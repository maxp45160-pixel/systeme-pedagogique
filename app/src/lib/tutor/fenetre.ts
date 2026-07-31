/**
 * Fenêtrage de l'historique transmis au moteur du tuteur.
 *
 * Sans borne, le payload croît linéairement avec la longueur de la
 * conversation — les réponses de l'assistant peuvent atteindre le plafond de
 * sortie et s'accumulent — jusqu'au refus du fournisseur (HTTP 413).
 *
 * On conserve le premier message utilisateur, qui porte l'intention initiale
 * de la séance, puis les derniers messages.
 *
 * ⚠️ La fenêtre sert à décider ce qu'on ENVOIE, jamais à compter les tours.
 * L'heuristique de chargement conditionnel des protocoles (ADR-021) se compte
 * en tours réellement échangés : lui passer la fenêtre plafonnerait son
 * compteur à la taille de celle-ci, ce qui casserait sa cadence.
 */

import type { MessageTuteur } from "@/lib/tutor/moteurs";

/**
 * Nombre maximum de messages (user + assistant) transmis au modèle.
 *
 * 14 messages ≈ 7 échanges. Le pire cas tient compte du prompt système
 * (~8 K jetons, renvoyé à chaque tour) et de réponses assistant au plafond de
 * sortie : 8 + 14 × 8 ≈ 120 K, soit la limite de 128 K de Mistral tout juste
 * tenue. Au-delà, la fenêtre ne protège plus de rien.
 */
export const MAX_MESSAGES_FENETRE = 14;

export interface HistoriqueFenetre {
  fenetre: MessageTuteur[];
  tronque: boolean;
}

/**
 * Réduit l'historique au premier message utilisateur suivi des derniers
 * messages, sans jamais laisser un message d'assistant orphelin en tête —
 * une réponse dont la question a disparu se lit comme une affirmation du
 * tuteur, ce que le protocole anti-hallucination interdit.
 *
 * La couture entre le premier message conservé et le début de la fenêtre
 * récente peut juxtaposer deux messages utilisateur. C'est assumé : le format
 * de conversation l'admet, alors qu'un assistant orphelin, lui, fabriquerait
 * une affirmation sans question.
 */
export function fenetrerHistorique(messages: MessageTuteur[]): HistoriqueFenetre {
  if (messages.length <= MAX_MESSAGES_FENETRE) {
    return { fenetre: messages, tronque: false };
  }

  const premier = messages.find((m) => m.role === "user");
  const queue = messages.slice(-(MAX_MESSAGES_FENETRE - 1));
  const queueNormalisee = queue[0]?.role === "assistant" ? queue.slice(1) : queue;

  const fenetre = premier
    ? [premier, ...queueNormalisee.filter((m) => m !== premier)]
    : queueNormalisee;

  return { fenetre, tronque: true };
}
