"use client";

/**
 * Tableau de bord de profilage — page plein écran `/dev/profil`.
 *
 * Charge les mesures serveur via `/api/profiling` et lit les mesures client
 * depuis `sessionStorage`, puis délègue l'affichage à `ProfilContenu`.
 */

import { useCallback, useEffect, useSyncExternalStore, useState } from "react";
import { cx } from "@/components/ui/primitives";
import {
  rendusActuels,
  interactionsActuelles,
  viderMesuresClient,
  profilageClientActif,
  abonnerProfilageClient,
} from "@/lib/profiling/client";
import { useEnregistrement } from "@/lib/profiling/utiliser-enregistrement";
import {
  ProfilContenu,
  type ReponseProfilage,
} from "@/components/dev/profil-contenu";

export function ProfilDashboard({ compteId }: { compteId: string }) {
  const [serveur, setServeur] = useState<ReponseProfilage | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);
  const [rafraichir, setRafraichir] = useState(0);
  // `profilageClientActif()` lit `typeof window` : faux au SSR, vrai au
  // client. `useSyncExternalStore` fournit la bonne valeur de chaque côté
  // sans écart d'hydratation.
  const clientActif = useSyncExternalStore(
    abonnerProfilageClient,
    () => profilageClientActif(compteId),
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

  const rafraichirMaintenant = useCallback(() => setRafraichir((n) => n + 1), []);
  const { enCours, basculer } = useEnregistrement(compteId, rafraichirMaintenant);

  const vider = async () => {
    viderMesuresClient(compteId);
    try {
      await fetch("/api/profiling", { method: "DELETE" });
    } catch {
      // ignore
    }
    setRafraichir((n) => n + 1);
  };

  const rendus = rendusActuels(compteId);
  const interactions = interactionsActuelles(compteId);

  return (
    <div className="space-y-6">
      {/* ── En-tête ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className={cx(
              "size-2 rounded-full",
              enCours ? "animate-pulse bg-danger" : clientActif ? "bg-succes" : "bg-texte-discret",
            )}
            aria-hidden
          />
          <span className="text-sm text-texte-attenue">
            {!clientActif
              ? "Profilage client : indisponible"
              : enCours
                ? "Enregistrement en cours"
                : "Enregistrement à l'arrêt"}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => void basculer()}
            className={cx(
              "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              enCours
                ? "border border-danger/30 bg-danger text-white hover:bg-danger/90"
                : "border border-succes/30 bg-succes-faible text-succes hover:bg-succes/10",
            )}
          >
            {enCours ? "Arrêter" : "Démarrer"}
          </button>
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
        enregistrement={enCours}
        chargement={chargement}
        erreur={erreur}
      />
    </div>
  );
}
