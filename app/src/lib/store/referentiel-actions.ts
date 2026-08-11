"use server";

/**
 * Écritures du référentiel du compte (ADR-026, ADR-027).
 *
 * Séparées de `actions.ts`, qui porte les écritures du **journal** — preuves,
 * tentatives, séances. Le référentiel n'est pas du journal : il ne s'ajoute pas
 * en append-only, il se modifie et se retire. Les mélanger aurait brouillé la
 * garantie la plus utile d'`actions.ts`, où aucune preuve n'est jamais réécrite.
 *
 * Comme là-bas : `dorsaleCompte()` redirige sans session, RLS reste la barrière
 * d'autorisation, et `revalidatePath("/", "layout")` suit chaque écriture
 * (ADR-024). Le tuteur n'a aucun accès à ce module — il propose, l'utilisateur
 * valide, et c'est la validation qui écrit (P5).
 *
 * LA RÈGLE DE RETRAIT (ADR-027) est appliquée ici, et elle est **dérivée**, pas
 * offerte au choix : une compétence sans preuve se supprime, une compétence qui
 * en porte s'archive. `supprimerCompetence` refuse plutôt que de se replier en
 * silence sur l'archivage — l'appelant doit avoir vu ce qu'il fait.
 */

import { revalidatePath } from "next/cache";

import { dorsaleCompte, type DorsaleCompte } from "./db";
import { entiteVersLigne, verifier } from "./supabase-backend";
import { lireReferentiel } from "./referentiel";
import {
  construireCompetences,
  construireDomaine,
  normaliserImportance,
  normaliserPalier,
  normaliserPrefixe,
  scinderRetraits,
  slugifier,
  validerCompetence,
  validerDomaine,
  type CompetenceCandidate,
} from "@/lib/domain/referentiel-compte";
import type { OrigineReferentiel, Palier } from "@/lib/domain/types";

/**
 * Nombre de preuves par code, pour trancher suppression contre archivage.
 *
 * Une seule colonne remonte. C'était `lire("evidence")` — donc un `SELECT *`
 * sur toutes les preuves du compte, dimensions et sources JSONB comprises, pour
 * ne rien faire d'autre que compter des occurrences d'un TEXT. Le geste le plus
 * fréquent de l'écran de gestion payait la lecture la plus lourde de la base.
 */
async function compterPreuves(dorsale: DorsaleCompte): Promise<Map<string, number>> {
  const { data, error } = await dorsale.supabase
    .from("evidence")
    .select("skill_code")
    .eq("user_id", dorsale.userId);
  verifier("comptage des preuves", error);

  const compte = new Map<string, number>();
  for (const ligne of (data ?? []) as { skill_code: string }[]) {
    compte.set(ligne.skill_code, (compte.get(ligne.skill_code) ?? 0) + 1);
  }
  return compte;
}

/* ------------------------------------------------------------------ */
/* Création d'une branche                                              */
/* ------------------------------------------------------------------ */

export interface SoumissionBranche {
  /** Nom lisible. S'il correspond à un domaine existant, on l'y rattache. */
  domaine: string;
  prefixe: string;
  description: string;
  competences: {
    intitule: string;
    palier: string;
    importance: string;
    /**
     * Codes dont cette compétence dépend.
     *
     * Sert au successeur d'une compétence maîtrisée (ADR-042) : le lien
     * « DEB-05 s'appuie sur DEB-01 » est un fait du référentiel, pas une note.
     * `construireCompetences` lit déjà `c.prerequis ?? []` et la colonne
     * `prerequis TEXT[]` existe — additif, aucune migration.
     */
    prerequis?: string[];
  }[];
  origine?: OrigineReferentiel;
}

export interface ResultatBranche {
  domaineId: string;
  domaineCree: boolean;
  codes: string[];
}

/**
 * Valide une proposition de branche et l'écrit.
 *
 * Le rattachement à un domaine existant se fait par **nom**, pas par
 * identifiant : c'est ce que le tuteur écrit, et ce que l'utilisateur lit. Le
 * préfixe proposé est alors ignoré — celui du domaine existant fait foi, sans
 * quoi deux séries de codes cohabiteraient dans la même branche.
 */
