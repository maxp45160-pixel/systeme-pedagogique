"use client";

/**
 * Vue graphe interactive des compétences — style Obsidian.
 *
 * Trois niveaux de zoom :
 *   1. Catégories  — un gros nœud par domaine, arêtes inter-domaines.
 *   2. Compétences — nœuds par skill, arêtes de prérequis et thèmes.
 *   3. Exercices   — étoile autour d'une compétence focalisée.
 *
 * Le moteur de forces est écrit à la main (~250 lignes) pour éviter toute
 * dépendance externe. Il converge en ~120 frames avec un amortissement de 0.92.
 *
 * Le composant est `"use client"` : les données sérialisables arrivent en
 * props depuis un Server Component parent.
 */

import {
  useRef,
  useEffect,
  useState,
  useCallback,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type WheelEvent as ReactWheelEvent,
  type TouchEvent as ReactTouchEvent,
} from "react";
import { useRouter } from "next/navigation";
import { NIVEAUX } from "@/lib/domain/types";
import type { DonneesGraphe } from "./graphe-donnees";
import { couleurDomaine, couleurDomaineClaire, couleurDomaineFoncee } from "@/lib/ui/couleurs-domaines";

/* ------------------------------------------------------------------ */
/* Types internes du moteur                                            */
/* ------------------------------------------------------------------ */

interface Noeud {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rayon: number;
  type: "domaine" | "competence" | "exercice";
  label: string;
  labelSous?: string;
  fullLabel: string;
  fullLabelSous?: string;
  tooltipLines?: string[];
  couleur: string;
  couleurBord: string;
  domaineIndex: number;
  /** Identifiant de navigation. */
  navId?: string;
  fixe?: boolean;
}

interface Arete {
  sourceIdx: number;
  targetIdx: number;
  type: "prerequis" | "theme" | "exercice-skill" | "inter-domaine" | "semantic";
  /** 0–1, modulates attraction strength. Absent = 1. */
  poids: number;
}

interface Camera {
  x: number;
  y: number;
  zoom: number;
}

type NiveauZoom = "categories" | "competences" | "exercices";

/* ------------------------------------------------------------------ */
/* Constantes physique — par niveau de zoom                            */
/* ------------------------------------------------------------------ */

/**
 * Les domaines sont gros (rayon 40-70px) et peu nombreux (~8). Il leur faut
 * beaucoup de répulsion, très peu de gravité, et une attraction faible pour
 * que seuls les domaines réellement connectés se rapprochent.
 *
 * Les compétences sont petites (~14-26px) et nombreuses (~80). La gravité
 * doit les maintenir visibles, la répulsion reste raisonnable.
 */
interface PhysConfig {
  repulsion: number;
  attraction: number;
  gravite: number;
  amortissement: number;
  vitesseMax: number;
}

const PHYS_DOMAINES: PhysConfig = {
  repulsion: 15000,
  attraction: 0.0008,
  gravite: 0.002,
  amortissement: 0.88,
  vitesseMax: 15,
};

const PHYS_COMPETENCES: PhysConfig = {
  repulsion: 8000,
  attraction: 0.002,
  gravite: 0.003,
  amortissement: 0.90,
  vitesseMax: 14,
};

const PHYS_EXERCICES: PhysConfig = {
  repulsion: 2000,
  attraction: 0.005,
  gravite: 0.008,
  amortissement: 0.90,
  vitesseMax: 10,
};

const ITERATIONS_INIT = 200;

/* ------------------------------------------------------------------ */
/* Couleurs niveaux de compétence (tokens du design system)            */
/* ------------------------------------------------------------------ */

const COULEURS_NIVEAU: Record<number, string> = {
  0: "#8b8578",  // exposition — neutre
  1: "#5a9bd5",  // compréhension — bleu doux
  2: "#6dae5e",  // application guidée — vert
  3: "#e6a23c",  // application autonome — ambre
  4: "#d97a3e",  // transfert — orange
  5: "#c24b4b",  // intégration — rouge profond
};

const COULEUR_NON_EVALUE = "#6e6653";

/* ------------------------------------------------------------------ */
/* Utilitaires                                                         */
/* ------------------------------------------------------------------ */

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val));
}

function tronquer(texte: string, max: number): string {
  return texte.length > max ? texte.slice(0, max - 1) + "…" : texte;
}

/* ------------------------------------------------------------------ */
/* Construction des nœuds et arêtes pour chaque niveau de zoom         */
/* ------------------------------------------------------------------ */

function construireNoeudsDomaines(donnees: DonneesGraphe): { noeuds: Noeud[]; aretes: Arete[] } {
  const total = donnees.domaines.length;

  const spreadRadius = Math.max(400, total * 80);

  const noeuds: Noeud[] = donnees.domaines.map((d, i) => {
    const angle = (i / total) * Math.PI * 2;
    const rayon = 35 + Math.min(d.nombreCompetences * 4, 40);
    const scoreTxt = d.scoreMoyen !== null ? `Score moyen : ${d.scoreMoyen.toFixed(1)} / 5` : "Aucune évaluation";
    return {
      id: d.id,
      x: Math.cos(angle) * spreadRadius + (Math.random() - 0.5) * 60,
      y: Math.sin(angle) * spreadRadius + (Math.random() - 0.5) * 60,
      vx: 0,
      vy: 0,
      rayon,
      type: "domaine" as const,
      label: d.prefixe,
      labelSous: d.nom,
      fullLabel: d.nom,
      fullLabelSous: `Domaine [${d.prefixe}] · ${d.nombreCompetences} compétence(s)`,
      tooltipLines: [
        scoreTxt,
      ],
      couleur: couleurDomaine(i, total),
      couleurBord: couleurDomaineFoncee(i, total),
      domaineIndex: i,
      navId: d.id,
    };
  });

  const indexParId = new Map(noeuds.map((n, i) => [n.id, i]));
  const aretes: Arete[] = donnees.aretes
    .filter((a) => a.type === "inter-domaine" || a.type === "semantic")
    .map((a) => ({
      sourceIdx: indexParId.get(a.source) ?? -1,
      targetIdx: indexParId.get(a.target) ?? -1,
      type: a.type,
      poids: a.poids ?? 1,
    }))
    .filter((a) => a.sourceIdx >= 0 && a.targetIdx >= 0);

  return { noeuds, aretes };
}

