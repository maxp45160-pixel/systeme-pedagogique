"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import { moisDuJour, moisValide } from "@/lib/domain/pages-cahier";
import { moisAffiche } from "@/components/seances/calendrier-cahier";
import { Bureau, type EntreesCahier } from "@/components/seances/bureau";
import { CahierArchive } from "@/components/seances/cahier-archive";

/** Les deux lectures de la même route (ADR-103). */
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
  entrees,
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
  entrees: EntreesCahier;
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
   * marque-page (le Bureau rouvre toujours sur la page du jour — un marque-
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
        entrees={entrees}
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
        entrees={entrees}
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
