"use client";

import { useIntention } from "@/components/intention/contexte-intention";

/**
 * Traiter une ligne de la marge.
 *
 * Ouvre le point d'entrée unique d'intention (`FournisseurIntention` / ADR-073)
 * pré-rempli avec le texte noté dans la marge.
 */
export function TraiterLigneMarge({
  texte,
}: {
  compteId?: string;
  texte: string;
}) {
  const { ouvrir } = useIntention();

  return (
    <button
      type="button"
      onClick={() => ouvrir(texte)}
      className="text-xs font-medium text-primaire hover:underline"
    >
      Traiter
    </button>
  );
}

