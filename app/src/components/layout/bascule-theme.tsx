"use client";

import { IconeLune, IconeSoleil } from "@/components/ui/icones";
import { cx } from "@/components/ui/primitives";

/** Thème explicitement choisi. `null` = suivre la préférence du système. */
export type ChoixTheme = "clair" | "dark" | null;

/**
 * Applique un thème et mémorise le choix.
 *
 * `null` efface la préférence : le système reprend la main, immédiatement et
 * aux rechargements suivants (le script inline retombera sur `matchMedia`).
 * Source unique de vérité pour la bascule du rail comme pour le contrôle
 * segmenté des réglages — dupliquer cette logique était le meilleur moyen de
 * les faire diverger.
 */
export function appliquerTheme(choix: ChoixTheme): void {
  const effectif =
    choix ??
    (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "clair");
  document.documentElement.setAttribute("data-theme", effectif);
  try {
    if (choix === null) localStorage.removeItem("theme");
    else localStorage.setItem("theme", choix);
  } catch {
    // Stockage indisponible : le choix ne sera pas retenu, sans conséquence.
  }
}

/** Choix explicite en vigueur, ou `null` si le système décide. */
export function lireChoixTheme(): ChoixTheme {
  try {
    const t = localStorage.getItem("theme");
    return t === "clair" || t === "dark" ? t : null;
  } catch {
    return null;
  }
}

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
    appliquerTheme(actuel === "dark" ? "clair" : "dark");
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
