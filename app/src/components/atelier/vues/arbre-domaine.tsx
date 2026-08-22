"use client";

/**
 * L'arbre de progression d'un domaine — la lecture « chemin » de l'Atelier.
 *
 * La grille de fiches répond à « qu'est-ce qu'il y a dans ce domaine ». Cet
 * écran répond à « par où je passe ». Mêmes compétences, même classement par
 * palier : ce n'est pas un second rangement des mêmes objets, c'est le même
 * rangement dessiné selon les prérequis déclarés.
 *
 * Ce composant ne décide rien. Rangées, statuts, arêtes et feuilles viennent
 * de `lib/domain/arbre-competences.ts` ; il ne fait que les placer et mesurer
 * leurs positions pour tracer les traits.
 *
 * ## Le gris n'est pas un défaut d'affichage
 *
 * Deux nœuds gris, jamais confondus :
 *   - `hors-perimetre` — le référentiel connaît cette compétence, elle est
 *     seulement hors du périmètre de travail ; son intitulé est réel ;
 *   - `non-creee` — un code cité en prérequis que personne n'a créé. Le
 *     chemin s'arrête là, et le nœud propose de le prolonger.
 *
 * Aucun nœud « à venir » n'est inventé : une suite non déclarée n'existe pas.
 * Là où le chemin se termine sans suite, l'arbre affiche ses `feuilles` et
 * propose le geste de création — un bouton, pas une donnée.
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type {
  ArbreDomaine,
  NoeudArbre,
  StatutNoeudArbre,
} from "@/lib/domain/arbre-competences";
import { cx } from "@/components/ui/primitives";
import { LIBELLES_PALIERS } from "./elements-fiche";

const LIBELLES_STATUTS: Record<StatutNoeudArbre, string> = {
  maitrisee: "Maîtrisée",
  "en-cours": "En cours",
  disponible: "À travailler",
  "prerequis-incomplet": "Après ses prérequis",
  "hors-perimetre": "Hors périmètre",
  "non-creee": "Pas encore créée",
};

const STYLES_STATUTS: Record<StatutNoeudArbre, string> = {
  maitrisee: "border-succes/40 bg-succes-faible/60 text-texte",
  "en-cours": "border-primaire/40 bg-primaire-faible/60 text-texte",
  disponible: "border-bordure bg-surface text-texte",
  "prerequis-incomplet": "border-bordure bg-surface-2/60 text-texte-attenue",
  "hors-perimetre": "border-dashed border-bordure bg-surface/40 text-texte-discret",
  "non-creee": "border-dashed border-bordure bg-surface/40 text-texte-discret",
};

const STYLES_PASTILLES: Record<StatutNoeudArbre, string> = {
  maitrisee: "bg-succes",
  "en-cours": "bg-primaire",
  disponible: "bg-texte-discret",
  "prerequis-incomplet": "bg-bordure",
  "hors-perimetre": "bg-bordure",
  "non-creee": "bg-bordure",
};

const FANTOMES: StatutNoeudArbre[] = ["hors-perimetre", "non-creee"];

interface Segment {
  cle: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  fantome: boolean;
  source: string;
  target: string;
}

export function ArbreDomaineVue({
  arbre,
  intitules,
  ouvrirElement,
  onCreerCompetence,
}: {
  arbre: ArbreDomaine;
  /** Intitulés connus, pour nommer une feuille sans relire l'arbre. */
  intitules: Map<string, string>;
  ouvrirElement: (code: string) => void;
  /** Ouvre la création d'une compétence. `code` quand un fantôme la nomme déjà. */
  onCreerCompetence?: (code?: string) => void;
}) {
  const conteneur = useRef<HTMLDivElement | null>(null);
  const noeudsRefs = useRef(new Map<string, HTMLElement>());
  const [segments, setSegments] = useState<Segment[]>([]);
  const [survol, setSurvol] = useState<string | null>(null);

  const enregistrer = useCallback((code: string, element: HTMLElement | null) => {
    if (element) noeudsRefs.current.set(code, element);
    else noeudsRefs.current.delete(code);
  }, []);

  const mesurer = useCallback(() => {
    const racine = conteneur.current;
    if (!racine) return;
    const base = racine.getBoundingClientRect();
    const centre = (code: string) => {
      const element = noeudsRefs.current.get(code);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return {
        x: rect.left - base.left + rect.width / 2,
        haut: rect.top - base.top,
        bas: rect.bottom - base.top,
      };
    };
    const prochains: Segment[] = [];
    for (const arete of arbre.aretes) {
      const source = centre(arete.source);
      const target = centre(arete.target);
      if (!source || !target) continue;
      /* Le trait part du bord le plus proche : un prérequis peut vivre sur la
         même rangée que la compétence qui le cite. */
      const descendant = source.bas <= target.haut;
      prochains.push({
        cle: `${arete.source}->${arete.target}`,
        x1: source.x,
        y1: descendant ? source.bas : source.haut,
        x2: target.x,
        y2: descendant ? target.haut : target.bas,
        fantome: arete.fantome,
        source: arete.source,
        target: arete.target,
      });
    }
    setSegments(prochains);
  }, [arbre.aretes]);

  useLayoutEffect(() => {
    mesurer();
  }, [mesurer, arbre]);

  useEffect(() => {
    const racine = conteneur.current;
    if (!racine || typeof ResizeObserver === "undefined") return;
    const observateur = new ResizeObserver(() => mesurer());
    observateur.observe(racine);
    return () => observateur.disconnect();
  }, [mesurer]);

  /** Le voisinage déclaré du nœud survolé — jamais un voisinage deviné. */
  const voisinage = useMemo(() => {
    if (!survol) return null;
    const codes = new Set<string>([survol]);
    for (const arete of arbre.aretes) {
      if (arete.source === survol) codes.add(arete.target);
      if (arete.target === survol) codes.add(arete.source);
    }
    return codes;
  }, [arbre.aretes, survol]);

  const feuilles = arbre.feuilles.filter((code) => !FANTOMES.includes(statutDe(arbre, code)));

  if (arbre.rangees.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-bordure bg-surface/50 px-4 py-8 text-center text-sm text-texte-discret">
        Ce domaine n’a pas encore de compétence : l’arbre s’ouvrira dès la première.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div ref={conteneur} className="relative">
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          aria-hidden="true"
          focusable="false"
        >
          {segments.map((segment) => {
            const eclaire =
              voisinage === null ||
              voisinage.has(segment.source) ||
              voisinage.has(segment.target);
            return (
              <path
                key={segment.cle}
                d={courbe(segment)}
                fill="none"
                stroke="var(--bordure)"
                strokeWidth={eclaire && voisinage !== null ? 2 : 1.5}
                strokeDasharray={segment.fantome ? "4 4" : undefined}
                opacity={eclaire ? (segment.fantome ? 0.65 : 1) : 0.2}
              />
            );
          })}
        </svg>

        <div className="relative space-y-8">
          {arbre.rangees.map((rangee) => (
            <section key={rangee.palier}>
              <div className="mb-3 flex items-center gap-2">
                <h4 className="text-xs font-semibold uppercase tracking-[0.1em] text-texte-discret">
                  {LIBELLES_PALIERS[rangee.palier] ?? rangee.palier}
                </h4>
                <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[0.625rem] font-medium text-texte-discret">
                  {rangee.noeuds.length}
                </span>
              </div>
              <div className="flex flex-wrap gap-3">
                {rangee.noeuds.map((noeud) => (
                  <NoeudCarte
                    key={noeud.code}
                    noeud={noeud}
                    attenue={voisinage !== null && !voisinage.has(noeud.code)}
                    enregistrer={enregistrer}
                    onSurvol={setSurvol}
                    onOuvrir={ouvrirElement}
                    onCreerCompetence={onCreerCompetence}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>

      {feuilles.length > 0 && (
        <section className="rounded-xl border border-dashed border-bordure bg-surface/40 p-4">
          <h4 className="text-xs font-semibold uppercase tracking-[0.1em] text-texte-discret">
            Bouts du chemin
          </h4>
          <p className="mt-1 text-xs leading-relaxed text-texte-attenue">
            Ces compétences sont travaillées et aucune suite n’est déclarée après elles.
            Le système ne devine pas laquelle vient ensuite : c’est à vous de l’ouvrir.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {feuilles.map((code) => (
              <span
                key={code}
                className="inline-flex items-center gap-2 rounded-lg border border-bordure bg-surface px-2.5 py-1.5 text-xs text-texte-attenue"
              >
                {intitules.get(code) ?? code}
                {onCreerCompetence && (
                  <button
                    type="button"
                    onClick={() => onCreerCompetence()}
                    className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[0.625rem] font-semibold text-primaire transition-colors hover:bg-primaire-faible cursor-pointer"
                  >
                    Ouvrir la suite
                  </button>
                )}
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function NoeudCarte({
  noeud,
  attenue,
  enregistrer,
  onSurvol,
  onOuvrir,
  onCreerCompetence,
}: {
  noeud: NoeudArbre;
  attenue: boolean;
  enregistrer: (code: string, element: HTMLElement | null) => void;
  onSurvol: (code: string | null) => void;
  onOuvrir: (code: string) => void;
  onCreerCompetence?: (code?: string) => void;
}) {
  const fantome = FANTOMES.includes(noeud.statut);
  const creable = noeud.statut === "non-creee" && onCreerCompetence !== undefined;

  return (
    <button
      ref={(element) => enregistrer(noeud.code, element)}
      type="button"
      onMouseEnter={() => onSurvol(noeud.code)}
      onMouseLeave={() => onSurvol(null)}
      onFocus={() => onSurvol(noeud.code)}
      onBlur={() => onSurvol(null)}
      onClick={() => {
        if (noeud.statut === "non-creee") onCreerCompetence?.(noeud.code);
        else onOuvrir(noeud.code);
      }}
      disabled={noeud.statut === "non-creee" && !creable}
      className={cx(
        "group w-56 rounded-xl border p-3 text-left transition-all",
        STYLES_STATUTS[noeud.statut],
        attenue ? "opacity-35" : "opacity-100",
        noeud.statut === "non-creee" && !creable
          ? "cursor-default"
          : "cursor-pointer hover:-translate-y-0.5 hover:shadow-[var(--ombre-levee)]",
      )}
    >
      <div className="flex items-center gap-1.5">
        <span className={cx("size-1.5 rounded-full", STYLES_PASTILLES[noeud.statut])} />
        <span className="chiffres text-[0.625rem] text-texte-discret">{noeud.code}</span>
        {noeud.rattachee && (
          <span className="rounded-md bg-accent/10 px-1 py-0.5 text-[0.5625rem] font-medium text-accent">
            Sous-domaine
          </span>
        )}
      </div>
      <p
        className={cx(
          "mt-1.5 text-sm font-semibold leading-snug",
          fantome ? "italic" : "group-hover:text-primaire",
        )}
      >
        {noeud.intitule}
      </p>
      <p className="mt-1.5 text-[0.625rem] text-texte-discret">
        {LIBELLES_STATUTS[noeud.statut]}
        {noeud.nombreObservations > 0 &&
          ` · ${noeud.nombreObservations} trace${noeud.nombreObservations > 1 ? "s" : ""}`}
      </p>
      {noeud.statut === "non-creee" && (
        <p className="mt-1.5 text-[0.625rem] leading-relaxed text-texte-discret">
          Citée en prérequis, jamais créée.
          {noeud.palierInconnu && " Son palier est celui de la compétence qui la cite."}
          {creable && " Cliquer pour l’ouvrir."}
        </p>
      )}
      {noeud.statut === "hors-perimetre" && (
        <p className="mt-1.5 text-[0.625rem] leading-relaxed text-texte-discret">
          Connue du référentiel, hors du périmètre de travail.
        </p>
      )}
    </button>
  );
}

/** Une courbe de Bézier verticale — lisible même quand deux nœuds se croisent. */
function courbe({ x1, y1, x2, y2 }: Segment): string {
  const inflexion = Math.max(12, Math.abs(y2 - y1) / 2);
  return `M ${x1} ${y1} C ${x1} ${y1 + inflexion}, ${x2} ${y2 - inflexion}, ${x2} ${y2}`;
}

function statutDe(arbre: ArbreDomaine, code: string): StatutNoeudArbre {
  for (const rangee of arbre.rangees) {
    for (const noeud of rangee.noeuds) {
      if (noeud.code === code) return noeud.statut;
    }
  }
  return "disponible";
}
