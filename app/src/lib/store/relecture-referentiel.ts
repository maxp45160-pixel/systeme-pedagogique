import "server-only";

/**
 * La relecture du référentiel, assemblée côté serveur — ADR-108.
 *
 * ## Ce que ce module branche enfin
 *
 * `lib/engine/candidats-referentiel.ts` porte quatre détecteurs déterministes
 * depuis le 18/08/2026, et `chargerCandidatsReferentiel` n'était appelé **par
 * rien**. C'est le constat qui ouvre ADR-108 : quatre détecteurs tournaient dans
 * le vide faute de surface. Ce module les assemble avec les quatre genres du
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
import {
  declencheursDeclaresDepuis,
  type FamilleRelecture,
} from "./declencheurs-relecture";
import { detecterCandidats, type CandidatReferentiel } from "@/lib/engine/candidats-referentiel";
import {
  empreinteProposition,
  lotOuvert,
  relectureDueApresSignal,
  type ReferentielLu,
  type ContenuProposition,
  type PropositionReferentielRelue,
} from "@/lib/domain/propositions-referentiel";
import { competenceVoisine, domaineVoisin } from "@/lib/domain/doublons-proposition";
import { chemin as cheminHierarchie } from "@/lib/domain/hierarchie-domaines";
import { relireReferentiel, type EntreeRelecture } from "@/lib/tutor/relecture-referentiel";
import type { MoteurTuteur } from "@/lib/tutor/moteurs";
import type { Contexte } from "./context";
import type { DomaineId } from "@/lib/domain/types";
import { franchissementsMaitriseCourants } from "@/lib/engine/historique";

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
  return {
    domaines: ctx.referentiel.domaines,
    competences: ctx.referentiel.skills,
    maitrisees: [...ctx.maitrises.values()].filter((m) => m.maitrisee).map((m) => m.code),
    intentions: {
      moyenTerme: ctx.donnees.user.objectifMoyenTerme,
      longTerme: ctx.donnees.user.objectifLongTerme,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Le lot lisible — sans appeler le tuteur                             */
/* ------------------------------------------------------------------ */

export interface LotPropositions {
  propositions: PropositionReferentielRelue[];
  /**
   * Une des trois familles attend-elle sa prochaine analyse ?
   *
   * Une commande issue d'une proposition ne suffit jamais : elle ferait
   * grandir le référentiel à partir de sa propre croissance.
   */
  relectureDue: boolean;
  besoins: BesoinsRelecture;
  /** L'horodatage du lot le plus récent, `null` si aucun. */
  dernierLot: string | null;
}

export interface BesoinsRelecture {
  structure: { tuteur: boolean; deterministe: boolean };
  progression: {
    due: boolean;
    maitrisesNouvelles: Array<{ code: string; intitule: string; franchiLe: string }>;
    intentionsNouvelles: Array<"moyen" | "long">;
  };
  maintenance: boolean;
}

