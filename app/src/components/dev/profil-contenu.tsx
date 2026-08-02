"use client";

/**
 * Contenu partagé du tableau de bord de profilage.
 *
 * Utilisé par deux hôtes :
 *   * `/dev/profil` — page plein écran (`ProfilDashboard`) ;
 *   * panneau flottant dans l'application (`ProfilFlottant`).
 *
 * Le composant est purement déclaratif : il reçoit les données déjà chargées
 * et ne fait aucune requête.
 */

import { cx } from "@/components/ui/primitives";
import type { MesureInteraction } from "@/lib/profiling/client";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface MesureServeur {
  operation: string;
  dureeMs: number;
  debut: number;
  details?: Record<string, number | string | boolean>;
}

export interface ReponseProfilage {
  actif: boolean;
  /** Le registre serveur collecte-t-il à cet instant ? */
  enregistrement: boolean;
  totalMesures: number;
  totalMs: number;
  parOperation: {
    operation: string;
    appels: number;
    totalMs: number;
    maxMs: number;
    moyenneMs: number;
  }[];
  dernieres: MesureServeur[];
}

export interface RendusAgreges {
  parComposant: {
    composant: string;
    appels: number;
    totalMs: number;
    maxMs: number;
    moyenneMs: number;
  }[];
  total: number;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function formatMs(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(0)} µs`;
  if (ms < 1000) return `${ms.toFixed(1)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

function formatHeure(epoch: number): string {
  return new Date(epoch).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/* ------------------------------------------------------------------ */
/* Composant                                                           */
/* ------------------------------------------------------------------ */

export function ProfilContenu({
  serveur,
  rendus,
  interactions,
  clientActif,
  enregistrement,
  chargement,
  erreur,
}: {
  serveur: ReponseProfilage | null;
  rendus: RendusAgreges;
  interactions: MesureInteraction[];
  clientActif: boolean;
  /** L'enregistrement est-il en cours ? Change ce que disent les états vides. */
  enregistrement: boolean;
  chargement: boolean;
  erreur: string | null;
}) {
  // Sans enregistrement, un tableau vide n'est pas une absence de mesure :
  // c'est une absence de collecte. Le dire, plutôt que laisser croire que
  // l'application est instantanée.
  const consigne = enregistrement
    ? "Navigue dans le produit puis reviens ici."
    : "L'enregistrement est à l'arrêt — clique sur « Démarrer », navigue, puis reviens ici.";

  return (
    <div className="space-y-6">
      {erreur && (
        <div className="rounded-md border border-danger/30 bg-danger-faible px-4 py-2.5 text-sm text-danger">
          {erreur}
        </div>
      )}

      {/* ── Résumé ── */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-carte border border-bordure bg-surface p-4">
          <div className="text-[0.6875rem] uppercase tracking-wide text-texte-discret">
            Serveur — total
          </div>
          <div className="chiffres mt-1 text-xl font-semibold tracking-tight">
            {serveur ? formatMs(serveur.totalMs) : "—"}
          </div>
          <div className="mt-0.5 text-xs text-texte-discret">
            {serveur ? `${serveur.totalMesures} mesures` : "Aucune mesure"}
          </div>
        </div>
        <div className="rounded-carte border border-bordure bg-surface p-4">
          <div className="text-[0.6875rem] uppercase tracking-wide text-texte-discret">
            Client — rendus
          </div>
          <div className="chiffres mt-1 text-xl font-semibold tracking-tight">
            {rendus.total}
          </div>
          <div className="mt-0.5 text-xs text-texte-discret">
            {rendus.parComposant.length} composants
          </div>
        </div>
        <div className="rounded-carte border border-bordure bg-surface p-4">
          <div className="text-[0.6875rem] uppercase tracking-wide text-texte-discret">
            Client — interactions
          </div>
          <div className="chiffres mt-1 text-xl font-semibold tracking-tight">
            {interactions.length}
          </div>
          <div className="mt-0.5 text-xs text-texte-discret">dernières actions</div>
        </div>
      </div>

      {/* ── Serveur : par opération ── */}
      <section>
        <h2 className="mb-2 font-serif text-lg italic text-texte-discret">
          — serveur, par opération
        </h2>
        {chargement ? (
          <p className="text-sm text-texte-discret">Chargement…</p>
        ) : !serveur || serveur.parOperation.length === 0 ? (
          <p className="text-sm text-texte-discret">
            Aucune mesure serveur. {consigne}
          </p>
        ) : (
          <div className="overflow-hidden rounded-carte border border-bordure bg-surface">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-bordure text-[0.6875rem] uppercase tracking-wide text-texte-discret">
                  <th className="px-4 py-2 font-medium">Opération</th>
                  <th className="px-4 py-2 text-right font-medium">Appels</th>
                  <th className="px-4 py-2 text-right font-medium">Total</th>
                  <th className="px-4 py-2 text-right font-medium">Moyenne</th>
                  <th className="px-4 py-2 text-right font-medium">Max</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-bordure/50">
                {serveur.parOperation.map((op) => (
                  <tr key={op.operation} className="hover:bg-surface-2/50">
                    <td className="px-4 py-2 font-mono text-xs">{op.operation}</td>
                    <td className="px-4 py-2 text-right text-xs">{op.appels}</td>
                    <td className="px-4 py-2 text-right text-xs font-medium">
                      {formatMs(op.totalMs)}
                    </td>
                    <td className="px-4 py-2 text-right text-xs">{formatMs(op.moyenneMs)}</td>
                    <td className="px-4 py-2 text-right text-xs">{formatMs(op.maxMs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Client : rendus par composant ── */}
      <section>
        <h2 className="mb-2 font-serif text-lg italic text-texte-discret">
          — client, rendus par composant
        </h2>
        {!clientActif ? (
          <p className="text-sm text-texte-discret">
            Le profilage client est inactif. Lance en mode développement pour le rendre actif.
          </p>
        ) : rendus.parComposant.length === 0 ? (
          <p className="text-sm text-texte-discret">
            Aucun rendu enregistré. {consigne}
          </p>
        ) : (
          <div className="overflow-hidden rounded-carte border border-bordure bg-surface">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-bordure text-[0.6875rem] uppercase tracking-wide text-texte-discret">
                  <th className="px-4 py-2 font-medium">Composant</th>
                  <th className="px-4 py-2 text-right font-medium">Rendus</th>
                  <th className="px-4 py-2 text-right font-medium">Total</th>
                  <th className="px-4 py-2 text-right font-medium">Moyenne</th>
                  <th className="px-4 py-2 text-right font-medium">Max</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-bordure/50">
                {rendus.parComposant.map((c) => (
                  <tr key={c.composant} className="hover:bg-surface-2/50">
                    <td className="px-4 py-2 font-mono text-xs">{c.composant}</td>
                    <td className="px-4 py-2 text-right text-xs">{c.appels}</td>
                    <td className="px-4 py-2 text-right text-xs font-medium">
                      {formatMs(c.totalMs)}
                    </td>
                    <td className="px-4 py-2 text-right text-xs">{formatMs(c.moyenneMs)}</td>
                    <td className="px-4 py-2 text-right text-xs">{formatMs(c.maxMs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Client : interactions ── */}
      <section>
        <h2 className="mb-2 font-serif text-lg italic text-texte-discret">
          — client, interactions
        </h2>
        {!clientActif ? (
          <p className="text-sm text-texte-discret">
            Le profilage client est inactif. Lance en mode développement pour le rendre actif.
          </p>
        ) : interactions.length === 0 ? (
          <p className="text-sm text-texte-discret">
            Aucune interaction enregistrée.
          </p>
        ) : (
          <div className="overflow-hidden rounded-carte border border-bordure bg-surface">
            <table className="w-full table-fixed text-left text-sm">
              <thead>
                <tr className="border-b border-bordure text-[0.6875rem] uppercase tracking-wide text-texte-discret">
                  <th className="w-[5rem] px-4 py-2 font-medium">Heure</th>
                  <th className="w-[4rem] px-4 py-2 font-medium">Type</th>
                  <th className="px-4 py-2 font-medium">Libellé</th>
                  <th className="w-[4.5rem] px-4 py-2 text-right font-medium">Durée</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-bordure/50">
                {interactions.map((i, idx) => (
                  <tr key={idx} className="hover:bg-surface-2/50">
                    <td className="px-4 py-2 text-xs text-texte-discret">
                      {formatHeure(i.horodatage)}
                    </td>
                    <td className="px-4 py-2 text-xs">
                      <span
                        className={cx(
                          "rounded border px-1.5 py-0.5 text-[0.625rem] font-medium",
                          i.type === "navigation" && "border-info/25 bg-info-faible text-info",
                          i.type === "clic" && "border-primaire/25 bg-primaire-faible text-primaire",
                          i.type === "saisie" && "border-alerte/25 bg-alerte-faible text-alerte",
                          i.type === "autre" && "border-bordure bg-surface-2 text-texte-attenue",
                        )}
                      >
                        {i.type}
                      </span>
                    </td>
                    <td className="max-w-[12rem] truncate px-4 py-2 text-xs" title={i.libelle}>{i.libelle}</td>
                    <td className="px-4 py-2 text-right text-xs font-medium">
                      {formatMs(i.dureeMs)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}