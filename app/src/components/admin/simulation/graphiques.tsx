"use client";

/**
 * Les tracés du tableau de bord de simulation.
 *
 * SVG écrit à la main, aucune bibliothèque — mêmes règles que
 * `components/charts` : une seule série par tracé, la valeur toujours répétée
 * en texte, et aucune couleur qui porte seule une information.
 *
 * Une exception assumée : la vignette par compétence superpose le niveau estimé
 * et l'aptitude réelle. Les deux ne se lisent que l'un CONTRE l'autre, et ils
 * sont distingués par le trait (plein / tirets), pas par la seule teinte.
 */

import type { NoeudGraphe } from "@/lib/simulation/tableau-de-bord";
import { cx } from "@/components/ui/primitives";

/* ------------------------------------------------------------------ */
/* Courbe                                                              */
/* ------------------------------------------------------------------ */

const L = 520;
const H = 130;
const M = { haut: 10, bas: 20, gauche: 34, droite: 8 };

export interface PointCourbe {
  jour: number;
  valeur: number | null;
}

export function Courbe({
  titre,
  legende,
  points,
  max,
  suffixe = "",
  marqueurs = [],
}: {
  titre: string;
  legende?: string;
  points: PointCourbe[];
  /** Plafond de l'axe. À défaut, le maximum observé. */
  max?: number;
  suffixe?: string;
  /** Repères verticaux datés — extensions du référentiel, pauses. */
  marqueurs?: { jour: number; libelle: string }[];
}) {
  const jourMax = points.at(-1)?.jour ?? 1;
  const plafond = Math.max(
    1,
    max ?? points.reduce((m, p) => Math.max(m, p.valeur ?? 0), 0),
  );

  const x = (jour: number) =>
    M.gauche + (jour / Math.max(1, jourMax)) * (L - M.gauche - M.droite);
  const y = (valeur: number) =>
    M.haut + (1 - Math.min(1, valeur / plafond)) * (H - M.haut - M.bas);

  const tracables = points.filter((p) => p.valeur !== null);
  const chemin = tracables
    .map((p, i) => `${i === 0 ? "M" : "L"} ${x(p.jour)} ${y(p.valeur as number)}`)
    .join(" ");
  const dernier = tracables.at(-1)?.valeur ?? null;

  return (
    <figure className="rounded-lg border border-bordure bg-surface p-3">
      <figcaption className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-texte">{titre}</span>
        <span className="shrink-0 text-sm font-medium tabular-nums text-texte">
          {dernier === null ? "non mesuré" : `${dernier}${suffixe}`}
        </span>
      </figcaption>

      <svg viewBox={`0 0 ${L} ${H}`} className="mt-2 w-full" role="img" aria-label={titre}>
        {[0, 0.5, 1].map((part) => (
          <g key={part}>
            <line
              x1={M.gauche}
              x2={L - M.droite}
              y1={y(plafond * part)}
              y2={y(plafond * part)}
              className="stroke-bordure"
              strokeWidth={0.6}
            />
            <text
              x={0}
              y={y(plafond * part) + 3}
              className="fill-texte-discret"
              style={{ fontSize: 9 }}
            >
              {Math.round(plafond * part * 100) / 100}
            </text>
          </g>
        ))}

        {marqueurs.map((marqueur) => (
          <line
            key={`${marqueur.jour}-${marqueur.libelle}`}
            x1={x(marqueur.jour)}
            x2={x(marqueur.jour)}
            y1={M.haut}
            y2={H - M.bas}
            className="stroke-info/40"
            strokeWidth={1}
            strokeDasharray="3 3"
          >
            <title>{marqueur.libelle}</title>
          </line>
        ))}

        {chemin && <path d={chemin} className="stroke-primaire" strokeWidth={1.8} fill="none" />}

        {[0, Math.round(jourMax / 2), jourMax].map((jour) => (
          <text
            key={jour}
            x={x(jour)}
            y={H - 5}
            textAnchor={jour === 0 ? "start" : jour === jourMax ? "end" : "middle"}
            className="fill-texte-discret"
            style={{ fontSize: 9 }}
          >
            j{jour}
          </text>
        ))}
      </svg>

      {legende && <p className="mt-1 text-xs text-texte-discret">{legende}</p>}
    </figure>
  );
}

