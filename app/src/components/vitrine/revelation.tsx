"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Déclencheur d'apparition de la vitrine : pose `data-attendu="true"` quand
 * le bloc entre dans le viewport. Les animations de la landing (anneaux de
 * progression, barres, ratures, bulles) écoutent cet attribut en CSS —
 * aucun style n'est calculé en JavaScript, et `prefers-reduced-motion`
 * désarme tout via le coupe-circuit global de `globals.css`.
 *
 * L'attribut est écrit directement sur le nœud DOM, sans état React : le
 * composant ne re-rend jamais, donc l'attribut posé par l'observateur n'est
 * pas écrasé par un rendu suivant.
 */
export function Revelation({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const noeud = ref.current;
    if (!noeud) return;
    if (typeof IntersectionObserver === "undefined") {
      noeud.dataset.attendu = "true";
      return;
    }
    const observateur = new IntersectionObserver(
      (entrees) => {
        for (const entree of entrees) {
          if (entree.isIntersecting) {
            noeud.dataset.attendu = "true";
            observateur.disconnect();
          }
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.15 },
    );
    observateur.observe(noeud);
    return () => observateur.disconnect();
  }, []);

  return (
    <div ref={ref} data-attendu="false" className={className}>
      {children}
    </div>
  );
}
