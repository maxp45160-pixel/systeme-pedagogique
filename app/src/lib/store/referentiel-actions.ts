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

import { dorsaleCompte, lire, type DorsaleCompte } from "./db";
import { entiteVersLigne, verifier } from "./supabase-backend";
import { lireReferentiel } from "./referentiel";
import {
  construireCompetences,
  construireDomaine,
  modeRetrait,
  modeRetraitDomaine,
  normaliserImportance,
  normaliserPalier,
  normaliserPrefixe,
  slugifier,
  validerCompetence,
  validerDomaine,
  type CompetenceCandidate,
} from "@/lib/domain/referentiel-compte";
import type { OrigineReferentiel, Palier } from "@/lib/domain/types";

/** Nombre de preuves par code, pour trancher suppression contre archivage. */
async function compterPreuves(dorsale: DorsaleCompte): Promise<Map<string, number>> {
  const preuves = await lire("evidence", dorsale);
  const compte = new Map<string, number>();
  for (const p of preuves) {
    compte.set(p.skillCode, (compte.get(p.skillCode) ?? 0) + 1);
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
  competences: { intitule: string; palier: string; importance: string }[];
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

export interface EtatRetrait {
  code: string;
  preuves: number;
  mode: "suppression" | "archivage";
}

/**
 * Ce qui arriverait si on retirait cette compétence, **avant** de le faire.
 *
 * L'écran s'en sert pour annoncer le geste et le nombre de preuves en jeu. Un
 * bouton « supprimer » qui archive en réalité, ou qui détruit des preuves sans
 * le dire, serait aussi trompeur dans un sens que dans l'autre.
 */
export async function etatRetrait(code: string): Promise<EtatRetrait> {
  const dorsale = await dorsaleCompte();
  const preuves = (await compterPreuves(dorsale)).get(code) ?? 0;
  return { code, preuves, mode: modeRetrait(preuves) };
}

/**
 * Retire une compétence du référentiel de travail sans toucher à ses preuves.
 *
 * C'est le seul retrait possible dès qu'une preuve existe (P4,
 * anti-hallucination §6). L'intitulé reste résoluble par `Referentiel.parCode`,
 * donc l'historique reste lisible.
 */
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

/**
 * Supprime définitivement une compétence — **uniquement si elle ne porte
 * aucune preuve**.
 *
 * Le refus est explicite et non un repli silencieux sur l'archivage : une
 * fonction qui fait autre chose que ce que son nom annonce est exactement le
 * genre de garde-fou qui s'érode. L'appelant doit appeler `archiverCompetence`
 * en connaissance de cause.
 */
export async function supprimerCompetence(code: string): Promise<void> {
  const dorsale = await dorsaleCompte();
  const preuves = (await compterPreuves(dorsale)).get(code) ?? 0;

  if (modeRetrait(preuves) !== "suppression") {
    throw new Error(
      `« ${code} » porte ${preuves} preuve(s) : elle ne peut pas être supprimée, seulement archivée. Une preuve ne disparaît pas.`,
    );
  }

  const { error } = await dorsale.supabase
    .from("competences")
    .delete()
    .eq("user_id", dorsale.userId)
    .eq("code", code);
  verifier("suppression de la compétence", error);
  revalidatePath("/", "layout");
}

/**
 * Retire un domaine entier.
 *
 * Supprimé si aucune de ses compétences ne porte de preuve ; archivé avec
 * elles sinon. La clé étrangère `ON DELETE RESTRICT` empêche de toute façon
 * d'effacer un domaine dont il reste des compétences : les compétences partent
 * d'abord, explicitement.
 */
export async function retirerDomaine(domaineId: string): Promise<"suppression" | "archivage"> {
  const dorsale = await dorsaleCompte();
  const referentiel = await lireReferentiel(dorsale);
  if (!referentiel.domainesParId.has(domaineId)) {
    throw new Error(`Domaine inconnu : ${domaineId}`);
  }

  const preuves = await compterPreuves(dorsale);
  const mode = modeRetraitDomaine(domaineId, referentiel, preuves);
  const membres = referentiel.skills.filter((s) => s.domaine === domaineId);

  if (mode === "archivage") {
    const { error } = await dorsale.supabase
      .from("competences")
      .update({ archive: true, active: false })
      .eq("user_id", dorsale.userId)
      .eq("domaine", domaineId);
    verifier("archivage des compétences du domaine", error);

    const suite = await dorsale.supabase
      .from("domaines")
      .update({ archive: true })
      .eq("user_id", dorsale.userId)
      .eq("id", domaineId);
    verifier("archivage du domaine", suite.error);
  } else {
    if (membres.length > 0) {
      const { error } = await dorsale.supabase
        .from("competences")
        .delete()
        .eq("user_id", dorsale.userId)
        .eq("domaine", domaineId);
      verifier("suppression des compétences du domaine", error);
    }
    const suite = await dorsale.supabase
      .from("domaines")
      .delete()
      .eq("user_id", dorsale.userId)
      .eq("id", domaineId);
    verifier("suppression du domaine", suite.error);
  }

  revalidatePath("/", "layout");
  return mode;
}

/* ------------------------------------------------------------------ */
/* Profil                                                              */
/* ------------------------------------------------------------------ */

export interface ModificationProfil {
  formation?: string;
  objectifMoyenTerme?: string;
  objectifLongTerme?: string;
  preferencesPedagogiques?: string[];
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
  if (Object.keys(ligne).length === 0) return;

  const { error } = await dorsale.supabase
    .from("profiles")
    .update(ligne)
    .eq("id", dorsale.userId);
  verifier("modification du profil", error);

  revalidatePath("/", "layout");
}
