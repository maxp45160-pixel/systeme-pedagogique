"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import { CaptureIntention } from "./capture-intention";
import {
  ContexteIntention,
  type ContexteIntentionType,
  type OptionsIntention,
  type UsageDomaineIntention,
} from "./contexte-intention";
import { useOnboarding } from "@/components/onboarding/onboarding-context";

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
  const [usageDomaine, setUsageDomaine] = useState<UsageDomaineIntention | undefined>(undefined);
  const { tourActif } = useOnboarding();

  const ouvrir = useCallback(
    (besoinOuOptions?: string | OptionsIntention, options?: OptionsIntention) => {
      // Contrat « une seule surface pleine page à la fois » : pendant un
      // tour actif, la capture ne s'ouvre pas. Sans ce verrou, le guide et
      // la modale se superposaient — deux masques sombres cumulés, la fiche
      // du tour flottant au-dessus du titre (audit du 21/08/2026). Le tour
      // se termine ou se passe d'abord.
      if (tourActif) return;

      let b: string | undefined;
      let c: ContexteIntentionType = "general";
      let u: UsageDomaineIntention | undefined;

      if (typeof besoinOuOptions === "string") {
        b = besoinOuOptions;
        if (options?.contexte) c = options.contexte;
        u = options?.usageDomaine;
      } else if (besoinOuOptions && typeof besoinOuOptions === "object") {
        b = besoinOuOptions.besoinInitial;
        if (besoinOuOptions.contexte) c = besoinOuOptions.contexte;
        u = besoinOuOptions.usageDomaine;
      }

      setBesoin(b);
      setContexte(c);
      setUsageDomaine(u);
      setOuverte(true);
    },
    [tourActif],
  );

  const fermer = useCallback(() => {
    setOuverte(false);
    setBesoin(undefined);
    setContexte("general");
    setUsageDomaine(undefined);
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
          usageDomaine={usageDomaine}
          onFermer={fermer}
        />
      )}
    </ContexteIntention.Provider>
  );
}

