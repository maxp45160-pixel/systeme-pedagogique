"use client";

/**
 * Enveloppe le contenu de l'application avec le `Profiler` de React.
 *
 * Chaque rendu est enregistré dans `sessionStorage` via
 * `lib/profiling/client.ts` et consultable sur `/dev/profil`.
 *
 * Le profilage n'est actif qu'en développement : en production ce composant
 * rend simplement ses enfants sans surcharge.
 */

import { Profiler, type ReactNode } from "react";
import { onRenderProfil } from "@/lib/profiling/client";

export function ProfilWrapper({ children }: { children: ReactNode }) {
  return (
    <Profiler id="app" onRender={onRenderProfil}>
      {children}
    </Profiler>
  );
}