"use client";

import { cx } from "@/components/ui/primitives";

export function CarteCreationPointillee({
  titre,
  description,
  onClick,
  className,
}: {
  titre: string;
  description?: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "group flex min-h-[170px] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-bordure/80 bg-surface/20 p-6 text-center shadow-xs transition-all duration-200 hover:-translate-y-1 hover:border-primaire/60 hover:bg-surface hover:shadow-[var(--ombre-posee)] cursor-pointer",
        className,
      )}
    >
      <span className="grid size-10 place-items-center rounded-full bg-surface-2 text-lg font-semibold text-texte-discret transition-colors group-hover:bg-primaire-faible group-hover:text-primaire">
        +
      </span>
      <div className="min-w-0">
        <span className="block font-serif text-sm font-semibold text-texte transition-colors group-hover:text-primaire">
          {titre}
        </span>
        {description && (
          <span className="mt-1 block text-xs text-texte-discret leading-relaxed max-w-[220px] mx-auto">
            {description}
          </span>
        )}
      </div>
    </button>
  );
}

/**
 * Les trois entrées de l'Atelier.
 *
 * « Transversal » a disparu : c'était un second classement des mêmes objets,
 * où chaque compétence apparaissait une deuxième fois. Restent quatre lieux qui
 * ne se recouvrent pas — le référentiel, les sélections, les ressources, et la
 * même matière vue en graphe.
 */
export type VueAtelier = "domaines" | "ressources" | "graphe" | "arbre";

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
    /* En dernier, et à dessein : l'arbre est une lecture d'ensemble, pas une
       entrée de travail. Il attend d'avoir assez de matière pour valoir mieux
       que les trois qui le précèdent. */
    { cle: "arbre" as const, libelle: "Arbre" },
  ];
  return (
    <div
      className="flex items-center gap-1 rounded-lg border border-bordure bg-surface-2 p-1 text-xs"
      role="tablist"
      aria-label="Modes de vue de l'Atelier"
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
