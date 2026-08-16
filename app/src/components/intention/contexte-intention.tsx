"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { CaptureIntention } from "./capture-intention";

/**
 * Le point d'entrée `+` est unique, ses déclencheurs ne le sont pas.
 *
 * Le rail desktop et la barre mobile portent chacun leur bouton, et la modale
 * doit rester la même : deux montages produiraient deux états de saisie, donc
 * deux traductions concurrentes pour un seul besoin. Le contexte tient l'état
 * ouvert / fermé au-dessus des deux barres, la modale est montée une fois.
 *
 * Un contexte plutôt qu'un événement global : le déclencheur qui ne trouverait
 * pas son provider doit échouer à la compilation, pas rester un bouton inerte.
 */

interface EtatIntention {
  ouvrir: () => void;
  ouverte: boolean;
}

const ContexteIntention = createContext<EtatIntention | null>(null);

export function FournisseurIntention({
  compteId,
  children,
}: {
  compteId: string;
  children: ReactNode;
}) {
  const [ouverte, setOuverte] = useState(false);
  const ouvrir = useCallback(() => setOuverte(true), []);
  const valeur = useMemo(() => ({ ouvrir, ouverte }), [ouvrir, ouverte]);

  return (
    <ContexteIntention.Provider value={valeur}>
      {children}
      {ouverte && (
        <CaptureIntention compteId={compteId} onFermer={() => setOuverte(false)} />
      )}
    </ContexteIntention.Provider>
  );
}

export function useIntention(): EtatIntention {
  const valeur = useContext(ContexteIntention);
  if (!valeur) {
    throw new Error("useIntention doit être utilisé sous FournisseurIntention.");
  }
  return valeur;
}
