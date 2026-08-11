"use client";

/**
 * Interrupteur d'enregistrement du profilage, côté interface.
 *
 * Un seul geste utilisateur — « Démarrer » / « Arrêter » — pilote les deux
 * collecteurs : les rendus React et les interactions (client, `sessionStorage`)
 * et le registre des opérations serveur (`/api/profiling`). Les laisser
 * dissociés produirait une mesure boiteuse : des temps serveur sans les rendus
 * qui les ont déclenchés.
 *
 * L'état affiché est celui du client — il est immédiat et ne dépend d'aucun
 * aller-retour. Le serveur est aligné dessus à chaque bascule.
 */

import { useCallback, useSyncExternalStore } from "react";
import {
  abonnerProfilageClient,
  definirEnregistrement,
  enregistrementActif,
} from "@/lib/profiling/client";

export interface Enregistrement {
  /** L'enregistrement est-il en cours ? */
  enCours: boolean;
  /** Bascule démarrage / arrêt (client + serveur). */
  basculer: () => Promise<void>;
}

export function useProfilageEnCours(compteId: string): boolean {
  return useSyncExternalStore(
    abonnerProfilageClient,
    () => enregistrementActif(compteId),
    () => false,
  );
}

/**
 * @param apresBascule appelé une fois les deux côtés alignés — sert à
 *   rafraîchir l'affichage sans attendre le prochain tick automatique.
 */
export function useEnregistrement(compteId: string, apresBascule?: () => void): Enregistrement {
  // `enregistrementActif()` lit `window` : faux au SSR, vrai au client.
  // `useSyncExternalStore` fournit la bonne valeur de chaque côté sans écart
  // d'hydratation.
  const enCours = useProfilageEnCours(compteId);

  const basculer = useCallback(async () => {
    const cible = !enregistrementActif(compteId);
    definirEnregistrement(compteId, cible);
    try {
      await fetch("/api/profiling", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: cible ? "start" : "stop" }),
      });
    } catch {
      // Le serveur peut être injoignable ; l'enregistrement client, lui,
      // a bien basculé. L'écart est visible dans le panneau.
    }
    apresBascule?.();
  }, [apresBascule, compteId]);

  return { enCours, basculer };
}
