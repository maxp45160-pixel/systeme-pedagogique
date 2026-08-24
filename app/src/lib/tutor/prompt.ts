/**
 * Un prompt système en deux morceaux : ce qui ne bouge pas, et ce qui bouge.
 *
 * ## Pourquoi la coupure
 *
 * Les fournisseurs qui savent réutiliser un préfixe le font sur le **début
 * identique** de la requête. Le moteur envoie déjà deux blocs `system` séparés
 * pour cela (`compatible-openai.ts`) : le premier est censé être stable d'un
 * appel à l'autre, le second variable.
 *
 * Les chemins de rédaction ne respectaient pas ce contrat. Le sujet demandé,
 * le contrat d'activité, l'énoncé de l'exercice, la difficulté conseillée
 * étaient concaténés **dans le bloc stable**. Le préfixe changeait donc à
 * chaque requête, et le cache ne pouvait jamais servir.
 *
 * Mesuré le 21/08/2026 sur le compte réel : `cacheLu` valait **0 sur les trois
 * chemins de génération**, contre **1968 jetons sur 1998** pour la traduction
 * d'un besoin, qui ne fait pas cette faute.
 *
 * ## Ce qui va où
 *
 * `stable` — l'identité du tuteur, les protocoles, les barèmes, le référentiel
 * du compte. Tout ce qui est vrai pour ce compte quelle que soit la demande.
 *
 * `variable` — la demande elle-même : un sujet, un contrat, un énoncé, une
 * difficulté conseillée. Tout ce qui change d'un appel au suivant.
 *
 * La règle de partage est simple : **si deux appels successifs du même compte
 * peuvent en différer, c'est `variable`.**
 */
export interface PromptTuteur {
  /** Préfixe identique d'un appel à l'autre — la partie qui peut être mise en cache. */
  stable: string;
  /** La demande du moment. Placée après le préfixe, elle ne le casse pas. */
  variable: string;
}

/**
 * Le prompt tel qu'un lecteur humain le lit — les deux blocs à la suite.
 *
 * Utilisé par les tests, qui vérifient une consigne sans avoir à savoir de quel
 * côté de la coupure elle est tombée. Le moteur, lui, ne l'appelle jamais :
 * c'est justement la concaténation qu'il ne doit pas faire.
 */
export function promptComplet(prompt: PromptTuteur): string {
  return [prompt.stable, prompt.variable].filter((bloc) => bloc.trim() !== "").join("\n\n");
}

/**
 * Le registre de tout ce que le tuteur écrit vers l'écran.
 *
 * Le prompt tutoie le modèle parce qu'il s'adresse à lui ; ce que le modèle
 * rédige s'adresse à la personne, et toute l'interface la vouvoie (ADR-119).
 * Sans cette ligne, un ancrage sortait en « Tu as travaillé 6 fois sur… » au
 * milieu d'une carte qui dit « Vous pourrez ensuite vous exercer dessus » —
 * constaté le 24/08/2026 sur le premier lot réel de relecture.
 *
 * Une seule déclaration : la règle a d'abord vécu en un exemplaire dans
 * `relecture-referentiel.ts`, ce qui laissait onze autres chemins de rédaction
 * sans consigne de registre. Les énoncés d'exercice, les bilans, les
 * justifications de compétence et les traductions de besoin s'affichent tous
 * tels quels — ils relèvent tous de cette règle.
 *
 * Elle vit dans le bloc **stable** du prompt : elle ne change jamais d'un
 * appel à l'autre, et n'a donc aucune raison de casser le préfixe mis en cache.
 */
export const REGLE_VOUVOIEMENT =
  "- Tout ce que tu écris s'affiche tel quel à la personne : VOUVOIE-LA, partout — énoncés, consignes, corrections, justifications, intitulés, ancrages. Ne la tutoie jamais, même si ce prompt te tutoie.";
