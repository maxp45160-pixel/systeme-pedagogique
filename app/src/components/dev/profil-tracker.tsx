"use client";

/**
 * Traqueur global d'interactions — monté dans le layout racine.
 *
 * Écoute les clics et les navigations sur toute l'application, sans avoir à
 * instrumenter chaque composant individuellement. Les mesures vont dans
 * `sessionStorage` via `lib/profiling/client.ts`.
 *
 * Invisible : ce composant ne rend rien, il se contente de poser des écouteurs.
 */

import { useEffect } from "react";
import { enregistrerInteraction } from "@/lib/profiling/client";

export function ProfilTracker() {
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const cible = e.target as HTMLElement;
      if (!cible) return;

      // Libellé lisible : texte du bouton/lien, ou classe/id.
      const texte = cible.textContent?.trim().slice(0, 60) ?? "";
      const tag = cible.tagName.toLowerCase();
      // `className` peut être un `SVGAnimatedString` sur les éléments SVG :
      // on ne l'utilise que si c'est une chaîne.
      const cls = typeof cible.className === "string" ? cible.className : "";
      const libelle = texte || cible.id || cls.split(" ")[0] || tag;

      enregistrerInteraction("clic", libelle, 0);
    }

    function handleNavigation() {
      enregistrerInteraction("navigation", window.location.pathname, 0);
    }

    // Popstate capte les navigations back/forward.
    window.addEventListener("popstate", handleNavigation);

    // Les clics sont capturés au niveau document.
    document.addEventListener("click", handleClick, true);

    return () => {
      window.removeEventListener("popstate", handleNavigation);
      document.removeEventListener("click", handleClick, true);
    };
  }, []);

  return null;
}