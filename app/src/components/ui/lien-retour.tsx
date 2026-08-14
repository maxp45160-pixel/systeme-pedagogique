"use client";

import Link from "next/link";

/**
 * Le lien de remontée d'une page profonde.
 */
export function LienRetour({
  href,
  libelle = "Retour",
  onClick,
}: {
  href?: string;
  libelle?: string;
  onClick?: () => void;
}) {
  function gererRetour(e: React.MouseEvent) {
    if (onClick) {
      e.preventDefault();
      onClick();
      return;
    }
    if (typeof window !== "undefined" && window.history.length > 1) {
      e.preventDefault();
      window.history.back();
      return;
    }
  }

  if (!href) {
    return (
      <div className="mb-3">
        <button
          type="button"
          onClick={gererRetour}
          className="inline-flex items-center gap-1 text-xs text-texte-attenue hover:text-texte transition-colors cursor-pointer"
        >
          ← {libelle}
        </button>
      </div>
    );
  }

  return (
    <div className="mb-3">
      <Link href={href} onClick={gererRetour} className="inline-flex items-center gap-1 text-xs text-texte-attenue hover:text-texte transition-colors">
        ← {libelle}
      </Link>
    </div>
  );
}

export function BoutonRetour({
  onClick,
  libelle = "Retour",
}: {
  onClick?: () => void;
  libelle?: string;
}) {
  return (
    <button
      type="button"
      onClick={
        onClick ??
        (() => {
          if (typeof window !== "undefined") {
            window.history.back();
          }
        })
      }
      className="inline-flex items-center gap-1.5 rounded-lg border border-bordure bg-surface px-2.5 py-1.5 text-xs font-semibold text-texte-attenue transition-all duration-150 hover:bg-surface-2 hover:text-primaire hover:border-primaire/40 cursor-pointer shadow-xs shrink-0"
      title="Revenir en arrière (Raccourci : bouton retour souris)"
      aria-label="Revenir en arrière"
    >
      <span className="text-xs font-bold" aria-hidden>←</span>
      <span>{libelle}</span>
    </button>
  );
}

