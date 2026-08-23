"use client";

import { useEffect, useMemo } from "react";
import { GuideTour, type EtapeTour } from "./guide-tour";
import { useOnboarding } from "./onboarding-context";

export const TOUR_DEMARRER_ID = "demarrer_v2";

/**
 * Une étape avant numérotation.
 *
 * Le badge (« 1/3 ») était écrit à la main dans chaque étape. Depuis ADR-116
 * l'étape de la clé disparaît quand le serveur génère : un badge figé aurait
 * annoncé « 2/3 » sur la première étape affichée. Il est donc calculé à partir
 * des étapes réellement retenues — la seule source qui ne peut pas mentir.
 */
type EtapeSource = Omit<EtapeTour, "badge"> & { court: string };

const ETAPE_CLE: EtapeSource = {
  id: "cle-ia",
  cibleSelector: '[data-tour="cle-ia"]',
  court: "Tuteur IA",
  titre: "Votre clé IA",
  description:
    "Le tuteur a besoin d'une clé pour écrire vos exercices (Mistral, Groq gratuit, Anthropic, OpenAI). Renseignez-la ici : elle reste dans votre navigateur, elle n'est jamais envoyée ailleurs.",
  position: "bottom",
  boutonTexte: "Voir les exemples",
};

const ETAPES_COMMUNES: EtapeSource[] = [
  {
    id: "exemples-inspiration",
    cibleSelector: '[data-tour="exemples-inspiration"]',
    court: "Inspiration",
    titre: "Des exemples tout prêts",
    description:
      "Choisissez un exemple proche de votre sujet : le formulaire se remplit tout seul, vous n'avez plus qu'à ajuster.",
    position: "bottom",
    boutonTexte: "Personnaliser",
  },
  {
    id: "style-apprentissage",
    cibleSelector: '[data-tour="style-apprentissage"]',
    court: "Votre façon d'apprendre",
    titre: "Comment préférez-vous vous entraîner ?",
    description:
      "Dites-nous comment vous apprenez le mieux : en pratiquant, avec des cas concrets, pas à pas, ou en partant de la théorie. Les exercices suivront.",
    position: "top",
    boutonTexte: "C'est parti",
  },
];

function numeroter(sources: EtapeSource[]): EtapeTour[] {
  return sources.map(({ court, ...etape }, index) => ({
    ...etape,
    badge: `${index + 1}/${sources.length} · ${court}`,
    // La dernière étape ferme le tour : son libellé ne doit pas promettre une
    // suite qui n'existe pas.
    boutonTexte: index === sources.length - 1 ? "C'est parti" : etape.boutonTexte,
  }));
}

export function DemarrerTour({
  autoDemarrage = true,
  afficherEtapeCle = true,
}: {
  autoDemarrage?: boolean;
  /**
   * Le bloc « clé IA » est-il rendu sur la page ?
   *
   * Faux quand la clé serveur suffit : l'étape doit disparaître avec sa cible.
   * `GuideTour` ne plante pas sur un sélecteur introuvable — il rend l'étape
   * sans projecteur — mais il décrirait alors un bloc absent de l'écran.
   */
  afficherEtapeCle?: boolean;
}) {
  const { tourActif, lancerTour, terminerTour, estTourTermine } =
    useOnboarding();

  const etapes = useMemo(
    () => numeroter(afficherEtapeCle ? [ETAPE_CLE, ...ETAPES_COMMUNES] : ETAPES_COMMUNES),
    [afficherEtapeCle],
  );

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
      etapes={etapes}
      actif={actif}
      surTerminer={() => terminerTour(TOUR_DEMARRER_ID)}
      surPasser={() => terminerTour(TOUR_DEMARRER_ID)}
    />
  );
}
