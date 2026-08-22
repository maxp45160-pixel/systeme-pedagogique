"use server";

/**
 * Façade serveur des commandes de référentiel.
 *
 * Toutes les mutations passent par `appliquer_commande_referentiel` : une
 * commande, une transaction, une version d'agrégat et une entrée de journal.
 * Les fonctions exportées restent adaptées aux gestes de l'interface ; elles
 * ne contiennent plus de SQL métier concurrent.
 */

import { revalidatePath } from "next/cache";

import { dorsaleCompte } from "./db";
import { verifier } from "./supabase-backend";
import { lireReferentiel } from "./referentiel";
import {
  nouvelIdCommande,
  preparerCreationDomaine,
  preparerRevisionDomaine,
  type CompetenceDejaAuReferentiel,
  type CommandeReferentiel,
  type EnveloppeCommandeReferentiel,
  type ResultatCommandeReferentiel,
} from "@/lib/domain/gouvernance-referentiel";
import { competenceHomonyme } from "@/lib/domain/referentiel-compte";
import type {
  OrigineRattachementCarte,
  OrigineReferentiel,
  Palier,
  Referentiel,
} from "@/lib/domain/types";
import { VERSION_CARTE, estNoeudCarteValide } from "@/lib/domain/carte-savoirs";

async function executerCommande(
  commande: CommandeReferentiel,
  referentiel: Referentiel,
  origine: OrigineReferentiel,
  motif: string,
): Promise<ResultatCommandeReferentiel> {
  const dorsale = await dorsaleCompte();
  const domaineId = commande.type === "creer_domaine" ? commande.domaine.id : commande.domaineId;
  const enveloppe: EnveloppeCommandeReferentiel = {
    requestId: nouvelIdCommande(),
    expectedVersion: commande.type === "creer_domaine" ? null : referentiel.domainesParId.get(domaineId)?.version ?? null,
    origine,
    motif: motif.trim() || "Modification validée du référentiel",
    commande,
  };
  const { data, error } = await dorsale.supabase.rpc("appliquer_commande_referentiel", {
    p_request_id: enveloppe.requestId,
    p_expected_version: enveloppe.expectedVersion,
    p_origine: enveloppe.origine,
    p_motif: enveloppe.motif,
    p_commande: enveloppe.commande,
  });
  verifier("commande de référentiel", error);
  revalidatePath("/", "layout");
  return data as ResultatCommandeReferentiel;
}

export interface SoumissionBranche {
  domaine: string;
  prefixe: string;
  description: string;
  competences: Array<{ intitule: string; palier: string; importance: string; prerequis?: string[] }>;
  origine?: OrigineReferentiel;
}

export interface ResultatBranche {
  domaineId: string;
  domaineCree: boolean;
  codes: string[];
  /**
   * Compétences proposées que le référentiel portait déjà. Aucune n'a été
   * recréée sous un second code ; celles qui venaient d'un autre domaine ont
   * été **rattachées** à celui-ci. L'écran doit le dire : la personne les a
   * demandées, elle doit savoir sous quelle forme elle les a obtenues.
   */
  dejaAuReferentiel: CompetenceDejaAuReferentiel[];
}

export async function creerBranche(soumission: SoumissionBranche): Promise<ResultatBranche> {
  const dorsale = await dorsaleCompte();
  const referentiel = await lireReferentiel(dorsale);
  const origine = soumission.origine ?? "tuteur";
  const { commande, dejaAuReferentiel } = preparerCreationDomaine({ ...soumission, origine }, referentiel);

  /*
   * Sans commande, il n'y avait rien de neuf à écrire : toutes les compétences
   * demandées existaient déjà. Le domaine, lui, existe forcément — une création
   * sans compétence propre a été refusée en amont.
   */
  const resultat = commande
    ? await executerCommande(commande, referentiel, origine, "Branche relue et validée")
    : null;
  const domaineId =
    resultat?.domaineId ??
    referentiel.domaines.find(
      (d) => d.nom.toLocaleLowerCase("fr-FR") === soumission.domaine.trim().toLocaleLowerCase("fr-FR"),
    )?.id;
  if (!domaineId) throw new Error(`Domaine introuvable : ${soumission.domaine}`);

  await rattacherAutomatiquement(domaineId, dejaAuReferentiel);
  return {
    domaineId,
    domaineCree: commande?.type === "creer_domaine",
    codes: resultat?.codes ?? resultat?.ajoutees ?? [],
    dejaAuReferentiel,
  };
}

