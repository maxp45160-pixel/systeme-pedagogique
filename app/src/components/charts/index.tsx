"use client";

/**
 * Graphiques en SVG écrit à la main. Aucune bibliothèque.
 *
 * Règles suivies :
 * - une seule teinte pour toute magnitude (échelle séquentielle claire → foncée) ;
 *   aucune palette catégorielle n'est utilisée, donc aucun risque de confusion
 *   entre séries pour un lecteur daltonien ;
 * - jamais deux axes verticaux ; jamais de série multiple colorée — on préfère
 *   des petits multiples (une vignette par domaine) ;
 * - marques fines, axes et grilles en retrait, aucune valeur sur chaque point ;
 * - survol interactif : point mis en évidence et infobulle personnalisée ;
 * - les valeurs chiffrées sont toujours répétées en texte à côté du graphique,
 *   pour que l'information ne dépende jamais de la seule couleur.
 */

import { useRef, useState } from "react";
import { cleJour, formatDateCourte } from "@/lib/engine/dates";

/* ------------------------------------------------------------------ */
/* Infobulle partagée                                                  */
/* ------------------------------------------------------------------ */

/**
 * Infobulle positionnée en `fixed` (coordonnées écran) avec `z-50`.
 * `fixed` permet de sortir du conteneur `overflow-x-auto` de la carte pour que
 * le `z-index` s'affiche par-dessus le cadre sans aucune découpe.
 */