function construireNoeudsCompetences(
  donnees: DonneesGraphe,
  filtreDomaineId?: string,
): { noeuds: Noeud[]; aretes: Arete[] } {
  const total = donnees.domaines.length;
  const indexDomaine = new Map(donnees.domaines.map((d, i) => [d.id, i]));
  const domaineParId = new Map(donnees.domaines.map((d) => [d.id, d]));

  const competences = filtreDomaineId
    ? donnees.competences.filter((c) => c.domaineId === filtreDomaineId)
    : donnees.competences;

  const codesSet = new Set(competences.map((c) => c.code));

  // Count competences per domain for cluster sizing
  const parDomaine = new Map<number, number>();
  for (const c of competences) {
    const di = indexDomaine.get(c.domaineId) ?? 0;
    parDomaine.set(di, (parDomaine.get(di) ?? 0) + 1);
  }
  const compteurDomaine = new Map<number, number>();

  const clusterSpread = filtreDomaineId ? 250 : Math.max(600, total * 160);

  const noeuds: Noeud[] = competences.map((c) => {
    const di = indexDomaine.get(c.domaineId) ?? 0;
    const dom = domaineParId.get(c.domaineId);
    const clusterAngle = (di / total) * Math.PI * 2;
    const idx = compteurDomaine.get(di) ?? 0;
    compteurDomaine.set(di, idx + 1);
    const nbInCluster = parDomaine.get(di) ?? 1;
    // Spiral distribution inside cluster for even spacing.
    // Borné par la densité du cluster : plus il y a de compétences, plus le
    // rayon maximal autorisé grandit — sans quoi une grande spirale empiète
    // sur le cluster voisin.
    const innerAngle = idx * 1.8;
    const innerRadius = Math.min(40 + idx * 28, 70 + nbInCluster * 16);

    const rayon = 14 + Math.min(c.nombrePreuves * 2, 12);
    const couleur = c.niveau !== null ? (COULEURS_NIVEAU[c.niveau] ?? COULEUR_NON_EVALUE) : COULEUR_NON_EVALUE;
    const levelName = c.niveau !== null ? NIVEAUX[c.niveau]?.nom ?? `Niveau ${c.niveau}` : "Non évalué";

    return {
      id: c.code,
      x: Math.cos(clusterAngle) * clusterSpread + Math.cos(innerAngle) * innerRadius,
      y: Math.sin(clusterAngle) * clusterSpread + Math.sin(innerAngle) * innerRadius,
      vx: 0,
      vy: 0,
      rayon,
      type: "competence" as const,
      label: c.code,
      labelSous: c.intitule,
      fullLabel: `${c.code} — ${c.intitule}`,
      fullLabelSous: dom ? `Domaine: ${dom.nom}` : undefined,
      tooltipLines: [
        `Palier : ${c.palier}`,
        `Statut : ${levelName}`,
        `${c.nombrePreuves} preuve(s) enregistrée(s)`,
        c.prerequis.length > 0 ? `Prérequis : ${c.prerequis.join(", ")}` : "",
      ].filter(Boolean),
      couleur,
      couleurBord: couleurDomaine(di, total),
      domaineIndex: di,
      navId: c.code,
    };
  });

  const indexParId = new Map(noeuds.map((n, i) => [n.id, i]));
  const aretes: Arete[] = [];

  // Prérequis et thèmes
  for (const a of donnees.aretes) {
    if ((a.type === "prerequis" || a.type === "theme") && codesSet.has(a.source) && codesSet.has(a.target)) {
      const si = indexParId.get(a.source);
      const ti = indexParId.get(a.target);
      if (si !== undefined && ti !== undefined) {
        aretes.push({ sourceIdx: si, targetIdx: ti, type: a.type, poids: a.poids ?? 1 });
      }
    }
  }

  return { noeuds, aretes };
}

