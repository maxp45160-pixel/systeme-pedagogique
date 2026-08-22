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
import type { PointEvolution } from "@/lib/engine/evolution";

/* ------------------------------------------------------------------ */
/* Infobulle partagée                                                  */
/* ------------------------------------------------------------------ */

/**
 * Infobulle positionnée en `fixed` (coordonnées écran), couche `menu`.
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
      className={`pointer-events-none fixed z-[var(--superposition-menu)] -translate-x-1/2 whitespace-nowrap rounded-md border border-bordure bg-surface px-2 py-1 text-[0.6875rem] text-texte shadow-[var(--ombre-surcouche)] ${
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
/* Courbe d'évolution du score global                                  */
/* ------------------------------------------------------------------ */

/*
 * Géométrie fixe en unités de viewBox, étirée à la largeur de la carte.
 * `vector-effect="non-scaling-stroke"` garde le trait à 2 px quelle que soit
 * la déformation — sans lui, une carte étroite épaissirait la ligne.
 */
const LARGEUR_COURBE = 560;
const HAUTEUR_COURBE = 150;
const MARGE_COURBE = { haut: 10, droite: 34, bas: 8, gauche: 8 };

/**
 * La trajectoire du score global, point par point où il a changé.
 *
 * Une seule teinte (`--primaire`), un axe 0-100 fixe : deux comptes ne sont
 * jamais comparés par la hauteur, seulement par leur propre histoire. La
 * valeur courante est répétée en texte à droite du tracé — la couleur et la
 * position ne portent jamais seules l'information.
 */
export function CourbeEvolution({ points }: { points: PointEvolution[] }) {
  const [survol, setSurvol] = useState<number | null>(null);
  const [curseur, setCurseur] = useState<{ x: number; y: number } | null>(null);

  if (points.length === 0) return null;

  const t0 = new Date(points[0].date).getTime();
  const t1 = new Date(points[points.length - 1].date).getTime();
  const span = Math.max(1, t1 - t0);

  const x = (point: PointEvolution): number => {
    const part =
      points.length === 1 ? 1 : (new Date(point.date).getTime() - t0) / span;
    return MARGE_COURBE.gauche + part * (LARGEUR_COURBE - MARGE_COURBE.gauche - MARGE_COURBE.droite);
  };
  // 6 px de marge verticale : un score de 100 ne doit pas toucher le cadre.
  const y = (score: number): number =>
    MARGE_COURBE.haut + (1 - score / 100) * (HAUTEUR_COURBE - MARGE_COURBE.haut - MARGE_COURBE.bas);

  const trace = points.map((point) => `${x(point)},${y(point.score)}`).join(" ");
  const aire = `M${x(points[0])},${HAUTEUR_COURBE - MARGE_COURBE.bas} L${trace.replaceAll(" ", " L")} L${
    x(points[points.length - 1])
  },${HAUTEUR_COURBE - MARGE_COURBE.bas} Z`;

  const dernier = points[points.length - 1];
  const survolee = survol !== null ? points[survol] : null;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${LARGEUR_COURBE} ${HAUTEUR_COURBE}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Évolution du score global : ${points.length} mesure(s), de ${points[0].score} à ${dernier.score} sur 100.`}
        onMouseLeave={() => {
          setSurvol(null);
          setCurseur(null);
        }}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
            /*
             * Le curseur vit en coordonnées de viewBox (l'axe X est du temps,
             * étiré à la largeur réelle) : on reprojète avant de chercher le
             * point le plus proche.
             */
          const vx = ((e.clientX - rect.left) / rect.width) * LARGEUR_COURBE;
          let meilleur = 0;
          for (let i = 1; i < points.length; i++) {
            if (Math.abs(x(points[i]) - vx) < Math.abs(x(points[meilleur]) - vx)) meilleur = i;
          }
          setSurvol(meilleur);
          setCurseur({ x: e.clientX, y: e.clientY });
        }}
      >
        <defs>
          <linearGradient id="aire-evolution" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primaire)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--primaire)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Repères horizontaux discrets — 0, 50 et 100 écrits une fois. */}
        {[0, 50, 100].map((v) => (
          <g key={v}>
            <line
              x1={MARGE_COURBE.gauche}
              x2={LARGEUR_COURBE - MARGE_COURBE.droite}
              y1={y(v)}
              y2={y(v)}
              stroke="var(--bordure)"
              strokeWidth="1"
              strokeDasharray={v === 50 ? "3 4" : undefined}
              opacity={v === 50 ? 0.7 : 0.45}
              vectorEffect="non-scaling-stroke"
            />
            <text
              x={LARGEUR_COURBE - MARGE_COURBE.droite + 5}
              y={y(v) + 3}
              fontSize="9"
              fill="var(--texte-discret)"
            >
              {v}
            </text>
          </g>
        ))}

        {points.length > 1 && (
          <>
            <path d={aire} fill="url(#aire-evolution)" />
            <polyline
              points={trace}
              fill="none"
              stroke="var(--primaire)"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </>
        )}

        {/* Le dernier point porte sa valeur écrite, au-dessus du tracé : elle
            ne doit ni mordre la gouttière des axes ni chevaucher le trait. */}
        <circle cx={x(dernier)} cy={y(dernier.score)} r="3.5" fill="var(--primaire)" />
        <text
          x={Math.min(x(dernier) + 4, LARGEUR_COURBE - MARGE_COURBE.droite - 2)}
          y={Math.max(y(dernier.score) - 10, 12)}
          fontSize="12"
          fontWeight="600"
          textAnchor="end"
          fill="var(--primaire)"
          stroke="var(--surface)"
          strokeWidth="3"
          paintOrder="stroke"
          className="chiffres"
        >
          {dernier.score}
        </text>

        {survolee && survol !== null && survol !== points.length - 1 && (
          <circle
            cx={x(survolee)}
            cy={y(survolee.score)}
            r="3"
            fill="var(--surface)"
            stroke="var(--primaire)"
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>

      {survolee && survol !== null && curseur && (
        <Infobulle x={curseur.x} y={curseur.y}>
          <span className="font-medium">{formatDateCourte(survolee.date)}</span>
          <span className="chiffres text-texte-attenue"> · {survolee.score} / 100</span>
        </Infobulle>
      )}
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
      {/* Piste pleine largeur : les segments se lisent sur un fond visible,
          jamais comme une couleur flottant au milieu de rien. */}
      <div className="flex h-2 gap-[2px] overflow-hidden rounded-full bg-bordure/50">
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