/**
 * Rattache ce que la personne a demandé et qui existait déjà ailleurs.
 *
 * Demander « Lire un tableau de données » dans Logistique, c'est demander que
 * ce savoir-faire y serve. Le système sait qu'il existe : le recréer
 * dédoublerait ses observations, et l'écarter en silence perdrait la demande. Il le
 * rattache donc, sans autre geste (ADR-081).
 *
 * L'échec du rattachement ne défait pas l'écriture qui précède : les
 * compétences neuves sont créées, et le message dira lesquelles n'ont pas pu
 * être rattachées. Défaire serait pire — on perdrait un travail réussi pour un
 * complément manqué.
 */
async function rattacherAutomatiquement(
  domaineId: string,
  dejaAuReferentiel: CompetenceDejaAuReferentiel[],
): Promise<void> {
  const codes = dejaAuReferentiel
    .filter((competence) => competence.aRattacher && competence.domaineId !== domaineId)
    .map(({ code }) => code);
  if (codes.length === 0) return;
  await rattacherCompetences(domaineId, codes, true);
}

export interface ResultatRattachement {
  domaineId: string;
  rattachees: string[];
  detachees: string[];
}

/**
 * Rattache des compétences d'autres domaines à celui-ci, ou les en détache.
 *
 * Le domaine porteur ne bouge pas : il garde le code et la gouvernance. Ce
 * geste ajoute une lecture — la compétence devient visible depuis ce domaine et
 * compte dans sa couverture (ADR-081). Aucun code n'est créé, aucune observation
 * n'est dupliquée.
 */
export async function rattacherCompetences(
  domaineId: string,
  codes: string[],
  rattache: boolean,
): Promise<ResultatRattachement> {
  const dorsale = await dorsaleCompte();
  const referentiel = await lireReferentiel(dorsale);
  const domaine = referentiel.domainesParId.get(domaineId);
  if (!domaine) throw new Error(`Domaine inconnu : ${domaineId}`);

  const demandes = [...new Set(codes)];
  for (const code of demandes) {
    const skill = referentiel.parCode.get(code);
    if (!skill) throw new Error(`Compétence inconnue : ${code}`);
    if (skill.domaine === domaineId) {
      throw new Error(`${code} est déjà portée par ${domaine.nom} : un rattachement ne se superpose pas au porteur.`);
    }
  }

  const { data, error } = await dorsale.supabase.rpc("rattacher_competences_domaine", {
    p_request_id: nouvelIdCommande(),
    p_expected_version: domaine.version ?? null,
    p_origine: "utilisateur",
    p_motif: rattache
      ? `Rattachement de ${demandes.join(", ")} à ${domaine.nom}`
      : `Détachement de ${demandes.join(", ")} de ${domaine.nom}`,
    p_domaine_id: domaineId,
    p_codes: demandes,
    p_rattache: rattache,
  });
  verifier("rattachement de compétences", error);
  revalidatePath("/", "layout");
  const resultat = data as { domaineId: string; rattachees?: string[]; detachees?: string[] };
  return {
    domaineId: resultat.domaineId,
    rattachees: resultat.rattachees ?? [],
    detachees: resultat.detachees ?? [],
  };
}

export interface ModificationCompetence {
  intitule?: string;
  palier?: Palier;
  importance?: number;
  prerequis?: string[];
  ordre?: number;
}

export async function modifierCompetence(code: string, champs: ModificationCompetence): Promise<void> {
  const dorsale = await dorsaleCompte();
  const referentiel = await lireReferentiel(dorsale);
  const skill = referentiel.parCode.get(code);
  if (!skill) throw new Error(`Compétence inconnue : ${code}`);
  const { commande } = preparerRevisionDomaine({
    domaineId: skill.domaine,
    ajouts: [],
    modifications: [{ code, ...champs }],
    retraits: [],
  }, referentiel, "utilisateur");
  // Une modification produit toujours une commande : elle ne passe pas par le
  // chemin des ajouts, seul à pouvoir n'avoir rien à écrire.
  if (!commande) throw new Error(`Rien à modifier pour ${code}.`);
  await executerCommande(commande, referentiel, "utilisateur", `Correction de formulation de ${code}`);
}

