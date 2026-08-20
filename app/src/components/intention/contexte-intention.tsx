"use client";

import { createContext, useContext } from "react";

/**
 * Le point d'entrée `+` est unique, ses déclencheurs ne le sont pas.
 *
 * Le contexte tient l'état d'ouverture au-dessus de l'arbre pour que le rail desktop,
 * la barre mobile et la marge du cahier ouvrent tous la même instance unique.
 */

export interface EtatIntention {
  ouvrir: (besoinInitial?: string) => void;
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
