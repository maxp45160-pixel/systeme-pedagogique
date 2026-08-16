/**
 * Rôle d'une note et formats autorisés — une seule déclaration.
 *
 * La règle vivait en double : un `ReadonlySet` de contrôle côté serveur dans
 * `lib/store/document-actions.ts`, et une liste de libellés côté formulaire
 * dans `components/dashboard/capture-notes.tsx`. Deux copies d'une même règle
 * métier dérivent : ajouter un format à l'une sans l'autre produit soit une
 * entrée de menu que le serveur refuse, soit un format acceptable qu'aucun
 * écran ne propose.
 *
 * Elle ne peut pas vivre dans `document-actions.ts` : ce fichier est marqué
 * `"use server"`, où tout export doit être une fonction asynchrone.
 *
 * Le rôle est une **intention déclarée**, jamais une mesure (ADR-064) : une
 * note opérationnelle ne devient une preuve qu'après une évaluation validée.
 */

export type RoleNote = "support" | "operationnel";

export interface FormatNote {
  valeur: string;
  libelle: string;
}

/*
 * Il n'y a plus de liste de « formats opérationnels disponibles ».
 *
 * Elle valait quand séance et projet étaient deux formats du même document. Une
 * séance ne produit plus de note : elle va droit au compositeur, qui écrit une
 * `LearningSession` (voir `ChoixTravail`). Le format `seance` reste déclaré
 * ci-dessous parce que les fiches déjà écrites doivent continuer à s'ouvrir —
 * il n'est simplement plus proposé nulle part.
 */

/** Formats connus mais reportés dans l'interface principale. */
export const FORMATS_OPERATIONNELS_A_VENIR: readonly FormatNote[] = [
  { valeur: "etude-de-cas", libelle: "Étude de cas" },
  { valeur: "redaction", libelle: "Rédaction" },
  { valeur: "schema", libelle: "Schéma" },
  { valeur: "experimentation", libelle: "Expérimentation" },
];

/** Les libellés sont ceux du formulaire : le contrôle et le menu partent d'ici. */
export const FORMATS_PAR_ROLE: Record<RoleNote, readonly FormatNote[]> = {
  support: [
    { valeur: "note", libelle: "Note libre" },
    { valeur: "reference", libelle: "Référence" },
    { valeur: "article", libelle: "Article" },
    { valeur: "cours", libelle: "Cours" },
    { valeur: "livre", libelle: "Livre" },
    { valeur: "formule", libelle: "Formule" },
    { valeur: "reflexion", libelle: "Réflexion" },
  ],
  operationnel: [
    { valeur: "seance", libelle: "Séance d'exercices" },
    { valeur: "projet", libelle: "Projet" },
    { valeur: "etude-de-cas", libelle: "Étude de cas" },
    { valeur: "redaction", libelle: "Rédaction" },
    { valeur: "schema", libelle: "Schéma" },
    { valeur: "experimentation", libelle: "Expérimentation" },
  ],
};

const VALEURS_PAR_ROLE: Record<RoleNote, ReadonlySet<string>> = {
  support: new Set(FORMATS_PAR_ROLE.support.map(({ valeur }) => valeur)),
  operationnel: new Set(FORMATS_PAR_ROLE.operationnel.map(({ valeur }) => valeur)),
};

export function formatAutorise(role: RoleNote, type: string): boolean {
  return VALEURS_PAR_ROLE[role].has(type);
}

/** Le rôle qui accepte ce format, s'il n'y en a qu'un. */
export function roleDuFormat(type: string): RoleNote | null {
  if (VALEURS_PAR_ROLE.support.has(type)) return "support";
  if (VALEURS_PAR_ROLE.operationnel.has(type)) return "operationnel";
  return null;
}
