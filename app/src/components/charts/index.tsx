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
/* Courbe simple                                                       */
/* ------------------------------------------------------------------ */

export interface PointSerie {
  date: string;
  valeur: number;
}

/**
 * Une seule série : pas de légende, le titre du bloc la nomme.
 * `max` est explicite pour que deux vignettes soient comparables.
 */
export function Courbe({
  points,
  max,
  hauteur = 64,
  libelle,
}: {
  points: PointSerie[];
  max: number;
  hauteur?: number;
  libelle: string;
}) {
  const [survol, setSurvol] = useState<number | null>(null);
  const [curseur, setCurseur] = useState<{ x: number; y: number } | null>(null);

  if (points.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded border border-dashed border-bordure text-[0.6875rem] text-texte-discret"
        style={{ height: hauteur }}
      >
        Aucune donnée
      </div>
    );
  }

  const L = 300;
  const H = hauteur;
  const marge = 3;
  const n = points.length;
  const x = (i: number) => (n === 1 ? L / 2 : marge + (i * (L - 2 * marge)) / (n - 1));
  /*
   * `max` est une prop publique, et `max === 0` produisait `0 / 0` — donc
   * `d="MNaN NaN"`, une courbe muette (audit §2.11). Les appelants actuels
   * passent tous un minimum, mais un composant ne se protège pas sur la
   * discipline de ses appelants. Échelle nulle : tout se pose sur la ligne de
   * base, ce qui est la lecture juste de « aucune valeur ».
   */
  const echelle = max > 0 ? max : 1;
  const y = (v: number) =>
    H - marge - (Math.max(0, Math.min(echelle, v)) / echelle) * (H - 2 * marge);

  const chemin = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(p.valeur).toFixed(1)}`).join(" ");
  const aire = `${chemin} L${x(n - 1).toFixed(1)} ${H - marge} L${x(0).toFixed(1)} ${H - marge} Z`;
  const dernier = points[n - 1];

  const pointSurvole = survol !== null ? points[survol] : null;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${L} ${H}`}
        className="w-full"
        style={{ height: hauteur }}
        role="img"
        aria-label={`${libelle} : de ${points[0].valeur} à ${dernier.valeur}`}
        preserveAspectRatio="none"
        onMouseLeave={() => {
          setSurvol(null);
          setCurseur(null);
        }}
        onMouseMove={(e) => {
          setCurseur({ x: e.clientX, y: e.clientY });
        }}
      >
        <path d={aire} fill="var(--primaire)" opacity="0.09" />
        <path
          d={chemin}
          fill="none"
          stroke="var(--primaire)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        {/*
          Marque de fin. Un `<circle>` se rendrait en ellipse étirée : le viewBox
          est en `preserveAspectRatio="none"`, donc l'échelle horizontale n'est pas
          celle du vertical. Un segment de longueur nulle à bout rond donne un point
          parfaitement circulaire, l'épaisseur de trait échappant à la déformation.
        */}
        <line
          x1={x(n - 1)}
          y1={y(dernier.valeur)}
          x2={x(n - 1)}
          y2={y(dernier.valeur)}
          stroke="var(--primaire)"
          strokeWidth="7"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        {/* Point mis en évidence au survol. */}
        {pointSurvole && (
          <line
            x1={x(survol!)}
            y1={y(pointSurvole.valeur)}
            x2={x(survol!)}
            y2={y(pointSurvole.valeur)}
            stroke="var(--primaire-fort)"
            strokeWidth="9"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        )}
        {/* Cibles de survol, plus larges que les marques. */}
        {points.map((p, i) => (
          <rect
            key={i}
            // Bornée à 0 : centrée sur le premier point, la cible débordait à
            // gauche du viewBox et perdait la moitié de sa surface utile.
            x={Math.max(0, x(i) - L / n / 2)}
            y={0}
            width={L / n}
            height={H}
            fill="transparent"
            className={survol === i ? "fill-primaire/5" : "hover:fill-primaire/5"}
            onMouseEnter={() => setSurvol(i)}
          />
        ))}
      </svg>

      {pointSurvole && curseur && (
        <Infobulle x={curseur.x} y={curseur.y}>
          <span className="chiffres font-medium">{pointSurvole.valeur}</span>
          <span className="text-texte-attenue"> · {formatDateCourte(pointSurvole.date)}</span>
        </Infobulle>
      )}
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
/* Radar (vue secondaire)                                              */
/* ------------------------------------------------------------------ */

