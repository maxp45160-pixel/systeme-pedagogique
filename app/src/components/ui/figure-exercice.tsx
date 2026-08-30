"use client";

/* Source résolue pouvant être une URL signée : l'image native reste adaptée à l'impression. */
/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import { cx } from "@/components/ui/primitives";
import type { FigureExercice } from "@/lib/domain/figure-exercice";

/**
 * Rendu accessible, responsive et imprimable d'une figure d'exercice.
 *
 * Le composant ne téléverse rien et ne génère aucune image. `source` doit déjà
 * être une URL autorisée et résolue par la couche qui possède la donnée.
 */
export function FigureExercice({
  figure,
  className,
}: {
  figure?: FigureExercice;
  className?: string;
}) {
  const [sourceEnErreur, setSourceEnErreur] = useState<string | null>(null);

  if (!figure) return null;

  const alt = figure.alt.trim() || "Illustration indisponible";
  const source = figure.source.trim();
  const largeur = typeof figure.largeur === "number" && Number.isInteger(figure.largeur) && figure.largeur > 0
    ? figure.largeur
    : undefined;
  const hauteur = typeof figure.hauteur === "number" && Number.isInteger(figure.hauteur) && figure.hauteur > 0
    ? figure.hauteur
    : undefined;
  const legende = figure.legende?.trim();
  const afficherSecours = sourceEnErreur === source || !source;

  return (
    <figure className={cx("figure-exercice", className)}>
      {afficherSecours ? (
        <div
          role="img"
          aria-label={`${alt}. Illustration indisponible.`}
          aria-live="polite"
          className="flex min-h-24 items-center justify-center rounded-md border border-dashed border-bordure bg-surface-2 px-4 py-6 text-center text-sm text-texte-attenue"
        >
          Illustration indisponible.
        </div>
      ) : (
        <img
          src={source}
          alt={alt}
          width={largeur}
          height={hauteur}
          onError={() => setSourceEnErreur(source)}
          className="block h-auto max-w-full rounded-md border border-bordure object-contain"
        />
      )}
      {legende && <figcaption className="mt-2 text-center text-xs text-texte-attenue">{legende}</figcaption>}
    </figure>
  );
}
