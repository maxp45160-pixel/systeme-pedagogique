"use client";

import { IconeLune, IconeSoleil } from "@/components/ui/icones";
import { cx } from "@/components/ui/primitives";

/**
 * Bascule clair/sombre.
 *
 * L'attribut `data-theme` est déjà positionné avant peinture par le script
 * inline du layout. Ce composant ne tient aucun état React : les deux icônes
 * sont rendues et c'est la variante CSS `dark:` qui décide laquelle s'affiche.
 * Résultat : pas d'effet de synchronisation, pas de décalage d'hydratation.
 */
export function BasculeTheme({ tone = "defaut" }: { tone?: "defaut" | "rail" }) {
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
      className={cx(
        "flex size-7 shrink-0 items-center justify-center rounded-md transition-colors",
        tone === "rail"
          ? "text-[var(--rail-texte-attenue)] hover:bg-white/10 hover:text-[var(--rail-texte)]"
          : "text-texte-discret hover:bg-surface-2 hover:text-texte",
      )}
      aria-label="Changer de thème"
      title="Changer de thème"
    >
      <IconeLune className="size-[15px] dark:hidden" />
      <IconeSoleil className="hidden size-[15px] dark:block" />
    </button>
  );
}
