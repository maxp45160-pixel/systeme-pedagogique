"use client";

/**
 * Panneau flottant de profilage — monté dans le layout `(app)`.
 *
 * Répond au besoin : « je touche à tout dans l'app pour tester, et je veux
 * voir les mesures en même temps ». Un bouton flottant ouvre un panneau
 * latéral qui se rafraîchit automatiquement toutes les 2 secondes.
 *
 * Les mesures serveur viennent de `/api/profiling` (registre en mémoire du
 * processus) ; les mesures client de `sessionStorage` (rendus React +
 * interactions).
 */

import { useCallback, useEffect, useRef, useSyncExternalStore, useState } from "react";
import { cx } from "@/components/ui/primitives";
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

const INTERVALLE_RAFRAICHISSEMENT_MS = 2000;

export function ProfilFlottant() {
  const [ouvert, setOuvert] = useState(false);
  const [serveur, setServeur] = useState<ReponseProfilage | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  // `profilageClientActif()` lit `typeof window` : faux au SSR, vrai au
  // client. `useSyncExternalStore` fournit la bonne valeur de chaque côté
  // sans écart d'hydratation.
  const clientActif = useSyncExternalStore(
    () => () => {},
    () => profilageClientActif(),
    () => false,
  );
  const panneauRef = useRef<HTMLDivElement>(null);

  const charger = useCallback(async () => {
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
    }
  }, []);

  // Rafraîchissement automatique tant que le panneau est ouvert.
  useEffect(() => {
    if (!ouvert) return;
    // Délai d'un tick : éviter un `setState` synchrone dans le corps de
    // l'effet, qui provoquerait un rendu en cascade (règle react-hooks).
    const temporisateur = setTimeout(() => void charger(), 0);
    const intervalle = setInterval(() => void charger(), INTERVALLE_RAFRAICHISSEMENT_MS);
    return () => {
      clearTimeout(temporisateur);
      clearInterval(intervalle);
    };
  }, [ouvert, charger]);

  // Fermeture au clic extérieur / Échap.
  useEffect(() => {
    if (!ouvert) return;
    function handleClick(e: MouseEvent) {
      if (panneauRef.current && !panneauRef.current.contains(e.target as Node)) {
        setOuvert(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOuvert(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [ouvert]);

  const vider = async () => {
    viderMesuresClient();
    try {
      await fetch("/api/profiling", { method: "DELETE" });
    } catch {
      // ignore
    }
    void charger();
  };

  const rendus = rendusActuels();
  const interactions = interactionsActuelles();

  return (
    <>
      {/* ── Bouton flottant ── */}
      <button
        onClick={() => setOuvert((o) => !o)}
        className={cx(
          "fixed bottom-20 right-4 z-50 flex size-11 items-center justify-center rounded-full shadow-lg transition-all duration-200",
          "lg:bottom-auto lg:top-4 lg:right-4",
          "bg-info text-white hover:bg-info-fort hover:shadow-xl",
          "hover:scale-105 active:scale-95",
          ouvert && "ring-2 ring-info/40 ring-offset-2 ring-offset-fond",
        )}
        aria-label={ouvert ? "Fermer le profilage" : "Ouvrir le profilage"}
        aria-expanded={ouvert}
        title="Profilage"
      >
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 3v18h18" />
          <path d="m7 14 4-4 3 3 5-6" />
        </svg>
        {!ouvert && serveur && serveur.totalMesures > 0 && (
          <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-danger text-[0.625rem] font-bold text-white shadow">
            {serveur.totalMesures > 9 ? "9+" : serveur.totalMesures}
          </span>
        )}
      </button>

      {/* ── Panneau latéral ── */}
      {ouvert && (
        <div className="fixed inset-0 z-40" aria-hidden />
      )}
      {ouvert && (
        <div
          ref={panneauRef}
          role="dialog"
          aria-modal
          aria-label="Profilage"
          className="apparition fixed bottom-0 right-0 top-0 z-50 flex w-full max-w-md flex-col border-l border-bordure bg-surface shadow-[var(--ombre-surcouche)]"
        >
          {/* En-tête */}
          <div className="flex items-center justify-between border-b border-bordure px-4 py-3">
            <div className="flex items-center gap-2">
              <svg viewBox="0 0 24 24" className="size-5 text-info" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 3v18h18" />
                <path d="m7 14 4-4 3 3 5-6" />
              </svg>
              <h2 className="font-serif text-[1.0625rem] font-medium tracking-tight">
                Profilage
              </h2>
              <span
                className={cx(
                  "size-2 rounded-full",
                  clientActif ? "bg-succes" : "bg-texte-discret",
                )}
                title={clientActif ? "Profilage client actif" : "Profilage client inactif"}
                aria-hidden
              />
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={vider}
                className="rounded-md border border-danger/30 bg-danger-faible px-2 py-1 text-[0.6875rem] font-medium text-danger transition-colors hover:bg-danger/10"
              >
                Vider
              </button>
              <button
                onClick={() => setOuvert(false)}
                className="flex size-7 items-center justify-center rounded-md text-texte-discret transition-colors hover:bg-surface-2 hover:text-texte"
                aria-label="Fermer"
              >
                <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Contenu défilant */}
          <div className="flex-1 overflow-y-auto px-4 py-4">
            <ProfilContenu
              serveur={serveur}
              rendus={rendus}
              interactions={interactions}
              clientActif={clientActif}
              chargement={false}
              erreur={erreur}
            />
          </div>
        </div>
      )}
    </>
  );
}