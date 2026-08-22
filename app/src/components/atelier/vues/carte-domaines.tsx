"use client";

/**
 * La carte des domaines — l'échelon au-dessus du graphe de compétences.
 *
 * Le graphe de compétences montre des dizaines de nœuds ; à cette échelle,
 * « quels sujets se parlent » n'est pas lisible. Cette carte répond à cette
 * question-là, et à rien d'autre : un nœud par domaine, une arête par fait
 * déclaré (`lib/domain/graphe-domaines.ts`).
 *
 * ## Pourquoi une grille mesurée et non un moteur de forces
 *
 * Un moteur de forces place les nœuds au hasard de son initialisation : deux
 * chargements donnent deux cartes, et rien n'est comparable d'une fois sur
 * l'autre. À l'échelle d'une dizaine de domaines, une grille ordonnée par le
 * référentiel est stable, lisible, et se relit à l'identique. Les traits sont
 * tracés après mesure des positions réelles — aucune coordonnée n'est
 * supposée.
 *
 * ## Ce qui n'y figure pas
 *
 * Aucun lien de proximité de vocabulaire entre domaines : sur deux mots de
 * nom, il produirait des voisinages au hasard. Un domaine sans arête reste
 * isolé, et l'écran le dit franchement.
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type {
  GrapheDomaines,
  LienDomaine,
  TypeLienDomaine,
} from "@/lib/domain/graphe-domaines";
import { cx } from "@/components/ui/primitives";

const LIBELLES_LIENS: Record<TypeLienDomaine, string> = {
  prerequis: "Prérequis déclaré",
  rattachement: "Compétence partagée",
  exercice: "Exercice commun",
};

const COULEURS_LIENS: Record<TypeLienDomaine, string> = {
  prerequis: "var(--primaire)",
  rattachement: "var(--accent)",
  exercice: "var(--info)",
};

interface Segment {
  cle: string;
  lien: LienDomaine;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export function CarteDomaines({
  graphe,
  ouvrirDomaine,
}: {
  graphe: GrapheDomaines;
  ouvrirDomaine: (domaineId: string) => void;
}) {
  const conteneur = useRef<HTMLDivElement | null>(null);
  const cartes = useRef(new Map<string, HTMLElement>());
  const [segments, setSegments] = useState<Segment[]>([]);
  const [survol, setSurvol] = useState<string | null>(null);
  const [seulementActifs, setSeulementActifs] = useState(false);

  const noeuds = useMemo(
    () => (seulementActifs ? graphe.noeuds.filter((noeud) => noeud.actif) : graphe.noeuds),
    [graphe.noeuds, seulementActifs],
  );
  const visibles = useMemo(() => new Set(noeuds.map((noeud) => noeud.id)), [noeuds]);
  const liens = useMemo(
    () => graphe.liens.filter((lien) => visibles.has(lien.source) && visibles.has(lien.target)),
    [graphe.liens, visibles],
  );
  const nombreActifs = graphe.noeuds.filter((noeud) => noeud.actif).length;

  const enregistrer = useCallback((id: string, element: HTMLElement | null) => {
    if (element) cartes.current.set(id, element);
    else cartes.current.delete(id);
  }, []);

  const mesurer = useCallback(() => {
    const racine = conteneur.current;
    if (!racine) return;
    const base = racine.getBoundingClientRect();
    const centre = (id: string) => {
      const element = cartes.current.get(id);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return {
        x: rect.left - base.left + rect.width / 2,
        y: rect.top - base.top + rect.height / 2,
      };
    };
    const prochains: Segment[] = [];
    for (const lien of liens) {
      const a = centre(lien.source);
      const b = centre(lien.target);
      if (!a || !b) continue;
      prochains.push({
        cle: `${lien.type}:${lien.source}->${lien.target}`,
        lien,
        x1: a.x,
        y1: a.y,
        x2: b.x,
        y2: b.y,
      });
    }
    setSegments(prochains);
  }, [liens]);

  useLayoutEffect(() => {
    mesurer();
  }, [mesurer, noeuds]);

  useEffect(() => {
    const racine = conteneur.current;
    if (!racine || typeof ResizeObserver === "undefined") return;
    const observateur = new ResizeObserver(() => mesurer());
    observateur.observe(racine);
    return () => observateur.disconnect();
  }, [mesurer]);

  const voisinage = useMemo(() => {
    if (!survol) return null;
    const codes = new Set<string>([survol]);
    for (const lien of liens) {
      if (lien.source === survol) codes.add(lien.target);
      if (lien.target === survol) codes.add(lien.source);
    }
    return codes;
  }, [liens, survol]);

  const degres = useMemo(() => {
    const compte = new Map<string, number>();
    for (const lien of liens) {
      compte.set(lien.source, (compte.get(lien.source) ?? 0) + 1);
      compte.set(lien.target, (compte.get(lien.target) ?? 0) + 1);
    }
    return compte;
  }, [liens]);

  if (graphe.noeuds.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-bordure bg-surface/50 px-4 py-10 text-center text-sm text-texte-discret">
        Aucun domaine à cartographier pour l’instant.
      </p>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-bordure bg-surface px-3.5 py-3">
        <div className="flex flex-wrap items-center gap-3">
          {(Object.keys(LIBELLES_LIENS) as TypeLienDomaine[]).map((type) => (
            <span key={type} className="inline-flex items-center gap-1.5 text-[0.6875rem] text-texte-attenue">
              <span
                className="h-0.5 w-5 rounded-full"
                style={{ backgroundColor: COULEURS_LIENS[type] }}
              />
              {LIBELLES_LIENS[type]}
            </span>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setSeulementActifs((valeur) => !valeur)}
          aria-pressed={seulementActifs}
          className={cx(
            "rounded-lg border px-3 py-1 text-xs font-medium transition-colors cursor-pointer",
            seulementActifs
              ? "border-primaire bg-primaire-faible text-primaire"
              : "border-bordure bg-surface-2 text-texte-discret hover:text-texte",
          )}
        >
          Domaines actifs ({nombreActifs})
        </button>
      </div>

      {noeuds.length === 0 ? (
        <p className="rounded-xl border border-dashed border-bordure bg-surface/50 px-4 py-10 text-center text-sm text-texte-discret">
          Aucun domaine travaillé récemment. Les traces existantes restent dans la vue complète.
        </p>
      ) : (
        <div ref={conteneur} className="relative">
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full"
            aria-hidden="true"
            focusable="false"
          >
            {segments.map((segment) => {
              const eclaire =
                voisinage === null ||
                voisinage.has(segment.lien.source) ||
                voisinage.has(segment.lien.target);
              return (
                <line
                  key={segment.cle}
                  x1={segment.x1}
                  y1={segment.y1}
                  x2={segment.x2}
                  y2={segment.y2}
                  stroke={COULEURS_LIENS[segment.lien.type]}
                  strokeWidth={1 + segment.lien.poids * 2}
                  strokeLinecap="round"
                  opacity={eclaire ? 0.55 : 0.12}
                />
              );
            })}
          </svg>

          <div className="relative grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {noeuds.map((noeud) => {
              const attenue = voisinage !== null && !voisinage.has(noeud.id);
              const degre = degres.get(noeud.id) ?? 0;
              return (
                <button
                  key={noeud.id}
                  ref={(element) => enregistrer(noeud.id, element)}
                  type="button"
                  onMouseEnter={() => setSurvol(noeud.id)}
                  onMouseLeave={() => setSurvol(null)}
                  onFocus={() => setSurvol(noeud.id)}
                  onBlur={() => setSurvol(null)}
                  onClick={() => ouvrirDomaine(noeud.id)}
                  className={cx(
                    "group rounded-xl border bg-surface p-4 text-left shadow-[var(--ombre-posee)] transition-all hover:-translate-y-0.5 hover:border-primaire/30 hover:shadow-[var(--ombre-levee)] cursor-pointer",
                    noeud.actif ? "border-primaire/40" : "border-bordure",
                    attenue ? "opacity-35" : "opacity-100",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="chiffres rounded-md bg-surface-2 px-1.5 py-0.5 text-[0.625rem] text-texte-discret">
                      {noeud.prefixe}
                    </span>
                    {noeud.actif && (
                      <span className="rounded-full bg-primaire-faible px-2 py-0.5 text-[0.5625rem] font-semibold text-primaire">
                        Travaillé récemment
                      </span>
                    )}
                  </div>
                  <h4 className="mt-2 font-serif text-base font-semibold leading-snug text-texte group-hover:text-primaire">
                    {noeud.nom}
                  </h4>
                  <p className="mt-2 text-[0.6875rem] text-texte-discret">
                    {noeud.nombreCompetences} compétence{noeud.nombreCompetences > 1 ? "s" : ""} ·{" "}
                    {Math.round(noeud.couverture * 100)} % déjà rencontrées
                  </p>
                  <p className="mt-1 text-[0.6875rem] text-texte-discret">
                    {degre === 0
                      ? "Aucun lien déclaré avec un autre domaine"
                      : `${degre} lien${degre > 1 ? "s" : ""} avec d’autres domaines`}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
