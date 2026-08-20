"use client";

import { useState, useEffect, useCallback, useMemo, useRef, type ReactNode } from "react";
import type { LearningSession, ExerciseAttempt } from "@/lib/domain/types";
import type { LigneMarge } from "@/lib/documents/marge";
import type { DonneesSeance } from "@/components/seances/concepteur-seance";
import {
  moisDuJour,
  moisValide,
  pageDOuverture,
  type DocumentOperationnelDate,
  type PositionFeuillet,
} from "@/lib/domain/pages-cahier";
import { cleMarquePage, ecrireLocal, lireLocal } from "@/lib/ui/stockage-local";
import { moisAffiche } from "@/components/seances/calendrier-cahier";
import { OngletsSeancesOuvertes } from "@/components/seances/file-seances";
import { PageCahier } from "@/components/seances/page-cahier";
import { RechercheCahier } from "@/components/seances/cahier-seances";
import type { TournePageHandle } from "@/components/seances/tourne-page";

interface PoseMarquePage {
  jour: string;
  rang: number;
}

function lirePose(cle: string): PoseMarquePage | null {
  const brut = lireLocal<string | PoseMarquePage>(cle);
  if (!brut) return null;
  if (typeof brut === "string") return { jour: brut, rang: 1 };
  if (typeof brut.jour !== "string") return null;
  return { jour: brut.jour, rang: typeof brut.rang === "number" ? brut.rang : 1 };
}

function lienFeuillet(position: PositionFeuillet): string {
  const base = `/seances?jour=${encodeURIComponent(position.jour)}`;
  return position.rang > 1 ? `${base}&f=${position.rang}` : base;
}

export function CahierInteractif({
  compteId,
  jourInitial,
  jourExplicite,
  feuilletInitial,
  moisInitial,
  jours,
  nombresDeFeuilletsMap,
  seances,
  tentatives,
  donnees,
  notes,
  projets = [],
  aujourdHuiIso,
  compositeur,
  seanceDeployee,
}: {
  compteId: string;
  jourInitial: string;
  jourExplicite: boolean;
  feuilletInitial: number | null;
  moisInitial?: string;
  jours: string[];
  nombresDeFeuilletsMap: [string, number][];
  seances: LearningSession[];
  tentatives: ExerciseAttempt[];
  donnees: DonneesSeance;
  notes: LigneMarge[];
  projets?: DocumentOperationnelDate[];
  aujourdHuiIso: string;
  compositeur?: ReactNode;
  seanceDeployee?: { id: string; contenu: ReactNode };
}) {
  const tourneRef = useRef<TournePageHandle>(null);
  const nombresDeFeuillets = useMemo(
    () => new Map(nombresDeFeuilletsMap),
    [nombresDeFeuilletsMap],
  );
  const aujourdHui = useMemo(() => new Date(aujourdHuiIso), [aujourdHuiIso]);

  // Initialisation immédiate : si le jour n'a pas été demandé explicitement dans l'URL,
  // on vérifie le marque-page local sans provoquer de double rendu serveur.
  const [jour, setJour] = useState<string>(() => {
    if (jourExplicite) return jourInitial;
    if (typeof window !== "undefined") {
      const pose = lirePose(cleMarquePage(compteId));
      if (pose?.jour) {
        return pageDOuverture(pose.jour, jours, aujourdHui);
      }
    }
    return jourInitial;
  });

  const [rang, setRang] = useState<number>(() => {
    if (jourExplicite && feuilletInitial) return Math.max(1, feuilletInitial);
    if (!jourExplicite && typeof window !== "undefined") {
      const pose = lirePose(cleMarquePage(compteId));
      if (pose?.jour === jour && typeof pose.rang === "number") {
        return Math.max(1, pose.rang);
      }
    }
    return feuilletInitial ? Math.max(1, feuilletInitial) : 1;
  });

  const [mois, setMois] = useState<string>(() =>
    moisAffiche(moisValide(moisInitial), jour),
  );

  // Navigation locale instantanée avec déclenchement de l'animation 3D fluide
  const allerAuFeuillet = useCallback(
    (position: PositionFeuillet, sens?: "avant" | "arriere") => {
      const direction = sens === "arriere" ? -1 : 1;
      tourneRef.current?.tourner(direction);

      setJour(position.jour);
      setRang(position.rang);
      setMois(moisDuJour(position.jour));

      // Sauvegarde du marque-page
      ecrireLocal(cleMarquePage(compteId), { jour: position.jour, rang: position.rang });

      // Synchronisation de l'URL sans rechargement de page
      if (typeof window !== "undefined") {
        window.history.replaceState(null, "", lienFeuillet(position));
      }
    },
    [compteId],
  );

  const changerMois = useCallback((nouveauMois: string) => {
    setMois(nouveauMois);
  }, []);

  // Synchronisation lors de l'historique navigateur (bouton Précédent / Suivant)
  useEffect(() => {
    function onPopState() {
      const params = new URLSearchParams(window.location.search);
      const j = params.get("jour");
      const f = params.get("f");
      if (j && jours.includes(j)) {
        setJour(j);
        setRang(f ? Math.max(1, parseInt(f, 10) || 1) : 1);
        setMois(moisDuJour(j));
      }
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [jours]);

  // Synchronisation de l'URL initiale si on a repris un marque-page
  useEffect(() => {
    if (!jourExplicite && typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (!params.has("jour")) {
        window.history.replaceState(null, "", lienFeuillet({ jour, rang }));
      }
    }
  }, [jour, rang, jourExplicite]);

  return (
    <div className="space-y-8">
      {compositeur}

      {/* Onglets qui dépassent du cahier pour les séances ouvertes ailleurs */}
      <div className="h-9 flex items-center w-full min-w-0 overflow-hidden">
        <OngletsSeancesOuvertes
          seances={seances}
          tentatives={tentatives}
          notes={notes}
          projets={projets}
          jourAffiche={jour}
          rangAffiche={rang}
          onNaviguer={(pos) =>
            allerAuFeuillet(
              pos,
              pos.jour > jour || (pos.jour === jour && pos.rang > rang) ? "avant" : "arriere",
            )
          }
        />
      </div>

      <PageCahier
        jour={jour}
        jours={jours}
        rang={rang}
        nombresDeFeuillets={nombresDeFeuillets}
        mois={mois}
        seances={seances}
        tentatives={tentatives}
        donnees={donnees}
        notes={notes}
        projets={projets}
        aujourdHui={aujourdHui}
        onChangerFeuillet={allerAuFeuillet}
        onChangerMois={changerMois}
        seanceDeployee={seanceDeployee}
        refTourne={tourneRef}
      />

      <section className="space-y-2 border-t border-bordure pt-6">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-texte-discret">
          Chercher dans tout le cahier
        </h2>
        <RechercheCahier />
      </section>
    </div>
  );
}
