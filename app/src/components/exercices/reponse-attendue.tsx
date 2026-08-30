"use client";

import { PanneauPliable } from "@/components/ui/panneau-pliable";
import { Markdown } from "@/components/ui/markdown";

/** Correction de référence, cachée pendant la recherche et relisible après. */
export function ReponseAttendue({
  correction,
  legende,
  ouvertParDefaut = false,
}: {
  correction: string;
  legende: string;
  ouvertParDefaut?: boolean;
}) {
  return (
    <PanneauPliable
      ouvertParDefaut={ouvertParDefaut}
      titre={<span className="text-sm font-medium">Réponse attendue</span>}
      sousEntete={<p className="mt-0.5 text-xs text-texte-attenue">{legende}</p>}
    >
      <div className="px-4 py-3.5 text-sm">
        <Markdown contenu={correction} />
      </div>
    </PanneauPliable>
  );
}
