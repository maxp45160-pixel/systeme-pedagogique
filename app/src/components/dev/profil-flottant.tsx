"use client";

/**
 * Pastille flottante de profilage actif.
 *
 * S'affiche discrètement en bas à droite lorsque l'enregistrement de performance
 * est actif en arrière-plan. Permet à l'utilisateur de constater immédiatement
 * que ses interactions et rendus sont en cours de capture pendant qu'il navigue,
 * et d'arrêter ou d'accéder au tableau de bord en un clic.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  abonnerProfilageClient,
  totalMesuresClient,
} from "@/lib/profiling/client";
import { useEnregistrement } from "@/lib/profiling/utiliser-enregistrement";

export function ProfilFlottant({ compteId }: { compteId: string }) {
  const { enCours, basculer } = useEnregistrement(compteId);
  const [total, setTotal] = useState(() => (enCours ? totalMesuresClient(compteId) : 0));

  useEffect(() => {
    if (!enCours) return;
    return abonnerProfilageClient(() => {
      setTotal(totalMesuresClient(compteId));
    });
  }, [enCours, compteId]);

  if (!enCours) return null;

  return (
    <div
      data-profiling-ignore="true"
      className="fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-full border border-danger/30 bg-surface/90 px-4 py-2 text-xs font-medium shadow-lg backdrop-blur-md transition-all sm:bottom-6 sm:right-6"
    >
      <div className="flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-danger" />
        </span>
        <span className="text-texte">
          Profilage actif <span className="text-texte-discret">({total} mesures)</span>
        </span>
      </div>

      <div className="flex items-center gap-1.5 border-l border-bordure pl-2">
        <Link
          href="/admin?onglet=profil"
          className="rounded px-2 py-0.5 text-primaire hover:bg-primaire-faible transition-colors"
        >
          Voir
        </Link>
        <button
          type="button"
          onClick={() => void basculer()}
          className="rounded px-2 py-0.5 text-danger hover:bg-danger-faible transition-colors"
        >
          Arrêter
        </button>
      </div>
    </div>
  );
}
