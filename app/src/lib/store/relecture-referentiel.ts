import "server-only";

/**
 * La relecture du référentiel, assemblée côté serveur — ADR-108.
 *
 * ## Ce que ce module branche enfin
 *
 * `lib/engine/candidats-referentiel.ts` porte quatre détecteurs déterministes
 * depuis le 18/08/2026, et `chargerCandidatsReferentiel` n'était appelé **par
 * rien**. C'est le constat qui ouvre ADR-108 : quatre détecteurs tournaient dans
 * le vide faute de surface. Ce module les assemble avec les trois genres du
 * tuteur en un lot unique, et l'écran des propositions le consomme.
 *
 * Les détecteurs ne sont pas réécrits. Ils gardent leur place et leur priorité :
 * ce qu'un calcul explique en une phrase n'a pas à être demandé à un modèle, et
 * un lot les met devant.
 *
 * ## Hors du chemin d'écriture
 *
 * Rien ici n'est appelé depuis une commande de référentiel. Une création de
 * compétence ne doit jamais échouer parce qu'un fournisseur de modèle a mis
 * quatre secondes — c'est un refus explicite d'ADR-108, et c'est pour cela que
 * la relecture vit dans sa propre route (`POST /api/referentiel/relecture`) et
 * dans son propre module.
 *
 * ## Ce qui n'est pas produit
 *
 * Aucune mesure. Le tuteur ne reçoit ni score, ni niveau, ni maîtrise (P5) — il
 * reçoit des intitulés, un arbre, des relations déclarées, ce qui a été mobilisé
 * et les deux phrases du profil. Il ne lit pas un parcours pour proposer un
 * rangement.
 */

import { randomUUID } from "node:crypto";

import { cache } from "react";

import { chargerContexte } from "./context";
import {
  chargerPropositions,
  derniereRelecture,
  enregistrerLot,
  inscrireRelecture,
  type PropositionAEnregistrer,
} from "./propositions-referentiel";
import { detecterCandidats, type CandidatReferentiel } from "@/lib/engine/candidats-referentiel";
import {
  empreinteProposition,
  empreintesRefusees,
  estPerimee,
  lotOuvert,
  type ReferentielLu,
  versionsCourantes,
  type ContenuProposition,
  type PropositionReferentielRelue,
} from "@/lib/domain/propositions-referentiel";
import { chemin as cheminHierarchie } from "@/lib/domain/hierarchie-domaines";
import { relireReferentiel, type EntreeRelecture } from "@/lib/tutor/relecture-referentiel";
import type { MoteurTuteur } from "@/lib/tutor/moteurs";
import type { Contexte } from "./context";
import type { DomaineId } from "@/lib/domain/types";

/**
 * Combien de compétences récemment mobilisées le tuteur reçoit.
 *
 * Un plafond de **prompt**, pas un seuil de déclenchement : ADR-108 écarte le
 * seuil de taille, et rien ici ne décide quoi que ce soit à partir de ce nombre.
 * Il borne ce qu'on envoie, pour la même raison que `MAX_TAGS_PROPOSES` borne ce
 * qu'on affiche.
 *
 * Aucune fenêtre en jours n'est employée, délibérément : « les N dernières
 * compétences observées » est un ORDRE, pas un seuil, et n'oblige à inventer
 * aucune durée qu'aucune donnée ne justifie.
 */
const TRAVAIL_RECENT_MAX = 12;

/**
 * Le référentiel sous la forme que l'applicabilité attend.
 *
 * `Referentiel` nomme ses compétences `skills`, `ReferentielLu` les nomme
 * `competences` : une seule traduction, ici, plutôt qu'à chaque appel.
 */
function referentielLu(ctx: Contexte): ReferentielLu {
  return { domaines: ctx.referentiel.domaines, competences: ctx.referentiel.skills };
}

/* ------------------------------------------------------------------ */
/* Le lot lisible — sans appeler le tuteur                             */
/* ------------------------------------------------------------------ */

export interface LotPropositions {
  propositions: PropositionReferentielRelue[];
  /**
   * La relecture est-elle périmée ? Vrai quand une version a bougé depuis le
   * dernier lot, ou qu'aucun lot n'a jamais été produit.
   *
   * C'est le déclencheur d'ADR-108 : la péremption, jamais un nombre. Il est
   * **dérivé** — comparer les versions lues aux versions courantes — et ne
   * s'écrit nulle part.
   */
  relectureDue: boolean;
  /** L'horodatage du lot le plus récent, `null` si aucun. */
  dernierLot: string | null;
}

