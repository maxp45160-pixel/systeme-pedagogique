/**
 * Traduction entre les entités du domaine (camelCase) et les lignes
 * PostgreSQL (snake_case).
 *
 * Règle unique, et elle est structurante : **seules les clés de premier
 * niveau deviennent des colonnes**. Tout ce qui est imbriqué (`dimensions`,
 * `source`, `activites`, `occurrences`, `bilan`, `criteres`…) part tel quel
 * dans une colonne `jsonb` et conserve donc son camelCase. Le moteur relit ces
 * objets sans transformation : les convertir en profondeur casserait
 * silencieusement les calculs.
 *
 * Les noms de champs du domaine sont tous en camelCase simple (pas
 * d'acronyme collé type `URL`), la conversion est donc réversible sans
 * table d'exceptions.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Domaine,
  Exercise,
  ExerciseAttempt,
  LearningSession,
  RefusRecommandation,
  Skill,
  SkillEvidence,
  User,
} from "@/lib/domain/types";
import type { Theme } from "@/lib/domain/theme";
import type { AjustementInscrit, NomParametre } from "@/lib/engine/reglages";
import type { Collections } from "./db";

/** Collections tabulaires — `user` est traité à part (table `profiles`). */
export type CleListe = Exclude<keyof Collections, "user">;

export const TABLES: Record<CleListe, string> = {
  evidence: "evidence",
  exercises: "exercises",
  attempts: "attempts",
  sessions: "sessions",
  refusRecommandations: "refus_recommandations",
};

/** Colonnes de service, jamais exposées au domaine. */
const COLONNES_TECHNIQUES = new Set(["user_id", "created_at", "updated_at"]);

