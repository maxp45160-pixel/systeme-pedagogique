"use client";

/**
 * Les deux briques de mise en page du tableau de bord de simulation.
 *
 * Elles vivent à part parce que le parcours unique et la campagne s'en servent
 * tous les deux, et qu'un import croisé entre les deux écrans serait circulaire.
 */

import type { ReactNode } from "react";

export function Chiffre({
  libelle,
  valeur,
  note,
}: {
  libelle: string;
  valeur: string;
  note?: string;
}) {
  return (
    <div className="border-l-2 border-bordure pl-3">
      <div className="text-xs text-texte-discret">{libelle}</div>
      <div className="text-lg font-medium tabular-nums text-texte">{valeur}</div>
      {note && <div className="text-xs text-texte-discret">{note}</div>}
    </div>
  );
}

export function Section({
  titre,
  legende,
  children,
}: {
  titre: string;
  legende?: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-texte-discret">
          {titre}
        </h2>
        {legende && <p className="mt-1 text-sm text-texte-attenue">{legende}</p>}
      </div>
      {children}
    </section>
  );
}
