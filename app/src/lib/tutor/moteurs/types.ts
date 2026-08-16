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

/* ------------------------------------------------------------------ */
/* Lecture de l'événement `fin`                                        */
/* ------------------------------------------------------------------ */

/**
 * Le fournisseur a-t-il servi les outils, d'après l'événement `fin` ?
 *
 * `compatible-openai` replie en dernier recours sur un appel **sans** `tools`
 * quand le fournisseur refuse la sortie structurée (marche 2). Le tuteur
 * répond alors en prose, aucun événement `proposition` n'est émis, et un
 * chemin one-shot qui ne regarde que ses propositions conclut « rien
 * d'exploitable » — le même message que pour un tuteur qui n'avait rien à
 * dire. Deux pannes très différentes, une seule phrase : c'est le silence
 * qu'ADR-031 a supprimé **pour le chat**, en faisant porter `outils` par
 * l'événement `fin`. Les chemins sans conversation ne le lisaient pas.
 *
 * Rend `null` quand l'événement n'est pas un `fin` exploitable — l'absence
 * d'information n'est pas un `false` (P2). L'appelant garde alors son
 * diagnostic par défaut.
 */
export function lireOutilsActifs(evenement: string, donnees: unknown): boolean | null {
  if (evenement !== "fin") return null;
  if (typeof donnees !== "object" || donnees === null) return null;
  const outils = (donnees as { outils?: unknown }).outils;
  if (typeof outils !== "object" || outils === null) return null;
  const actifs = (outils as { actifs?: unknown }).actifs;
  return typeof actifs === "boolean" ? actifs : null;
}

/**
 * La panne annoncée par le moteur, ou `null`.
 *
 * ⚠️ Sans cette lecture, **une clé expirée s'affiche « le tuteur n'a rien
 * produit d'exploitable »**. Le moteur émet pourtant la vraie cause — « Clé
 * refusée par le fournisseur », « quota atteint », « modèle introuvable » — et
 * les chemins one-shot la laissaient passer : ils ne regardaient que leurs
 * propositions, concluaient à l'absence, et écrasaient le message précis par le
 * leur, générique. Le cas s'est produit le 16/08/2026 : une clé Mistral expirée
 * a fait passer trois écrans pour cassés (besoin, thème, génération), et rien à
 * l'écran ne pointait vers les réglages.
 *
 * `null` quand l'événement n'est pas une erreur porteuse de message : l'appelant
 * garde son diagnostic par défaut.
 */
export function lireErreurMoteur(evenement: string, donnees: unknown): string | null {
  if (evenement !== "erreur") return null;
  if (typeof donnees !== "object" || donnees === null) return null;
  const message = (donnees as { message?: unknown }).message;
  return typeof message === "string" && message.trim() ? message.trim() : null;
}

/**
 * Le message unique des chemins assistés quand le fournisseur n'outille pas.
 *
 * Aucun repli texte n'est proposé ici, et c'est délibéré : deviner une
 * proposition dans de la prose est exactement la classe de bugs fermée par
 * ADR-031. Le chemin assisté s'annonce indisponible, l'utilisateur retombe
 * sur la saisie manuelle.
 */
export function messageSansOutils(quoi: string): string {
  return `Ton fournisseur de modèle n'accepte pas les appels d'outil : ${quoi} est indisponible. Le chat reste utilisable, et la saisie manuelle aussi.`;
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
