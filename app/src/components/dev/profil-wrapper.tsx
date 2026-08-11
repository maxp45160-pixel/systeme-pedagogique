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

import { Profiler, type ReactNode, useMemo } from "react";
import { onRenderProfil } from "@/lib/profiling/client";
import { useProfilageEnCours } from "@/lib/profiling/utiliser-enregistrement";

export function ProfilWrapper({ compteId, id = "app", children }: { compteId: string; id?: string; children: ReactNode }) {
  const actif = useProfilageEnCours(compteId);
  const onRender = useMemo(() => onRenderProfil(compteId), [compteId]);
  if (!actif) return children;
  return (
    <Profiler id={id} onRender={onRender}>
      {children}
    </Profiler>
  );
}