export async function creerBranche(
  soumission: SoumissionBranche,
): Promise<ResultatBranche> {
  const dorsale = await dorsaleCompte();
  const referentiel = await lireReferentiel(dorsale);

  const nom = soumission.domaine.trim();
  if (!nom) throw new Error("Le nom du domaine est obligatoire.");

  const existant =
    referentiel.domaines.find((d) => d.nom.toLowerCase() === nom.toLowerCase()) ??
    referentiel.domainesParId.get(slugifier(nom));

  const candidates: CompetenceCandidate[] = soumission.competences
    .filter((c) => c.intitule.trim().length > 0)
    .map((c) => ({
      intitule: c.intitule.trim(),
      palier: normaliserPalier(c.palier) as Palier,
      importance: normaliserImportance(c.importance),
      // Un prérequis pointant un code inexistant est écarté ici plutôt que de
      // faire échouer la branche : c'est une arête du graphe, pas son objet.
      prerequis: (c.prerequis ?? []).filter((code) => referentiel.parCode.has(code)),
    }));

  if (candidates.length === 0) {
    throw new Error("Une branche doit porter au moins une compétence.");
  }

  const origine = soumission.origine ?? "tuteur";
  let domaine = existant;

  if (!domaine) {
    const prefixe = normaliserPrefixe(soumission.prefixe, nom);
    const erreurs = validerDomaine({ nom, prefixe, description: soumission.description }, referentiel);
    if (erreurs.length > 0) throw new Error(erreurs.join(" "));

    domaine = construireDomaine(
      { nom, prefixe, description: soumission.description },
      origine,
      referentiel.domaines.length,
    );

    const { error } = await dorsale.supabase
      .from("domaines")
      .insert(entiteVersLigne(domaine, dorsale.userId));
    verifier("création du domaine", error);
  }

  // Validation compétence par compétence, contre le référentiel ET contre les
  // candidates déjà retenues : deux intitulés identiques dans la même
  // proposition doivent être refusés comme un doublon avec l'existant.
  const erreurs: string[] = [];
  const vus = new Set<string>();
  for (const c of candidates) {
    erreurs.push(...validerCompetence(c, referentiel, domaine.id));
    const nu = c.intitule.toLowerCase();
    if (vus.has(nu)) erreurs.push(`« ${c.intitule} » apparaît deux fois dans la proposition.`);
    vus.add(nu);
  }
  if (erreurs.length > 0) throw new Error([...new Set(erreurs)].join(" "));

  const skills = construireCompetences(candidates, domaine, referentiel, origine);
  const { error } = await dorsale.supabase
    .from("competences")
    .insert(skills.map((s) => entiteVersLigne(s, dorsale.userId)));
  verifier("création des compétences", error);

  revalidatePath("/", "layout");
  return {
    domaineId: domaine.id,
    domaineCree: !existant,
    codes: skills.map((s) => s.code),
  };
}

/* ------------------------------------------------------------------ */
/* Modification                                                        */
/* ------------------------------------------------------------------ */

/**
 * Champs modifiables d'une compétence.
 *
 * `code` n'y figure pas, et c'est structurel : c'est la clé étrangère des
 * preuves. Le renommer déplacerait silencieusement tout l'historique d'une
 * compétence vers une autre.
 */
export interface ModificationCompetence {
  intitule?: string;
  palier?: Palier;
  importance?: number;
  prerequis?: string[];
  ordre?: number;
}

export async function modifierCompetence(
  code: string,
  champs: ModificationCompetence,
): Promise<void> {
  const dorsale = await dorsaleCompte();
  const referentiel = await lireReferentiel(dorsale);

  const skill = referentiel.parCode.get(code);
  if (!skill) throw new Error(`Compétence inconnue : ${code}`);

  const candidate: CompetenceCandidate = {
    intitule: champs.intitule ?? skill.intitule,
    palier: champs.palier ?? skill.palier,
    importance: champs.importance ?? skill.importance,
    prerequis: champs.prerequis ?? skill.prerequis,
  };
  const erreurs = validerCompetence(candidate, referentiel, skill.domaine, code);
  if (erreurs.length > 0) throw new Error(erreurs.join(" "));

  const { error } = await dorsale.supabase
    .from("competences")
    .update(entiteVersLigne(candidate, dorsale.userId))
    .eq("user_id", dorsale.userId)
    .eq("code", code);
  verifier("modification de la compétence", error);

  revalidatePath("/", "layout");
}

/* ------------------------------------------------------------------ */
/* Révision groupée d'une branche                                      */
/* ------------------------------------------------------------------ */

export interface SoumissionRevision {
  domaineId: string;
  /** Reformulation du domaine lui-même. Le **préfixe est immuable** : il engendre les codes. */
  domaine?: { nom?: string; description?: string };
  ajouts: { intitule: string; palier: string; importance: string; prerequis?: string[] }[];
  modifications: { code: string; intitule?: string; palier?: string; importance?: string }[];
  /** Codes à retirer. Le geste est **dérivé**, jamais choisi (ADR-027). */
  retraits: string[];
}

