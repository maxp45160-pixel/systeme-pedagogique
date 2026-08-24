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
import {
  competenceHomonyme,
  prefixesDistincts,
  slugifier,
  validerDomaine,
} from "@/lib/domain/referentiel-compte";
import { parenteCirculaire } from "@/lib/domain/hierarchie-domaines";
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
 * Tague ce que la personne a demandé et qui existait déjà ailleurs.
 *
 * Demander « Lire un tableau de données » dans Logistique, c'est demander que
 * ce savoir-faire y serve. Le système sait qu'il existe : le recréer
 * dédoublerait ses observations, et l'écarter en silence perdrait la demande.
 * Il pose donc le tag, sans autre geste (ADR-107).
 *
 * L'échec du tag ne défait pas l'écriture qui précède : les compétences neuves
 * sont créées, et le message dira lesquelles n'ont pas pu être taguées. Défaire
 * serait pire — on perdrait un travail réussi pour un complément manqué.
 */
async function rattacherAutomatiquement(
  domaineId: string,
  dejaAuReferentiel: CompetenceDejaAuReferentiel[],
): Promise<void> {
  const codes = dejaAuReferentiel
    .filter((competence) => competence.aRattacher)
    .map(({ code }) => code);
  if (codes.length === 0) return;
  await taguerCompetences(domaineId, codes, true);
}

export interface ResultatTag {
  domaineId: string;
  taguees: string[];
  detaguees: string[];
}

/**
 * Pose ou retire un tag de domaine sur des compétences (ADR-107).
 *
 * Rien ne se déplace : le code ne change pas, le namespace de création non
 * plus, les observations restent où elles sont. Un tag ajoute une visibilité —
 * la compétence apparaît dans ce domaine et dans tous ses ancêtres, et compte
 * dans leur couverture. Le retirer la fait disparaître de cette vue ; retirer
 * son dernier tag l'envoie « À classer », ce qui est un état autorisé.
 */
export async function taguerCompetences(
  domaineId: string,
  codes: string[],
  tague: boolean,
): Promise<ResultatTag> {
  const dorsale = await dorsaleCompte();
  const referentiel = await lireReferentiel(dorsale);
  const domaine = referentiel.domainesParId.get(domaineId);
  if (!domaine) throw new Error(`Domaine inconnu : ${domaineId}`);

  const demandes = [...new Set(codes)];
  for (const code of demandes) {
    if (!referentiel.parCode.has(code)) throw new Error(`Compétence inconnue : ${code}`);
  }

  const { data, error } = await dorsale.supabase.rpc("taguer_competences_domaine", {
    p_request_id: nouvelIdCommande(),
    p_expected_version: domaine.version ?? null,
    p_origine: "utilisateur",
    p_motif: tague
      ? `Tag de ${demandes.join(", ")} vers ${domaine.nom}`
      : `Retrait du tag de ${demandes.join(", ")} sur ${domaine.nom}`,
    p_domaine_id: domaineId,
    p_codes: demandes,
    p_tague: tague,
  });
  verifier("tag de compétences", error);
  revalidatePath("/", "layout");
  const resultat = data as { domaineId: string; taguees?: string[]; detaguees?: string[] };
  return {
    domaineId: resultat.domaineId,
    taguees: resultat.taguees ?? [],
    detaguees: resultat.detaguees ?? [],
  };
}

/**
 * Déplace un domaine sous un autre, ou le remet à la racine (ADR-107).
 *
 * Le déplacement ne réécrit rien : ni compétence, ni observation, ni score.
 * Seule la visibilité dérivée change — les compétences du sous-arbre remontent
 * désormais vers un autre parent — et elle se recalcule à la lecture suivante.
 *
 * La parenté circulaire est refusée par la commande SQL. Le contrôle est répété
 * ici pour rendre un message avant l'aller-retour, jamais pour s'y substituer :
 * la barrière qui compte est celle de la base.
 */
