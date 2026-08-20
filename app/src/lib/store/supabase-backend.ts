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
  Skill,
  User,
} from "@/lib/domain/types";
import type { AjustementInscrit } from "@/lib/engine/reglages";
import type { Collections } from "./db";
import {
  DonneeSupabaseInvalide,
  validerAjustement,
  validerCompetence,
  validerDomaine,
  validerEntiteSupabase,
  validerRattachement,
  validerUser,
  type RattachementDomaine,
} from "./validation-supabase";

/** Collections tabulaires — `user` est traité à part (table `profiles`). */
export type CleListe = Exclude<keyof Collections, "user">;

export const TABLES: Record<CleListe, string> = {
  observations: "observations",
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
 * Le profil ne suit pas la règle générale parce que ses colonnes ne portent
 * pas toutes les mêmes noms que `User`. Une ligne présente est néanmoins
 * validée sans repli : une valeur invalide venue de Supabase ne doit jamais
 * devenir une valeur plausible fabriquée. Le profil neutre ne sert qu'au cas
 * distinct où aucune ligne n'existe encore pendant la création du compte.
 */
export function profilVersUser(
  ligne: Record<string, unknown>,
  defaut: User,
): User {
  if (
    !Array.isArray(ligne.preferences_pedagogiques) ||
    ligne.preferences_pedagogiques.some((preference) => typeof preference !== "string")
  ) {
    throw new DonneeSupabaseInvalide(
      "profile.preferencesPedagogiques",
      "tableau de textes attendu",
    );
  }
  const user = ligneVersEntite<User>(ligne);
  if (user.id !== defaut.id) {
    throw new DonneeSupabaseInvalide("profile.id", `identifiant du compte ${defaut.id} attendu`);
  }
  return validerUser(user);
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
  competenceDomaines: RattachementDomaine[];
  moteurReglages: AjustementInscrit[];
}

/**
 * Clés attendues dans la charge utile de `charger_tout`, hors `profile`.
 *
 * Toute table ajoutée aux `Collections` ou référentiel s'ajoute ici **et** dans la fonction
 * SQL (`supabase/schema.sql` § 8bis).
 */
export const CLES_RPC = [
  "observations",
  "exercises",
  "attempts",
  "sessions",
  "refus_recommandations",
  "domaines",
  "competences",
  "competence_domaines",
  "moteur_reglages",
] as const;

/**
 * Charge utile de `charger_tout` → entités du domaine.
 *
 * Refuse explicitement toute clé manquante ou valeur invalide. Le repli vers
 * les lectures séparées est réservé au seul cas où la fonction SQL n'existe
 * pas encore ; une charge utile présente mais incohérente n'est pas une panne
 * de transport et ne doit pas être masquée.
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
): ResultatRPC {
  if (!brut || typeof brut !== "object" || Array.isArray(brut)) {
    throw new DonneeSupabaseInvalide("charger_tout", "objet JSON attendu");
  }
  const charge = brut as Record<string, unknown>;

  const manquantes = CLES_RPC.filter((cle) => !(cle in charge));
  if (manquantes.length > 0) {
    throw new DonneeSupabaseInvalide(
      "charger_tout",
      `clés présentes (${manquantes.join(", ")} absente${manquantes.length > 1 ? "s" : ""})`,
    );
  }

  const profilBrut = charge.profile as Record<string, unknown> | null;
  const user: User = profilBrut ? profilVersUser(profilBrut, defautProfil) : defautProfil;

  const lignes = (cle: string): Record<string, unknown>[] => {
    const valeur = charge[cle];
    if (!Array.isArray(valeur)) {
      throw new DonneeSupabaseInvalide(`charger_tout.${cle}`, "tableau attendu");
    }
    return valeur.map((ligne, index) => {
      if (!ligne || typeof ligne !== "object" || Array.isArray(ligne)) {
        throw new DonneeSupabaseInvalide(`charger_tout.${cle}[${index}]`, "ligne objet attendue");
      }
      return ligne as Record<string, unknown>;
    });
  };

  const convertirCollection = <K extends CleListe>(cle: string, nom: K): Collections[K] =>
    lignes(cle).map((ligne, index) =>
      validerEntiteSupabase(nom, ligneVersEntite(ligne), index),
    ) as Collections[K];

  const domaines = lignes("domaines").map((ligne, index) =>
    validerDomaine(ligneVersEntite(ligne), `domaines[${index}]`));
  const competences = lignes("competences").map((ligne, index) =>
    validerCompetence(ligneVersEntite(ligne), `competences[${index}]`));
  const competenceDomaines = lignes("competence_domaines").map((ligne, index) =>
    validerRattachement(ligneVersEntite(ligne), `competenceDomaines[${index}]`));
  const moteurReglages = lignes("moteur_reglages").map((ligne, index) =>
    validerAjustement(ligneVersEntite(ligne), `moteurReglages[${index}]`));

  return {
    collections: {
      user,
      observations: convertirCollection("observations", "observations"),
      exercises: convertirCollection("exercises", "exercises"),
      attempts: convertirCollection("attempts", "attempts"),
      sessions: convertirCollection("sessions", "sessions"),
      refusRecommandations: convertirCollection("refus_recommandations", "refusRecommandations"),
    },
    domaines,
    competences,
    competenceDomaines,
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
