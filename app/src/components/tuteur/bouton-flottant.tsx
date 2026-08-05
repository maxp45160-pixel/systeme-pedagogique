"use client";

/**
 * Bouton flottant du tuteur — accessible depuis n'importe quelle page.
 *
 * Friction #4 : le tuteur n'était accessible que depuis les fiches.
 * Ce bouton le rend accessible de partout. Pour l'instant, il navigue
 * vers /tuteur. Une version future pourrait ouvrir un tiroir in-situ.
 */

import { useRouter } from "next/navigation";
import { cx } from "@/components/ui/primitives";

export function BoutonTuteurFlottant() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.push("/tuteur")}
      aria-label="Ouvrir le tuteur"
      title="Ouvrir le tuteur"
      className={cx(
        "fixed bottom-6 right-6 z-40 flex size-12 items-center justify-center",
        "rounded-full bg-primaire text-primaire-contraste shadow-lg",
        "transition-transform hover:scale-105 active:scale-95",
        "focus:outline-none focus:ring-2 focus:ring-primaire focus:ring-offset-2",
      )}
    >
      <span className="text-lg font-bold" aria-hidden>
        💬
      </span>
    </button>
  );
}