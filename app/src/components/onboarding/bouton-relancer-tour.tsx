"use client";

import { useRouter } from "next/navigation";
import { Bouton } from "@/components/ui/primitives";
import { useOnboarding } from "./onboarding-context";

export function BoutonRelancerTour({
  tourId = "dashboard_v1",
  libelle = "Relancer la visite guidée",
  redirigerVers = "/",
}: {
  tourId?: string;
  libelle?: string;
  redirigerVers?: string;
}) {
  const { reinitialiserTour } = useOnboarding();
  const router = useRouter();

  function relancer() {
    reinitialiserTour(tourId);
    if (redirigerVers) {
      router.push(redirigerVers);
    }
  }

  return (
    <Bouton type="button" onClick={relancer} variante="secondaire" taille="petite">
      <span>{libelle}</span>
    </Bouton>
  );
}