function candidatsDuContexte(ctx: Contexte) {
  return detecterCandidats({
    referentiel: ctx.referentiel,
    etats: ctx.etats,
    observations: ctx.observationsEffectives,
    exercices: ctx.donnees.exercises,
    tentatives: ctx.donnees.attempts,
    seances: ctx.donnees.sessions.map((s) => ({ date: s.date, skillCodes: s.skillCodes })),
    now: ctx.now,
  });
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
  const [enregistrees, derniereStructure, derniereProgression, derniereMaintenance] = await Promise.all([
    chargerPropositions(),
    derniereRelecture("structure"),
    derniereRelecture("progression"),
    derniereRelecture("maintenance"),
  ]);
  const ouvertes = lotOuvert(enregistrees, referentielLu(ctx), ctx.now);
  const [signauxStructure, signauxProgression] = await Promise.all([
    declencheursDeclaresDepuis("structure", derniereStructure?.creeLe ?? null),
    declencheursDeclaresDepuis("progression", derniereProgression?.creeLe ?? null),
  ]);

  const candidats = candidatsDuContexte(ctx);
  const dernierSignalStructure = signauxStructure.map((s) => s.creeLe).sort().at(-1) ?? null;
  const derniereObservation = ctx.observationsEffectives.map((o) => o.date).sort().at(-1) ?? null;
  const derniereObservationParCode = new Map<string, string>();
  for (const observation of ctx.observationsEffectives) {
    const precedente = derniereObservationParCode.get(observation.skillCode);
    if (!precedente || observation.date > precedente) {
      derniereObservationParCode.set(observation.skillCode, observation.date);
    }
  }
  const inedite = (candidat: CandidatReferentiel) => {
    const empreinte = empreinteProposition(contenuDuCandidat(candidat));
    const memes = enregistrees.filter((p) => p.empreinte === empreinte);
    if (memes.length === 0) return true;
    if (memes.some((p) => p.arbitrage === null)) return false;
    const refus = memes
      .filter((p) => p.arbitrage?.decision === "refusee")
      .map((p) => p.arbitrage!.date)
      .sort()
      .at(-1);
    if (!refus) return false;
    const horizon = candidat.genre === "dormance"
      ? (derniereObservationParCode.get(candidat.code) ?? null)
      : [dernierSignalStructure, derniereObservation]
          .filter((date): date is string => date !== null)
          .sort()
          .at(-1) ?? null;
    return horizon !== null && horizon > refus;
  };
  const structureDeterministe = [
    ...candidats.aretes,
    ...candidats.rangements,
    ...candidats.reformulations,
  ].some(inedite);
  const maintenance = candidats.dormances.some(inedite);

  const passages = franchissementsMaitriseCourants(
    ctx.observationsEffectives,
    ctx.referentiel.parCode,
    ctx.now,
  );
  const maitrisesNouvelles = passages.filter((passage) =>
    relectureDueApresSignal(passage.franchiLe, derniereProgression?.creeLe ?? null),
  );
  const intentionsNouvelles = [...new Set(signauxProgression.flatMap((signal) =>
    signal.cause === "intention_moyen"
      ? ["moyen" as const]
      : signal.cause === "intention_long"
        ? ["long" as const]
        : [],
  ))];

  const besoins: BesoinsRelecture = {
    structure: { tuteur: signauxStructure.length > 0, deterministe: structureDeterministe },
    progression: {
      due: maitrisesNouvelles.length > 0 || intentionsNouvelles.length > 0,
      maitrisesNouvelles,
      intentionsNouvelles,
    },
    maintenance,
  };
  const relectureDue =
    besoins.structure.tuteur ||
    besoins.structure.deterministe ||
    besoins.progression.due ||
    besoins.maintenance;
  const dernierLot = [derniereStructure, derniereProgression, derniereMaintenance]
    .map((r) => r?.creeLe ?? null)
    .filter((date): date is string => date !== null)
    .sort()
    .at(-1) ?? null;

  return { propositions: ouvertes, relectureDue, besoins, dernierLot };
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
  selection: {
    familles: Array<"structure" | "progression">;
    maitrisesNouvelles: Array<{ code: string; intitule: string; franchiLe: string }>;
    intentionsNouvelles: Array<"moyen" | "long">;
  } = { familles: ["structure", "progression"], maitrisesNouvelles: [], intentionsNouvelles: [] },
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
    familles: selection.familles,
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
    maitrisesNouvelles: selection.maitrisesNouvelles,
    intentionsNouvelles: selection.intentionsNouvelles,
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
  /**
   * Combien ont été écartées parce qu'elles redisaient ce qui existe déjà.
   *
   * Compté à part de `ecartees` : « tu me l'as déjà proposé » et « ça existe
   * déjà au référentiel » sont deux constats différents, et confondre les deux
   * masquerait une dérive du tuteur derrière la mémoire des refus.
   */
  doublons: number;
  /** Ce qui a empêché le tuteur de contribuer. Les détecteurs, eux, aboutissent toujours. */
  erreurTuteur: string | null;
  famillesAnalysees: FamilleRelecture[];
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
  options: { elargissementActif: boolean; besoins: BesoinsRelecture; signal?: AbortSignal },
): Promise<ResultatProductionLot> {
  const ctx = await chargerContexte();
  const enregistrees = await chargerPropositions();
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
  let doublons = 0;

  /*
   * Ce que le référentiel porte DÉJÀ, pour ne pas le proposer une seconde fois.
   *
   * Le 24/08/2026, la relecture a proposé « Résilience et optimisation des
   * réseaux logistiques » alors que « Résilience logistique » existait. Les
   * contrôles du dépôt n'ont rien vu : ils comparent des noms exacts, et ils ne
   * jouent qu'à l'ÉCRITURE — la carte s'affichait, et n'aurait échoué qu'au
   * clic. Le contrôle est donc remonté ici, avant l'enregistrement du lot.
   *
   * Il ne couvre que les deux genres qui CRÉENT : `scission` fabrique un
   * domaine, `manque` fabrique une compétence. `relation` et `rattachement`
   * désignent l'existant et n'ont rien à dédoublonner.
   */
  const domainesVivants = ctx.referentiel.domaines
    .filter((domaine) => !domaine.archive)
    .map((domaine) => ({ id: domaine.id, nom: domaine.nom }));
  const competencesVivantes = ctx.referentiel.actifs.map((skill) => ({
    code: skill.code,
    intitule: skill.intitule,
  }));

  const ajouter = (
    contenu: ContenuProposition,
    motifs: string[],
    domaineId: DomaineId | null,
    domainesLus: readonly (DomaineId | null)[],
  ) => {
    const empreinte = empreinteProposition(contenu);
    if (dejaOuvertes.has(empreinte)) {
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

  const famillesAnalysees: FamilleRelecture[] = [];

  /* --- 1. Les détecteurs déterministes des seules familles dues --- */

  const candidats = candidatsDuContexte(ctx);

  const candidatsDus: CandidatReferentiel[] = [
    ...(options.besoins.structure.deterministe
      ? [...candidats.aretes, ...candidats.rangements, ...candidats.reformulations]
      : []),
    ...(options.besoins.maintenance ? candidats.dormances : []),
  ];
  for (const candidat of candidatsDus) {
    const domaineId = domaineDuCandidat(candidat, ctx);
    ajouter(contenuDuCandidat(candidat), candidat.motifs, domaineId, [domaineId]);
  }
  if (options.besoins.maintenance) famillesAnalysees.push("maintenance");

  /* --- 2. Les genres du tuteur, filtrés par famille --- */

  let erreurTuteur: string | null = null;

  const famillesTuteur: Array<"structure" | "progression"> = [];
  if (options.besoins.structure.tuteur) famillesTuteur.push("structure");
  if (options.besoins.progression.due) famillesTuteur.push("progression");

  if (moteur && famillesTuteur.length > 0) {
    const resultat = await relireReferentiel(
      moteur,
      composerEntreeRelecture(ctx, options.elargissementActif, {
        familles: famillesTuteur,
        maitrisesNouvelles: options.besoins.progression.maitrisesNouvelles,
        intentionsNouvelles: options.besoins.progression.intentionsNouvelles,
      }),
      options.signal,
    );
    erreurTuteur = resultat.erreur;
    if (resultat.erreur === null) famillesAnalysees.push(...famillesTuteur);

    for (const scission of resultat.lot.scissions) {
      const dejaLa = domaineVoisin(scission.nom, domainesVivants);
      if (dejaLa) {
        doublons += 1;
        continue;
      }
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
      const sourceProgression = relation.sourceProgression?.type === "maitrise"
        ? { type: "maitrise" as const, code: relation.sourceProgression.codeExistant }
        : relation.sourceProgression?.type === "intention"
          ? {
              type: "intention" as const,
              portee: relation.sourceProgression.portee,
              valeurLue: relation.sourceProgression.portee === "moyen"
                ? ctx.donnees.user.objectifMoyenTerme
                : ctx.donnees.user.objectifLongTerme,
            }
          : undefined;
      ajouter(
        {
          genre: "relation",
          amont: designee(relation.amont),
          aval: designee(relation.aval),
          ...(sourceProgression ? { sourceProgression } : {}),
        },
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
      const dejaLa = competenceVoisine(manque.intitule, competencesVivantes);
      if (dejaLa) {
        doublons += 1;
        continue;
      }
      ajouter(
        {
          genre: "manque",
          domaineId: manque.domaineId,
          intitule: manque.intitule,
          palier: manque.palier,
          ancrage: manque.ancrage,
          sourceProgression: manque.sourceProgression.type === "maitrise"
            ? { type: "maitrise", code: manque.sourceProgression.codeExistant }
            : {
                type: "intention",
                portee: manque.sourceProgression.portee,
                valeurLue: manque.sourceProgression.portee === "moyen"
                  ? ctx.donnees.user.objectifMoyenTerme
                  : ctx.donnees.user.objectifLongTerme,
              },
        },
        [manque.ancrage, manque.justification],
        manque.domaineId,
        [manque.domaineId],
      );
    }
  } else if (famillesTuteur.length > 0) {
    erreurTuteur = "Aucun moteur de tuteur disponible : seules les propositions calculées sont là.";
  }

  if (
    options.besoins.structure.deterministe &&
    !options.besoins.structure.tuteur &&
    !famillesAnalysees.includes("structure")
  ) {
    famillesAnalysees.push("structure");
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
  if (famillesAnalysees.length > 0) {
    await inscrireRelecture(lotId, versions, aEcrire.length, [...new Set(famillesAnalysees)]);
  }

  return {
    lotId,
    enregistrees: aEcrire.length,
    ecartees,
    doublons,
    erreurTuteur,
    famillesAnalysees: [...new Set(famillesAnalysees)],
  };
}
