"use client";

import { useEffect } from "react";
import { GuideTour, type EtapeTour } from "./guide-tour";
import { destinationsPrincipales, resumeDestinations } from "@/components/layout/navigation";
import { useOnboarding } from "./onboarding-context";

const TOUR_DASHBOARD_ID = "dashboard_v1";

const ETAPES_DASHBOARD: EtapeTour[] = [
  {
    id: "action-prioritaire",
    cibleSelector: '[data-tour="action-prioritaire"]',
    titre: "Votre priorité du jour",
    description:
      "Pas de liste interminable : une seule chose à faire maintenant, choisie d'après votre niveau et vos objectifs. C'est par là qu'on commence.",
    position: "bottom",
    badge: "1/4 · Votre priorité",
    boutonTexte: "Découvrir la suite",
  },
  {
    id: "nouveau-besoin",
    cibleSelector: '[data-tour="nouveau-besoin"]',
    titre: "Le bouton « + »",
    description:
      "Une envie du moment ? Réviser un point, poser une note, lancer un projet : écrivez-le en une phrase, on s'occupe du reste.",
    position: "right",
    badge: "2/4 · Le bouton +",
    boutonTexte: "Voir les espaces",
  },
  {
    id: "navigation-rail",
    cibleSelector: '[data-tour="navigation-rail"]',
    /*
      Titre et description dérivés de `NAVIGATION`, pas recopiés.

      La version recopiée annonçait « vos trois espaces — l'Atelier, le Cahier,
      la Progression » en surlignant un rail qui en montrait quatre, dont un
      « Bureau » qu'elle passait sous silence et un « Cahier » retiré par
      ADR-103. C'est la première chose que voit un compte neuf ; elle ne peut
      pas être la moins fiable.
    */
    titre: `Vos ${destinationsPrincipales().length} espaces`,
    description: resumeDestinations(),
    position: "right",
    badge: "3/4 · Les espaces",
    boutonTexte: "Découvrir le tuteur",
  },
  {
    id: "tuteur-flottant",
    cibleSelector: '[data-tour="tuteur-flottant"]',
    titre: "Votre tuteur, à tout moment",
    description:
      "Une question, un point qui bloque ? Le tuteur est accessible d'un clic en bas à droite. Il explique et il écrit des exercices — il ne touche jamais à vos niveaux.",
    position: "left",
    badge: "4/4 · Le tuteur",
    boutonTexte: "C'est parti",
  },
];

export function DashboardTour({
  autoDemarrage = false,
}: {
  /** Si vrai et que le tour n'a jamais été fait, il démarre automatiquement */
  autoDemarrage?: boolean;
}) {
  const { tourActif, lancerTour, terminerTour, estTourTermine } =
    useOnboarding();

  useEffect(() => {
    if (!autoDemarrage || estTourTermine(TOUR_DASHBOARD_ID)) return;
    // Court délai pour laisser le temps au DOM de se peindre
    const timer = setTimeout(() => {
      lancerTour(TOUR_DASHBOARD_ID);
    }, 600);
    return () => clearTimeout(timer);
  }, [autoDemarrage, estTourTermine, lancerTour]);

  const actif = tourActif === TOUR_DASHBOARD_ID;

  return (
    <GuideTour
      tourId={TOUR_DASHBOARD_ID}
      etapes={ETAPES_DASHBOARD}
      actif={actif}
      surTerminer={() => terminerTour(TOUR_DASHBOARD_ID)}
      surPasser={() => terminerTour(TOUR_DASHBOARD_ID)}
    />
  );
}
