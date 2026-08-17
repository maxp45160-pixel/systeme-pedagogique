"use client";

import { useEffect, useState } from "react";
import { Bouton, cx } from "@/components/ui/primitives";

const ETAPES_DEFAUT = [
  "Prise de connaissance du contexte…",
  "Analyse et structuration par le tuteur IA…",
  "Formulation et vérification des critères…",
  "Finalisation de la proposition…",
];

/**
 * Composant partagé de chargement pour toutes les générations IA :
 *  - Barre de progression continue ultra-fluide avec pourcentage (asymptote naturelle).
 *  - Textes d'étapes dynamiques synchronisés ou message du serveur.
 *  - Mode squelette prédictif optionnel pour éliminer le Cumulative Layout Shift (CLS).
 *  - Bouton d'annulation (Arrêter).
 */
export function ChargementGeneration({
  progressionServeur,
  etapes = ETAPES_DEFAUT,
  dureeAsymptoteSec = 7,
  pourcentageMinimum = 0,
  modeApercu = "simple",
  onArreter,
  className,
}: {
  progressionServeur?: string | null;
  etapes?: readonly string[];
  dureeAsymptoteSec?: number;
  pourcentageMinimum?: number;
  modeApercu?: "simple" | "exercice" | "bilan";
  onArreter?: () => void;
  className?: string;
}) {
  const [pourcentage, setPourcentage] = useState(pourcentageMinimum);
  const [etapeIndex, setEtapeIndex] = useState(0);
  const [secondesEcoulees, setSecondesEcoulees] = useState(0);

  const nbEtapes = etapes.length;

  const pourcentageAffiche = Math.max(pourcentage, pourcentageMinimum);

  useEffect(() => {
    const tempsDebut = Date.now();

    // Actualisation fluide (toutes les 100 ms) basée sur une asymptote lisse
    const intervalPourcent = setInterval(() => {
      const ecouleSec = (Date.now() - tempsDebut) / 1000;
      setSecondesEcoulees(Math.floor(ecouleSec));
      // Progression asymptotique naturelle : 94 * (1 - e^(-t / duree))
      const val = Math.min(
        94,
        Math.round(94 * (1 - Math.exp(-ecouleSec / dureeAsymptoteSec))),
      );
      setPourcentage((prev) => Math.max(prev, val, pourcentageMinimum));
    }, 100);

    const intervalMs = Math.max(
      1600,
      Math.round((dureeAsymptoteSec * 1000) / Math.max(1, nbEtapes)),
    );
    const intervalEtape = setInterval(() => {
      setEtapeIndex((prev) => (prev < nbEtapes - 1 ? prev + 1 : prev));
    }, intervalMs);

    return () => {
      clearInterval(intervalPourcent);
      clearInterval(intervalEtape);
    };
  }, [nbEtapes, dureeAsymptoteSec, pourcentageMinimum]);

  const texteCourant = progressionServeur ?? etapes[etapeIndex];
  const seuilAlerteSec = Math.max(25, Math.round(dureeAsymptoteSec * 1.35));

  return (
    <div
      className={cx(
        "flex flex-col items-center justify-center rounded-xl border border-bordure bg-surface/50 p-6 text-center shadow-[var(--ombre-posee)]",
        className,
      )}
    >
      <div className="w-full max-w-md space-y-2.5">
        <div className="flex items-center justify-between text-xs font-medium text-texte-attenue">
          <span className="truncate">{texteCourant}</span>
          <span className="chiffres ml-3 shrink-0 font-semibold text-texte">
            {pourcentageAffiche}%
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-surface-3">
          <div
            className="h-full rounded-full bg-primaire transition-all duration-300 ease-out"
            style={{ width: `${pourcentageAffiche}%` }}
          />
        </div>
        {secondesEcoulees >= seuilAlerteSec && (
          <p className="text-[0.6875rem] text-texte-discret pt-1">
            En attente de la réponse complète du fournisseur IA ({secondesEcoulees} s écoulées)…
          </p>
        )}
      </div>

      {modeApercu === "exercice" && (
        <div className="mt-6 w-full max-w-lg space-y-3 rounded-lg border border-bordure/60 bg-surface-2/40 p-4 text-left animate-pulse" aria-hidden>
          <div className="flex items-center gap-2">
            <div className="h-4 w-20 rounded bg-surface-3" />
            <div className="h-4 w-24 rounded bg-surface-3" />
            <div className="h-4 w-16 rounded bg-surface-3" />
          </div>
          <div className="h-5 w-3/4 rounded bg-surface-3" />
          <div className="space-y-1.5 pt-1">
            <div className="h-3 w-full rounded bg-surface-3/80" />
            <div className="h-3 w-5/6 rounded bg-surface-3/80" />
            <div className="h-3 w-2/3 rounded bg-surface-3/80" />
          </div>
          <div className="pt-2">
            <div className="h-3 w-28 rounded bg-surface-3" />
            <div className="mt-1.5 h-12 w-full rounded bg-surface-3/50 border border-bordure/40" />
          </div>
        </div>
      )}

      {modeApercu === "bilan" && (
        <div className="mt-6 w-full max-w-lg space-y-3 rounded-lg border border-bordure/60 bg-surface-2/40 p-4 text-left animate-pulse" aria-hidden>
          <div className="flex items-center justify-between">
            <div className="h-4 w-32 rounded bg-surface-3" />
            <div className="h-4 w-20 rounded bg-surface-3" />
          </div>
          <div className="space-y-2 pt-1">
            <div className="h-10 w-full rounded bg-surface-3/60 border border-bordure/40" />
            <div className="h-10 w-full rounded bg-surface-3/60 border border-bordure/40" />
          </div>
        </div>
      )}

      {onArreter && (
        <Bouton
          onClick={onArreter}
          variante="secondaire"
          taille="petite"
          className="mt-6"
        >
          Arrêter
        </Bouton>
      )}
    </div>
  );
}

