/**
 * Préférence de thème — lecture et application.
 *
 * L'attribut `data-theme` de `<html>` est posé avant peinture par le script
 * inline de `app/layout.tsx` ; ce module est la seule façon de le changer
 * ensuite. Aucun composant ne manipule l'attribut ni `localStorage` en direct :
 * dupliquer cette logique était le meilleur moyen de faire diverger les deux
 * points d'entrée (le contrôle des réglages, et le script de démarrage).
 *
 * Il n'y a plus de bascule clair/sombre isolée dans l'interface : le choix vit
 * dans les réglages du compte, avec les trois états (clair, sombre, système).
 */

/** Thème explicitement choisi. `null` = suivre la préférence du système. */
export type ChoixTheme = "clair" | "dark" | null;

/**
 * Applique un thème et mémorise le choix.
 *
 * `null` efface la préférence : le système reprend la main, immédiatement et
 * aux rechargements suivants (le script inline retombera sur `matchMedia`).
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
