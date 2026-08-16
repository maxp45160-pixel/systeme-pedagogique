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
 *  - Bouton d'annulation (Arrêter).
 */
export function ChargementGeneration({
  progressionServeur,
  etapes = ETAPES_DEFAUT,
  dureeAsymptoteSec = 7,
  onArreter,
  className,
}: {
  progressionServeur?: string | null;
  etapes?: readonly string[];
  dureeAsymptoteSec?: number;
  onArreter?: () => void;
  className?: string;
}) {
  const [pourcentage, setPourcentage] = useState(0);
  const [etapeIndex, setEtapeIndex] = useState(0);

  useEffect(() => {
    const tempsDebut = Date.now();

    // Actualisation fluide (toutes les 100 ms) basée sur une asymptote lisse
    const intervalPourcent = setInterval(() => {
      const ecouleSec = (Date.now() - tempsDebut) / 1000;
      // Progression asymptotique naturelle : 94 * (1 - e^(-t / duree))
      const val = Math.min(
        94,
        Math.round(94 * (1 - Math.exp(-ecouleSec / dureeAsymptoteSec))),
      );
      setPourcentage((prev) => Math.max(prev, val));
    }, 100);

    const intervalEtape = setInterval(() => {
      setEtapeIndex((prev) => (prev < etapes.length - 1 ? prev + 1 : prev));
    }, 2600);

    return () => {
      clearInterval(intervalPourcent);
      clearInterval(intervalEtape);
    };
  }, [etapes, dureeAsymptoteSec]);

  const texteCourant = progressionServeur ?? etapes[etapeIndex];

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
            {pourcentage}%
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-surface-3">
          <div
            className="h-full rounded-full bg-primaire transition-all duration-300 ease-out"
            style={{ width: `${pourcentage}%` }}
          />
        </div>
      </div>

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