/* ------------------------------------------------------------------ */
/* Barres                                                              */
/* ------------------------------------------------------------------ */

export function Barres({
  lignes,
  ton = "primaire",
}: {
  lignes: { libelle: string; valeur: number; note?: string }[];
  ton?: "primaire" | "info" | "alerte";
}) {
  const max = Math.max(1, ...lignes.map((l) => l.valeur));
  const couleur =
    ton === "info" ? "bg-info" : ton === "alerte" ? "bg-alerte" : "bg-primaire";

  return (
    <ul className="flex flex-col gap-1.5">
      {lignes.map((ligne) => (
        <li key={ligne.libelle} className="grid grid-cols-[minmax(0,11rem)_1fr_auto] items-center gap-2">
          <span className="truncate text-xs text-texte-attenue" title={ligne.libelle}>
            {ligne.libelle}
          </span>
          <span className="h-2 rounded-full bg-surface-2">
            <span
              className={cx("block h-2 rounded-full", couleur)}
              style={{ width: `${(ligne.valeur / max) * 100}%` }}
            />
          </span>
          <span className="text-xs tabular-nums text-texte">
            {ligne.valeur}
            {ligne.note ? <span className="text-texte-discret"> {ligne.note}</span> : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* Vignette par compétence                                             */
/* ------------------------------------------------------------------ */

export function Vignette({
  serie,
  aptitude,
  jours,
}: {
  serie: (number | null)[];
  aptitude: number | null;
  jours: number[];
}) {
  const l = 150;
  const h = 34;
  const jourMax = jours.at(-1) ?? 1;
  const x = (i: number) => ((jours[i] ?? 0) / Math.max(1, jourMax)) * l;
  const y = (valeur: number) => h - (Math.max(0, Math.min(5, valeur)) / 5) * h;

  let chemin = "";
  serie.forEach((valeur, i) => {
    if (valeur === null) return;
    chemin += `${chemin === "" ? "M" : "L"} ${x(i)} ${y(valeur)} `;
  });

  return (
    <svg
      viewBox={`0 0 ${l} ${h}`}
      className="h-8 w-full"
      role="img"
      aria-label={`Niveau estimé au fil du temps${aptitude === null ? "" : `, aptitude réelle ${aptitude}`}`}
    >
      <line x1={0} x2={l} y1={h} y2={h} className="stroke-bordure" strokeWidth={0.5} />
      {aptitude !== null && (
        <line
          x1={0}
          x2={l}
          y1={y(aptitude)}
          y2={y(aptitude)}
          className="stroke-alerte"
          strokeWidth={1}
          strokeDasharray="3 2"
        />
      )}
      {chemin && <path d={chemin} className="stroke-primaire" strokeWidth={1.5} fill="none" />}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Graphe final                                                        */
/* ------------------------------------------------------------------ */

const PALIERS = ["fondamentaux", "intermediaire", "avance"];
const COLONNE = 300;
const LIGNE = 46;
const MARGE_BANDE = 34;

interface Place extends NoeudGraphe {
  x: number;
  y: number;
}

/**
 * Le graphe tel qu'il est, sans arête fabriquée.
 *
 * Une compétence est posée dans la bande de son domaine et la colonne de son
 * palier : la position dit donc quelque chose de vrai, contrairement à une
 * disposition par force qui ne dit que « l'algorithme a convergé là ». Les
 * seules arêtes tracées sont les prérequis déclarés.
 */
export function GrapheCompetences({
  noeuds,
  liens,
}: {
  noeuds: NoeudGraphe[];
  liens: { de: string; vers: string }[];
}) {
  const domaines = [...new Set(noeuds.map((n) => n.domaine))];
  const places: Place[] = [];
  const bandes: { nom: string; y: number; hauteur: number }[] = [];
  let curseur = 0;

  for (const domaine of domaines) {
    const dansDomaine = noeuds.filter((n) => n.domaine === domaine);
    const parPalier = PALIERS.map((palier) => dansDomaine.filter((n) => n.palier === palier));
    const hauteur = MARGE_BANDE + Math.max(1, ...parPalier.map((p) => p.length)) * LIGNE;

    parPalier.forEach((groupe, colonne) => {
      groupe.forEach((noeud, rang) => {
        places.push({
          ...noeud,
          x: 90 + colonne * COLONNE,
          y: curseur + MARGE_BANDE + rang * LIGNE,
        });
      });
    });

    bandes.push({ nom: dansDomaine[0]?.domaineNom ?? domaine, y: curseur, hauteur });
    curseur += hauteur;
  }

  const parCode = new Map(places.map((p) => [p.code, p]));
  const largeur = 90 + 2 * COLONNE + 200;

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${largeur} ${Math.max(1, curseur)}`}
        className="w-full min-w-[46rem]"
        role="img"
        aria-label="Graphe des compétences au dernier jour"
      >
        <defs>
          <marker id="fleche-sim" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M 0 0 L 8 4 L 0 8 z" className="fill-bordure-forte" />
          </marker>
        </defs>

        {bandes.map((bande) => (
          <g key={bande.nom}>
            <line
              x1={0}
              x2={largeur}
              y1={bande.y}
              y2={bande.y}
              className="stroke-bordure"
              strokeWidth={0.8}
            />
            <text x={4} y={bande.y + 16} className="fill-texte-discret" style={{ fontSize: 11 }}>
              {bande.nom}
            </text>
          </g>
        ))}

        {liens.map((lien) => {
          const de = parCode.get(lien.de);
          const vers = parCode.get(lien.vers);
          if (!de || !vers) return null;
          const milieu = (de.x + vers.x) / 2;
          return (
            <path
              key={`${lien.de}-${lien.vers}`}
              d={`M ${de.x + 8} ${de.y} C ${milieu} ${de.y}, ${milieu} ${vers.y}, ${vers.x - 10} ${vers.y}`}
              className="stroke-bordure-forte"
              strokeWidth={0.9}
              fill="none"
              markerEnd="url(#fleche-sim)"
            />
          );
        })}

        {places.map((place) => (
          <g key={place.code}>
            <circle
              cx={place.x}
              cy={place.y}
              r={place.observations === 0 ? 5 : Math.min(12, 6 + place.observations / 3)}
              style={{
                fill: place.niveau === null ? "var(--niveau-vide)" : `var(--niveau-${place.niveau})`,
              }}
              className={place.observations === 0 ? "stroke-bordure-forte" : "stroke-surface"}
              strokeWidth={1.2}
              strokeDasharray={place.observations === 0 ? "2 2" : undefined}
            >
              <title>
                {`${place.code} — ${place.intitule}\nNiveau estimé : ${place.niveau ?? "non établi"}\nAptitude réelle : ${place.aptitude ?? "inconnue"}\nObservations : ${place.observations} · servie ${place.servies} fois`}
              </title>
            </circle>
            <text
              x={place.x + 16}
              y={place.y + 3}
              className="fill-texte"
              style={{ fontSize: 10 }}
            >
              {place.code}
            </text>
            <text
              x={place.x + 52}
              y={place.y + 3}
              className="fill-texte-discret"
              style={{ fontSize: 10 }}
            >
              {place.intitule.length > 26 ? `${place.intitule.slice(0, 25)}…` : place.intitule}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

export function LegendeGraphe() {
  return (
    <p className="text-xs text-texte-discret">
      Un disque par compétence : sa taille suit le nombre d&apos;observations, sa
      teinte le niveau dérivé. Cercle en pointillé et vide : jamais observée — le
      moteur ne s&apos;y prononce pas. Colonnes de gauche à droite :
      fondamentaux, intermédiaire, avancé. Les flèches sont les prérequis
      déclarés, et rien d&apos;autre : aucune arête n&apos;est fabriquée.
    </p>
  );
}