export interface ResultatRevision {
  ajoutes: string[];
  modifiees: string[];
  supprimees: string[];
  archivees: string[];
}

/**
 * Applique une révision relue et cochée par l'utilisateur.
 *
 * Une Server Function plutôt que trois appels enchaînés côté client, et pour
 * une raison précise : les trois écritures doivent former **un** geste et
 * **un** `revalidatePath`. Trois appels séparés, c'est trois rendus complets de
 * la page — le « lag par branche » qu'ADR-035 a déjà corrigé pour les retraits
 * groupés — et surtout un référentiel visible dans trois états intermédiaires
 * dont aucun n'est celui que la personne a validé.
 *
 * Trois garde-fous, dans cet ordre :
 *
 * 1. **tout code doit appartenir à `domaineId`.** C'est la troisième couche du
 *    design « désigner, pas frapper » : un bug du validateur ne peut pas
 *    toucher une compétence hors périmètre, et RLS interdit de toucher un autre
 *    compte ;
 * 2. **aucun `delete` direct.** Les retraits passent par `scinderRetraits`,
 *    donc par la règle d'ADR-027 : une compétence qui porte une preuve ne peut
 *    qu'être archivée ;
 * 3. **aucun ajout ne peut dépendre d'un code retiré** dans le même geste.
 *    Sinon on écrirait une référence pendante — une compétence dont le
 *    prérequis n'existe plus à la seconde où elle naît.
 */
export async function appliquerRevision(
  soumission: SoumissionRevision,
): Promise<ResultatRevision> {
  const dorsale = await dorsaleCompte();
  const referentiel = await lireReferentiel(dorsale);

  const domaine = referentiel.domainesParId.get(soumission.domaineId);
  if (!domaine) throw new Error(`Domaine inconnu : ${soumission.domaineId}`);

  // 1. Périmètre : chaque code désigné appartient bien à ce domaine.
  const designes = [...soumission.modifications.map((m) => m.code), ...soumission.retraits];
  for (const code of designes) {
    if (referentiel.parCode.get(code)?.domaine !== domaine.id) {
      throw new Error(`${code} n'appartient pas au domaine ${domaine.nom}.`);
    }
  }

  // 3. Références pendantes : un ajout ne dépend pas de ce qu'on retire.
  const retires = new Set(soumission.retraits);
  for (const a of soumission.ajouts) {
    const pendant = (a.prerequis ?? []).find((c) => retires.has(c));
    if (pendant) {
      throw new Error(
        `« ${a.intitule} » dépend de ${pendant}, qui est retiré dans la même révision.`,
      );
    }
  }

  const resultat: ResultatRevision = {
    ajoutes: [],
    modifiees: [],
    supprimees: [],
    archivees: [],
  };

  // ── Le domaine lui-même. Le préfixe n'est pas touché : il engendre les codes.
  const champsDomaine: Record<string, string> = {};
  if (soumission.domaine?.nom?.trim()) champsDomaine.nom = soumission.domaine.nom.trim();
  if (soumission.domaine?.description?.trim()) {
    champsDomaine.description = soumission.domaine.description.trim();
  }
  if (Object.keys(champsDomaine).length > 0) {
    const { error } = await dorsale.supabase
      .from("domaines")
      .update(champsDomaine)
      .eq("user_id", dorsale.userId)
      .eq("id", domaine.id);
    verifier("modification du domaine", error);
  }

  // ── Modifications, validées une à une comme `modifierCompetence`.
  for (const m of soumission.modifications) {
    const skill = referentiel.parCode.get(m.code);
    if (!skill) continue;

    const candidate: CompetenceCandidate = {
      intitule: m.intitule?.trim() || skill.intitule,
      palier: m.palier ? (normaliserPalier(m.palier) as Palier) : skill.palier,
      importance: m.importance ? normaliserImportance(m.importance) : skill.importance,
      prerequis: skill.prerequis,
    };
    const erreurs = validerCompetence(candidate, referentiel, skill.domaine, m.code);
    if (erreurs.length > 0) throw new Error(`${m.code} — ${erreurs.join(" ")}`);

    const { error } = await dorsale.supabase
      .from("competences")
      .update(entiteVersLigne(candidate, dorsale.userId))
      .eq("user_id", dorsale.userId)
      .eq("code", m.code);
    verifier("modification de la compétence", error);
    resultat.modifiees.push(m.code);
  }

  // ── Ajouts : codes attribués par l'application, jamais par le tuteur.
  if (soumission.ajouts.length > 0) {
    const candidates: CompetenceCandidate[] = soumission.ajouts
      .filter((a) => a.intitule.trim().length > 0)
      .map((a) => ({
        intitule: a.intitule.trim(),
        palier: normaliserPalier(a.palier) as Palier,
        importance: normaliserImportance(a.importance),
        prerequis: (a.prerequis ?? []).filter((c) => referentiel.parCode.has(c)),
      }));

    for (const c of candidates) {
      const erreurs = validerCompetence(c, referentiel, domaine.id);
      if (erreurs.length > 0) throw new Error(`« ${c.intitule} » — ${erreurs.join(" ")}`);
    }

    const nouvelles = construireCompetences(candidates, domaine, referentiel, "tuteur");
    if (nouvelles.length > 0) {
      const { error } = await dorsale.supabase
        .from("competences")
        .insert(nouvelles.map((s) => entiteVersLigne(s, dorsale.userId)));
      verifier("ajout des compétences", error);
      resultat.ajoutes.push(...nouvelles.map((s) => s.code));
    }
  }

  // ── Retraits : le mode est DÉRIVÉ, jamais choisi.
  if (soumission.retraits.length > 0) {
    const preuves = await compterPreuves(dorsale);
    const { supprimees, archivees } = scinderRetraits(soumission.retraits, preuves);

    if (archivees.length > 0) {
      const { error } = await dorsale.supabase
        .from("competences")
        .update({ archive: true, active: false })
        .eq("user_id", dorsale.userId)
        .in("code", archivees);
      verifier("archivage des compétences", error);
    }
    if (supprimees.length > 0) {
      const { error } = await dorsale.supabase
        .from("competences")
        .delete()
        .eq("user_id", dorsale.userId)
        .in("code", supprimees);
      verifier("suppression des compétences", error);
    }

    resultat.supprimees = supprimees;
    resultat.archivees = archivees;
  }

  revalidatePath("/", "layout");
  return resultat;
}

