/**
 * Interface commune à tous les moteurs du tuteur (ADR-007).
 *
 * Un « moteur » est un fournisseur de modèle. Le reste du système — contexte,
 * parseur de propositions, chat, validation humaine — est identique quel que
 * soit le moteur retenu. Changer de fournisseur est une variable
 * d'environnement, pas une réécriture.
 *
 * ⚠️ Ne pas confondre avec les « dorsales » de `lib/store/db.ts`, qui
 * désignent le choix Supabase / JSON pour les *données*. Deux mécanismes sans
 * rapport.
 *
 * Ce fichier ne dépend de rien : il doit rester importable depuis un test
 * sans tirer `node:fs` ni `next/headers`.
 */

/** Rôles acceptés dans une conversation avec le tuteur. */
export interface MessageTuteur {
  role: "user" | "assistant";
  content: string;
}

/**
 * Émission d'un événement SSE vers le navigateur.
 *
 * Le vocabulaire est **imposé par `components/tuteur/chat.tsx`**, qui n'est pas
 * modifié par ce chantier :
 * - `texte`   `{ delta }`   — fragment de réponse
 * - `refus`   `{ message, categorie? }`
 * - `tronque` `{ message }`
 * - `fin`     `{ stopReason, usage }`
 * - `erreur`  `{ message }`
 *
 * Tout moteur doit s'y conformer : c'est ce qui rend les moteurs
 * interchangeables sans toucher à l'interface.
 */
export type EnvoyerEvenement = (evenement: string, donnees: unknown) => void;

export interface DemandeTuteur {
  /** Préfixe stable : protocoles + cadre d'intervention. Mis en cache si le moteur le sait. */
  systemeStable: string;
  /** Bloc variable : profil dérivé des preuves. */
  systemeProfil: string;
  messages: MessageTuteur[];
  envoyer: EnvoyerEvenement;
}

export interface MoteurTuteur {
  /** Identifiant technique, affiché dans le manifeste de l'interface. */
  readonly nom: string;
  /** Modèle effectivement appelé. */
  readonly modele: string;
  /**
   * Produit la réponse et émet les événements au fil de l'eau.
   *
   * Ne lève jamais : une erreur est signalée par un événement `erreur`, pour
   * que le flux SSE se termine proprement côté navigateur.
   */
  repondre(demande: DemandeTuteur): Promise<void>;
}
