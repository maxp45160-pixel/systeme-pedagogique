import { IconeLivre } from "@/components/ui/icones";

/**
 * Bandeau défilant des matières possibles. Le défilement est purement CSS
 * (`.defilement` dans `globals.css`) : la liste est simplement doublée pour
 * boucler sans couture. Décoratif — marqué `aria-hidden`, le propos tient
 * dans le héros et les sections voisines.
 */
const SUJETS = [
  "Mathématiques",
  "Espagnol",
  "Anglais",
  "Français",
  "Physique",
  "Chimie",
  "Histoire",
  "Géographie",
  "Allemand",
  "Biologie",
  "Italien",
  "Économie",
  "Philosophie",
  "Latin",
  "Informatique",
];

export function BandeauMatieres() {
  return (
    <div aria-hidden className="overflow-hidden border-y border-bordure bg-surface py-4">
      <div className="defilement flex w-max gap-3">
        {[...SUJETS, ...SUJETS].map((sujet, index) => (
          <span
            key={`${sujet}-${index}`}
            className="flex items-center gap-2 whitespace-nowrap rounded-full border border-bordure bg-fond px-4 py-1.5 text-sm font-medium text-texte-attenue"
          >
            <IconeLivre className="size-3.5 text-primaire" />
            {sujet}
          </span>
        ))}
      </div>
    </div>
  );
}
