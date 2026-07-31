"use client";

/**
 * Réduction du rail de navigation.
 *
 * Même mécanique que la bascule de thème : l'attribut `data-rail` est déjà posé
 * sur `<html>` avant peinture par le script inline du layout racine, et c'est la
 * variante CSS `rail-reduit:` qui pilote toutes les largeurs. Le composant ne
 * tient donc aucun état React — les deux icônes sont rendues, le CSS décide.
 *
 * C'est ce qui garantit qu'un rechargement en mode réduit n'affiche jamais, même
 * une image, un rail à sa largeur pleine.
 */
export function BasculeRail() {
  function basculer() {
    const racine = document.documentElement;
    const reduit = racine.getAttribute("data-rail") === "reduit";
    if (reduit) racine.removeAttribute("data-rail");
    else racine.setAttribute("data-rail", "reduit");
    try {
      if (reduit) localStorage.removeItem("rail");
      else localStorage.setItem("rail", "reduit");
    } catch {
      // Stockage indisponible : le choix ne sera pas retenu, sans conséquence.
    }
  }

  return (
    <button
      type="button"
      onClick={basculer}
      className="flex size-7 shrink-0 items-center justify-center rounded-md text-[var(--rail-texte-attenue)] transition-colors hover:bg-white/10 hover:text-[var(--rail-texte)]"
      // Les deux libellés sont rendus et masqués par CSS, comme les icônes :
      // un `aria-label` conditionnel exigerait un état React, donc un rendu
      // serveur potentiellement faux.
      aria-label="Réduire ou déployer le rail"
      title="Réduire ou déployer le rail"
    >
      <ChevronsGauche className="size-[15px] rail-reduit:hidden" />
      <ChevronsDroite className="hidden size-[15px] rail-reduit:block" />
    </button>
  );
}

/* Même tracé que le reste du jeu d'icônes : grille 24, trait 1,5, bouts ronds. */

function ChevronsGauche({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M11 5 4 12l7 7M20 5l-7 7 7 7" />
    </svg>
  );
}

function ChevronsDroite({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M13 5l7 7-7 7M4 5l7 7-7 7" />
    </svg>
  );
}