function Infobulle({
  x,
  y,
  children,
}: {
  x: number;
  y: number;
  children: React.ReactNode;
}) {
  // Si le curseur est tout en haut de l'écran, on affiche sous le curseur
  const sousLeCurseur = y < 45;
  return (
    <div
      className={`pointer-events-none fixed z-50 -translate-x-1/2 whitespace-nowrap rounded-md border border-bordure bg-surface px-2 py-1 text-[0.6875rem] text-texte shadow-[var(--ombre-surcouche)] ${
        sousLeCurseur ? "translate-y-4" : "-translate-y-full -translate-y-2"
      }`}
      style={{ left: x, top: y }}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Grille d'activité                                                   */
/* ------------------------------------------------------------------ */

/**
 * Régularité de travail sur les N dernières semaines.
 *
 * Volontairement descriptif : aucune notion de série interrompue, aucun
 * message de perte. L'échelle est séquentielle sur une seule teinte, et une
 * case vide est un fait, pas un échec.
 */
export function GrilleActivite({
  minutesParJour,
  semaines = 18,
  cellule = 11,
  now = new Date(),
}: {
  minutesParJour: Map<string, number>;
  semaines?: number;
  /**
   * Côté d'une case en pixels. La géométrie reste en pixels et non en
   * pourcentage : une case de grille d'activité doit rester carrée, un
   * étirement la rendrait illisible.
   */
  cellule?: number;
  now?: Date;
}) {
  const [survol, setSurvol] = useState<{ ci: number; ji: number } | null>(null);
  const [curseur, setCurseur] = useState<{ x: number; y: number } | null>(null);
  const conteneurRef = useRef<HTMLDivElement>(null);

  const espace = Math.max(2, Math.round(cellule * 0.27));
  const pas = cellule + espace;

  // On aligne la dernière colonne sur la semaine en cours (lundi → dimanche).
  const finSemaine = new Date(now);
  const jourSemaine = (finSemaine.getDay() + 6) % 7; // 0 = lundi
  finSemaine.setDate(finSemaine.getDate() + (6 - jourSemaine));

  const colonnes: { date: Date; minutes: number }[][] = [];
  for (let s = semaines - 1; s >= 0; s--) {
    const colonne: { date: Date; minutes: number }[] = [];
    for (let j = 0; j < 7; j++) {
      const d = new Date(finSemaine);
      d.setDate(finSemaine.getDate() - s * 7 - (6 - j));
      colonne.push({ date: d, minutes: minutesParJour.get(cleJour(d)) ?? 0 });
    }
    colonnes.push(colonne);
  }

  // Quatre paliers d'une même teinte : léger → soutenu.
  function couleur(minutes: number): string {
    if (minutes === 0) return "var(--niveau-vide)";
    if (minutes < 20) return "var(--niveau-1)";
    if (minutes < 45) return "var(--niveau-3)";
    if (minutes < 90) return "var(--niveau-4)";
    return "var(--niveau-5)";
  }

  const largeur = semaines * pas;
  const hauteur = 7 * pas;
  const joursActifs = [...minutesParJour.values()].filter((m) => m > 0).length;

  const caseSurvolee =
    survol !== null ? colonnes[survol.ci]?.[survol.ji] : null;

  return (
    <div ref={conteneurRef} className="relative overflow-x-auto">
      <svg
        viewBox={`0 0 ${largeur} ${hauteur}`}
        width={largeur}
        height={hauteur}
        role="img"
        aria-label={`Activité sur ${semaines} semaines : ${joursActifs} jours travaillés`}
        onMouseLeave={() => {
          setSurvol(null);
          setCurseur(null);
        }}
        onMouseMove={(e) => {
          setCurseur({ x: e.clientX, y: e.clientY });
        }}
      >
        {colonnes.map((colonne, ci) =>
          colonne.map((c, ji) => {
            const futur = c.date > now;
            const estSurvole = survol?.ci === ci && survol?.ji === ji;
            return (
              <rect
                key={`${ci}-${ji}`}
                x={ci * pas}
                y={ji * pas}
                width={cellule}
                height={cellule}
                rx={Math.max(2, Math.round(cellule * 0.22))}
                fill={futur ? "transparent" : couleur(c.minutes)}
                opacity={futur ? 0 : c.minutes === 0 ? 0.55 : 1}
                stroke={estSurvole ? "var(--primaire)" : "transparent"}
                strokeWidth={estSurvole ? 1.5 : 0}
                className={!futur ? "cursor-pointer transition-opacity hover:opacity-80" : undefined}
                onMouseEnter={() => setSurvol({ ci, ji })}
              />
            );
          }),
        )}
      </svg>

      {caseSurvolee && survol && curseur && (
        <Infobulle x={curseur.x} y={curseur.y}>
          <span className="font-medium">{formatDateCourte(caseSurvolee.date.toISOString())}</span>
          <span className="text-texte-attenue">
            {" "}
            · {caseSurvolee.minutes === 0 ? "pas de séance" : `${caseSurvolee.minutes} min`}
          </span>
        </Infobulle>
      )}
    </div>
  );
}

/** Légende de la grille : la couleur seule ne doit jamais porter le sens. */
export function LegendeActivite() {
  return (
    <div className="flex items-center gap-1.5 text-[0.625rem] text-texte-discret">
      <span>Moins</span>
      {["var(--niveau-vide)", "var(--niveau-1)", "var(--niveau-3)", "var(--niveau-4)", "var(--niveau-5)"].map(
        (c, i) => (
          <span
            key={i}
            className="size-2.5 rounded-[2px]"
            style={{ background: c, opacity: i === 0 ? 0.55 : 1 }}
          />
        ),
      )}
      <span>Plus</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Répartition en barres empilées                                      */
/* ------------------------------------------------------------------ */

/**
 * Répartition des compétences par niveau. Échelle séquentielle d'une seule
 * teinte, séparateurs de 2 px entre segments, valeurs répétées en légende.
 */
export function RepartitionNiveaux({ compte }: { compte: Record<number, number> }) {
  const total = Object.values(compte).reduce((s, v) => s + v, 0);
  if (total === 0) return null;

  const segments = [0, 1, 2, 3, 4, 5]
    .map((n) => ({ niveau: n, valeur: compte[n] ?? 0 }))
    .filter((s) => s.valeur > 0);

  return (
    <div>
      <div className="flex h-2 gap-[2px] overflow-hidden rounded-full">
        {segments.map((s) => (
          <div
            key={s.niveau}
            style={{
              width: `${(s.valeur / total) * 100}%`,
              background: `var(--niveau-${s.niveau})`,
            }}
            title={`Niveau ${s.niveau} — ${s.valeur} compétence(s)`}
          />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[0.6875rem] text-texte-attenue">
        {segments.map((s) => (
          <span key={s.niveau} className="inline-flex items-center gap-1">
            <span
              className="size-2 rounded-[2px]"
              style={{ background: `var(--niveau-${s.niveau})` }}
              aria-hidden
            />
            Niveau {s.niveau} · <span className="chiffres">{s.valeur}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
