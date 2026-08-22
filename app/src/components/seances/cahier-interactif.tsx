"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import type { LearningSession, ExerciseAttempt } from "@/lib/domain/types";
import type { LigneMarge } from "@/lib/documents/marge";
import type { DonneesSeance } from "@/components/seances/concepteur-seance";
import {
  moisDuJour,
  moisValide,
  type DocumentOperationnelDate,
} from "@/lib/domain/pages-cahier";
import { moisAffiche } from "@/components/seances/calendrier-cahier";
import { Bureau } from "@/components/seances/bureau";
import { CahierArchive } from "@/components/seances/cahier-archive";

/** Les deux lectures de la même route (ADR-101). */
type Vue = "bureau" | "cahier";

/**
 * Le conteneur des deux modes du pôle.
 *
 * Toutes les données sont reçues une fois du serveur, puis la navigation —
 * entre les jours comme entre les deux modes — est locale et instantanée.
 */
export function CahierInteractif({
  jourInitial,
  moisInitial,
  vueInitiale = "bureau",
  jours,
  seances,
  tentatives,
  donnees,
  notes,
  projets = [],
  aujourdHuiIso,
  compteId,
  recherche,
  compositeur,
  seanceDeployee,
}: {
  /** Le jour ouvert : la page du jour, sauf lien explicite (`?jour=`, `?session=`). */
  jourInitial: string;
  moisInitial?: string;
  /** `cahier` quand l'URL porte `?vue=cahier` ou une recherche. */
  vueInitiale?: Vue;
  jours: string[];
  seances: LearningSession[];
  tentatives: ExerciseAttempt[];
  donnees: DonneesSeance;
  notes: LigneMarge[];
  projets?: DocumentOperationnelDate[];
  aujourdHuiIso: string;
  compteId: string;
  /** Terme de recherche actif, le cas échéant. Le Cahier s'ouvre dessus. */
  recherche?: string;
  compositeur?: ReactNode;
  seanceDeployee?: { id: string; contenu: ReactNode };
}) {
  const [jour, setJour] = useState<string>(jourInitial);
  const [mois, setMois] = useState<string>(() =>
    moisAffiche(moisValide(moisInitial), jourInitial),
  );
  const [vue, setVue] = useState<Vue>(vueInitiale);
  const aujourdHui = useMemo(() => new Date(aujourdHuiIso), [aujourdHuiIso]);

  /**
   * Navigation locale instantanée entre les pages. Aucune écriture : ni
   * marque-page (le cahier rouvre toujours sur la page du jour — un marque-
   * page qui ramenait trois jours en arrière était une friction, pas un
   * confort), ni URL (un `?jour=` posé par `replaceState` deviendrait un lien
   * explicite au rechargement et réintroduirait l'ouverture dans le passé).
   */
  const allerALaPage = useCallback((cible: string) => {
    setJour(cible);
    setMois(moisDuJour(cible));
    // Ouvrir un jour depuis l'archive ramène AU Bureau, sur ce jour-là :
    // on ne clique pas une vignette pour rester dans la grille.
    setVue("bureau");
  }, []);

  const ouvrirCahier = useCallback(() => setVue("cahier"), []);
  const fermerCahier = useCallback(() => setVue("bureau"), []);

  if (vue === "cahier") {
    return (
      <CahierArchive
        mois={mois}
        jours={jours}
        seances={seances}
        tentatives={tentatives}
        notes={notes}
        projets={projets}
        donnees={donnees}
        recherche={recherche}
        onChangerJour={allerALaPage}
        onChangerMois={setMois}
        onFermer={fermerCahier}
      />
    );
  }

  return (
    <>
      {compositeur}

      <Bureau
        jour={jour}
        jours={jours}
        mois={mois}
        seances={seances}
        tentatives={tentatives}
        donnees={donnees}
        notes={notes}
        projets={projets}
        aujourdHui={aujourdHui}
        compteId={compteId}
        onChangerJour={allerALaPage}
        onChangerMois={setMois}
        onOuvrirCahier={ouvrirCahier}
        seanceDeployee={seanceDeployee}
      />
    </>
  );
}
