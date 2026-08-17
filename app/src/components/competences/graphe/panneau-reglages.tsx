"use client";

/**
 * Panneau de filtres du graphe — Domaines, Éléments et Liaisons.
 *
 * Épuré pour aller droit au but :
 * - Sélection et filtrage direct par Domaine.
 * - Activation des types d'éléments complémentaires (Thèmes, Exercices, Documents).
 * - Activation/désactivation globale des liaisons.
 */

import { useMemo } from "react";
import type { TypeLien } from "@/lib/domain/graphe";
import type { ReglagesGraphe } from "./reglages-graphe";
import { couleurDomaine, indexerDomaines } from "@/lib/ui/couleurs-domaines";

export function PanneauReglages({
  reglages,
  domainesDisponibles = [],
  onChange,
  onFermer,
}: {
  reglages: ReglagesGraphe;
  domainesDisponibles?: { id: string; nom: string; total: number }[];
  onChange: (suivant: ReglagesGraphe) => void;
  onFermer: () => void;
}) {
  function set<K extends keyof ReglagesGraphe>(cle: K, valeur: ReglagesGraphe[K]) {
    onChange({ ...reglages, [cle]: valeur });
  }

  // Indexation identique au canvas pour une concordance exacte des couleurs
  const { indexDomaine, totalDomaines } = useMemo(
    () => indexerDomaines(domainesDisponibles.map((d) => d.id)),
    [domainesDisponibles],
  );

  const liensActifs = useMemo(
    () => Object.values(reglages.typesLiensVisibles).some(Boolean),
    [reglages.typesLiensVisibles],
  );

  function basculerTousLiens(actif: boolean) {
    const maj: Record<TypeLien, boolean> = {
      prerequis: actif,
      theme: actif,
      exercice: actif,
      similarite: actif,
      document: actif,
    };
    set("typesLiensVisibles", maj);
  }

  const totalCompetences = useMemo(
    () => domainesDisponibles.reduce((acc, d) => acc + d.total, 0),
    [domainesDisponibles],
  );

  return (
    <div className="absolute inset-y-0 right-0 z-20 flex w-[min(20rem,88%)] flex-col overflow-y-auto border-l border-bordure bg-surface-2/98 text-sm shadow-2xl backdrop-blur-md">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-bordure bg-surface-2 px-4 py-3.5">
        <div>
          <p className="font-semibold text-texte">Filtres de la constellation</p>
          <p className="text-[11px] text-texte-discret">{totalCompetences} compétences réparties</p>
        </div>
        <button
          type="button"
          onClick={onFermer}
          className="grid size-8 place-items-center rounded-lg border border-bordure text-texte-attenue hover:text-texte cursor-pointer"
          aria-label="Fermer le panneau de réglages"
        >
          ✕
        </button>
      </div>

      <div className="space-y-5 px-4 py-4">
        {/* 1. FILTRER PAR DOMAINE (Au premier plan) */}
        {domainesDisponibles.length > 0 && (
          <section className="rounded-xl border border-bordure bg-surface/70 p-3">
            <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-bordure/60">
              <p className="font-semibold text-xs text-texte uppercase tracking-wider">
                Domaines ({domainesDisponibles.length})
              </p>
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => set("domainesMasques", {})}
                  className="text-primaire hover:underline cursor-pointer font-medium"
                >
                  Tous
                </button>
                <span className="text-texte-discret">·</span>
                <button
                  type="button"
                  onClick={() => {
                    const masques: Record<string, boolean> = {};
                    domainesDisponibles.forEach((d) => (masques[d.id] = true));
                    set("domainesMasques", masques);
                  }}
                  className="text-texte-discret hover:underline cursor-pointer"
                >
                  Aucun
                </button>
              </div>
            </div>
            <div className="space-y-1 max-h-60 overflow-y-auto pr-1">
              {domainesDisponibles.map((d) => {
                const visible = !reglages.domainesMasques?.[d.id];
                const idx = indexDomaine.get(d.id) ?? 0;
                const couleur = couleurDomaine(idx, totalDomaines);
                return (
                  <label
                    key={d.id}
                    className="flex min-h-7 items-center justify-between gap-2 text-xs cursor-pointer hover:bg-surface-2 rounded-lg px-2 py-1 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <input
                        type="checkbox"
                        checked={visible}
                        onChange={(e) =>
                          set("domainesMasques", {
                            ...reglages.domainesMasques,
                            [d.id]: !e.target.checked,
                          })
                        }
                        className="size-3.5 accent-[var(--primaire)] shrink-0 cursor-pointer"
                      />
                      <span
                        className="size-3 rounded-full shrink-0 border border-black/20"
                        style={{ backgroundColor: couleur }}
                      />
                      <span className="truncate text-texte font-medium">{d.nom}</span>
                    </div>
                    <span className="chiffres text-[11px] text-texte-discret shrink-0">
                      {d.total}
                    </span>
                  </label>
                );
              })}
            </div>
          </section>
        )}

        {/* 2. ÉLÉMENTS DU CORPUS */}
        <section className="rounded-xl border border-bordure bg-surface/70 p-3">
          <p className="mb-2 pb-1.5 border-b border-bordure/60 font-semibold text-xs text-texte uppercase tracking-wider">
            Autres éléments
          </p>
          <div className="space-y-1.5">
            <label className="flex min-h-7 items-center gap-2 text-xs cursor-pointer hover:bg-surface-2 rounded-lg px-2 py-1 transition-colors">
              <input
                type="checkbox"
                checked={reglages.typesNoeudsVisibles.theme}
                onChange={(e) =>
                  set("typesNoeudsVisibles", {
                    ...reglages.typesNoeudsVisibles,
                    theme: e.target.checked,
                  })
                }
                className="size-3.5 accent-[var(--primaire)] cursor-pointer"
              />
              <span className="text-texte">Thèmes transversaux</span>
            </label>
            <label className="flex min-h-7 items-center gap-2 text-xs cursor-pointer hover:bg-surface-2 rounded-lg px-2 py-1 transition-colors">
              <input
                type="checkbox"
                checked={reglages.typesNoeudsVisibles.exercice}
                onChange={(e) =>
                  set("typesNoeudsVisibles", {
                    ...reglages.typesNoeudsVisibles,
                    exercice: e.target.checked,
                  })
                }
                className="size-3.5 accent-[var(--primaire)] cursor-pointer"
              />
              <span className="text-texte">Exercices</span>
            </label>
            <label className="flex min-h-7 items-center gap-2 text-xs cursor-pointer hover:bg-surface-2 rounded-lg px-2 py-1 transition-colors">
              <input
                type="checkbox"
                checked={reglages.typesNoeudsVisibles.document}
                onChange={(e) =>
                  set("typesNoeudsVisibles", {
                    ...reglages.typesNoeudsVisibles,
                    document: e.target.checked,
                  })
                }
                className="size-3.5 accent-[var(--primaire)] cursor-pointer"
              />
              <span className="text-texte">Documents Markdown</span>
            </label>
          </div>
        </section>

        {/* 3. LIAISONS ENTRE COMPÉTENCES */}
        <section className="rounded-xl border border-bordure bg-surface/70 p-3">
          <div className="flex items-center justify-between mb-1.5 pb-1 border-b border-bordure/60">
            <p className="font-semibold text-xs text-texte uppercase tracking-wider">
              Liaisons & Relations
            </p>
            <button
              type="button"
              onClick={() => basculerTousLiens(!liensActifs)}
              className="text-[0.6875rem] text-primaire hover:underline cursor-pointer font-medium"
            >
              {liensActifs ? "Masquer tout" : "Afficher tout"}
            </button>
          </div>
          <p className="text-[11px] text-texte-discret mb-2 leading-relaxed">
            Affiche les connexions transversales (thèmes, co-ciblages, proximité sémantique).
          </p>
          <label className="flex min-h-7 items-center gap-2 text-xs cursor-pointer hover:bg-surface-2 rounded-lg px-2 py-1 transition-colors">
            <input
              type="checkbox"
              checked={liensActifs}
              onChange={(e) => basculerTousLiens(e.target.checked)}
              className="size-3.5 accent-[var(--primaire)] cursor-pointer"
            />
            <span className="text-texte font-medium">Afficher les liens relationnels</span>
          </label>
        </section>
      </div>
    </div>
  );
}
