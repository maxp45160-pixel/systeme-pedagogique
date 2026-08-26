"use client";

import { createContext, useContext } from "react";

/**
 * Le point d'entrée `+` est unique, ses déclencheurs ne le sont pas.
 *
 * Le contexte tient l'état d'ouverture au-dessus de l'arbre pour que le rail desktop,
 * la barre mobile et la marge du cahier ouvrent tous la même instance unique.
 */

/**
 * `projet` et `referentiel` portent l'orientation choisie à l'amorçage —
 * un INDICE transmis au tuteur, jamais une contrainte : la consigne qui en
 * découle dans le prompt est souple, et aucun recadrage déterministe ne s'y
 * attache. Le point d'entrée `+` d'un compte établi reste sur `general`.
 */
export type ContexteIntentionType = "general" | "domaine" | "projet" | "referentiel";

/** Cadre explicite demandé depuis l'entrée unique de déclaration. */
export type UsageDomaineIntention = "module" | "continu";

export interface OptionsIntention {
  besoinInitial?: string;
  contexte?: ContexteIntentionType;
  /** Ouvre directement le chemin de création d'un domaine avec sa nature. */
  usageDomaine?: UsageDomaineIntention;
}

export interface EtatIntention {
  ouvrir: (besoinOuOptions?: string | OptionsIntention, options?: OptionsIntention) => void;
  ouverte: boolean;
}

export const ContexteIntention = createContext<EtatIntention | null>(null);

export function useIntention(): EtatIntention {
  const valeur = useContext(ContexteIntention);
  if (!valeur) {
    throw new Error("useIntention doit être utilisé sous FournisseurIntention.");
  }
  return valeur;
}