/**
 * Une arête de progression, dans un sens et un seul : `amont` est prérequis de `aval`.
 *
 * Le référentiel ne stocke que `competences.prerequis` : une « compétence
 * suivante » n'existe pas en base, c'est la même arête lue à l'envers. Déclarer
 * un prérequis P sur C, c'est `relier(P, C)` ; déclarer une suite N à C, c'est
 * `relier(C, N)`. Une seule implémentation pour les deux gestes, donc une seule
 * validation — l'ADR-027 vaut aussi pour les arêtes.
 *
 * Le sens inverse est refusé : deux compétences prérequis l'une de l'autre ne
 * décrivent aucun ordre d'apprentissage, et `validerCompetence` ne voit pas le
 * cycle puisqu'il n'examine qu'une compétence à la fois.
 */
export async function relierCompetences(amont: string, aval: string): Promise<void> {
  if (amont === aval) throw new Error("Une compétence ne peut pas être son propre prérequis.");
  const referentiel = await lireReferentiel(await dorsaleCompte());
  const skillAmont = referentiel.parCode.get(amont);
  const skillAval = referentiel.parCode.get(aval);
  if (!skillAmont) throw new Error(`Compétence inconnue : ${amont}`);
  if (!skillAval) throw new Error(`Compétence inconnue : ${aval}`);
  if (skillAmont.prerequis.includes(aval)) {
    throw new Error(
      `${aval} est déjà un prérequis de ${amont} : déclarer l'inverse fermerait la boucle.`,
    );
  }
  if (skillAval.prerequis.includes(amont)) return;
  await modifierCompetence(aval, { prerequis: [...skillAval.prerequis, amont] });
}

export interface RelationAAppliquer {
  /** La compétence lue, celle dont la fiche est ouverte. */
  code: string;
  sens: "prerequis" | "suivante";
  /** Le code que le tuteur a désigné, s'il en a désigné un. */
  codeExistant: string | null;
  intitule: string;
  palier: string;
  /** Le domaine où la compétence doit vivre si elle doit être créée. */
  domaineId: string | null;
}

export interface ResultatRelationAppliquee {
  /** Le code effectivement relié — existant ou fraîchement attribué. */
  codeRelie: string;
  /** `true` si la compétence n'existait pas et vient d'entrer au référentiel. */
  creee: boolean;
}

/**
 * Écrit une relation que le tuteur a proposée et que la personne a validée.
 *
 * Trois issues, dans cet ordre — c'est l'arbitrage qui empêche les domaines
 * d'enfler :
 *
 * 1. **le tuteur a désigné un code existant** ⇒ on relie, rien n'est créé ;
 * 2. **l'intitulé est celui d'une compétence déjà au référentiel**, quel que
 *    soit son domaine ⇒ on relie celle-là. `competenceHomonyme` cherche dans
 *    `referentiel.skills` entier, donc un prérequis de logistique qui existe
 *    déjà en mathématiques ne se recrée pas ;
 * 3. **elle n'existe pas** ⇒ elle est créée **dans le domaine que le tuteur a
 *    nommé**, pas dans celui de la fiche ouverte. Une compétence de maths va
 *    dans Maths ; l'arête traverse les domaines, ce que `prerequis` autorise
 *    déjà.
 *
 * Sans domaine plaçable, on refuse : ranger par défaut dans le domaine courant
 * est exactement le mécanisme qui produit les domaines immenses. Créer un
 * domaine reste une décision explicite, prise ailleurs.
 *
 * Une relation à la fois : une commande `reviser_domaine` ne porte qu'un
 * domaine, et une validation ligne à ligne n'a pas besoin de lots.
 */
