"use client";

/**
 * Le tuteur, accessible de partout — en tiroir, pas en navigation.
 *
 * Le bouton flottant ouvre le tiroir et garde la page visible derrière lui.
 * Les données pédagogiques initiales sont désormais chargées à la demande
 * lors du premier clic, afin de ne pas ralentir le chargement initial du layout.
 */

import { HorsPageContextuelle } from "@/components/tuteur/hors-page-contextuelle";
import { TiroirTuteur } from "@/components/tuteur/tiroir-tuteur";

export function TuteurGlobal() {
  return (
    <HorsPageContextuelle>
      <TiroirTuteur
        declencheur="flottant"
        libelle="Ouvrir le tuteur"
      />
    </HorsPageContextuelle>
  );
}
