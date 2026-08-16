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

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { enregistrerInteraction } from "@/lib/profiling/client";
import { useProfilageEnCours } from "@/lib/profiling/utiliser-enregistrement";

const MAX_LIBELLE = 40;

/**
 * Remonte le DOM pour trouver l'élément interactif le plus proche
 * (bouton, lien, input, label) afin d'obtenir un libellé parlant
 * plutôt que le texte brut d'un `<span>` imbriqué.
 */
function trouverInteractif(el: HTMLElement): HTMLElement {
  let courant: HTMLElement | null = el;
  while (courant) {
    const tag = courant.tagName;
    if (
      tag === "BUTTON" ||
      tag === "A" ||
      tag === "INPUT" ||
      tag === "LABEL" ||
      courant.getAttribute("role") === "button" ||
      courant.getAttribute("role") === "tab" ||
      courant.getAttribute("role") === "link"
    ) {
      return courant;
    }
    courant = courant.parentElement;
  }
  return el;
}

/** Construit un libellé court et lisible à partir de l'élément cliqué. */
function extraireLibelle(cible: HTMLElement): string {
  const interactif = trouverInteractif(cible);

  // Aria-label > textContent direct > id > tag.
  const aria = interactif.getAttribute("aria-label")?.trim();
  if (aria) return aria.slice(0, MAX_LIBELLE);

  // Texte « propre » : seulement les enfants texte directs pour éviter
  // de capturer tout le contenu imbriqué d'un conteneur.
  const textesDirecs: string[] = [];
  for (const noeud of interactif.childNodes) {
    if (noeud.nodeType === Node.TEXT_NODE) {
      const t = noeud.textContent?.trim();
      if (t) textesDirecs.push(t);
    }
  }
  const texte = textesDirecs.join(" ").trim();
  if (texte) {
    return texte.length > MAX_LIBELLE
      ? texte.slice(0, MAX_LIBELLE - 1) + "…"
      : texte;
  }

  // Fallback : textContent complet, tronqué.
  const complet = interactif.textContent?.trim() ?? "";
  if (complet) {
    return complet.length > MAX_LIBELLE
      ? complet.slice(0, MAX_LIBELLE - 1) + "…"
      : complet;
  }

  // Dernier recours : id, className, ou tag.
  if (interactif.id) return interactif.id;
  const cls =
    typeof interactif.className === "string"
      ? interactif.className.split(" ")[0]
      : "";
  return cls || interactif.tagName.toLowerCase();
}

export function ProfilTracker({ compteId }: { compteId: string }) {
  const actif = useProfilageEnCours(compteId);
  const pathname = usePathname();
  const dernierPathname = useRef<string | null>(null);

  // Capture les navigations Next.js App Router (pushState / transitions de page)
  useEffect(() => {
    if (!actif || !pathname) return;
    if (dernierPathname.current !== pathname) {
      dernierPathname.current = pathname;
      enregistrerInteraction(compteId, "navigation", pathname, 0);
    }
  }, [actif, pathname, compteId]);

  useEffect(() => {
    if (!actif) return;
    function handleClick(e: MouseEvent) {
      const cible = e.target as HTMLElement;
      if (!cible) return;

      // Ignorer les clics à l'intérieur du panneau de profilage lui-même
      // pour éviter la boucle de rétroaction.
      if (cible.closest("[data-profiling-ignore]")) return;

      const libelle = extraireLibelle(cible);
      enregistrerInteraction(compteId, "clic", libelle, 0);
    }

    // Les clics sont capturés au niveau document.
    document.addEventListener("click", handleClick, true);

    return () => {
      document.removeEventListener("click", handleClick, true);
    };
  }, [actif, compteId]);

  return null;
}