/**
 * Entrée ou sortie du périmètre de travail.
 *
 * Réversible d'un clic, et sans effet sur les preuves : c'est ce qui distingue
 * ce geste de l'archivage. Une compétence archivée ne se réactive pas ici —
 * il faut la désarchiver d'abord, pour que le retour dans le périmètre reste
 * une décision consciente.
 */
export async function basculerActive(code: string, active: boolean): Promise<void> {
  const dorsale = await dorsaleCompte();
  const referentiel = await lireReferentiel(dorsale);

  const skill = referentiel.parCode.get(code);
  if (!skill) throw new Error(`Compétence inconnue : ${code}`);
  if (skill.archive && active) {
    throw new Error(
      `« ${code} » est archivée : désarchive-la avant de la remettre dans ton périmètre.`,
    );
  }

  const { error } = await dorsale.supabase
    .from("competences")
    .update({ active })
    .eq("user_id", dorsale.userId)
    .eq("code", code);
  verifier("changement de périmètre", error);

  revalidatePath("/", "layout");
}

/* ------------------------------------------------------------------ */
/* Retrait — ADR-027                                                   */
/* ------------------------------------------------------------------ */

export async function archiverCompetence(code: string): Promise<void> {
  const dorsale = await dorsaleCompte();
  const { error } = await dorsale.supabase
    .from("competences")
    .update({ archive: true, active: false })
    .eq("user_id", dorsale.userId)
    .eq("code", code);
  verifier("archivage de la compétence", error);
  revalidatePath("/", "layout");
}

export async function desarchiverCompetence(code: string): Promise<void> {
  const dorsale = await dorsaleCompte();
  // `active` reste false : désarchiver rend la compétence modifiable et
  // réactivable, ça ne la remet pas d'office au travail.
  const { error } = await dorsale.supabase
    .from("competences")
    .update({ archive: false })
    .eq("user_id", dorsale.userId)
    .eq("code", code);
  verifier("désarchivage de la compétence", error);
  revalidatePath("/", "layout");
}

export interface ResultatRetraitGroupe {
  supprimees: string[];
  archivees: string[];
}

/**
 * Retire plusieurs compétences en un geste.
 *
 * Chaque code garde son mode **dérivé** — on ne choisit pas d'archiver tout le
 * lot parce qu'une seule ligne porte une preuve, et on ne supprime pas tout
 * parce que la majorité est vide. Le lot est simplement scindé en deux
 * requêtes, et le résultat dit ce qui est arrivé à quoi : l'écran l'annonçait
 * avant le clic, il doit pouvoir le confirmer après.
 *
 * Un seul `revalidatePath` pour l'ensemble. Retirer huit compétences en coûtait
 * huit, chacun suivi d'un rendu complet de la page — c'est le « ça prend
 * quelques secondes de lag par branche » remonté à l'usage.
 */
