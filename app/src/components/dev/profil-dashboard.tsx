"use client";

/**
 * Tableau de bord de profilage — page plein écran `/dev/profil`.
 *
 * Charge les mesures serveur via `/api/profiling` et lit les mesures client
 * depuis `sessionStorage`, puis délègue l'affichage à `ProfilContenu`.
 */

import { useCallback, useEffect, useSyncExternalStore, useState } from "react";
import {
  rendusActuels,
  interactionsActuelles,
  viderMesuresClient,
  profilageClientActif,
} from "@/lib/profiling/client";
import {
  ProfilContenu,
  type ReponseProfilage,
} from "@/components/dev/profil-contenu";

export function ProfilDashboard() {
  const [serveur, setServeur] = useState<ReponseProfilage | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);
  const [rafraichir, setRafraichir] = useState(0);
  // `profilageClientActif()` lit `typeof window` : faux au SSR, vrai au
  // client. `useSyncExternalStore` fournit la bonne valeur de chaque côté
  // sans écart d'hydratation.
  const clientActif = useSyncExternalStore(
    () => () => {},
    () => profilageClientActif(),
    () => false,
  );

  const charger = useCallback(async () => {
    setChargement(true);
    try {
      const res = await fetch("/api/profiling");
      if (!res.ok) {
        const detail = await res.json().catch(() => null);
        setErreur(detail?.erreur ?? `Erreur ${res.status}`);
        setServeur(null);
        return;
      }
      const donnees = (await res.json()) as ReponseProfilage;
      setServeur(donnees);
      setErreur(null);
    } catch {
      setErreur("Serveur injoignable.");
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    // Délai d'un tick : éviter un `setState` synchrone dans le corps de
    // l'effet, qui provoquerait un rendu en cascade (règle react-hooks).
    const temporisateur = setTimeout(() => void charger(), 0);
    return () => clearTimeout(temporisateur);
  }, [charger, rafraichir]);

  const vider = async () => {
    viderMesuresClient();
    try {
      await fetch("/api/profiling", { method: "DELETE" });
    } catch {
      // ignore
    }
    setRafraichir((n) => n + 1);
  };

  const rendus = rendusActuels();
  const interactions = interactionsActuelles();

  return (
    <div className="space-y-6">
      {/* ── En-tête ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className={clientActif ? "size-2 rounded-full bg-succes" : "size-2 rounded-full bg-texte-discret"}
            aria-hidden
          />
          <span className="text-sm text-texte-attenue">
            Profilage client : {clientActif ? "actif" : "inactif"}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setRafraichir((n) => n + 1)}
            className="rounded-md border border-bordure-forte bg-surface px-3 py-1.5 text-xs font-medium text-texte transition-colors hover:bg-surface-2"
          >
            Rafraîchir
          </button>
          <button
            onClick={vider}
            className="rounded-md border border-danger/30 bg-danger-faible px-3 py-1.5 text-xs font-medium text-danger transition-colors hover:bg-danger/10"
          >
            Vider
          </button>
        </div>
      </div>

      <ProfilContenu
        serveur={serveur}
        rendus={rendus}
        interactions={interactions}
        clientActif={clientActif}
        chargement={chargement}
        erreur={erreur}
      />
    </div>
  );
}