function construireNoeudsExercices(
  donnees: DonneesGraphe,
  codeCompetence: string,
): { noeuds: Noeud[]; aretes: Arete[] } {
  const total = donnees.domaines.length;
  const indexDomaine = new Map(donnees.domaines.map((d, i) => [d.id, i]));
  const comp = donnees.competences.find((c) => c.code === codeCompetence);
  if (!comp) return { noeuds: [], aretes: [] };

  const di = indexDomaine.get(comp.domaineId) ?? 0;
  const couleurComp = comp.niveau !== null ? (COULEURS_NIVEAU[comp.niveau] ?? COULEUR_NON_EVALUE) : COULEUR_NON_EVALUE;

  // Nœud central : la compétence
  const noeuds: Noeud[] = [
    {
      id: comp.code,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      rayon: 30,
      type: "competence",
      label: comp.code,
      labelSous: comp.intitule,
      fullLabel: `${comp.code} — ${comp.intitule}`,
      fullLabelSous: `Palier: ${comp.palier}`,
      tooltipLines: [
        `Compétence centrale`,
        `${comp.nombrePreuves} preuve(s)`,
      ],
      couleur: couleurComp,
      couleurBord: couleurDomaine(di, total),
      domaineIndex: di,
      navId: comp.code,
      fixe: true,
    },
  ];

  // Exercices liés
  const exercicesLies = donnees.exercices.filter((e) =>
    e.competences.includes(codeCompetence),
  );
  const nbEx = exercicesLies.length;
  for (let i = 0; i < nbEx; i++) {
    const ex = exercicesLies[i];
    const angle = (i / Math.max(nbEx, 1)) * Math.PI * 2;
    const dist = 140;
    noeuds.push({
      id: ex.id,
      x: Math.cos(angle) * dist,
      y: Math.sin(angle) * dist,
      vx: 0,
      vy: 0,
      rayon: 14,
      type: "exercice",
      label: ex.titre,
      labelSous: `Diff. ${ex.difficulte}/5`,
      fullLabel: ex.titre,
      fullLabelSous: `Exercice (${ex.difficulte}/5)`,
      tooltipLines: [
        `Compétences : ${ex.competences.join(", ")}`,
      ],
      couleur: couleurDomaineClaire(di, total),
      couleurBord: couleurDomaine(di, total),
      domaineIndex: di,
      navId: ex.id,
    });
  }

  // Prérequis directs (autres compétences liées)
  for (const pre of comp.prerequis) {
    const preComp = donnees.competences.find((c) => c.code === pre);
    if (!preComp) continue;
    const dip = indexDomaine.get(preComp.domaineId) ?? 0;
    const couleurPre = preComp.niveau !== null ? (COULEURS_NIVEAU[preComp.niveau] ?? COULEUR_NON_EVALUE) : COULEUR_NON_EVALUE;
    const angle = Math.PI + (noeuds.length * 0.6);
    noeuds.push({
      id: preComp.code,
      x: Math.cos(angle) * 180,
      y: Math.sin(angle) * 180,
      vx: 0,
      vy: 0,
      rayon: 18,
      type: "competence",
      label: preComp.code,
      labelSous: preComp.intitule,
      fullLabel: `${preComp.code} — ${preComp.intitule}`,
      fullLabelSous: `Prérequis de ${comp.code}`,
      tooltipLines: [
        `Palier : ${preComp.palier}`,
      ],
      couleur: couleurPre,
      couleurBord: couleurDomaine(dip, total),
      domaineIndex: dip,
      navId: preComp.code,
    });
  }

  // Arêtes
  const indexParId = new Map(noeuds.map((n, i) => [n.id, i]));
  const aretes: Arete[] = [];

  // Exercice → compétence
  for (const ex of exercicesLies) {
    const si = indexParId.get(ex.id);
    const ti = indexParId.get(comp.code);
    if (si !== undefined && ti !== undefined) {
      aretes.push({ sourceIdx: si, targetIdx: ti, type: "exercice-skill", poids: 1 });
    }
  }

  // Prérequis → compétence
  for (const pre of comp.prerequis) {
    const si = indexParId.get(pre);
    const ti = indexParId.get(comp.code);
    if (si !== undefined && ti !== undefined) {
      aretes.push({ sourceIdx: si, targetIdx: ti, type: "prerequis", poids: 1 });
    }
  }

  return { noeuds, aretes };
}

/* ------------------------------------------------------------------ */
/* Moteur de forces                                                    */
/* ------------------------------------------------------------------ */

function simulerForces(noeuds: Noeud[], aretes: Arete[], phys: PhysConfig) {
  const n = noeuds.length;
  if (n === 0) return;

  // Répulsion (N²) — scaled by node radii so big nodes push harder
  for (let i = 0; i < n; i++) {
    if (noeuds[i].fixe) continue;
    for (let j = i + 1; j < n; j++) {
      const ni = noeuds[i];
      const nj = noeuds[j];
      let dx = ni.x - nj.x;
      let dy = ni.y - nj.y;
      // Prevent exact overlap (causes NaN)
      if (dx === 0 && dy === 0) {
        dx = (Math.random() - 0.5) * 2;
        dy = (Math.random() - 0.5) * 2;
      }
      const dist2 = dx * dx + dy * dy;
      const dist = Math.sqrt(dist2);
      // Minimum distance = sum of radii + padding
      const minDist = ni.rayon + nj.rayon + 20;
      // Scale repulsion by combined node size
      const sizeScale = (ni.rayon + nj.rayon) / 20;
      const force = (phys.repulsion * sizeScale) / (dist2 + 100);
      // Extra push when overlapping
      const overlap = minDist - dist;
      const overlapForce = overlap > 0 ? overlap * 2 : 0;
      const totalForce = force + overlapForce;
      const fx = (dx / dist) * totalForce;
      const fy = (dy / dist) * totalForce;
      ni.vx += fx;
      ni.vy += fy;
      if (!nj.fixe) {
        nj.vx -= fx;
        nj.vy -= fy;
      }
    }
  }

  // Attraction (arêtes) — weighted by edge poids
  for (const a of aretes) {
    const s = noeuds[a.sourceIdx];
    const t = noeuds[a.targetIdx];
    const dx = t.x - s.x;
    const dy = t.y - s.y;
    const dist = Math.sqrt(dx * dx + dy * dy) + 1;
    // Target distance: sum of radii + comfortable padding
    const idealDist = s.rayon + t.rayon + 80;
    // Only attract when beyond ideal distance
    const delta = dist - idealDist;
    if (delta <= 0) continue; // already close enough
    // Multiply by edge weight — semantic edges pull proportionally to similarity
    const force = delta * phys.attraction * a.poids;
    const fx = (dx / dist) * force;
    const fy = (dy / dist) * force;
    if (!s.fixe) { s.vx += fx; s.vy += fy; }
    if (!t.fixe) { t.vx -= fx; t.vy -= fy; }
  }

  // Très légère gravité vers le centre — just enough to keep things on screen
  for (const noeud of noeuds) {
    if (noeud.fixe) continue;
    const dist = Math.sqrt(noeud.x * noeud.x + noeud.y * noeud.y);
    if (dist > 50) {
      noeud.vx -= (noeud.x / dist) * dist * phys.gravite;
      noeud.vy -= (noeud.y / dist) * dist * phys.gravite;
    }
  }

  // Intégration + amortissement
  for (const noeud of noeuds) {
    if (noeud.fixe) continue;
    noeud.vx *= phys.amortissement;
    noeud.vy *= phys.amortissement;
    noeud.vx = clamp(noeud.vx, -phys.vitesseMax, phys.vitesseMax);
    noeud.vy = clamp(noeud.vy, -phys.vitesseMax, phys.vitesseMax);
    noeud.x += noeud.vx;
    noeud.y += noeud.vy;
  }
}

