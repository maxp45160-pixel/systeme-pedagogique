"use client";

import { cx } from "@/components/ui/primitives";

/**
 * Les trois entrées de Mes cours.
 *
 * « Transversal » a disparu : c'était un second classement des mêmes objets,
 * où chaque compétence apparaissait une deuxième fois. « Arbre » a disparu à
 * son tour (ADR-121) : il montrait le même référentiel que « Graphe », dans un
 * onglet frère, en attendant d'avoir assez de matière pour valoir mieux que
 * les trois autres. Restent trois lieux qui ne se recouvrent pas — le
 * référentiel, les ressources, et la même matière vue en relations.
 */
export type VueAtelier = "domaines" | "ressources" | "graphe";

export function BarreVuesAtelier({
  vue,
  onChanger,
}: {
  vue: VueAtelier;
  onChanger: (v: VueAtelier) => void;
}) {
  const options = [
    { cle: "domaines" as const, libelle: "Domaines" },
    { cle: "ressources" as const, libelle: "Ressources" },
    { cle: "graphe" as const, libelle: "Graphe" },
  ];
  return (
    <div
      className="flex items-center gap-1 rounded-lg border border-bordure bg-surface-2 p-1 text-xs"
      role="tablist"
      aria-label="Modes de vue de mes cours"
    >
      {options.map((opt) => (
        <button
          key={opt.cle}
          type="button"
          role="tab"
          aria-selected={vue === opt.cle}
          onClick={() => onChanger(opt.cle)}
          className={cx(
            "rounded-md px-3 py-1.5 font-medium transition-all cursor-pointer",
            vue === opt.cle
              ? "bg-surface text-primaire shadow-xs font-semibold"
              : "text-texte-discret hover:text-texte hover:bg-surface/50",
          )}
        >
          {opt.libelle}
        </button>
      ))}
    </div>
  );
}

/*
 * `VueTousLesDomaines` vit maintenant dans `vues/liste-domaines.tsx` : la page
 * des domaines a absorbe la carte des domaines retiree de la vue Graphe, et
 * elle depassait ce fichier de barres de vues. Reexportee ici pour ne pas
 * casser les imports existants.
 */
export { VueTousLesDomaines } from "./vues/liste-domaines";