export async function appliquerRelationProposee(
  relation: RelationAAppliquer,
): Promise<ResultatRelationAppliquee> {
  const intitule = relation.intitule.trim();
  if (!intitule) throw new Error("Une relation sans intitulé ne peut pas être écrite.");

  const referentiel = await lireReferentiel(await dorsaleCompte());
  if (!referentiel.parCode.has(relation.code)) {
    throw new Error(`Compétence inconnue : ${relation.code}`);
  }

  const designee =
    relation.codeExistant && referentiel.parCode.has(relation.codeExistant)
      ? relation.codeExistant
      : null;
  const homonyme = designee ? null : competenceHomonyme(intitule, referentiel);
  let codeRelie = designee ?? homonyme?.code ?? null;
  let creee = false;

  if (!codeRelie) {
    if (!relation.domaineId || !referentiel.domainesParId.has(relation.domaineId)) {
      throw new Error(
        `« ${intitule} » ne se rattache à aucun domaine existant. Crée le domaine d'abord, puis relance la proposition.`,
      );
    }
    const resultat = await appliquerRevision({
      domaineId: relation.domaineId,
      ajouts: [
        {
          intitule,
          palier: relation.palier,
          /*
           * Importance au milieu de l'échelle : le tuteur ne la propose pas, et
           * la déduire du voisinage serait fabriquer une mesure. Elle se règle
           * ensuite dans la révision du domaine.
           */
          importance: "0.5",
        },
      ],
      modifications: [],
      retraits: [],
    });
    /* Un intitulé déjà pris a été dévié vers `dejaAuReferentiel` sans rien créer. */
    codeRelie = resultat.ajoutes[0] ?? resultat.dejaAuReferentiel[0]?.code ?? null;
    creee = resultat.ajoutes.length > 0;
    if (!codeRelie) throw new Error(`La création de « ${intitule} » n'a rendu aucun code.`);
  }

  if (relation.sens === "prerequis") {
    await relierCompetences(codeRelie, relation.code);
  } else {
    await relierCompetences(relation.code, codeRelie);
  }

  return { codeRelie, creee };
}

/** Retire l'arête `amont → aval`. Voir `relierCompetences` pour le sens. */
export async function delierCompetences(amont: string, aval: string): Promise<void> {
  const referentiel = await lireReferentiel(await dorsaleCompte());
  const skillAval = referentiel.parCode.get(aval);
  if (!skillAval) throw new Error(`Compétence inconnue : ${aval}`);
  if (!skillAval.prerequis.includes(amont)) return;
  await modifierCompetence(aval, {
    prerequis: skillAval.prerequis.filter((code) => code !== amont),
  });
}

export interface SoumissionRevision {
  domaineId: string;
  domaine?: { nom?: string; description?: string; ordre?: number };
  ajouts: Array<{ intitule: string; palier: string; importance: string; prerequis?: string[] }>;
  modifications: Array<{ code: string; intitule?: string; palier?: string; importance?: string }>;
  retraits: string[];
}

export interface ResultatRevision {
  ajoutes: string[];
  modifiees: string[];
  supprimees: string[];
  archivees: string[];
  dejaAuReferentiel: CompetenceDejaAuReferentiel[];
}

export async function appliquerRevision(soumission: SoumissionRevision): Promise<ResultatRevision> {
  const dorsale = await dorsaleCompte();
  const referentiel = await lireReferentiel(dorsale);
  const { commande, dejaAuReferentiel } = preparerRevisionDomaine(soumission, referentiel, "tuteur");
  const resultat = commande
    ? await executerCommande(commande, referentiel, "tuteur", "Révision assistée relue et validée")
    : null;
  await rattacherAutomatiquement(soumission.domaineId, dejaAuReferentiel);
  return {
    ajoutes: resultat?.ajoutees ?? [],
    modifiees: resultat?.modifiees ?? [],
    supprimees: resultat?.supprimees ?? [],
    archivees: resultat?.archivees ?? [],
    dejaAuReferentiel,
  };
}

export interface CompetenceLisible {
  code: string;
  intitule: string;
  domaine: string;
  domaineNom: string;
}

/**
 * Le référentiel actif, réduit à ce qu'un écran a besoin de montrer.
 *
 * Une lecture, pas une commande — mais elle vit ici parce qu'un composant
 * client ne peut pas appeler `lireReferentiel` directement. Les modales qui
 * n'ont qu'un `compteId` (le parcours projet, ouvert depuis le `+` comme depuis
 * le tableau de bord) affichaient jusqu'ici le code brut d'une compétence,
 * faute de connaître son intitulé : « LOG-14 » ne dit pas ce qu'on va
 * travailler.
 */
export async function lireCompetencesActives(): Promise<CompetenceLisible[]> {
  const referentiel = await lireReferentiel();
  return referentiel.actifs.map((skill) => ({
    code: skill.code,
    intitule: skill.intitule,
    domaine: skill.domaine,
    domaineNom: referentiel.domainesParId.get(skill.domaine)?.nom ?? skill.domaine,
  }));
}

export async function archiverDomaine(domaineId: string): Promise<ResultatCommandeReferentiel> {
  const dorsale = await dorsaleCompte();
  const referentiel = await lireReferentiel(dorsale);
  if (!referentiel.domainesParId.has(domaineId)) throw new Error(`Domaine inconnu : ${domaineId}`);
  const resultat = await executerCommande({ type: "archiver_domaine", domaineId }, referentiel, "utilisateur", "Retrait validé du domaine");
  await dorsale.supabase
    .from("exercises")
    .update({ archive: true })
    .eq("user_id", dorsale.userId)
    .eq("domaine", domaineId);
  return resultat;
}

