"use client";

/**
 * Zone de profilage nommée d'après la route courante.
 *
 * Montée dans le layout `(app)` autour du contenu principal, elle enregistre
 * chaque rendu avec un `id` du type `page:/exercices` au lieu du générique
 * `app`. Cela donne une ligne par page dans le tableau « rendus par
 * composant », sans toucher aux pages elles-mêmes.
 */

import { Profiler, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { onRenderProfil } from "@/lib/profiling/client";

export function ProfilPage({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // Nom court lisible dans le tableau de profilage.
  const id = `page:${pathname}`;

  return (
    <Profiler id={id} onRender={onRenderProfil}>
      {children}
    </Profiler>
  );
}
