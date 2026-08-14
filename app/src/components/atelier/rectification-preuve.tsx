"use client";

import { rectifyEvidence } from "@/lib/store/adaptive-actions";
import { Bouton } from "@/components/ui/primitives";

/**
 * Corriger une preuve qui ne dit pas la vérité.
 *
 * Une preuve n'est jamais supprimée : ce geste ajoute une ligne à son
 * historique, et le calcul cesse (ou reprend) de la compter. L'original reste
 * lisible — c'est la raison pour laquelle l'intitulé parle de ce que la preuve
 * *fait* (« ne compte plus »), pas de ce qu'on lui fait subir.
 *
 * Placé sur la preuve elle-même : une liste séparée de rectifications
 * obligerait à reconnaître une preuve à son identifiant.
 */
export function RectificationPreuve({ preuveId }: { preuveId: string }) {
  return (
    <details className="mt-2">
      <summary className="cursor-pointer text-[0.625rem] text-texte-discret hover:text-texte">
        Signaler une erreur sur cette preuve
      </summary>
      <form
        action={rectifyEvidence.bind(null, `rectify:${preuveId}:${crypto.randomUUID()}`)}
        className="mt-2 space-y-2"
      >
        <input type="hidden" name="evidenceId" value={preuveId} />
        <input type="hidden" name="action" value="invalider" />
        <label htmlFor={`motif-${preuveId}`} className="block text-[0.625rem] text-texte-discret">
          Pourquoi cette preuve ne reflète-t-elle pas ce qui s&apos;est passé ?
        </label>
        <textarea
          id={`motif-${preuveId}`}
          name="reason"
          rows={2}
          maxLength={1000}
          required
          className="w-full rounded-md border border-bordure-controle bg-surface px-1.5 py-1 text-xs text-texte"
        />
        <Bouton type="submit" variante="secondaire" taille="petite">
          Ne plus compter cette preuve
        </Bouton>
        <p className="text-[0.625rem] text-texte-discret">
          La preuve d&apos;origine reste conservée ; seul son effet sur le niveau change.
        </p>
      </form>
    </details>
  );
}
