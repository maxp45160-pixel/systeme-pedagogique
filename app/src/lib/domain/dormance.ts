/**
 * Ce qui fait qu'une compétence est *dormante*, et pas seulement *neuve*.
 *
 * ## Pourquoi cette règle vit dans le domaine
 *
 * Elle est posée à deux endroits qui ne se parlent pas :
 *
 * - `lib/engine/candidats-referentiel.ts` la lit pour **produire** un candidat ;
 * - `lib/domain/propositions-referentiel.ts` la lit pour décider qu'une
 *   proposition déjà enregistrée **reste applicable**.
 *
 * Le second point n'est pas un détail de confort. Les propositions sont des
 * lignes stockées : corriger le détecteur le 24/08/2026 n'a rien retiré des
 * vingt-huit dormances qu'il avait produites la veille sur des compétences
 * créées le jour même. Elles ne disparaissent que si l'applicabilité pose la
 * même question que la détection — d'où une implémentation unique, ici.
 */

const JOUR_MS = 24 * 60 * 60 * 1000;

/**
 * Âge minimal, en jours, avant qu'une compétence puisse être dite dormante.
 *
 * Rien n'ayant jamais eu lieu sur elle, l'âge de la compétence EST sa durée
 * sans rien : les deux se confondent, et sa date de création suffit à la
 * mesurer.
 *
 * 90 jours et non 30 : trois mois est ce que la doctrine du détecteur
 * annonçait déjà (« depuis trois mois »). Le seuil ne sert qu'à écarter ce qui
 * n'a pas encore eu l'occasion de servir ; le raccourcir ne rendrait pas la
 * proposition plus vraie, seulement plus fréquente.
 */
export const JOURS_DORMANCE = 90;

/**
 * Depuis combien de jours cette compétence n'a rien pu produire — ou `null`
 * quand la question ne se pose pas encore.
 *
 * `null` dans deux cas, et jamais un nombre par défaut :
 *
 * - **la date manque** — `competences.created_at` est `NOT NULL`, mais une
 *   donnée absente n'autorise pas à fabriquer un âge (invariant 6) ;
 * - **elle est trop jeune** — une compétence ajoutée il y a cinq minutes n'a
 *   ni observation, ni exercice, ni relation, pour la seule raison que rien
 *   n'a encore pu la mobiliser. Proposer de la mettre de côté, c'est proposer
 *   d'oublier ce qu'on vient d'écrire.
 */
export function joursDeDormance(
  creeLe: string | undefined,
  now: Date,
): number | null {
  if (!creeLe) return null;
  const depuis = new Date(creeLe).getTime();
  if (Number.isNaN(depuis)) return null;
  const jours = Math.max(0, Math.floor((now.getTime() - depuis) / JOUR_MS));
  return jours < JOURS_DORMANCE ? null : jours;
}
