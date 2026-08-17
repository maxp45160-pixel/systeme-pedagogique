"use client";

/**
 * N'affiche ses enfants que sur les pages **sans** entrée contextuelle vers le
 * tuteur.
 *
 * La fiche d'une compétence porte déjà un bouton qui ouvre le même tiroir, en
 * lui transmettant la compétence. Y ajouter le bouton flottant donnerait deux
 * entrées sur la même page, dont la moins renseignée. Une seule entrée par
 * page, et c'est la contextuelle qui gagne.
 *
 * Le chemin est lu côté client : une mise en page Next 16 ne le reçoit pas, et
 * le `proxy` ne pose aucun en-tête de chemin. Le coût est un rendu serveur du
 * tiroir qui n'est pas affiché sur cette route — le contexte du tuteur y est de
 * toute façon déjà assemblé pour le bouton contextuel, et `chargerContexte` est
 * mémoïsé par requête.
 */

import { usePathname } from "next/navigation";

/** Fiche d'une compétence : `/competences/<code>`. */
function porteDejaUneEntree(chemin: string): boolean {
  const segments = chemin.split("/").filter(Boolean);
  return segments.length === 2 && segments[0] === "competences";
}

export function HorsPageContextuelle({ children }: { children: React.ReactNode }) {
  const chemin = usePathname();
  if (chemin && porteDejaUneEntree(chemin)) return null;
  return <>{children}</>;
}
