"use client";

import { IconeLune, IconeSoleil } from "@/components/ui/icones";

/**
 * Bascule clair/sombre.
 *
 * L'attribut `data-theme` est déjà positionné avant peinture par le script
 * inline du layout. Ce composant ne tient aucun état React : les deux icônes
 * sont rendues et c'est la variante CSS `dark:` qui décide laquelle s'affiche.
 * Résultat : pas d'effet de synchronisation, pas de décalage d'hydratation.
 */
export function BasculeTheme() {
  function basculer() {
    const actuel = document.documentElement.getAttribute("data-theme");
    const suivant = actuel === "dark" ? "clair" : "dark";
    document.documentElement.setAttribute("data-theme", suivant);
    try {
      localStorage.setItem("theme", suivant);
    } catch {
      // Stockage indisponible : le choix ne sera pas retenu, sans conséquence.
    }
  }

  return (
    <button
      type="button"
      onClick={basculer}
      className="flex size-7 shrink-0 items-center justify-center rounded-md text-texte-discret transition-colors hover:bg-surface-2 hover:text-texte"
      aria-label="Changer de thème"
      title="Changer de thème"
    >
      <IconeLune className="size-[15px] dark:hidden" />
      <IconeSoleil className="hidden size-[15px] dark:block" />
    </button>
  );
}