export async function retirerCompetences(codes: string[]): Promise<ResultatRetraitGroupe> {
  if (codes.length === 0) return { supprimees: [], archivees: [] };

  const dorsale = await dorsaleCompte();
  const preuves = await compterPreuves(dorsale);

  // Le découpage vit dans `scinderRetraits` (pur, testé), partagé avec
  // `appliquerRevision` : deux copies de la règle d'ADR-027 finiraient par
  // diverger, et la divergence serait invisible — l'un effacerait ce que
  // l'autre archive.
  const { supprimees, archivees } = scinderRetraits(codes, preuves);

  if (archivees.length > 0) {
    const { error } = await dorsale.supabase
      .from("competences")
      .update({ archive: true, active: false })
      .eq("user_id", dorsale.userId)
      .in("code", archivees);
    verifier("archivage des compétences", error);
  }

  if (supprimees.length > 0) {
    const { error } = await dorsale.supabase
      .from("competences")
      .delete()
      .eq("user_id", dorsale.userId)
      .in("code", supprimees);
    verifier("suppression des compétences", error);
  }

  revalidatePath("/", "layout");
  return { supprimees, archivees };
}

/**
 * Change le périmètre de travail de plusieurs compétences en une requête.
 *
 * Même motif que ci-dessus : c'est le geste qu'on fait par poignées — « ces
 * six-là sont trop dures pour l'instant » — et il coûtait un aller-retour par
 * case cochée.
 */
export async function basculerActives(codes: string[], active: boolean): Promise<void> {
  if (codes.length === 0) return;
  const dorsale = await dorsaleCompte();

  /*
   * Réactiver exige le même garde-fou que `basculerActive` : une compétence
   * archivée ne rentre pas au périmètre d'un clic, il faut la désarchiver
   * d'abord. Le geste par lot ne doit pas tenir un invariant que le geste
   * unitaire refuserait (audit §2.8) — c'est la forme exacte qu'ADR-044 a
   * corrigée pour les retraits.
   */
  if (active) {
    const referentiel = await lireReferentiel(dorsale);
    const archives = codes.filter((code) => referentiel.parCode.get(code)?.archive);
    if (archives.length > 0) {
      throw new Error(
        `Compétence(s) archivée(s) : ${archives.join(", ")}. Désarchive-les avant de les remettre dans ton périmètre.`,
      );
    }
  }

  const { error } = await dorsale.supabase
    .from("competences")
    .update({ active })
    .eq("user_id", dorsale.userId)
    .in("code", codes);
  verifier("changement de périmètre", error);
  revalidatePath("/", "layout");
}

/* Profil                                                              */
/* ------------------------------------------------------------------ */

export interface ModificationProfil {
  formation?: string;
  objectifMoyenTerme?: string;
  objectifLongTerme?: string;
  preferencesPedagogiques?: string[];
  plan?: string;
}

/**
 * Premier chemin d'écriture vers `profiles` depuis l'interface.
 *
 * Les colonnes existaient depuis l'origine et rien ne les renseignait
 * (`supabase-backend.ts` le disait en clair) : deux comptes sur trois affichaient
 * « Formation à renseigner ». C'est le prérequis matériel qu'ADR-009 identifiait
 * depuis le 27/07 — sans objectif déclaré, l'importance d'une compétence ne peut
 * se rapporter à rien, et le tuteur n'a pas de quoi la proposer.
 */
export async function modifierProfil(champs: ModificationProfil): Promise<void> {
  const dorsale = await dorsaleCompte();

  const ligne: Record<string, unknown> = {};
  if (champs.formation !== undefined) ligne.formation = champs.formation.trim();
  if (champs.objectifMoyenTerme !== undefined) {
    ligne.objectif_moyen_terme = champs.objectifMoyenTerme.trim();
  }
  if (champs.objectifLongTerme !== undefined) {
    ligne.objectif_long_terme = champs.objectifLongTerme.trim();
  }
  if (champs.preferencesPedagogiques !== undefined) {
    ligne.preferences_pedagogiques = champs.preferencesPedagogiques
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
  }
  // Le plan est facultatif : le vider est un geste légitime, donc une chaîne
  // vide part telle quelle plutôt que d'être écartée comme « rien à écrire ».
  if (champs.plan !== undefined) ligne.plan = champs.plan.trim();
  if (Object.keys(ligne).length === 0) return;

  const { error } = await dorsale.supabase
    .from("profiles")
    .update(ligne)
    .eq("id", dorsale.userId);
  verifier("modification du profil", error);

  revalidatePath("/", "layout");
}
