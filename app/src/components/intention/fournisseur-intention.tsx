"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import { CaptureIntention } from "./capture-intention";
import {
  ContexteIntention,
  type ContexteIntentionType,
  type OptionsIntention,
} from "./contexte-intention";

/**
 * Le fournisseur d'intention monte la modale unique CaptureIntention (`+` / ADR-073).
 *
 * Il vit au sommet du layout partagé `(app)` et écoute les ouvertures
 * déclenchées par le rail, la barre mobile ou la marge du cahier via `useIntention()`.
 */
export function FournisseurIntention({
  compteId,
  children,
  domainesExistants = [],
}: {
  compteId: string;
  children: ReactNode;
  domainesExistants?: { id: string; nom: string; prefixe: string }[];
}) {
  const [ouverte, setOuverte] = useState(false);
  const [besoin, setBesoin] = useState<string | undefined>(undefined);
  const [contexte, setContexte] = useState<ContexteIntentionType>("general");

  const ouvrir = useCallback(
    (besoinOuOptions?: string | OptionsIntention, options?: OptionsIntention) => {
      let b: string | undefined;
      let c: ContexteIntentionType = "general";

      if (typeof besoinOuOptions === "string") {
        b = besoinOuOptions;
        if (options?.contexte) c = options.contexte;
      } else if (besoinOuOptions && typeof besoinOuOptions === "object") {
        b = besoinOuOptions.besoinInitial;
        if (besoinOuOptions.contexte) c = besoinOuOptions.contexte;
      }

      setBesoin(b);
      setContexte(c);
      setOuverte(true);
    },
    [],
  );

  const fermer = useCallback(() => {
    setOuverte(false);
    setBesoin(undefined);
    setContexte("general");
  }, []);

  const valeur = useMemo(() => ({ ouvrir, ouverte }), [ouvrir, ouverte]);

  return (
    <ContexteIntention.Provider value={valeur}>
      {children}
      {ouverte && (
        <CaptureIntention
          compteId={compteId}
          domainesExistants={domainesExistants}
          besoinInitial={besoin ?? ""}
          contexte={contexte}
          onFermer={fermer}
        />
      )}
    </ContexteIntention.Provider>
  );
}

