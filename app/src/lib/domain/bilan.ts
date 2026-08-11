/**
 * Le barème du bilan d'exercice — une seule source pour l'écran et le prompt.
 *
 * Ces libellés vivaient en constantes locales de `formulaire-bilan.tsx`. Le lot
 * A1 fait relire la réponse par le tuteur, qui doit rendre son verdict **dans
 * les mêmes termes** que ceux que l'utilisateur voit : si le prompt dit
 * « Correct / Partiel / Incorrect » et que l'écran affiche « Oui / En partie /
 * Non », les deux échelles divergent sans que rien ne le signale.
 *
 * C'est la leçon des `MARQUEUR_*` de `lib/tutor/proposition.ts` : un texte
 * partagé entre un prompt et un parseur doit avoir un seul point de
 * définition, parce qu'une désynchronisation ne lève aucune erreur — elle
 * produit une mesure fausse et silencieuse.
 *
 * Module pur : aucun import React, aucun `server-only`. Il est lu par le
 * composant client et par le constructeur de prompt.
 */

/** Valeur d'appréciation d'un critère. Trois positions, jamais un continuum. */
export type ValeurAppreciation = 0 | 0.5 | 1;

/**
 * L'échelle des critères, dans l'ordre où elle s'affiche.
 *
 * Trois positions et pas cinq : le protocole d'évaluation raisonne en
 * « démontré / partiellement / non démontré ». Une échelle plus fine
 * donnerait une précision que l'évaluation n'a pas.
 */
export const APPRECIATIONS: { valeur: ValeurAppreciation; libelle: string }[] = [
  { valeur: 0, libelle: "Non" },
  { valeur: 0.5, libelle: "En partie" },
  { valeur: 1, libelle: "Oui" },
];

/** Résultat global d'une tentative — le même vocabulaire que `SkillEvidence.resultat`. */
export type ResultatBilan = "reussi" | "partiel" | "echec";

/**
 * Les trois résultats, avec l'aide qui les départage.
 *
 * L'aide n'est pas décorative : c'est elle qui rend le choix reproductible
 * d'une tentative à l'autre, et c'est elle que le prompt du tuteur reprend
 * pour que son verdict porte sur les mêmes critères que celui de la personne.
 */
export const RESULTATS: { valeur: ResultatBilan; libelle: string; aide: string }[] = [
  { valeur: "reussi", libelle: "Réussi", aide: "Méthode et résultat corrects" },
  { valeur: "partiel", libelle: "Partiellement", aide: "Méthode correcte, résultat incomplet" },
  { valeur: "echec", libelle: "Non abouti", aide: "Je n'ai pas su faire" },
];
