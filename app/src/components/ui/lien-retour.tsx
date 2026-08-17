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