export interface AxeRadar {
  libelle: string;
  /** `null` si le domaine n'a aucune preuve : l'axe reste au centre, marqué. */
  valeur: number | null;
}

/**
 * Radar — une seule série, jamais une vue par défaut (exigence explicite du
 * cahier des charges). Deux sens distincts selon l'appelant : un axe par
 * compétence (page domaine) ou un axe par domaine (synthèse de progression).
 *
 * Les axes sans preuve sont tracés à zéro ET listés en texte sous le
 * graphique, pour qu'un creux ne soit pas lu comme une faiblesse mesurée.
 *
 * `libelle` est requis — pas déduit en interne. Le composant a longtemps
 * annoncé « Radar des domaines » quelle que soit la donnée reçue, y compris
 * quand elle était en réalité un axe par compétence : un texte fixe dans le
 * composant ment dès qu'un second sens existe. C'est à l'appelant de dire ce
 * qu'il montre.
 */
export function Radar({
  axes,
  taille = 260,
  libelle,
}: {
  axes: AxeRadar[];
  taille?: number;
  /** Décrit ce que représente un axe, ex. « Radar par compétence du domaine ». */
  libelle: string;
}) {
  /*
   * Un radar demande au moins trois axes (audit §2.11).
   *
   * À un axe, `<polygon points="x,y">` ne dessine rien ; à deux, c'est un
   * segment d'aire nulle. Dans les deux cas la carte s'affichait, titrée
   * « Radar », avec une figure invisible — ce qui se lit comme un défaut de
   * rendu, pas comme « pas assez de données ».
   *
   * Le garde-fou existait dans `panneau-progression.tsx` et pas sur la fiche de
   * domaine. Il vit ici, une fois : un appelant ne doit pas avoir à connaître
   * la géométrie du composant qu'il utilise.
   */
  if (axes.length < 3) {
    return (
      <p className="rounded-md border border-dashed border-bordure px-3 py-6 text-center text-xs text-texte-attenue">
        Un radar demande au moins trois axes ; il y en a {axes.length}.
      </p>
    );
  }

  const c = taille / 2;
  const rayon = c - 34;
  const n = axes.length;
  const angle = (i: number) => (i * 2 * Math.PI) / n - Math.PI / 2;
  const pt = (i: number, r: number) => ({
    x: c + r * Math.cos(angle(i)),
    y: c + r * Math.sin(angle(i)),
  });

  const polygone = axes
    .map((a, i) => {
      const p = pt(i, ((a.valeur ?? 0) / 100) * rayon);
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    })
    .join(" ");

  const mesures = axes.filter((a) => a.valeur !== null);

  return (
    <svg
      viewBox={`0 0 ${taille} ${taille}`}
      className="mx-auto"
      style={{ maxWidth: taille }}
      role="img"
      aria-label={`${libelle}. ${mesures.length} mesuré(s) sur ${n}.`}
    >
      {/* Grille en retrait : quatre cercles seulement. */}
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <circle
          key={f}
          cx={c}
          cy={c}
          r={rayon * f}
          fill="none"
          stroke="var(--bordure)"
          strokeWidth="1"
        />
      ))}
      {axes.map((a, i) => {
        const p = pt(i, rayon);
        return (
          <line key={i} x1={c} y1={c} x2={p.x} y2={p.y} stroke="var(--bordure)" strokeWidth="1" />
        );
      })}

      <polygon points={polygone} fill="var(--primaire)" fillOpacity="0.13" stroke="var(--primaire)" strokeWidth="2" />

      {axes.map((a, i) => {
        const p = pt(i, ((a.valeur ?? 0) / 100) * rayon);
        return (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r="4"
            fill={a.valeur === null ? "var(--surface)" : "var(--primaire)"}
            stroke={a.valeur === null ? "var(--bordure-forte)" : "var(--surface)"}
            strokeWidth="1.5"
          >
            <title>
              {a.valeur === null
                ? `${a.libelle} — aucune preuve`
                : `${a.libelle} — ${a.valeur}/100`}
            </title>
          </circle>
        );
      })}

      {axes.map((a, i) => {
        const p = pt(i, rayon + 18);
        const ancre = Math.abs(p.x - c) < 12 ? "middle" : p.x > c ? "start" : "end";
        return (
          <text
            key={i}
            x={p.x}
            y={p.y}
            textAnchor={ancre}
            dominantBaseline="middle"
            className="fill-[var(--texte-discret)] text-[8.5px]"
          >
            {a.libelle}
          </text>
        );
      })}
    </svg>
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