export async function deplacerDomaine(
  domaineId: string,
  parentId: string | null,
): Promise<void> {
  const dorsale = await dorsaleCompte();
  const referentiel = await lireReferentiel(dorsale);
  const domaine = referentiel.domainesParId.get(domaineId);
  if (!domaine) throw new Error(`Domaine inconnu : ${domaineId}`);

  const parent = parentId ? referentiel.domainesParId.get(parentId) : null;
  if (parentId && !parent) throw new Error(`Domaine parent inconnu : ${parentId}`);
  if (parentId && parenteCirculaire(referentiel.domaines, domaineId, parentId)) {
    throw new Error(
      `« ${parent!.nom} » descend de « ${domaine.nom} » : le rattacher dessous fermerait une boucle.`,
    );
  }

  const { error } = await dorsale.supabase.rpc("deplacer_domaine", {
    p_request_id: nouvelIdCommande(),
    p_expected_version: domaine.version ?? null,
    p_origine: "utilisateur",
    p_motif: parent
      ? `Déplacement de ${domaine.nom} sous ${parent.nom}`
      : `${domaine.nom} remis à la racine`,
    p_domaine_id: domaineId,
    p_parent_id: parentId,
  });
  verifier("déplacement du domaine", error);
  revalidatePath("/", "layout");
}

export interface ResultatScission {
  sousDomaineId: string;
  nom: string;
  prefixe: string;
  /** Codes dont le tag a bougé du parent vers l'enfant. */
  transferees: string[];
  /** Codes qui n'étaient pas tagués sur le parent : ajoutés, pas transférés. */
  ajoutees: string[];
}

/**
 * Crée un sous-domaine et y transfère des tags, en UNE transaction (ADR-108).
 *
 * ## Pourquoi une commande dédiée plutôt que trois appels
 *
 * Créer le domaine, le rattacher au parent, puis déplacer les tags : trois
 * commandes successives, et une erreur au milieu laisse un sous-domaine vide et
 * des compétences à moitié déplacées. C'est exactement le défaut qu'ADR-065
 * existe pour empêcher. `scinder_domaine` fait les trois ou aucun.
 *
 * ## Ce que l'application décide, et que le tuteur ne touche pas
 *
 * L'identifiant (`slugifier`) et le préfixe (`prefixesDistincts`) sont calculés
 * **ici**, à partir du nom lisible. Le tuteur ne propose qu'un nom : les codes
 * sont attribués par l'application (ADR-026), et un préfixe frappé par un modèle
 * pourrait entrer en collision avec un domaine existant et produire des codes
 * ambigus. La base refuse la collision de toute façon ; ce calcul évite d'aller
 * la chercher.
 *
 * ## Ce qui ne bouge pas
 *
 * Aucune compétence n'est créée, recodée ni déplacée. `competences.domaine`
 * reste le namespace de création. Seuls des tags se déplacent, et la visibilité
 * dans le parent se recalcule par héritage (ADR-107) — c'est ce qui fait qu'une
 * scission ne change aucun score global ni aucune observation.
 */
