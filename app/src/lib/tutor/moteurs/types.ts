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

import type { OutilTuteur } from "../outils";

/** Rôles acceptés dans une conversation avec le tuteur. */
export interface MessageTuteur {
  role: "user" | "assistant";
  content: string;
}

/**
 * Émission d'un événement SSE vers le navigateur.
 *
 * Le vocabulaire est partagé avec `components/tuteur/chat.tsx` :
 * - `texte`               `{ delta }`   — fragment de réponse
 * - `refus`               `{ message, categorie? }`
 * - `tronque`             `{ message }`
 * - `proposition-en-cours` `{ outil }` — un appel d'outil a commencé
 * - `proposition`         `PropositionRecue` — appel d'outil validé (lot 3.2)
 * - `proposition-rejetee` `{ message }` — appel d'outil reçu mais non valide
 * - `fin`                 `{ stopReason, usage }`
 * - `erreur`              `{ message }`
 *
 * Tout moteur doit s'y conformer : c'est ce qui rend les moteurs
 * interchangeables sans toucher à l'interface.
 *
 * `proposition-en-cours` n'est pas cosmétique non plus. Un appel d'outil
 * n'émet aucun `content` : la rédaction d'un exercice, qui est la partie la
 * plus longue d'un tour, ne produit rien de visible. Sans cet événement, la
 * sortie structurée se paie d'un écran figé de plusieurs dizaines de secondes,
 * indiscernable d'une panne.
 *
 * `proposition-rejetee` n'est pas décoratif. Une proposition mal formée — le
 * plus souvent une réponse coupée par la limite de jetons — doit se voir. Sans
 * cet événement, la bascule en sortie structurée remplacerait un demi-exercice
 * accepté par un exercice disparu, et les deux sont des pannes silencieuses.
 */
export type EnvoyerEvenement = (evenement: string, donnees: unknown) => void;

export interface DemandeTuteur {
  /** Préfixe stable : protocoles + cadre d'intervention. Mis en cache si le moteur le sait. */
  systemeStable: string;
  /** Bloc variable : profil dérivé des preuves. */
  systemeProfil: string;
  messages: MessageTuteur[];
  /**
   * Outils par lesquels le tuteur émet ses propositions (lot 3.2).
   *
   * Stables pour un compte donné, donc placés avec le préfixe mis en cache.
   * Un moteur qui ne saurait pas les servir doit continuer de répondre en
   * texte : les parseurs de `proposition.ts` restent le filet.
   */
  outils: OutilTuteur[];
  /**
   * Abandon du client, propagé jusqu'au fournisseur.
   *
   * Sans lui, couper l'onglet n'interrompait rien : la génération allait
   * jusqu'au bout, facturée, pour un texte que plus personne n'affichait — et
   * N envois rapprochés déclenchaient N générations simultanées, donc un 429.
   * Un moteur qui l'ignore reste fonctionnel ; il coûte seulement plus cher.
   */
  signal?: AbortSignal;
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
