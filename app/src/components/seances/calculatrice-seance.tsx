"use client";

import { useSyncExternalStore } from "react";
import { OutilSeance } from "@/components/seances/outil-seance";
import { Calculatrice } from "@/components/seances/calculatrice";
import { IconeCalculatrice } from "@/components/ui/icones";
import {
  calculatriceActive,
  sAbonnerPreferencesOutils,
} from "@/lib/ui/preferences-outils";

/**
 * L'outil « Calculatrice » de la barre de séance.
 *
 * La préférence vit en `localStorage` par compte (`preferences-outils.ts`) :
 * c'est un store externe, lu et suivi via `useSyncExternalStore` — l'outil
 * apparaît/disparaît sans rechargement quand on bascule le réglage, y compris
 * depuis une autre fenêtre du même compte. Côté serveur il est absent : un
 * flash puis une disparition serait plus bruyant qu'une apparition différée
 * d'un rendu.
 */
export function CalculatriceSeance({ compteId }: { compteId: string }) {
  const activee = useSyncExternalStore(
    sAbonnerPreferencesOutils,
    () => calculatriceActive(compteId),
    () => false,
  );

  if (!activee) return null;

  return (
    <OutilSeance
      variante="outil"
      libelle="Calculatrice"
      icone={<IconeCalculatrice className="size-3.5" />}
      contenuClassName="sm:left-1/2 sm:-translate-x-1/2 sm:w-[min(24rem,calc(100vw-2rem))] fixed left-4 right-4 top-28 z-[var(--superposition-menu)] mt-2 shadow-xl sm:absolute sm:top-auto"
    >
      <Calculatrice />
    </OutilSeance>
  );
}