export async function scinderDomaine(
  parentId: string,
  nom: string,
  description: string,
  codes: string[],
): Promise<ResultatScission> {
  const dorsale = await dorsaleCompte();
  const referentiel = await lireReferentiel(dorsale);

  const parent = referentiel.domainesParId.get(parentId);
  if (!parent) throw new Error(`Domaine parent inconnu : ${parentId}`);

  const nomPropre = nom.trim();
  const demandes = [...new Set(codes)];
  if (demandes.length === 0) {
    throw new Error("Une scission doit emporter au moins une compétence.");
  }
  for (const code of demandes) {
    const skill = referentiel.parCode.get(code);
    if (!skill) throw new Error(`Compétence inconnue : ${code}`);
    if (skill.archive) throw new Error(`« ${skill.intitule} » est archivée : elle ne se range plus.`);
  }

  const erreurs = validerDomaine(
    { nom: nomPropre, prefixe: parent.prefixe, description },
    referentiel,
  );
  /*
   * Le préfixe est écarté des erreurs relevées : celui passé au validateur est
   * celui du parent, forcément déjà pris, et c'est `prefixesDistincts` qui en
   * calcule un libre juste après. Toutes les autres règles — nom vide, nom déjà
   * pris — restent bloquantes.
   */
  const bloquantes = erreurs.filter((erreur) => !erreur.toLowerCase().includes("préfixe"));
  if (bloquantes.length > 0) throw new Error(bloquantes.join(" "));

  const sousDomaineId = slugifier(nomPropre);
  if (referentiel.domainesParId.has(sousDomaineId)) {
    throw new Error(`« ${nomPropre} » existe déjà : une scission crée un domaine neuf.`);
  }
  const [prefixe] = prefixesDistincts(
    [{ nom: nomPropre, prefixe: "" }],
    referentiel.domaines.map((domaine) => domaine.prefixe),
  );

  const { data, error } = await dorsale.supabase.rpc("scinder_domaine", {
    p_request_id: nouvelIdCommande(),
    p_expected_version: parent.version ?? null,
    p_origine: "utilisateur",
    p_motif: `Scission de ${parent.nom} : ${nomPropre} reçoit ${demandes.join(", ")}`,
    p_parent_id: parentId,
    p_sous_domaine_id: sousDomaineId,
    p_nom: nomPropre,
    p_prefixe: prefixe,
    p_description: description.trim(),
    p_codes: demandes,
  });
  verifier("scission du domaine", error);
  revalidatePath("/", "layout");

  const resultat = data as {
    sousDomaineId: string;
    nom: string;
    prefixe: string;
    transferees?: string[];
    ajoutees?: string[];
  };
  return {
    sousDomaineId: resultat.sousDomaineId,
    nom: resultat.nom,
    prefixe: resultat.prefixe,
    transferees: resultat.transferees ?? [],
    ajoutees: resultat.ajoutees ?? [],
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

/* ------------------------------------------------------------------ */
/* Mettre de côté une compétence, et la reprendre                      */
/* ------------------------------------------------------------------ */

/**
 * Le domaine qui gouverne une compétence, ou une erreur qui le dit.
 *
 * La gouvernance d'ADR-065 porte sur le **namespace de création**
 * (`Skill.domaine`), pas sur les tags : c'est lui que la RPC exige, et une
 * compétence taguée ailleurs se met de côté depuis son domaine d'origine.
 */
async function competenceGouvernee(code: string) {
  const dorsale = await dorsaleCompte();
  const referentiel = await lireReferentiel(dorsale);
  const skill = referentiel.parCode.get(code);
  if (!skill) throw new Error(`Compétence inconnue : ${code}`);
  return { referentiel, skill };
}

/**
 * Mettre une compétence de côté : elle sort du périmètre actif, rien n'est
 * supprimé.
 *
 * ## Pourquoi elle ne passe pas par `appliquerRevision`
 *
 * Un retrait de révision laisse le SQL choisir entre archiver et supprimer :
 * il supprime dès que rien ne dépend de la compétence. Une compétence dormante
 * n'a par définition ni observation, ni exercice, ni relation — elle était donc
 * SUPPRIMÉE, pendant que l'écran promettait de pouvoir la reprendre. La
 * commande `archiver_competence` archive sans arbitrer (24/08/2026).
 *
 * Le retrait de révision garde son heuristique : effacer une erreur de saisie
 * reste un geste légitime, et ce n'est pas celui-ci.
 */
export async function mettreDeCoteCompetence(code: string): Promise<void> {
  const { referentiel, skill } = await competenceGouvernee(code);
  if (skill.archive) return;
  await executerCommande(
    { type: "archiver_competence", domaineId: skill.domaine, code: skill.code },
    referentiel,
    "utilisateur",
    "Mise de côté validée",
  );
}

/**
 * Reprendre une compétence mise de côté : elle revient dans le périmètre actif.
 *
 * Le pendant exact de `restaurerDomaine`, pour une compétence. Il n'existait
 * pas : la commande SQL `desarchiver_competence` était en base depuis le
 * 20/08/2026 et n'était appelée par rien, si bien que l'écran promettait une
 * reprise qu'aucun geste ne tenait.
 *
 * Elle ne restaure aucun exercice : ceux-ci sont archivés par domaine, jamais
 * par compétence, et rien n'a été archivé au moment de la mise de côté.
 */
export async function reprendreCompetence(code: string): Promise<void> {
  const { referentiel, skill } = await competenceGouvernee(code);
  if (!skill.archive) return;
  await executerCommande(
    { type: "desarchiver_competence", domaineId: skill.domaine, code: skill.code },
    referentiel,
    "utilisateur",
    "Reprise d’une compétence mise de côté",
  );
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