/* ------------------------------------------------------------------ */
/* Rendu Canvas                                                        */
/* ------------------------------------------------------------------ */

function dessinerGrille(ctx: CanvasRenderingContext2D, w: number, h: number, cam: Camera) {
  const espacement = 30 * cam.zoom;
  if (espacement < 8) return;
  ctx.fillStyle = "rgba(128, 120, 110, 0.12)";
  const startX = ((-cam.x * cam.zoom + w / 2) % espacement + espacement) % espacement;
  const startY = ((-cam.y * cam.zoom + h / 2) % espacement + espacement) % espacement;
  for (let x = startX; x < w; x += espacement) {
    for (let y = startY; y < h; y += espacement) {
      ctx.beginPath();
      ctx.arc(x, y, 1, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function dessinerArete(
  ctx: CanvasRenderingContext2D,
  s: Noeud,
  t: Noeud,
  type: string,
  poids: number | undefined,
  cam: Camera,
  w: number,
  h: number,
) {
  const sx = (s.x - cam.x) * cam.zoom + w / 2;
  const sy = (s.y - cam.y) * cam.zoom + h / 2;
  const tx = (t.x - cam.x) * cam.zoom + w / 2;
  const ty = (t.y - cam.y) * cam.zoom + h / 2;

  ctx.beginPath();
  // Courbe quadratique légère pour éviter les lignes droites
  const mx = (sx + tx) / 2 + (sy - ty) * 0.1;
  const my = (sy + ty) / 2 + (tx - sx) * 0.1;
  ctx.moveTo(sx, sy);
  ctx.quadraticCurveTo(mx, my, tx, ty);

  if (type === "prerequis") {
    ctx.strokeStyle = "rgba(160, 150, 130, 0.5)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([]);
  } else if (type === "theme") {
    ctx.strokeStyle = "rgba(160, 140, 200, 0.4)";
    ctx.lineWidth = 1.2;
    ctx.setLineDash([4, 4]);
  } else if (type === "exercice-skill") {
    ctx.strokeStyle = "rgba(140, 160, 130, 0.4)";
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 3]);
  } else if (type === "inter-domaine") {
    ctx.strokeStyle = "rgba(140, 170, 210, 0.45)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 6]);
  } else {
    ctx.strokeStyle = "rgba(130, 130, 130, 0.3)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([]);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  // Flèche pour les prérequis
  if (type === "prerequis") {
    const angle = Math.atan2(ty - my, tx - mx);
    const taille = 6 * cam.zoom;
    const arrowX = tx - Math.cos(angle) * (t.rayon * cam.zoom + 2);
    const arrowY = ty - Math.sin(angle) * (t.rayon * cam.zoom + 2);
    ctx.beginPath();
    ctx.moveTo(arrowX, arrowY);
    ctx.lineTo(
      arrowX - Math.cos(angle - 0.4) * taille,
      arrowY - Math.sin(angle - 0.4) * taille,
    );
    ctx.lineTo(
      arrowX - Math.cos(angle + 0.4) * taille,
      arrowY - Math.sin(angle + 0.4) * taille,
    );
    ctx.closePath();
    ctx.fillStyle = "rgba(160, 150, 130, 0.6)";
    ctx.fill();
  }
}

function dessinerNoeud(
  ctx: CanvasRenderingContext2D,
  n: Noeud,
  cam: Camera,
  w: number,
  h: number,
  survol: boolean,
) {
  const sx = (n.x - cam.x) * cam.zoom + w / 2;
  const sy = (n.y - cam.y) * cam.zoom + h / 2;
  const r = n.rayon * cam.zoom;

  // Halo de survol
  if (survol) {
    ctx.beginPath();
    ctx.arc(sx, sy, r + 6, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  if (n.type === "exercice") {
    // Losange
    ctx.beginPath();
    ctx.moveTo(sx, sy - r);
    ctx.lineTo(sx + r, sy);
    ctx.lineTo(sx, sy + r);
    ctx.lineTo(sx - r, sy);
    ctx.closePath();
  } else {
    // Cercle
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
  }

  // Remplissage dégradé
  const grad = ctx.createRadialGradient(sx - r * 0.3, sy - r * 0.3, 0, sx, sy, r);
  grad.addColorStop(0, n.couleur);
  grad.addColorStop(1, n.couleurBord);
  ctx.fillStyle = grad;
  ctx.fill();

  // Bordure
  ctx.strokeStyle = n.couleurBord;
  ctx.lineWidth = survol ? 2.5 : 1.5;
  ctx.stroke();

  // Label visibility depends strictly on zoom level (cam.zoom) and node type, NEVER on node radius r
  const fontSize = n.type === "domaine"
    ? Math.max(11, Math.round(14 * cam.zoom))
    : n.type === "competence"
      ? Math.max(9, Math.round(11 * cam.zoom))
      : Math.max(8, Math.round(10 * cam.zoom));

  ctx.font = `600 ${fontSize}px Inter, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffffff";

  if (n.type === "domaine") {
    // Prefix (e.g. ARC, DDD, MIG) inside circle
    ctx.font = `700 ${Math.max(12, Math.round(15 * cam.zoom))}px Inter, system-ui, sans-serif`;
    ctx.fillStyle = "#ffffff";
    ctx.fillText(n.label, sx, sy);

    // Full domain name below circle
    const nameFontSize = Math.max(9, Math.round(11 * cam.zoom));
    ctx.font = `500 ${nameFontSize}px Inter, system-ui, sans-serif`;
    ctx.fillStyle = "var(--texte, #e2d9c6)";

    const fullName = n.labelSous ?? "";
    const words = fullName.split(" ");
    if (words.length > 3 && fullName.length > 22) {
      const mid = Math.ceil(words.length / 2);
      const line1 = words.slice(0, mid).join(" ");
      const line2 = words.slice(mid).join(" ");
      ctx.fillText(line1, sx, sy + r + nameFontSize);
      ctx.fillText(line2, sx, sy + r + nameFontSize * 2 + 2);
    } else {
      ctx.fillText(fullName, sx, sy + r + nameFontSize + 2);
    }
  } else if (n.type === "competence") {
    // Show skill code inside node circle when zoom is sufficient
    if (cam.zoom > 0.35 || survol) {
      ctx.fillText(n.label, sx, sy);
    }
    // Show full title below node when hovered or zoomed in
    if (survol || cam.zoom > 1.2) {
      ctx.font = `500 ${Math.max(9, Math.round(10 * cam.zoom))}px Inter, system-ui, sans-serif`;
      ctx.fillStyle = "var(--texte, #e2d9c6)";
      ctx.fillText(tronquer(n.labelSous ?? "", 35), sx, sy + r + 12);
    }
  } else {
    // Exercise nodes
    if (survol || cam.zoom > 0.7) {
      ctx.fillStyle = "var(--texte, #e2d9c6)";
      ctx.fillText(tronquer(n.label, 25), sx, sy + r + fontSize + 2);
      if (n.labelSous) {
        ctx.font = `400 ${Math.max(8, Math.round(fontSize * 0.85))}px Inter, system-ui, sans-serif`;
        ctx.fillStyle = "rgba(180, 170, 150, 0.8)";
        ctx.fillText(n.labelSous, sx, sy + r + fontSize * 2 + 4);
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* Composant React                                                     */
/* ------------------------------------------------------------------ */

export function GrapheCompetences({ donnees }: { donnees: DonneesGraphe }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const router = useRouter();

  const [niveau, setNiveau] = useState<NiveauZoom>("categories");
  const [focusId, setFocusId] = useState<string | null>(null);
  const [breadcrumb, setBreadcrumb] = useState<{ niveau: NiveauZoom; id: string | null; label: string }[]>([
    { niveau: "categories", id: null, label: "Catégories" },
  ]);

  // Refs mutables pour la boucle rAF
  const noeudsRef = useRef<Noeud[]>([]);
  const aretesRef = useRef<Arete[]>([]);
  const physRef = useRef<PhysConfig>(PHYS_DOMAINES);
  const cameraRef = useRef<Camera>({ x: 0, y: 0, zoom: 1 });
  const survolRef = useRef<number>(-1);
  const dragRef = useRef<{ idx: number; offsetX: number; offsetY: number } | null>(null);
  const panRef = useRef<{ startX: number; startY: number; camX: number; camY: number } | null>(null);
  const animRef = useRef<number>(0);
  const clickTimeRef = useRef<number>(0);

  // Construire les nœuds pour le niveau courant
  const construire = useCallback(() => {
    let result: { noeuds: Noeud[]; aretes: Arete[] };
    let phys: PhysConfig;
    if (niveau === "categories") {
      result = construireNoeudsDomaines(donnees);
      phys = PHYS_DOMAINES;
    } else if (niveau === "competences") {
      result = construireNoeudsCompetences(donnees, focusId ?? undefined);
      phys = PHYS_COMPETENCES;
    } else {
      result = construireNoeudsExercices(donnees, focusId ?? "");
      phys = PHYS_EXERCICES;
    }
    noeudsRef.current = result.noeuds;
    aretesRef.current = result.aretes;
    physRef.current = phys;

    // Simulation initiale pour stabiliser
    for (let i = 0; i < ITERATIONS_INIT; i++) {
      simulerForces(noeudsRef.current, aretesRef.current, phys);
    }

    // Auto-fit camera: compute bounding box and zoom to fit
    if (noeudsRef.current.length > 0) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const n of noeudsRef.current) {
        minX = Math.min(minX, n.x - n.rayon);
        minY = Math.min(minY, n.y - n.rayon);
        maxX = Math.max(maxX, n.x + n.rayon);
        maxY = Math.max(maxY, n.y + n.rayon);
      }
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      const graphW = maxX - minX + 120; // padding
      const graphH = maxY - minY + 120;
      const canvas = canvasRef.current;
      const viewW = canvas ? canvas.getBoundingClientRect().width : 900;
      const viewH = canvas ? canvas.getBoundingClientRect().height : 600;
      const zoom = Math.min(viewW / graphW, viewH / graphH, 1.5);
      cameraRef.current = { x: cx, y: cy, zoom: clamp(zoom, 0.15, 1.5) };
    } else {
      cameraRef.current = { x: 0, y: 0, zoom: 1 };
    }
  }, [donnees, niveau, focusId]);

  useEffect(() => {
    construire();
  }, [construire]);

  // Boucle d'animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let running = true;

    function tick() {
      if (!running || !ctx || !canvas) return;

      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;

      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        ctx.scale(dpr, dpr);
      }

      // Simulation
      simulerForces(noeudsRef.current, aretesRef.current, physRef.current);

      // Clear
      ctx.clearRect(0, 0, w, h);

      // Grille de fond
      dessinerGrille(ctx, w, h, cameraRef.current);

      // Hover focus calculation: find connected nodes
      const hIdx = survolRef.current;
      const connectedSet = new Set<number>();
      if (hIdx >= 0 && hIdx < noeudsRef.current.length) {
        connectedSet.add(hIdx);
        for (const a of aretesRef.current) {
          if (a.sourceIdx === hIdx) connectedSet.add(a.targetIdx);
          if (a.targetIdx === hIdx) connectedSet.add(a.sourceIdx);
        }
      }

      // Arêtes
      for (const a of aretesRef.current) {
        const isConnected = hIdx < 0 || a.sourceIdx === hIdx || a.targetIdx === hIdx;
        ctx.globalAlpha = isConnected ? 1.0 : 0.1;
        dessinerArete(
          ctx,
          noeudsRef.current[a.sourceIdx],
          noeudsRef.current[a.targetIdx],
          a.type,
          a.poids,
          cameraRef.current,
          w,
          h,
        );
      }
      ctx.globalAlpha = 1.0;

      // Nœuds
      for (let i = 0; i < noeudsRef.current.length; i++) {
        const isFocus = hIdx < 0 || connectedSet.has(i);
        ctx.globalAlpha = isFocus ? 1.0 : 0.2;
        dessinerNoeud(ctx, noeudsRef.current[i], cameraRef.current, w, h, i === hIdx);
      }
      ctx.globalAlpha = 1.0;

      // Info-bulle riche et complète (untruncated) du nœud survolé
      if (survolRef.current >= 0 && survolRef.current < noeudsRef.current.length) {
        const n = noeudsRef.current[survolRef.current];
        const sx = (n.x - cameraRef.current.x) * cameraRef.current.zoom + w / 2;
        const sy = (n.y - cameraRef.current.y) * cameraRef.current.zoom + h / 2;
        const r = n.rayon * cameraRef.current.zoom;

        ctx.save();
        const headerFont = "600 12px Inter, system-ui, sans-serif";
        const subFont = "400 11px Inter, system-ui, sans-serif";
        const detailFont = "400 10px Inter, system-ui, sans-serif";

        const lines: { text: string; font: string; color: string }[] = [
          { text: n.fullLabel, font: headerFont, color: "#ffffff" },
        ];
        if (n.fullLabelSous) {
          lines.push({ text: n.fullLabelSous, font: subFont, color: "rgba(180, 200, 240, 0.95)" });
        }
        if (n.tooltipLines) {
          for (const line of n.tooltipLines) {
            lines.push({ text: line, font: detailFont, color: "rgba(220, 215, 200, 0.85)" });
          }
        }

        // Measure card dimensions
        let maxW = 120;
        for (const l of lines) {
          ctx.font = l.font;
          maxW = Math.max(maxW, ctx.measureText(l.text).width);
        }
        const padX = 12;
        const padY = 10;
        const cardW = maxW + padX * 2;
        const lineH = 16;
        const cardH = lines.length * lineH + padY * 2;

        let tx = sx - cardW / 2;
        let ty = sy - r - cardH - 10;
        if (ty < 10) ty = sy + r + 10; // Flip below if off top
        if (tx < 10) tx = 10;
        if (tx + cardW > w - 10) tx = w - cardW - 10;

        // Card shadow & background
        ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 4;
        ctx.fillStyle = "rgba(26, 24, 20, 0.95)";
        ctx.beginPath();
        ctx.roundRect(tx, ty, cardW, cardH, 8);
        ctx.fill();

        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
        ctx.strokeStyle = "rgba(120, 110, 95, 0.6)";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Render lines
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        let currY = ty + padY;
        for (const l of lines) {
          ctx.font = l.font;
          ctx.fillStyle = l.color;
          ctx.fillText(l.text, tx + padX, currY);
          currY += lineH;
        }

        ctx.restore();
      }

      animRef.current = requestAnimationFrame(tick);
    }

    animRef.current = requestAnimationFrame(tick);

    return () => {
      running = false;
      cancelAnimationFrame(animRef.current);
    };
  }, [niveau, focusId, construire]);

  // ── Interactions souris ──

  function noeudSousSouris(clientX: number, clientY: number): number {
    const canvas = canvasRef.current;
    if (!canvas) return -1;
    const rect = canvas.getBoundingClientRect();
    const mx = clientX - rect.left;
    const my = clientY - rect.top;
    const cam = cameraRef.current;
    const w = rect.width;
    const h = rect.height;

    for (let i = noeudsRef.current.length - 1; i >= 0; i--) {
      const n = noeudsRef.current[i];
      const sx = (n.x - cam.x) * cam.zoom + w / 2;
      const sy = (n.y - cam.y) * cam.zoom + h / 2;
      const r = n.rayon * cam.zoom + 4;
      if ((mx - sx) ** 2 + (my - sy) ** 2 < r ** 2) return i;
    }
    return -1;
  }

  function handleMouseMove(e: ReactMouseEvent<HTMLCanvasElement>) {
    if (dragRef.current) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const cam = cameraRef.current;
      const n = noeudsRef.current[dragRef.current.idx];
      if (n) {
        n.x = (e.clientX - rect.left - rect.width / 2) / cam.zoom + cam.x + dragRef.current.offsetX;
        n.y = (e.clientY - rect.top - rect.height / 2) / cam.zoom + cam.y + dragRef.current.offsetY;
        n.vx = 0;
        n.vy = 0;
      }
      return;
    }
    if (panRef.current) {
      const cam = cameraRef.current;
      cam.x = panRef.current.camX - (e.clientX - panRef.current.startX) / cam.zoom;
      cam.y = panRef.current.camY - (e.clientY - panRef.current.startY) / cam.zoom;
      return;
    }
    survolRef.current = noeudSousSouris(e.clientX, e.clientY);
  }

  function handleMouseDown(e: ReactMouseEvent<HTMLCanvasElement>) {
    const idx = noeudSousSouris(e.clientX, e.clientY);
    if (idx >= 0) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const cam = cameraRef.current;
      const n = noeudsRef.current[idx];
      dragRef.current = {
        idx,
        offsetX: n.x - ((e.clientX - rect.left - rect.width / 2) / cam.zoom + cam.x),
        offsetY: n.y - ((e.clientY - rect.top - rect.height / 2) / cam.zoom + cam.y),
      };
      clickTimeRef.current = e.timeStamp;
    } else {
      panRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        camX: cameraRef.current.x,
        camY: cameraRef.current.y,
      };
    }
  }

  function handleMouseUp(e: ReactMouseEvent<HTMLCanvasElement>) {
    if (dragRef.current) {
      const elapsed = e.timeStamp - clickTimeRef.current;
      const idx = dragRef.current.idx;
      dragRef.current = null;

      // Clic court = navigation / zoom
      if (elapsed < 250) {
        const n = noeudsRef.current[idx];
        if (n) handleClicNoeud(n);
      }
      return;
    }
    panRef.current = null;
  }

  function handleWheel(e: ReactWheelEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const cam = cameraRef.current;
    const factor = e.deltaY > 0 ? 0.88 : 1.14;
    const newZoom = clamp(cam.zoom * factor, 0.15, 4.5);
    cam.zoom = newZoom;

    // ── Semantic Zoom Thresholds ──
    // Zooming IN
    if (e.deltaY < 0) {
      if (niveau === "categories" && newZoom >= 1.6) {
        const hoverIdx = survolRef.current;
        const targetNode = hoverIdx >= 0 ? noeudsRef.current[hoverIdx] : null;
        if (targetNode && targetNode.type === "domaine") {
          setNiveau("competences");
          setFocusId(targetNode.id);
          setBreadcrumb((prev) => [
            ...prev,
            { niveau: "competences", id: targetNode.id, label: targetNode.label },
          ]);
        } else {
          setNiveau("competences");
          setFocusId(null);
          setBreadcrumb((prev) => [
            ...prev,
            { niveau: "competences", id: null, label: "Toutes" },
          ]);
        }
      } else if (niveau === "competences" && newZoom >= 2.2) {
        const hoverIdx = survolRef.current;
        const targetNode = hoverIdx >= 0 ? noeudsRef.current[hoverIdx] : null;
        if (targetNode && targetNode.type === "competence") {
          setNiveau("exercices");
          setFocusId(targetNode.id);
          setBreadcrumb((prev) => [
            ...prev,
            { niveau: "exercices", id: targetNode.id, label: targetNode.label },
          ]);
        }
      }
    } else if (e.deltaY > 0) {
      // Zooming OUT
      if (niveau === "exercices" && newZoom <= 0.45) {
        remonter();
      } else if (niveau === "competences" && newZoom <= 0.35) {
        remonter();
      }
    }
  }

  // Touch support
  const touchRef = useRef<{ id: number; x: number; y: number } | null>(null);

  function handleTouchStart(e: ReactTouchEvent<HTMLCanvasElement>) {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    touchRef.current = { id: touch.identifier, x: touch.clientX, y: touch.clientY };

    const idx = noeudSousSouris(touch.clientX, touch.clientY);
    if (idx >= 0) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      dragRef.current = {
        idx,
        offsetX: 0,
        offsetY: 0,
      };
      clickTimeRef.current = e.timeStamp;
    } else {
      panRef.current = {
        startX: touch.clientX,
        startY: touch.clientY,
        camX: cameraRef.current.x,
        camY: cameraRef.current.y,
      };
    }
  }

  function handleTouchMove(e: ReactTouchEvent<HTMLCanvasElement>) {
    if (e.touches.length !== 1 || !touchRef.current) return;
    const touch = e.touches[0];

    if (dragRef.current) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const cam = cameraRef.current;
      const n = noeudsRef.current[dragRef.current.idx];
      if (n) {
        n.x = (touch.clientX - rect.left - rect.width / 2) / cam.zoom + cam.x;
        n.y = (touch.clientY - rect.top - rect.height / 2) / cam.zoom + cam.y;
        n.vx = 0;
        n.vy = 0;
      }
      return;
    }
    if (panRef.current) {
      const cam = cameraRef.current;
      cam.x = panRef.current.camX - (touch.clientX - panRef.current.startX) / cam.zoom;
      cam.y = panRef.current.camY - (touch.clientY - panRef.current.startY) / cam.zoom;
    }
  }

  function handleTouchEnd(e: ReactTouchEvent<HTMLCanvasElement>) {
    if (dragRef.current) {
      const elapsed = e.timeStamp - clickTimeRef.current;
      const idx = dragRef.current.idx;
      dragRef.current = null;
      if (elapsed < 300) {
        const n = noeudsRef.current[idx];
        if (n) handleClicNoeud(n);
      }
    }
    panRef.current = null;
    touchRef.current = null;
  }

  // ── Navigation entre niveaux ──

  function handleClicNoeud(n: Noeud) {
    if (n.type === "domaine") {
      setNiveau("competences");
      setFocusId(n.id);
      setBreadcrumb((prev) => [
        ...prev,
        { niveau: "competences", id: n.id, label: n.label },
      ]);
    } else if (n.type === "competence" && niveau === "competences") {
      setNiveau("exercices");
      setFocusId(n.id);
      setBreadcrumb((prev) => [
        ...prev,
        { niveau: "exercices", id: n.id, label: `${n.label}` },
      ]);
    } else if (n.type === "competence") {
      // Double-clic ou clic en mode exercices → naviguer
      router.push(`/competences/${encodeURIComponent(n.navId ?? n.id)}`);
    } else if (n.type === "exercice") {
      // Pas de navigation directe pour les exercices pour l'instant
    }
  }

  function remonter() {
    if (breadcrumb.length <= 1) return;
    const nouveau = breadcrumb.slice(0, -1);
    const dernier = nouveau[nouveau.length - 1];
    setBreadcrumb(nouveau);
    setNiveau(dernier.niveau);
    setFocusId(dernier.id);
  }

  function allerVue(index: number) {
    if (index >= breadcrumb.length - 1) return;
    const nouveau = breadcrumb.slice(0, index + 1);
    const dernier = nouveau[nouveau.length - 1];
    setBreadcrumb(nouveau);
    setNiveau(dernier.niveau);
    setFocusId(dernier.id);
  }

  // Bouton « Tout voir » pour le mode compétences sans filtre domaine
  function voirToutesCompetences() {
    setNiveau("competences");
    setFocusId(null);
    setBreadcrumb([
      { niveau: "categories", id: null, label: "Catégories" },
      { niveau: "competences", id: null, label: "Toutes" },
    ]);
  }

  // Recaler la caméra sur le bounding box du graphe (auto-fit).
  function recentrer() {
    const noeuds = noeudsRef.current;
    if (noeuds.length === 0) {
      cameraRef.current = { x: 0, y: 0, zoom: 1 };
      return;
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of noeuds) {
      minX = Math.min(minX, n.x - n.rayon);
      minY = Math.min(minY, n.y - n.rayon);
      maxX = Math.max(maxX, n.x + n.rayon);
      maxY = Math.max(maxY, n.y + n.rayon);
    }
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const graphW = maxX - minX + 120;
    const graphH = maxY - minY + 120;
    const canvas = canvasRef.current;
    const viewW = canvas ? canvas.getBoundingClientRect().width : 900;
    const viewH = canvas ? canvas.getBoundingClientRect().height : 600;
    const zoom = Math.min(viewW / graphW, viewH / graphH, 1.5);
    cameraRef.current = { x: cx, y: cy, zoom: clamp(zoom, 0.15, 1.5) };
  }

  // Navigation clavier : + / - pour zoomer, flèches pour se déplacer,
  // Entrée pour ouvrir le nœud focalisé.
  function handleKeyDown(e: ReactKeyboardEvent<HTMLCanvasElement>) {
    const cam = cameraRef.current;
    switch (e.key) {
      case "+":
      case "=": {
        e.preventDefault();
        cam.zoom = clamp(cam.zoom * 1.14, 0.15, 4.5);
        break;
      }
      case "-": {
        e.preventDefault();
        cam.zoom = clamp(cam.zoom * 0.88, 0.15, 4.5);
        break;
      }
      case "ArrowUp": {
        e.preventDefault();
        cam.y -= 60 / cam.zoom;
        break;
      }
      case "ArrowDown": {
        e.preventDefault();
        cam.y += 60 / cam.zoom;
        break;
      }
      case "ArrowLeft": {
        e.preventDefault();
        cam.x -= 60 / cam.zoom;
        break;
      }
      case "ArrowRight": {
        e.preventDefault();
        cam.x += 60 / cam.zoom;
        break;
      }
      case "Enter": {
        if (survolRef.current >= 0 && survolRef.current < noeudsRef.current.length) {
          e.preventDefault();
          handleClicNoeud(noeudsRef.current[survolRef.current]);
        }
        break;
      }
      case "Escape": {
        e.preventDefault();
        remonter();
        break;
      }
      case "r":
      case "R": {
        e.preventDefault();
        recentrer();
        break;
      }
    }
  }

  // État vide : aucun domaine à montrer (compte sans référentiel actif).
  if (donnees.domaines.length === 0) {
    return (
      <div className="graphe-conteneur" id="graphe-competences">
        <div className="flex h-full min-h-[500px] items-center justify-center px-4">
          <div className="text-center">
            <p className="text-sm font-medium">Aucune compétence à afficher</p>
            <p className="mx-auto mt-1 max-w-md text-xs text-texte-attenue">
              Ton référentiel est construit mais aucun domaine n{"'"}a de compétences actives.
              Ajoute une compétence depuis la vue Liste pour commencer.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="graphe-conteneur" id="graphe-competences">
      {/* Barre d'outils flottante */}
      <div className="absolute left-3 top-3 z-10 flex flex-wrap items-center gap-1.5">
        {/* Fil d'Ariane */}
        {breadcrumb.map((b, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <span className="text-xs text-texte-discret">/</span>}
            <button
              type="button"
              onClick={() => allerVue(i)}
              className={`rounded px-1.5 py-0.5 text-xs font-medium transition-colors ${
                i === breadcrumb.length - 1
                  ? "bg-primaire-faible text-primaire"
                  : "text-texte-attenue hover:text-texte hover:bg-surface-2"
              }`}
            >
              {b.label}
            </button>
          </span>
        ))}
      </div>

      {/* Actions flottantes */}
      <div className="absolute right-3 top-3 z-10 flex items-center gap-2">
        {niveau === "categories" && (
          <button
            type="button"
            onClick={voirToutesCompetences}
            className="rounded border border-bordure bg-surface px-2 py-1 text-xs font-medium text-texte-attenue transition-colors hover:bg-surface-2 hover:text-texte"
          >
            Voir toutes les compétences
          </button>
        )}
        {breadcrumb.length > 1 && (
          <button
            type="button"
            onClick={remonter}
            className="rounded border border-bordure bg-surface px-2 py-1 text-xs font-medium text-texte-attenue transition-colors hover:bg-surface-2 hover:text-texte"
          >
            ← Retour
          </button>
        )}
        <button
          type="button"
          onClick={recentrer}
          title="Recentrer (R)"
          className="rounded border border-bordure bg-surface px-2 py-1 text-xs font-medium text-texte-attenue transition-colors hover:bg-surface-2 hover:text-texte"
        >
          ⟲ Recentrer
        </button>
      </div>

      {/* Légende flottante */}
      <div className="absolute bottom-3 left-3 z-10 flex flex-wrap items-center gap-3 rounded border border-bordure bg-surface/80 px-3 py-1.5 text-[0.6875rem] text-texte-attenue backdrop-blur-sm">
        {niveau === "categories" && (
          <>
            <span>● Domaine</span>
            <span className="text-texte-discret">— Taille ∝ nb. compétences</span>
            <span className="text-texte-discret">— Lien pointillé = proximité sémantique</span>
          </>
        )}
        {niveau === "competences" && (
          <>
            <span className="flex items-center gap-1">
              <span className="inline-block size-2.5 rounded-full" style={{ background: COULEURS_NIVEAU[0] }} />
              Exposition
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block size-2.5 rounded-full" style={{ background: COULEURS_NIVEAU[2] }} />
              Application
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block size-2.5 rounded-full" style={{ background: COULEURS_NIVEAU[4] }} />
              Transfert
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block size-2.5 rounded-full" style={{ background: COULEUR_NON_EVALUE }} />
              Non évalué
            </span>
          </>
        )}
        {niveau === "exercices" && (
          <>
            <span>● Compétence</span>
            <span>◆ Exercice</span>
            <span className="text-texte-discret">→ Prérequis</span>
          </>
        )}
        <span className="text-texte-discret">Molette = zoom · Drag = déplacer</span>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="size-full cursor-grab active:cursor-grabbing"
        role="img"
        aria-label="Graphe des compétences. Molette ou + / - pour zoomer, flèches pour se déplacer, Entrée pour ouvrir le nœud focalisé, R pour recentrer."
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          survolRef.current = -1;
          dragRef.current = null;
          panRef.current = null;
        }}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />
    </div>
  );
}
