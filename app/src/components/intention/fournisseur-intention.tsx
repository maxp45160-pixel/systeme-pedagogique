"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import { CaptureIntention } from "./capture-intention";
import { ContexteIntention } from "./contexte-intention";

/**
 * Le fournisseur d'intention monte la modale unique CaptureIntention (`+` / ADR-073).
 *
 * Il vit au sommet du layout partagé `(app)` et écoute les ouvertures
 * déclenchées par le rail, la barre mobile ou la marge du cahier via `useIntention()`.
 */
export function FournisseurIntention({
  compteId,
  children,
}: {
  compteId: string;
  children: ReactNode;
}) {
  const [ouverte, setOuverte] = useState(false);
  const [besoin, setBesoin] = useState<string | undefined>(undefined);
  const ouvrir = useCallback((besoinInitial?: string) => {
    setBesoin(besoinInitial);
    setOuverte(true);
  }, []);
  const fermer = useCallback(() => {
    setOuverte(false);
    setBesoin(undefined);
  }, []);
  const valeur = useMemo(() => ({ ouvrir, ouverte }), [ouvrir, ouverte]);

  return (
    <ContexteIntention.Provider value={valeur}>
      {children}
      {ouverte && (
        <CaptureIntention
          compteId={compteId}
          besoinInitial={besoin ?? ""}
          onFermer={fermer}
        />
      )}
    </ContexteIntention.Provider>
  );
}