/**
 * Ce qu'il y a à montrer aujourd'hui, sans rien produire de neuf.
 *
 * Lecture pure : aucun appel de modèle, aucune écriture. C'est ce que la page
 * des propositions et la pastille du rail appellent, et c'est ce qui rend
 * l'affichage indépendant de la disponibilité du fournisseur.
 *
 * Mémoïsée par requête (`cache`) : depuis le 24/08/2026 le rail la lit sur
 * CHAQUE page, et la page des propositions la relit derrière. Sans mémoïsation,
 * la même lecture partirait deux fois par rendu.
 */
export const chargerLotPropositions = cache(async (): Promise<LotPropositions> => {
  const ctx = await chargerContexte();
  const [enregistrees, derniere] = await Promise.all([
    chargerPropositions(),
    derniereRelecture(),
  ]);
  const versions = versionsCourantes(ctx.referentiel.domaines);
  const ouvertes = lotOuvert(enregistrees, referentielLu(ctx), ctx.now);

  /*
   * « Due » se lit sur la dernière RELECTURE, pas sur la vacuité du lot.
   *
   * Le raccourci tentant — « aucune proposition ouverte, donc à relire » — se
   * retourne dès qu'un lot n'a RIEN à proposer, ce qui est le cas normal d'un
   * référentiel bien rangé : le lot vide n'écrit aucune ligne, « à relire »
   * reste vrai indéfiniment, et la relecture repart à chaque ouverture de
   * l'Atelier pour rappeler le modèle et ne rien produire.
   *
   * `relectures_referentiel` enregistre le fait qu'une relecture a eu lieu,
   * précisément pour qu'un lot vide soit une réponse et non une absence. Le
   * déclencheur reste celui d'ADR-108 : la péremption d'une version de
   * domaine, jamais un seuil de taille.
   */
  const relectureDue =
    derniere === null || estPerimee({ versionsLues: derniere.versionsLues }, versions);

  return { propositions: ouvertes, relectureDue, dernierLot: derniere?.creeLe ?? null };
});

/* ------------------------------------------------------------------ */
/* Les quatre détecteurs → des propositions                            */
/* ------------------------------------------------------------------ */

/**
 * Le domaine sur lequel porte un candidat déterministe.
 *
 * `null` quand il n'en vise aucun en particulier — une arête relie deux
 * compétences qui peuvent vivre ailleurs l'une de l'autre.
 */
function domaineDuCandidat(
  candidat: CandidatReferentiel,
  ctx: Contexte,
): DomaineId | null {
  switch (candidat.genre) {
    case "arete":
      return null;
    case "dormance":
    case "reformulation":
      return ctx.referentiel.parCode.get(candidat.code)?.domaine ?? null;
    case "rangement":
      return candidat.domaineObserve;
  }
}

function contenuDuCandidat(candidat: CandidatReferentiel): ContenuProposition {
  switch (candidat.genre) {
    case "arete":
      return {
        genre: "arete",
        amont: candidat.amont,
        aval: candidat.aval,
        force: candidat.force,
        source: candidat.source,
      };
    case "dormance":
      return {
        genre: "dormance",
        code: candidat.code,
        joursSansRien: candidat.joursSansRien,
      };
    case "reformulation":
      return {
        genre: "reformulation",
        code: candidat.code,
        intitule: candidat.intitule,
        regles: candidat.regles,
        aDesObservations: candidat.aDesObservations,
      };
    case "rangement":
      return {
        genre: "rangement",
        code: candidat.code,
        domaineActuel: candidat.domaineActuel,
        domaineObserve: candidat.domaineObserve,
        observations: candidat.observations,
      };
  }
}

/* ------------------------------------------------------------------ */
/* Ce que le tuteur reçoit                                             */
/* ------------------------------------------------------------------ */

/**
 * Le référentiel tel que le tuteur le lit.
 *
 * Exporté pour être testable sans moteur : c'est ici que se joue l'interdit de
 * P5 — si une mesure entrait dans le prompt, elle entrerait par cette fonction.
 */
