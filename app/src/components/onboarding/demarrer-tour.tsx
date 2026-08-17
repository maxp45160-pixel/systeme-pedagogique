"use client";

import { useEffect } from "react";
import { GuideTour, type EtapeTour } from "./guide-tour";
import { useOnboarding } from "./onboarding-context";

export const TOUR_DEMARRER_ID = "demarrer_v2";

const ETAPES_DEMARRER: EtapeTour[] = [
  {
    id: "cle-ia",
    cibleSelector: '[data-tour="cle-ia"]',
    titre: "Votre clé IA",
    description:
      "Le tuteur a besoin d'une clé pour écrire vos exercices (Mistral, Groq gratuit, Anthropic, OpenAI). Renseignez-la ici : elle reste dans votre navigateur, elle n'est jamais envoyée ailleurs.",
    position: "bottom",
    badge: "1/3 · Tuteur IA",
    boutonTexte: "Voir les exemples",
  },
  {
    id: "exemples-inspiration",
    cibleSelector: '[data-tour="exemples-inspiration"]',
    titre: "Des exemples tout prêts",
    description:
      "Choisissez un exemple proche de votre sujet : le formulaire se remplit tout seul, vous n'avez plus qu'à ajuster.",
    position: "bottom",
    badge: "2/3 · Inspiration",
    boutonTexte: "Personnaliser",
  },
  {
    id: "style-apprentissage",
    cibleSelector: '[data-tour="style-apprentissage"]',
    titre: "Comment préférez-vous vous entraîner ?",
    description:
      "Dites-nous comment vous apprenez le mieux : en pratiquant, avec des cas concrets, pas à pas, ou en partant de la théorie. Les exercices suivront.",
    position: "top",
    badge: "3/3 · Votre façon d'apprendre",
    boutonTexte: "C'est parti",
  },
];

export function DemarrerTour({
  autoDemarrage = true,
}: {
  autoDemarrage?: boolean;
}) {
  const { tourActif, lancerTour, terminerTour, estTourTermine } =
    useOnboarding();

  useEffect(() => {
    if (autoDemarrage && !estTourTermine(TOUR_DEMARRER_ID)) {
      const timer = setTimeout(() => {
        lancerTour(TOUR_DEMARRER_ID);
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [autoDemarrage, estTourTermine, lancerTour]);

  const actif = tourActif === TOUR_DEMARRER_ID;

  return (
    <GuideTour
      tourId={TOUR_DEMARRER_ID}
      etapes={ETAPES_DEMARRER}
      actif={actif}
      surTerminer={() => terminerTour(TOUR_DEMARRER_ID)}
      surPasser={() => terminerTour(TOUR_DEMARRER_ID)}
    />
  );
}
