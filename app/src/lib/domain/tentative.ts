/**
 * Ce qu'une tentative doit porter pour qu'on puisse en conclure quelque chose.
 *
 * Module pur, testable sans base — et c'est le point : la règle vivait
 * jusqu'ici nulle part, donc partout. Le bilan s'ouvrait sur une tentative
 * vide, l'utilisateur cochait ses critères de mémoire, et la preuve écrite
 * ne s'appuyait sur aucune trace relisible.
 *
 * Mesuré le 07/08/2026 : **16 des 37 tentatives terminées ne portent aucune
 * réponse écrite**. Ce n'est donc pas une formalité qu'on ajoute, c'est un
 * changement de parcours. Il a une contrepartie obligatoire, `abandonnerExercice`
 * (lib/store/actions.ts) : une tentative qu'on ne veut pas mener doit pouvoir se
 * clore sans réponse — elle n'écrit aucune preuve de toute façon.
 *
 * ⚠️ Aucun seuil de longueur n'est posé, et c'est délibéré (CLAUDE.md §8 : pas
 * de seuil sans données). Le jour où l'usage montre qu'on tape « . » pour
 * passer, ce sera une observation, et un seuil pourra être calé dessus — comme
 * `FRACTION_NON_TENTEE` l'a été sur des tentatives réelles (ADR-028).
 */

/**
 * La réponse écrite permet-elle d'ouvrir le bilan ?
 *
 * Non vide après `trim`, et rien d'autre. `undefined` et `null` sont traités
 * comme vides : `attempts.reponse` est déclarée `NOT NULL DEFAULT ''` en base,
 * mais une tentative venue d'un seed ou d'un test peut ne pas porter le champ,
 * et présumer « suffisante » une valeur absente serait exactement l'inverse de
 * la règle.
 */
export function reponseSuffisante(reponse: string | null | undefined): boolean {
  return typeof reponse === "string" && reponse.trim().length > 0;
}

/**
 * Pourquoi le bilan est fermé, ou `null` s'il est ouvert.
 *
 * Le message nomme **le bouton** à cliquer, pas l'intention : la zone de
 * réponse exige un « Enregistrer le brouillon » explicite (choix délibéré de
 * `zone-reponse.tsx`), donc du texte à l'écran ne suffit pas — c'est ce que la
 * base porte qui compte. Sans ce détail, le message enverrait l'utilisateur
 * regarder un champ qu'il a déjà rempli.
 */
export function motifBlocageBilan(reponse: string | null | undefined): string | null {
  if (reponseSuffisante(reponse)) return null;
  return "Le bilan demande ta réponse écrite. Rédige-la puis clique « Enregistrer le brouillon » : c'est la trace du raisonnement, et c'est elle que le tuteur relira pour te proposer une correction.";
}
