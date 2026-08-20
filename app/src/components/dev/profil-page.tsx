"use client";

/**
 * Zone de profilage nommée d'après la route courante.
 *
 * Montée dans le layout `(app)` autour du contenu principal, elle enregistre
 * chaque rendu avec un `id` du type `page:/atelier` au lieu du générique
 * `app`. Cela donne une ligne par page dans le tableau « rendus par
 * composant », sans toucher aux pages elles-mêmes.
 */

import { Profiler, type ReactNode, useMemo } from "react";
import { usePathname } from "next/navigation";
import { onRenderProfil } from "@/lib/profiling/client";
import { useProfilageEnCours } from "@/lib/profiling/utiliser-enregistrement";

export function ProfilPage({ compteId, children }: { compteId: string; children: ReactNode }) {
  const pathname = usePathname();
  const actif = useProfilageEnCours(compteId);
  const onRender = useMemo(() => onRenderProfil(compteId), [compteId]);
  // Nom court lisible dans le tableau de profilage.
  const id = `page:${pathname}`;

  if (!actif) return children;
  return (
    <Profiler id={id} onRender={onRender}>
      {children}
    </Profiler>
  );
}
