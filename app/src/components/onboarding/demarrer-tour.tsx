"use client";

import { useEffect } from "react";
import { GuideTour, type EtapeTour } from "./guide-tour";
import { useOnboarding } from "./onboarding-context";

export const TOUR_DEMARRER_ID = "demarrer_v2";

const ETAPES_DEMARRER: EtapeTour[] = [
  {
    id: "cle-ia",
    cibleSelector: '[data-tour="cle-ia"]',
    titre: "🔑 Clé IA : Prête à l'emploi",
    description:
      "Le tuteur fonctionne avec ton fournisseur IA préféré (Mistral, Groq gratuit, Anthropic, OpenAI). Configure ta clé ici si ce n'est pas déjà fait : elle reste sécurisée dans ton navigateur.",
    position: "bottom",
    badge: "1/3 · Tuteur IA",
    boutonTexte: "Voir les exemples",
  },
  {
    id: "exemples-inspiration",
    cibleSelector: '[data-tour="exemples-inspiration"]',
    titre: "💡 Exemples en 1 clic",
    description:
      "Gagne du temps : choisis un exemple concret (Développement Web, Data & IA, Droit...) pour pré-remplir instantanément ton sujet et ton objectif.",
    position: "bottom",
    badge: "2/3 · Inspiration",
    boutonTexte: "Personnaliser",
  },
  {
    id: "style-apprentissage",
    cibleSelector: '[data-tour="style-apprentissage"]',
    titre: "⚡ Ton style d'apprentissage",
    description:
      "Indique en 1 clic comment tu souhaites que le tuteur t'enseigne (pratique & code, cas concrets, rigueur théorique, pas-à-pas). L'IA adaptera immédiatement ses explications et exercices !",
    position: "top",
    badge: "3/3 · Sur-mesure",
    boutonTexte: "C'est parti !",
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