export function composerEntreeRelecture(
  ctx: Contexte,
  elargissementActif: boolean,
): EntreeRelecture {
  const vivants = ctx.referentiel.domaines.filter((domaine) => !domaine.archive);

  const domaines = vivants.map((domaine) => ({
    id: domaine.id,
    chemin: cheminHierarchie(ctx.referentiel.domaines, domaine.id)
      .map((etape) => etape.nom)
      .join(" › "),
    description: domaine.description,
    // Les tags DÉCLARÉS, jamais les hérités : on relit ce qui est écrit, et
    // faire remonter les compétences des enfants dans chaque parent gonflerait
    // le prompt d'autant de copies qu'il y a de niveaux.
    competences: ctx.referentiel.actifs
      .filter((skill) => (skill.tagsDomaine ?? []).includes(domaine.id))
      .map((skill) => ({ code: skill.code, intitule: skill.intitule, palier: skill.palier })),
  }));

  const aClasser = ctx.referentiel.actifs
    .filter((skill) => (skill.tagsDomaine ?? []).length === 0)
    .map((skill) => ({ code: skill.code, intitule: skill.intitule, palier: skill.palier }));

  const relationsDeclarees = ctx.referentiel.actifs.flatMap((skill) =>
    skill.prerequis.map((amont) => ({ amont, aval: skill.code })),
  );

  /*
   * Le travail récent : les dernières compétences observées, dans l'ordre où
   * elles l'ont été. Un ordre, pas une fenêtre — aucune durée à inventer.
   *
   * `mobilisations` compte les observations de la compétence. C'est un fait
   * (« combien de fois elle a été mise en jeu »), jamais une mesure de niveau :
   * ni résultat, ni autonomie, ni qualité ne quittent le serveur.
   */
  const parRecence = [...ctx.observationsEffectives].sort((a, b) =>
    b.date.localeCompare(a.date),
  );
  const mobilisations = new Map<string, number>();
  for (const observation of parRecence) {
    mobilisations.set(observation.skillCode, (mobilisations.get(observation.skillCode) ?? 0) + 1);
  }
  const travailRecent: { code: string; intitule: string; mobilisations: number }[] = [];
  const vus = new Set<string>();
  for (const observation of parRecence) {
    if (travailRecent.length >= TRAVAIL_RECENT_MAX) break;
    if (vus.has(observation.skillCode)) continue;
    const skill = ctx.referentiel.parCode.get(observation.skillCode);
    if (!skill || skill.archive) continue;
    vus.add(observation.skillCode);
    travailRecent.push({
      code: skill.code,
      intitule: skill.intitule,
      mobilisations: mobilisations.get(skill.code) ?? 0,
    });
  }

  return {
    domaines,
    aClasser,
    relationsDeclarees,
    travailRecent,
    // VERBATIM. Aucune extraction, aucune structure : ADR-096 a retiré les
    // objectifs structurés le 21/08, et ils ne reviennent pas par cette porte.
    intentions: {
      moyenTerme: ctx.donnees.user.objectifMoyenTerme,
      longTerme: ctx.donnees.user.objectifLongTerme,
    },
    elargissementActif,
  };
}

/* ------------------------------------------------------------------ */
/* Produire un lot                                                     */
/* ------------------------------------------------------------------ */

export interface ResultatProductionLot {
  lotId: string;
  /** Combien de propositions ont été enregistrées, tous genres confondus. */
  enregistrees: number;
  /** Combien ont été écartées parce que déjà refusées, ou déjà proposées. */
  ecartees: number;
  /** Ce qui a empêché le tuteur de contribuer. Les détecteurs, eux, aboutissent toujours. */
  erreurTuteur: string | null;
}

/**
 * Produit et enregistre un lot.
 *
 * Le moteur est **facultatif**. Sans lui, ou s'il échoue, le lot est celui des
 * quatre détecteurs déterministes seuls — ce qui reste un lot utile, et ce qui
 * garantit qu'une panne de fournisseur ne rend pas l'écran vide. C'est la même
 * dégradation que partout ailleurs dans le dépôt : le tuteur enrichit, il ne
 * conditionne pas.
 *
 * Les empreintes déjà refusées sont écartées AVANT l'écriture, pas à
 * l'affichage. Les deux existent : `lotOuvert` refiltre à la lecture, parce
 * qu'un refus peut tomber entre la production d'un lot et sa consultation.
 */