export async function restaurerDomaine(domaineId: string): Promise<void> {
  const dorsale = await dorsaleCompte();
  const referentiel = await lireReferentiel(dorsale);
  if (!referentiel.domainesParId.has(domaineId)) throw new Error(`Domaine inconnu : ${domaineId}`);
  await executerCommande({ type: "restaurer_domaine", domaineId }, referentiel, "utilisateur", "Restauration du domaine");
  await dorsale.supabase
    .from("exercises")
    .update({ archive: false })
    .eq("user_id", dorsale.userId)
    .eq("domaine", domaineId);
}

export interface ModificationProfil {
  formation?: string;
  objectifMoyenTerme?: string;
  objectifLongTerme?: string;
  preferencesPedagogiques?: string[];
}

export async function modifierProfil(champs: ModificationProfil): Promise<void> {
  const dorsale = await dorsaleCompte();
  const ligne: Record<string, unknown> = {};
  if (champs.formation !== undefined) ligne.formation = champs.formation.trim();
  if (champs.objectifMoyenTerme !== undefined) ligne.objectif_moyen_terme = champs.objectifMoyenTerme.trim();
  if (champs.objectifLongTerme !== undefined) ligne.objectif_long_terme = champs.objectifLongTerme.trim();
  if (champs.preferencesPedagogiques !== undefined) ligne.preferences_pedagogiques = champs.preferencesPedagogiques.map((preference) => preference.trim()).filter(Boolean);
  if (Object.keys(ligne).length === 0) return;
  const { error } = await dorsale.supabase.from("profiles").update(ligne).eq("id", dorsale.userId);
  verifier("modification du profil", error);
  revalidatePath("/", "layout");
}

/* ------------------------------------------------------------------ */
/* Classement sur la carte des savoirs                                 */
/* ------------------------------------------------------------------ */

/*
 * Pourquoi une RPC et non un `update` direct.
 *
 * `public.domaines` ne porte pas la politique uniforme `isolation_par_compte` :
 * elle porte `referentiel_commande_modification`, qui exige le drapeau
 * `app.referentiel_command`. Un `UPDATE` lancé depuis l'application ne
 * correspond donc à AUCUNE ligne — et PostgREST rend un succès, zéro ligne
 * modifiée, sans message. C'est ce qu'a fait la première version : le clic ne
 * produisait rien, silencieusement (constaté le 22/08/2026).
 *
 * `classer_domaine` est le chemin d'écriture étroit qui manquait : elle n'écrit
 * que les quatre colonnes de classement, sur le domaine du compte appelant, et
 * elle lève quand la ligne n'existe pas.
 *
 * Elle ne passe pas par `appliquer_commande_referentiel` : un classement ne
 * touche ni code, ni compétence, ni observation, et incrémenter `version`
 * ferait échouer sans raison toute commande concurrente ayant lu la version
 * d'avant.
 */

/**
 * Enregistre l'arbitrage d'une personne. Ce n'est jamais un calcul qui appelle
 * cette fonction : `origine` ne peut valoir que `tuteur` (proposition du tuteur
 * validée) ou `manuel` (choix de la personne, suggestion acceptée comprise).
 */
export async function rattacherDomaineACarte(
  domaineId: string,
  noeud: string,
  origine: OrigineRattachementCarte,
): Promise<void> {
  if (!estNoeudCarteValide(noeud)) {
    throw new Error(`Nœud de carte inconnu : ${noeud}`);
  }
  const dorsale = await dorsaleCompte();
  const { error } = await dorsale.supabase.rpc("classer_domaine", {
    p_domaine_id: domaineId,
    p_noeud: noeud,
    p_version: VERSION_CARTE,
    p_origine: origine,
  });
  verifier("classement du domaine", error);
  revalidatePath("/", "layout");
}

/** Retire le classement. Les quatre colonnes repartent ensemble, comme elles sont venues. */
export async function detacherDomaineDeCarte(domaineId: string): Promise<void> {
  const dorsale = await dorsaleCompte();
  const { error } = await dorsale.supabase.rpc("classer_domaine", {
    p_domaine_id: domaineId,
    p_noeud: null,
    p_version: null,
    p_origine: null,
  });
  verifier("retrait du classement", error);
  revalidatePath("/", "layout");
}
