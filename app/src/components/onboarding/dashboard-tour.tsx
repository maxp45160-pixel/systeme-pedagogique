"use client";

import { useEffect } from "react";
import { GuideTour, type EtapeTour } from "./guide-tour";
import { useOnboarding } from "./onboarding-context";

const TOUR_DASHBOARD_ID = "dashboard_v1";

const ETAPES_DASHBOARD: EtapeTour[] = [
  {
    id: "action-prioritaire",
    cibleSelector: '[data-tour="action-prioritaire"]',
    titre: "🎯 Ton point de départ : l'Action Prioritaire",
    description:
      "Le système ne te noie pas sous des listes infinies : il analyse en continu ton niveau et tes objectifs pour te proposer toujours la meilleure action étayée à faire maintenant. C'est ici que tu démarres !",
    position: "bottom",
    badge: "1/4 · L'Action du jour",
    boutonTexte: "Découvrir la suite",
  },
  {
    id: "nouveau-besoin",
    cibleSelector: '[data-tour="nouveau-besoin"]',
    titre: "✨ Le bouton unique « + » (Nouveau besoin)",
    description:
      "Une envie spontanée ? Réviser un point précis, ajouter une note, lancer un mini-projet ou étendre ton référentiel : écris simplement ce dont tu as besoin en une phrase, le système choisit l'outil adéquat.",
    position: "right",
    badge: "2/4 · Point d'entrée",
    boutonTexte: "Voir les espaces",
  },
  {
    id: "navigation-rail",
    cibleSelector: '[data-tour="navigation-rail"]',
    titre: "🧭 Tes espaces de travail",
    description:
      "L'Atelier regroupe ton référentiel et tes notes de travail. Le Cahier organise tes séances d'entraînement. La Progression mesure tes acquis réels à partir de preuves factuelles.",
    position: "right",
    badge: "3/4 · Navigation",
    boutonTexte: "Découvrir le tuteur",
  },
  {
    id: "tuteur-flottant",
    cibleSelector: '[data-tour="tuteur-flottant"]',
    titre: "🤖 Ton Tuteur IA disponible à tout moment",
    description:
      "Une question, une incompréhension ou besoin d'explications sur un concept ? Ton tuteur est toujours accessible d'un clic en bas à droite pour t'accompagner sans jamais altérer tes mesures de compétences.",
    position: "left",
    badge: "4/4 · Accompagnement",
    boutonTexte: "C'est parti !",
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
