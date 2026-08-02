"use client";

/**
 * Enveloppe le contenu de l'application avec le `Profiler` de React.
 *
 * Chaque rendu est enregistré dans `sessionStorage` via
 * `lib/profiling/client.ts` et consultable sur `/dev/profil`.
 *
 * Le profilage n'est actif qu'en développement : en production ce composant
 * rend simplement ses enfants sans surcharge.
 *
 * Accepte un `id` optionnel pour nommer la zone de mesure. Le `id` apparaît
 * dans la colonne « Composant » du tableau de bord. Par défaut : `"app"`.
 */

import { Profiler, type ReactNode } from "react";
import { onRenderProfil } from "@/lib/profiling/client";

export function ProfilWrapper({ id = "app", children }: { id?: string; children: ReactNode }) {
  return (
    <Profiler id={id} onRender={onRenderProfil}>
      {children}
    </Profiler>
  );
}

/**
 * Zone de profilage réutilisable pour mesurer un composant ou une section.
 *
 * Exemple d'usage dans une page :
 * ```tsx
 * <ProfilZone id="tableau-de-bord">
 *   <MonContenu />
 * </ProfilZone>
 * ```
 */
export const ProfilZone = ProfilWrapper;