export async function produireLot(
  moteur: MoteurTuteur | null,
  options: { elargissementActif: boolean; signal?: AbortSignal },
): Promise<ResultatProductionLot> {
  const ctx = await chargerContexte();
  const enregistrees = await chargerPropositions();
  const refusees = empreintesRefusees(enregistrees);
  const dejaOuvertes = new Set(
    lotOuvert(enregistrees, referentielLu(ctx), ctx.now).map((p) => p.empreinte),
  );

  const versions = Object.fromEntries(
    ctx.referentiel.domaines.map((domaine) => [domaine.id, domaine.version]),
  );
  /**
   * Les versions attachées à une proposition : celles des domaines qu'elle
   * NOMME, pas celles de tout le référentiel.
   *
   * Attacher les seize versions à chaque proposition les périmerait toutes au
   * premier geste sur n'importe quel domaine — l'écran se viderait à chaque
   * ajout de compétence, et la relecture ne servirait plus à rien.
   */
  const versionsDe = (domaineIds: readonly (DomaineId | null)[]): Record<DomaineId, number> => {
    const retenues: Record<DomaineId, number> = {};
    for (const id of domaineIds) {
      if (id && id in versions) retenues[id] = versions[id];
    }
    return retenues;
  };

  const aEcrire: PropositionAEnregistrer[] = [];
  let ecartees = 0;

  const ajouter = (
    contenu: ContenuProposition,
    motifs: string[],
    domaineId: DomaineId | null,
    domainesLus: readonly (DomaineId | null)[],
  ) => {
    const empreinte = empreinteProposition(contenu);
    if (refusees.has(empreinte) || dejaOuvertes.has(empreinte)) {
      ecartees += 1;
      return;
    }
    dejaOuvertes.add(empreinte);
    aEcrire.push({
      id: randomUUID(),
      genre: contenu.genre,
      domaineId,
      empreinte,
      versionsLues: versionsDe(domainesLus),
      contenu,
      motifs,
    });
  };

  /* --- 1. Les quatre détecteurs déterministes, inchangés --- */

  const candidats = detecterCandidats({
    referentiel: ctx.referentiel,
    etats: ctx.etats,
    observations: ctx.observationsEffectives,
    exercices: ctx.donnees.exercises,
    tentatives: ctx.donnees.attempts,
    seances: ctx.donnees.sessions.map((s) => ({ date: s.date, skillCodes: s.skillCodes })),
    now: ctx.now,
  });

  for (const candidat of [
    ...candidats.aretes,
    ...candidats.rangements,
    ...candidats.reformulations,
    ...candidats.dormances,
  ] as CandidatReferentiel[]) {
    const domaineId = domaineDuCandidat(candidat, ctx);
    ajouter(contenuDuCandidat(candidat), candidat.motifs, domaineId, [domaineId]);
  }

  /* --- 2. Les trois genres du tuteur --- */

  let erreurTuteur: string | null = null;

  if (moteur) {
    const resultat = await relireReferentiel(
      moteur,
      composerEntreeRelecture(ctx, options.elargissementActif),
      options.signal,
    );
    erreurTuteur = resultat.erreur;

    for (const scission of resultat.lot.scissions) {
      ajouter(
        {
          genre: "scission",
          parentId: scission.parentId,
          nom: scission.nom,
          description: scission.description,
          codes: scission.codes,
        },
        [scission.justification],
        scission.parentId,
        [scission.parentId],
      );
    }

    for (const relation of resultat.lot.relations) {
      /*
       * `codeExistant` (vocabulaire de l'outil, qui insiste sur le fait que le
       * tuteur DÉSIGNE au lieu de frapper) devient `code` (vocabulaire du
       * domaine). Deux noms pour deux couches, et la traduction se fait ici,
       * une fois — pas dans chaque lecteur.
       */
      const designee = (c: { codeExistant?: string; intitule: string; palier: string }) => ({
        ...(c.codeExistant ? { code: c.codeExistant } : {}),
        intitule: c.intitule,
        palier: c.palier,
      });
      const domaines = [relation.amont.codeExistant, relation.aval.codeExistant].map((code) =>
        code ? (ctx.referentiel.parCode.get(code)?.domaine ?? null) : null,
      );
      ajouter(
        { genre: "relation", amont: designee(relation.amont), aval: designee(relation.aval) },
        [relation.justification],
        domaines.find((d) => d !== null) ?? null,
        domaines,
      );
    }

    /*
     * Le rattachement porte sur le domaine visé — c'est lui qui change de
     * contenu. La compétence, elle, ne bouge pas : son namespace de création
     * et ses autres tags restent intacts (ADR-107).
     */
    for (const rattachement of resultat.lot.rattachements) {
      ajouter(
        {
          genre: "rattachement",
          code: rattachement.codeExistant,
          domaineId: rattachement.domaineId,
        },
        [rattachement.justification],
        rattachement.domaineId,
        [rattachement.domaineId],
      );
    }

    for (const manque of resultat.lot.manques) {
      ajouter(
        {
          genre: "manque",
          domaineId: manque.domaineId,
          intitule: manque.intitule,
          palier: manque.palier,
          ancrage: manque.ancrage,
        },
        [manque.ancrage, manque.justification],
        manque.domaineId,
        [manque.domaineId],
      );
    }
  } else {
    erreurTuteur = "Aucun moteur de tuteur disponible : seules les propositions calculées sont là.";
  }

  const lotId = randomUUID();
  await enregistrerLot(lotId, aEcrire);
  /*
   * La trace est écrite MÊME quand le lot est vide, et c'est tout son objet :
   * « rien à proposer » est une réponse, et sans cette ligne elle serait
   * indiscernable de « pas encore relu ». L'instantané porté est celui du
   * référentiel ENTIER — c'est bien tout le référentiel qui vient d'être relu,
   * quand bien même chaque proposition ne retient que les versions des
   * domaines qu'elle nomme.
   */
  await inscrireRelecture(lotId, versions, aEcrire.length);

  return { lotId, enregistrees: aEcrire.length, ecartees, erreurTuteur };
}