export function versColonne(cle: string): string {
  return cle.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

export function versChamp(colonne: string): string {
  return colonne.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

/**
 * Ligne SQL → entité du domaine.
 *
 * Les `NULL` sont supprimés plutôt que transmis : un champ optionnel absent
 * doit être `undefined`, sinon `dureeMin: null` traverse le moteur et
 * s'affiche comme une durée nulle mesurée, ce qu'interdit le protocole
 * anti-hallucination (§7 : ne jamais fabriquer un 0 trompeur).
 */
export function ligneVersEntite<T>(ligne: Record<string, unknown>): T {
  const sortie: Record<string, unknown> = {};
  for (const [colonne, valeur] of Object.entries(ligne)) {
    if (COLONNES_TECHNIQUES.has(colonne)) continue;
    if (valeur === null) continue;
    sortie[versChamp(colonne)] = valeur;
  }
  return sortie as T;
}

/** Entité du domaine → ligne SQL, rattachée au compte. */
export function entiteVersLigne(
  entite: object,
  userId: string,
): Record<string, unknown> {
  const sortie: Record<string, unknown> = { user_id: userId };
  for (const [cle, valeur] of Object.entries(entite)) {
    if (valeur === undefined) continue;
    sortie[versColonne(cle)] = valeur;
  }
  return sortie;
}

/* ------------------------------------------------------------------ */
/* Profil                                                              */
/* ------------------------------------------------------------------ */

/**
 * Le profil ne suit pas la règle générale : il est fusionné avec les valeurs
 * par défaut, car un compte fraîchement créé par le trigger SQL n'a ni
 * formation ni objectifs renseignés, et l'interface doit rester lisible.
 */
export function profilVersUser(
  ligne: Record<string, unknown>,
  defaut: User,
): User {
  const texte = (v: unknown, repli: string) =>
    typeof v === "string" && v.trim().length > 0 ? v : repli;

  return {
    id: String(ligne.id),
    prenom: texte(ligne.prenom, defaut.prenom),
    avatarUrl:
      typeof ligne.avatar_url === "string" && ligne.avatar_url.trim().length > 0
        ? ligne.avatar_url.trim()
        : defaut.avatarUrl,
    formation: texte(ligne.formation, defaut.formation),
    objectifMoyenTerme: texte(ligne.objectif_moyen_terme, defaut.objectifMoyenTerme),
    objectifLongTerme: texte(ligne.objectif_long_terme, defaut.objectifLongTerme),
    debutSuivi: texte(ligne.debut_suivi, defaut.debutSuivi),
    preferencesPedagogiques: Array.isArray(ligne.preferences_pedagogiques)
      ? (ligne.preferences_pedagogiques as string[])
      : (defaut.preferencesPedagogiques ?? []),
    // Le plan n'a pas de repli : non déclaré, il reste absent. Un texte par
    // défaut serait une intention prêtée à la personne.
    plan: typeof ligne.plan === "string" && ligne.plan.trim().length > 0 ? ligne.plan : undefined,
  };
}

// La traduction inverse (User → colonnes `profiles`) n'existe pas : aucun
// écran n'édite le profil. Elle sera à réécrire le jour où cet écran existera
// — cinq lignes symétriques de `profilVersUser` — plutôt que maintenue à vide.

/* ------------------------------------------------------------------ */
/* Chargement groupé (RPC `charger_tout`)                              */
/* ------------------------------------------------------------------ */

/** Ce que `charger_tout` doit rapporter : profil, données, référentiel, thèmes, réglages moteur. */
export interface ResultatRPC {
  collections: Collections;
  domaines: Domaine[];
  competences: Skill[];
  themes: Theme[];
  moteurReglages: AjustementInscrit[];
}

/**
 * Clés attendues dans la charge utile de `charger_tout`, hors `profile`.
 *
 * Toute table ajoutée aux `Collections` ou référentiel s'ajoute ici **et** dans la fonction
 * SQL (`supabase/schema.sql` § 8bis).
 */
export const CLES_RPC = [
  "evidence",
  "exercises",
  "attempts",
  "sessions",
  "refus_recommandations",
  "domaines",
  "competences",
  "themes",
  "moteur_reglages",
] as const;

/**
 * Charge utile de `charger_tout` → entités du domaine.
 *
 * Renvoie `null` — et n'invente rien — dès qu'une clé attendue manque : le
 * code appelant se replie alors sur les lectures séparées, qui, elles, lisent
 * bien toutes les tables.
 *
 * C'est le garde-fou qui manquait. La fonction SQL a vécu deux mois sans
 * renvoyer `refus_recommandations` ; la conversion fabriquait un `[]` pour la
 * clé absente, le moteur n'excluait jamais rien, et « Passer une suggestion »
 * restait sans effet — un `[]` fabriqué est indiscernable d'un `[]` mesuré.
 * C'est P2 (ADR-034) appliqué au transport : quand une valeur venue de la
 * dorsale est illisible, refuser de conclure plutôt que produire un défaut
 * plausible.
 *
 * Une liste vide reste parfaitement légitime — quand la clé est *présente*.
 */
export function convertirResultatRPC(
  brut: unknown,
  defautProfil: User,
): ResultatRPC | null {
  if (!brut || typeof brut !== "object" || Array.isArray(brut)) return null;
  const charge = brut as Record<string, unknown>;

  const manquantes = CLES_RPC.filter((cle) => !(cle in charge));
  if (manquantes.length > 0) {
    console.warn(
      `[store] charger_tout : clés absentes de la charge utile (${manquantes.join(", ")})` +
        " — repli sur les lectures séparées. La fonction SQL a dérivé du schéma.",
    );
    return null;
  }

  const profilBrut = charge.profile as Record<string, unknown> | null;
  const user: User = profilBrut ? profilVersUser(profilBrut, defautProfil) : defautProfil;

  const convertirListe = <T>(cle: string): T[] =>
    ((charge[cle] as Record<string, unknown>[] | null) ?? []).map((l) =>
      ligneVersEntite<T>(l),
    );

  const moteurReglages: AjustementInscrit[] = (
    (charge.moteur_reglages as Record<string, unknown>[] | null) ?? []
  ).map((l) => ({
    id: String(l.id),
    appliqueLe: String(l.applique_le),
    parametre: String(l.parametre) as NomParametre,
    valeurAvant: Number(l.valeur_avant),
    valeurApres: Number(l.valeur_apres),
    metrique: String(l.metrique),
    n: Number(l.n),
    valeurMetrique: Number(l.valeur_metrique),
    motif: String(l.motif),
  }));

  return {
    collections: {
      user,
      evidence: convertirListe<SkillEvidence>("evidence"),
      exercises: convertirListe<Exercise>("exercises"),
      attempts: convertirListe<ExerciseAttempt>("attempts"),
      sessions: convertirListe<LearningSession>("sessions"),
      refusRecommandations: convertirListe<RefusRecommandation>("refus_recommandations"),
    },
    domaines: convertirListe<Domaine>("domaines"),
    competences: convertirListe<Skill>("competences"),
    themes: convertirListe<Theme>("themes"),
    moteurReglages,
  };
}

/* ------------------------------------------------------------------ */
/* Diagnostic                                                          */
/* ------------------------------------------------------------------ */

/**
 * Une erreur Supabase n'est jamais avalée en silence : elle est journalisée
 * puis relancée. Le fallback JSON de la version précédente masquait aussi
 * bien une coupure réseau qu'un schéma désynchronisé, et laissait croire à
 * une sauvegarde réussie alors que rien n'était écrit.
 */
export function verifier(
  contexte: string,
  erreur: { message: string; code?: string } | null,
): void {
  if (!erreur) return;
  const detail = erreur.code ? `${erreur.code} — ${erreur.message}` : erreur.message;
  throw new Error(`Supabase (${contexte}) : ${detail}`);
}

export type ClientSupabase = SupabaseClient;
