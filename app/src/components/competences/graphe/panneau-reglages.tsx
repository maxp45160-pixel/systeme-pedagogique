"use client";

/**
 * Panneau de réglages du graphe — filtres, axe de coloration, forces.
 *
 * Façon Obsidian : un volet latéral repliable plutôt que des contrôles
 * éparpillés sur le canvas. Chaque changement est immédiat (pas de bouton
 * « Appliquer ») et persisté par l'appelant (`GrapheCompetences`).
 */

import type { TypeLien, TypeNoeud } from "@/lib/domain/graphe";
import { STYLE_PAR_TYPE_LIEN } from "./rendu-canvas";
import type { AxeCouleur, ReglagesGraphe } from "./reglages-graphe";

const LIBELLES_TYPE_NOEUD: Record<TypeNoeud, string> = {
  competence: "Compétences",
  exercice: "Exercices",
  theme: "Thèmes (hubs)",
};

const LIBELLES_AXE_COULEUR: Record<AxeCouleur, string> = {
  domaine: "Domaine",
  palier: "Palier",
  maitrise: "Niveau de maîtrise",
  couverture: "Couverture en exercices",
};

const ORDRE_LIENS: TypeLien[] = ["prerequis", "theme", "exercice", "similarite"];

export function PanneauReglages({
  reglages,
  onChange,
  onFermer,
}: {
  reglages: ReglagesGraphe;
  onChange: (suivant: ReglagesGraphe) => void;
  onFermer: () => void;
}) {
  function set<K extends keyof ReglagesGraphe>(cle: K, valeur: ReglagesGraphe[K]) {
    onChange({ ...reglages, [cle]: valeur });
  }

  return (
    <div className="flex h-full w-64 shrink-0 flex-col overflow-y-auto border-l border-bordure bg-surface-2 text-xs">
      <div className="flex items-center justify-between border-b border-bordure px-3 py-2.5">
        <p className="font-medium">Réglages</p>
        <button
          type="button"
          onClick={onFermer}
          className="text-texte-attenue hover:text-texte"
          aria-label="Fermer le panneau de réglages"
        >
          ✕
        </button>
      </div>

      <div className="space-y-5 px-3 py-3">
        {/* Types de nœuds */}
        <section>
          <p className="mb-1.5 font-medium text-texte-attenue">Afficher</p>
          <div className="space-y-1">
            {(Object.keys(LIBELLES_TYPE_NOEUD) as TypeNoeud[]).map((t) => (
              <label key={t} className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={reglages.typesNoeudsVisibles[t]}
                  onChange={(e) =>
                    set("typesNoeudsVisibles", {
                      ...reglages.typesNoeudsVisibles,
                      [t]: e.target.checked,
                    })
                  }
                  className="size-3.5 accent-[var(--primaire)]"
                />
                {LIBELLES_TYPE_NOEUD[t]}
              </label>
            ))}
          </div>
        </section>

        {/* Types de liens */}
        <section>
          <p className="mb-1.5 font-medium text-texte-attenue">Liens</p>
          <div className="space-y-1">
            {ORDRE_LIENS.map((t) => (
              <label key={t} className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={reglages.typesLiensVisibles[t]}
                  onChange={(e) =>
                    set("typesLiensVisibles", {
                      ...reglages.typesLiensVisibles,
                      [t]: e.target.checked,
                    })
                  }
                  className="size-3.5 accent-[var(--primaire)]"
                />
                <span className="flex items-center gap-1">
                  {STYLE_PAR_TYPE_LIEN[t].libelle}
                  {STYLE_PAR_TYPE_LIEN[t].pointille && (
                    <span className="text-texte-discret">(pointillé)</span>
                  )}
                </span>
              </label>
            ))}
          </div>
          {reglages.typesLiensVisibles.similarite && (
            <label className="mt-2 flex flex-col gap-1">
              <span className="text-texte-discret">
                Seuil de similarité : {reglages.seuilSimilarite.toFixed(2)}
              </span>
              <input
                type="range"
                min={0}
                max={0.6}
                step={0.01}
                value={reglages.seuilSimilarite}
                onChange={(e) => set("seuilSimilarite", Number(e.target.value))}
              />
            </label>
          )}
        </section>

        {/* Axe de coloration */}
        <section>
          <p className="mb-1.5 font-medium text-texte-attenue">Classer par</p>
          <select
            value={reglages.axeCouleur}
            onChange={(e) => set("axeCouleur", e.target.value as AxeCouleur)}
            className="w-full rounded-md border border-bordure bg-surface px-2 py-1"
          >
            {(Object.keys(LIBELLES_AXE_COULEUR) as AxeCouleur[]).map((a) => (
              <option key={a} value={a}>
                {LIBELLES_AXE_COULEUR[a]}
              </option>
            ))}
          </select>
        </section>

        {/* Forces */}
        <section>
          <p className="mb-1.5 font-medium text-texte-attenue">Disposition</p>
          <div className="space-y-2">
            <label className="flex flex-col gap-1">
              <span className="text-texte-discret">Répulsion</span>
              <input
                type="range"
                min={40}
                max={600}
                step={10}
                value={reglages.forces.repulsion}
                onChange={(e) =>
                  set("forces", { ...reglages.forces, repulsion: Number(e.target.value) })
                }
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-texte-discret">Distance des liens</span>
              <input
                type="range"
                min={20}
                max={200}
                step={5}
                value={reglages.forces.distanceLiens}
                onChange={(e) =>
                  set("forces", { ...reglages.forces, distanceLiens: Number(e.target.value) })
                }
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-texte-discret">Force de centrage</span>
              <input
                type="range"
                min={0}
                max={0.15}
                step={0.005}
                value={reglages.forces.centrage}
                onChange={(e) =>
                  set("forces", { ...reglages.forces, centrage: Number(e.target.value) })
                }
              />
            </label>
          </div>
        </section>

        {/* Libellés */}
        <section>
          <p className="mb-1.5 font-medium text-texte-attenue">Libellés</p>
          <label className="flex flex-col gap-1">
            <span className="text-texte-discret">
              Apparaissent à partir du zoom {reglages.seuilLibelles.toFixed(2)}×
            </span>
            <input
              type="range"
              min={0.2}
              max={2}
              step={0.05}
              value={reglages.seuilLibelles}
              onChange={(e) => set("seuilLibelles", Number(e.target.value))}
            />
          </label>
        </section>
      </div>
    </div>
  );
}
