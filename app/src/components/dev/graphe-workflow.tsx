"use client";

/**
 * Visualisation interactive du graphe de workflow — Canvas + d3-force.
 *
 * Suit le même pattern que `graphe-competences.tsx` (ADR-056) : Canvas 2D
 * pour le rendu, d3-force pour le layout, pan/zoom/drag/survol. Adapté au
 * graphe de workflow : types de nœuds/liens différents, panneau de métriques
 * et d'export au lieu du panneau de réglages compétences.
 *
 * Le graphe est orienté (digraph) : les flèches indiquent le sens des
 * transitions. Les nœuds sont colorés par type, les liens stylés par type.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type Simulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";
import type {
  NoeudWorkflow,
  LienWorkflow,
  TypeNoeudWorkflow,
  TypeLienWorkflow,
  StatistiquesGraphe,
} from "@/lib/domain/workflow-graphe";
import type { ExportJSON } from "@/lib/domain/workflow-export";

/* ------------------------------------------------------------------ */
/* Types internes                                                      */
/* ------------------------------------------------------------------ */

interface NoeudSimule extends NoeudWorkflow, SimulationNodeDatum {
  rayon: number;
}

interface LienSimule
  extends Omit<LienWorkflow, "source" | "target">,
    SimulationLinkDatum<NoeudSimule> {
  source: string | NoeudSimule;
  target: string | NoeudSimule;
}

interface Camera {
  x: number;
  y: number;
  zoom: number;
}

interface Palette {
  texte: string;
  texteAttenue: string;
  texteDiscret: string;
  surface: string;
  surface2: string;
  bordure: string;
  primaire: string;
}

/* ------------------------------------------------------------------ */
/* Constantes de style                                                 */
/* ------------------------------------------------------------------ */

const COULEUR_PAR_TYPE_NOEUD: Record<TypeNoeudWorkflow, string> = {
  page: "#4a90d9",
  modal: "#9b59b6",
  tiroir: "#27ae60",
  etape: "#e67e22",
  action: "#e74c3c",
};

const FORME_LIBELLE: Record<TypeNoeudWorkflow, string> = {
  page: "Page",
  modal: "Modale",
  tiroir: "Tiroir",
  etape: "Étape",
  action: "Action",
};

const STYLE_LIEN: Record<
  TypeLienWorkflow,
  { libelle: string; pointille: number[]; epaisseur: number; couleur: string }
> = {
  navigation: { libelle: "Navigation", pointille: [], epaisseur: 1.8, couleur: "#4a90d9" },
  ouverture: { libelle: "Ouverture", pointille: [8, 4], epaisseur: 1.4, couleur: "#9b59b6" },
  transition: { libelle: "Transition", pointille: [4, 4], epaisseur: 1.4, couleur: "#e67e22" },
  soumission: { libelle: "Soumission", pointille: [], epaisseur: 2.2, couleur: "#e74c3c" },
  retour: { libelle: "Retour", pointille: [3, 5], epaisseur: 1, couleur: "#95a5a6" },
};

const RAYON_PAR_TYPE: Record<TypeNoeudWorkflow, number> = {
  page: 24,
  modal: 18,
  tiroir: 16,
  etape: 14,
  action: 11,
};

/** Espacement horizontal entre colonnes de profondeur BFS. */
const ESPACEMENT_X = 260;
/** Décalage vertical par type dans une même colonne. */
const DECALAGE_Y_TYPE: Record<TypeNoeudWorkflow, number> = {
  page: 0,
  modal: -80,
  tiroir: 80,
  etape: -160,
  action: 160,
};

/* ------------------------------------------------------------------ */
/* Palette CSS                                                         */
/* ------------------------------------------------------------------ */

const REPLIS: Palette = {
  texte: "#1a1814",
  texteAttenue: "#6b6355",
  texteDiscret: "#8f8a7a",
  surface: "#ffffff",
  surface2: "#f5f3ee",
  bordure: "#ddd7c9",
  primaire: "#2f6f4f",
};

function resoudrePalette(): Palette {
  if (typeof window === "undefined") return REPLIS;
  const style = getComputedStyle(document.documentElement);
  const lire = (nom: string, repli: string) =>
    style.getPropertyValue(nom).trim() || repli;
  return {
    texte: lire("--texte", REPLIS.texte),
    texteAttenue: lire("--texte-attenue", REPLIS.texteAttenue),
    texteDiscret: lire("--texte-discret", REPLIS.texteDiscret),
    surface: lire("--surface", REPLIS.surface),
    surface2: lire("--surface-2", REPLIS.surface2),
    bordure: lire("--bordure", REPLIS.bordure),
    primaire: lire("--primaire", REPLIS.primaire),
  };
}

/* ------------------------------------------------------------------ */
/* Props                                                               */
/* ------------------------------------------------------------------ */

export interface GrapheWorkflowVizProps {
  noeuds: NoeudWorkflow[];
  liens: LienWorkflow[];
  inatteignables: NoeudWorkflow[];
  profondeurs: Record<string, number>;
  stats: StatistiquesGraphe;
  dot: string;
  jsonExport: ExportJSON;
  matriceNoeuds: string[];
  matriceData: number[][];
}

/* ------------------------------------------------------------------ */
/* Composant                                                           */
/* ------------------------------------------------------------------ */

export function GrapheWorkflowViz({
  noeuds,
  liens,
  inatteignables,
  profondeurs,
  stats,
  dot,
  jsonExport,
  matriceNoeuds,
  matriceData,
}: GrapheWorkflowVizProps) {
  const conteneurRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simulationRef = useRef<Simulation<NoeudSimule, LienSimule> | null>(null);
  const noeudsRef = useRef<NoeudSimule[]>([]);
  const liensRef = useRef<LienSimule[]>([]);
  const cameraRef = useRef<Camera>({ x: 0, y: 0, zoom: 0.45 });
  const paletteRef = useRef<Palette>(resoudrePalette());
  const tailleRef = useRef({ largeur: 0, hauteur: 0 });
  const dragRef = useRef<{ noeud: NoeudSimule } | null>(null);
  const panRef = useRef<{ x: number; y: number } | null>(null);
  const deplaceRef = useRef(false);
  const survolIdRef = useRef<string | null>(null);

  const [panneauOuvert, setPanneauOuvert] = useState(true);
  const [selectionId, setSelectionId] = useState<string | null>(null);
  const [copie, setCopie] = useState<string | null>(null);

  // Filtres par type
  const [typesNoeuds, setTypesNoeuds] = useState<Record<TypeNoeudWorkflow, boolean>>({
    page: true,
    modal: true,
    tiroir: true,
    etape: true,
    action: true,
  });
  const [typesLiens, setTypesLiens] = useState<Record<TypeLienWorkflow, boolean>>({
    navigation: true,
    ouverture: true,
    transition: true,
    soumission: true,
    retour: true,
  });

  /* ── Filtrage ── */

  const noeudsVisibles = useMemo(
    () => noeuds.filter((n) => typesNoeuds[n.type]),
    [noeuds, typesNoeuds],
  );
  const idsVisibles = useMemo(
    () => new Set(noeudsVisibles.map((n) => n.id)),
    [noeudsVisibles],
  );
  const liensVisibles = useMemo(
    () =>
      liens.filter(
        (l) =>
          typesLiens[l.type] &&
          idsVisibles.has(l.source) &&
          idsVisibles.has(l.target),
      ),
    [liens, typesLiens, idsVisibles],
  );

  /* ── Détail de la sélection ── */

  const noeudSelectionne = useMemo(
    () => noeuds.find((n) => n.id === selectionId) ?? null,
    [noeuds, selectionId],
  );
  const liensEntrants = useMemo(
    () => liens.filter((l) => l.target === selectionId),
    [liens, selectionId],
  );
  const liensSortants = useMemo(
    () => liens.filter((l) => l.source === selectionId),
    [liens, selectionId],
  );

  /* ── Dessin ── */

  const dessiner = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { largeur, hauteur } = tailleRef.current;
    const palette = paletteRef.current;
    const camera = cameraRef.current;

    // Fond
    ctx.fillStyle = palette.surface;
    ctx.fillRect(0, 0, largeur, hauteur);

    // Grille de points
    const pas = 32 * camera.zoom;
    if (pas >= 6) {
      const decalageX = ((largeur / 2 + camera.x * camera.zoom) % pas) - pas;
      const decalageY = ((hauteur / 2 + camera.y * camera.zoom) % pas) - pas;
      ctx.fillStyle = palette.bordure;
      for (let x = decalageX; x < largeur + pas; x += pas) {
        for (let y = decalageY; y < hauteur + pas; y += pas) {
          ctx.beginPath();
          ctx.arc(x, y, 0.9, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    const survol = survolIdRef.current;
    const voisins = new Set<string>();
    if (survol) {
      for (const l of liensRef.current) {
        const s = typeof l.source === "string" ? l.source : l.source.id;
        const t = typeof l.target === "string" ? l.target : l.target.id;
        if (s === survol) voisins.add(t);
        if (t === survol) voisins.add(s);
      }
    }

    // Liens — courbes quadratiques pour éviter les superpositions
    for (const l of liensRef.current) {
      const source = l.source as NoeudSimule;
      const cible = l.target as NoeudSimule;
      if (source.x === undefined || cible.x === undefined) continue;

      const sId = typeof l.source === "string" ? l.source : l.source.id;
      const tId = typeof l.target === "string" ? l.target : l.target.id;
      const concerne = survol !== null && (sId === survol || tId === survol);
      const opacite = survol === null || concerne ? 0.65 : 0.06;

      const ax = largeur / 2 + (source.x! + camera.x) * camera.zoom;
      const ay = hauteur / 2 + (source.y! + camera.y) * camera.zoom;
      const bx = largeur / 2 + (cible.x! + camera.x) * camera.zoom;
      const by = hauteur / 2 + (cible.y! + camera.y) * camera.zoom;
      const style = STYLE_LIEN[l.type];

      // Point de contrôle pour la courbe — décalage perpendiculaire
      const dx = bx - ax;
      const dy = by - ay;
      const dist = Math.hypot(dx, dy);
      const courbure = dist > 200 ? 30 : dist > 100 ? 20 : 12;
      const cx = (ax + bx) / 2 - (dy / dist) * courbure;
      const cy = (ay + by) / 2 + (dx / dist) * courbure;

      ctx.save();
      ctx.globalAlpha = opacite;
      ctx.strokeStyle = style.couleur;
      ctx.lineWidth = style.epaisseur * camera.zoom;
      ctx.setLineDash(style.pointille.map((v) => v * camera.zoom));

      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.quadraticCurveTo(cx, cy, bx, by);
      ctx.stroke();

      // Flèche à l'arrivée (tangente à la courbe au point final)
      const tFleche = 0.96;
      const fxA = (1 - tFleche) * (1 - tFleche) * ax + 2 * (1 - tFleche) * tFleche * cx + tFleche * tFleche * bx;
      const fyA = (1 - tFleche) * (1 - tFleche) * ay + 2 * (1 - tFleche) * tFleche * cy + tFleche * tFleche * by;
      const angle = Math.atan2(by - fyA, bx - fxA);
      const rayonCible = cible.rayon * camera.zoom;
      const pointe = {
        x: bx - Math.cos(angle) * (rayonCible + 4),
        y: by - Math.sin(angle) * (rayonCible + 4),
      };
      const tailleFleche = 7 * camera.zoom;
      ctx.setLineDash([]);
      ctx.fillStyle = style.couleur;
      ctx.beginPath();
      ctx.moveTo(pointe.x, pointe.y);
      ctx.lineTo(
        pointe.x - tailleFleche * Math.cos(angle - Math.PI / 7),
        pointe.y - tailleFleche * Math.sin(angle - Math.PI / 7),
      );
      ctx.lineTo(
        pointe.x - tailleFleche * Math.cos(angle + Math.PI / 7),
        pointe.y - tailleFleche * Math.sin(angle + Math.PI / 7),
      );
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }

    // Nœuds
    for (const n of noeudsRef.current) {
      if (n.x === undefined || n.y === undefined) continue;
      const px = largeur / 2 + (n.x + camera.x) * camera.zoom;
      const py = hauteur / 2 + (n.y + camera.y) * camera.zoom;
      const rayon = n.rayon * camera.zoom;
      const estSurvole = n.id === survol;
      const estVoisin = voisins.has(n.id);
      const estSelectionne = n.id === selectionId;
      const estompe = survol !== null && !estSurvole && !estVoisin;

      ctx.save();
      ctx.globalAlpha = estompe ? 0.15 : 1;
      ctx.fillStyle = COULEUR_PAR_TYPE_NOEUD[n.type];

      // Forme par type
      ctx.beginPath();
      switch (n.type) {
        case "action":
          // Losange
          ctx.moveTo(px, py - rayon);
          ctx.lineTo(px + rayon, py);
          ctx.lineTo(px, py + rayon);
          ctx.lineTo(px - rayon, py);
          ctx.closePath();
          break;
        case "modal":
          // Rect arrondi
          ctx.roundRect(px - rayon, py - rayon * 0.7, rayon * 2, rayon * 1.4, 4);
          break;
        case "tiroir":
          // Rect
          ctx.rect(px - rayon, py - rayon * 0.6, rayon * 2, rayon * 1.2);
          break;
        case "etape":
          // Hexagone
          for (let i = 0; i < 6; i++) {
            const a = (Math.PI / 3) * i - Math.PI / 6;
            const ex = px + rayon * Math.cos(a);
            const ey = py + rayon * Math.sin(a);
            if (i === 0) ctx.moveTo(ex, ey);
            else ctx.lineTo(ex, ey);
          }
          ctx.closePath();
          break;
        default:
          // Cercle (page)
          ctx.arc(px, py, rayon, 0, Math.PI * 2);
      }
      ctx.fill();

      if (estSurvole || estSelectionne) {
        ctx.lineWidth = estSelectionne ? 3 : 2;
        ctx.strokeStyle = palette.texte;
        ctx.stroke();
      }
      ctx.restore();

      // Libellé avec fond pour la lisibilité
      const afficherLibelle = camera.zoom >= 0.6 || estSurvole || estVoisin;
      if (afficherLibelle && !estompe) {
        ctx.save();
        const fontSize = Math.max(10, 11 * Math.min(camera.zoom, 1.6));
        ctx.font = `500 ${fontSize}px var(--police-texte, sans-serif)`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        const libelle =
          n.libelle.length > 28 ? `${n.libelle.slice(0, 27)}…` : n.libelle;
        const mesure = ctx.measureText(libelle);
        const padH = 4;
        const padV = 2;
        const lblY = py + rayon + 5;
        // Fond semi-transparent derrière le texte
        ctx.fillStyle = palette.surface;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.roundRect(
          px - mesure.width / 2 - padH,
          lblY - padV,
          mesure.width + padH * 2,
          fontSize + padV * 2 + 1,
          3,
        );
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = palette.texte;
        ctx.fillText(libelle, px, lblY);
        ctx.restore();
      }
    }

    // Tooltip
    if (survol) {
      const n = noeudsRef.current.find((x) => x.id === survol);
      if (n && n.x !== undefined && n.y !== undefined) {
        const px = largeur / 2 + (n.x + camera.x) * camera.zoom;
        const py = hauteur / 2 + (n.y + camera.y) * camera.zoom;
        const lignes = [
          n.libelle,
          `Type : ${FORME_LIBELLE[n.type]}`,
          ...(n.url ? [`URL : ${n.url}`] : []),
          ...(n.condition ? [`Si : ${n.condition}`] : []),
          `Profondeur BFS : ${profondeurs[n.id] ?? "?"}`,
        ];
        ctx.save();
        ctx.font = "11px var(--police-texte, sans-serif)";
        const largeurTexte = Math.max(
          ...lignes.map((l) => ctx.measureText(l).width),
        );
        const pad = 8;
        const boiteX = px + 14;
        const boiteY = py - 10;
        const boiteL = largeurTexte + pad * 2;
        const boiteH = lignes.length * 15 + pad * 2 - 4;

        ctx.fillStyle = palette.surface2;
        ctx.strokeStyle = palette.bordure;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(boiteX, boiteY, boiteL, boiteH, 6);
        ctx.fill();
        ctx.stroke();

        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        lignes.forEach((ligne, i) => {
          ctx.fillStyle = i === 0 ? palette.texte : palette.texteAttenue;
          ctx.fillText(ligne, boiteX + pad, boiteY + pad + i * 15);
        });
        ctx.restore();
      }
    }
  }, [selectionId, profondeurs]);

  const dessinerRef = useRef(dessiner);
  useEffect(() => {
    dessinerRef.current = dessiner;
  }, [dessiner]);

  /* ── Simulation d3-force ── */

  useEffect(() => {
    const reduitMouvement =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Positions initiales hiérarchiques : X = profondeur BFS, Y = type
    // Cela donne une lecture gauche→droite naturelle du workflow.
    const compteurParColonne = new Map<number, number>();
    const noeudsSimules: NoeudSimule[] = noeudsVisibles.map((n) => {
      const prof = profondeurs[n.id] ?? 0;
      const rang = compteurParColonne.get(prof) ?? 0;
      compteurParColonne.set(prof, rang + 1);
      return {
        ...n,
        rayon: RAYON_PAR_TYPE[n.type],
        x: prof * ESPACEMENT_X,
        y: DECALAGE_Y_TYPE[n.type] + rang * 65,
      };
    });
    const parId = new Map(noeudsSimules.map((n) => [n.id, n]));

    // Conserver les positions si on revient d'un filtre
    for (const ancien of noeudsRef.current) {
      const suivant = parId.get(ancien.id);
      if (suivant && ancien.x !== undefined) {
        suivant.x = ancien.x;
        suivant.y = ancien.y;
        suivant.vx = ancien.vx;
        suivant.vy = ancien.vy;
      }
    }

    const liensSimules: LienSimule[] = liensVisibles
      .filter((l) => parId.has(l.source) && parId.has(l.target))
      .map((l) => ({ ...l }));

    noeudsRef.current = noeudsSimules;
    liensRef.current = liensSimules;

    simulationRef.current?.stop();
    const sim = forceSimulation(noeudsSimules)
      .force("charge", forceManyBody<NoeudSimule>().strength(-600))
      .force(
        "link",
        forceLink<NoeudSimule, LienSimule>(liensSimules)
          .id((n) => n.id)
          .distance(160)
          .strength(0.2),
      )
      .force("collide", forceCollide<NoeudSimule>((n) => n.rayon + 20))
      // Force hiérarchique : tire les nœuds vers leur colonne BFS
      .force("x", forceX<NoeudSimule>((n) => (profondeurs[n.id] ?? 0) * ESPACEMENT_X).strength(0.7))
      .force("y", forceY<NoeudSimule>((n) => DECALAGE_Y_TYPE[n.type]).strength(0.05))
      .force("center", forceCenter(0, 0).strength(0.01))
      .alphaDecay(0.03)
      .alphaMin(0.005);

    simulationRef.current = sim;

    if (reduitMouvement) {
      sim.stop();
      for (let i = 0; i < 300; i++) sim.tick();
      dessinerRef.current();
    } else {
      sim.on("tick", () => dessinerRef.current());
    }

    return () => {
      sim.stop();
    };
  }, [noeuds, liens, typesNoeuds, typesLiens, profondeurs]);

  /* ── Redimensionnement ── */

  useEffect(() => {
    const conteneur = conteneurRef.current;
    const canvas = canvasRef.current;
    if (!conteneur || !canvas) return;

    function redimensionner() {
      const rect = conteneur!.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      tailleRef.current = { largeur: rect.width, hauteur: rect.height };
      canvas!.width = Math.max(1, Math.round(rect.width * dpr));
      canvas!.height = Math.max(1, Math.round(rect.height * dpr));
      canvas!.style.width = `${rect.width}px`;
      canvas!.style.height = `${rect.height}px`;
      const ctx = canvas!.getContext("2d");
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
      dessinerRef.current();
    }

    redimensionner();
    const observateur = new ResizeObserver(redimensionner);
    observateur.observe(conteneur);
    return () => observateur.disconnect();
  }, []);

  /* ── Thème ── */

  useEffect(() => {
    const cible = document.documentElement;
    const observateur = new MutationObserver(() => {
      paletteRef.current = resoudrePalette();
      dessinerRef.current();
    });
    observateur.observe(cible, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observateur.disconnect();
  }, []);

  /* ── Interactions souris ── */

  const noeudSousCurseur = useCallback(
    (xEcran: number, yEcran: number): NoeudSimule | null => {
      const { largeur, hauteur } = tailleRef.current;
      const camera = cameraRef.current;
      let trouve: NoeudSimule | null = null;
      let meilleureDistance = Infinity;
      for (const n of noeudsRef.current) {
        if (n.x === undefined || n.y === undefined) continue;
        const px = largeur / 2 + (n.x + camera.x) * camera.zoom;
        const py = hauteur / 2 + (n.y + camera.y) * camera.zoom;
        const rayon = n.rayon * camera.zoom;
        const d = Math.hypot(xEcran - px, yEcran - py);
        if (d <= rayon + 4 && d < meilleureDistance) {
          meilleureDistance = d;
          trouve = n;
        }
      }
      return trouve;
    },
    [],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function coordsRelatives(e: { clientX: number; clientY: number }): [number, number] {
      const rect = canvas!.getBoundingClientRect();
      return [e.clientX - rect.left, e.clientY - rect.top];
    }

    function onPointerDown(e: PointerEvent) {
      const [x, y] = coordsRelatives(e);
      deplaceRef.current = false;
      const n = noeudSousCurseur(x, y);
      if (n) {
        dragRef.current = { noeud: n };
        simulationRef.current?.alphaTarget(0.3).restart();
        n.fx = n.x;
        n.fy = n.y;
      } else {
        panRef.current = { x: e.clientX, y: e.clientY };
      }
      canvas!.setPointerCapture(e.pointerId);
    }

    function onPointerMove(e: PointerEvent) {
      const [x, y] = coordsRelatives(e);
      if (dragRef.current) {
        deplaceRef.current = true;
        const { largeur, hauteur } = tailleRef.current;
        const camera = cameraRef.current;
        dragRef.current.noeud.fx =
          (x - largeur / 2) / camera.zoom - camera.x;
        dragRef.current.noeud.fy =
          (y - hauteur / 2) / camera.zoom - camera.y;
        dessinerRef.current();
        return;
      }
      if (panRef.current) {
        deplaceRef.current = true;
        const dx = e.clientX - panRef.current.x;
        const dy = e.clientY - panRef.current.y;
        panRef.current = { x: e.clientX, y: e.clientY };
        cameraRef.current.x += dx / cameraRef.current.zoom;
        cameraRef.current.y += dy / cameraRef.current.zoom;
        dessinerRef.current();
        return;
      }
      const n = noeudSousCurseur(x, y);
      const idSuivant = n?.id ?? null;
      if (survolIdRef.current !== idSuivant) {
        survolIdRef.current = idSuivant;
        dessinerRef.current();
      }
    }

    function onPointerUp(e: PointerEvent) {
      if (dragRef.current) {
        dragRef.current.noeud.fx = null;
        dragRef.current.noeud.fy = null;
        simulationRef.current?.alphaTarget(0);
        if (!deplaceRef.current) {
          setSelectionId(dragRef.current.noeud.id);
        }
        dragRef.current = null;
      }
      panRef.current = null;
      try {
        canvas!.releasePointerCapture(e.pointerId);
      } catch {
        /* déjà relâché */
      }
    }

    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const [x, y] = coordsRelatives(e);
      const { largeur, hauteur } = tailleRef.current;
      const camera = cameraRef.current;
      const mondeX = (x - largeur / 2) / camera.zoom - camera.x;
      const mondeY = (y - hauteur / 2) / camera.zoom - camera.y;
      const facteur = Math.exp(-e.deltaY * 0.001);
      camera.zoom = Math.min(4.5, Math.max(0.1, camera.zoom * facteur));
      camera.x = (x - largeur / 2) / camera.zoom - mondeX;
      camera.y = (y - hauteur / 2) / camera.zoom - mondeY;
      dessinerRef.current();
    }

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("wheel", onWheel);
    };
  }, [noeudSousCurseur]);

  /* ── Copie dans le presse-papier ── */

  const copierTexte = useCallback(async (texte: string, nom: string) => {
    await navigator.clipboard.writeText(texte);
    setCopie(nom);
    setTimeout(() => setCopie(null), 1800);
  }, []);

  const matriceFormatee = useMemo(() => {
    const max = Math.max(...matriceNoeuds.map((n) => n.length));
    const en_tete = " ".repeat(max + 2) + matriceNoeuds.map((_, i) => String(i).padStart(2)).join(" ");
    const lignes = matriceData.map((row, i) => {
      const nom = matriceNoeuds[i].padEnd(max + 2);
      return nom + row.map((v) => String(v).padStart(2)).join(" ");
    });
    return [en_tete, ...lignes].join("\n");
  }, [matriceNoeuds, matriceData]);

  /* ── Rendu ── */

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Canvas */}
      <div ref={conteneurRef} className="relative min-w-0 flex-1">
        <canvas
          ref={canvasRef}
          tabIndex={0}
          role="application"
          aria-label="Graphe du workflow — déplacer les nœuds, molette pour zoomer"
          className="block h-full w-full cursor-grab touch-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primaire"
        />

        {/* Légende */}
        <div className="pointer-events-none absolute bottom-3 left-3 space-y-1.5 rounded-lg border border-bordure bg-surface/90 px-3 py-2.5 text-[0.6875rem] text-texte-attenue backdrop-blur-sm">
          <div className="mb-1 text-[0.6rem] font-semibold uppercase tracking-wider text-texte-discret">
            Nœuds
          </div>
          {(Object.keys(COULEUR_PAR_TYPE_NOEUD) as TypeNoeudWorkflow[])
            .filter((t) => typesNoeuds[t])
            .map((t) => (
              <div key={t} className="flex items-center gap-1.5">
                <span
                  className="inline-block size-2.5 rounded-sm"
                  style={{ background: COULEUR_PAR_TYPE_NOEUD[t] }}
                />
                {FORME_LIBELLE[t]}
              </div>
            ))}
          <div className="mb-1 mt-2 text-[0.6rem] font-semibold uppercase tracking-wider text-texte-discret">
            Liens
          </div>
          {(Object.keys(STYLE_LIEN) as TypeLienWorkflow[])
            .filter((t) => typesLiens[t])
            .map((t) => (
              <div key={t} className="flex items-center gap-1.5">
                <span
                  className="inline-block h-0 w-4 border-t-2"
                  style={{
                    borderStyle:
                      STYLE_LIEN[t].pointille.length > 0 ? "dashed" : "solid",
                    borderColor: STYLE_LIEN[t].couleur,
                    borderWidth: STYLE_LIEN[t].epaisseur,
                  }}
                />
                {STYLE_LIEN[t].libelle}
              </div>
            ))}
        </div>

        {/* Bouton panneau */}
        <button
          type="button"
          onClick={() => setPanneauOuvert((o) => !o)}
          className="absolute right-3 top-3 rounded-md border border-bordure bg-surface/90 px-2.5 py-1.5 text-xs font-medium text-texte-attenue backdrop-blur-sm hover:text-texte"
        >
          {panneauOuvert ? "Masquer" : "Panneau"}
        </button>
      </div>

      {/* Panneau latéral */}
      {panneauOuvert && (
        <aside className="flex w-80 shrink-0 flex-col overflow-y-auto border-l border-bordure bg-surface-2 text-sm">
          {/* Métriques */}
          <section className="border-b border-bordure px-4 py-3">
            <h2 className="text-[0.65rem] font-semibold uppercase tracking-wider text-texte-discret">
              Métriques du graphe
            </h2>
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
              <dt className="text-texte-attenue">|V| nœuds</dt>
              <dd className="font-mono font-medium">{stats.totalNoeuds}</dd>
              <dt className="text-texte-attenue">|E| arêtes</dt>
              <dd className="font-mono font-medium">{stats.totalLiens}</dd>
              <dt className="text-texte-attenue">Atteignables</dt>
              <dd className="font-mono font-medium">{stats.atteignables}</dd>
              <dt className="text-texte-attenue">Inatteignables</dt>
              <dd className="font-mono font-medium">{stats.inatteignables}</dd>
              <dt className="text-texte-attenue">Diamètre BFS</dt>
              <dd className="font-mono font-medium">{stats.diametreBFS}</dd>
              <dt className="text-texte-attenue">Degré sortant moy.</dt>
              <dd className="font-mono font-medium">
                {stats.degreSortantMoyen.toFixed(2)}
              </dd>
              <dt className="text-texte-attenue">Degré entrant moy.</dt>
              <dd className="font-mono font-medium">
                {stats.degreEntrantMoyen.toFixed(2)}
              </dd>
            </dl>

            {stats.puits.length > 0 && (
              <div className="mt-2">
                <p className="text-[0.65rem] font-medium text-alerte">
                  {stats.puits.length} puits (dead ends)
                </p>
                <ul className="mt-0.5 text-[0.65rem] text-texte-discret">
                  {stats.puits.map((id) => (
                    <li key={id} className="truncate">
                      {id}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {inatteignables.length > 0 && (
              <div className="mt-2 rounded-md border border-alerte/30 bg-alerte-faible px-2 py-1.5">
                <p className="text-[0.65rem] font-medium text-alerte">
                  ⚠ {inatteignables.length} nœud(s) inatteignable(s)
                </p>
                <ul className="mt-0.5 text-[0.65rem] text-texte-discret">
                  {inatteignables.map((n) => (
                    <li key={n.id} className="truncate">
                      {n.id} ({n.libelle})
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {/* Détail du nœud sélectionné */}
          <section className="border-b border-bordure px-4 py-3">
            <h2 className="text-[0.65rem] font-semibold uppercase tracking-wider text-texte-discret">
              {noeudSelectionne
                ? "Nœud sélectionné"
                : "Cliquer un nœud pour voir le détail"}
            </h2>
            {noeudSelectionne && (
              <div className="mt-2 space-y-1.5 text-xs">
                <div>
                  <span className="text-texte-attenue">ID : </span>
                  <span className="font-mono">{noeudSelectionne.id}</span>
                </div>
                <div>
                  <span className="text-texte-attenue">Type : </span>
                  <span
                    className="inline-block rounded-sm px-1 py-0.5 text-[0.65rem] font-medium text-white"
                    style={{
                      background:
                        COULEUR_PAR_TYPE_NOEUD[noeudSelectionne.type],
                    }}
                  >
                    {FORME_LIBELLE[noeudSelectionne.type]}
                  </span>
                </div>
                <div>
                  <span className="text-texte-attenue">Libellé : </span>
                  {noeudSelectionne.libelle}
                </div>
                {noeudSelectionne.url && (
                  <div>
                    <span className="text-texte-attenue">URL : </span>
                    <span className="font-mono">{noeudSelectionne.url}</span>
                  </div>
                )}
                {noeudSelectionne.condition && (
                  <div>
                    <span className="text-texte-attenue">Condition : </span>
                    <span className="italic">{noeudSelectionne.condition}</span>
                  </div>
                )}
                <div>
                  <span className="text-texte-attenue">Profondeur BFS : </span>
                  <span className="font-mono">
                    {profondeurs[noeudSelectionne.id] ?? "—"}
                  </span>
                </div>
                <div>
                  <span className="text-texte-attenue">Degré entrant : </span>
                  <span className="font-mono">{liensEntrants.length}</span>
                </div>
                <div>
                  <span className="text-texte-attenue">Degré sortant : </span>
                  <span className="font-mono">{liensSortants.length}</span>
                </div>

                {liensEntrants.length > 0 && (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-texte-attenue hover:text-texte">
                      Arêtes entrantes ({liensEntrants.length})
                    </summary>
                    <ul className="mt-1 space-y-0.5 pl-2 text-[0.65rem]">
                      {liensEntrants.map((l, i) => (
                        <li key={i} className="truncate">
                          <span className="text-texte-discret">{l.source}</span>
                          {" → "}
                          <span className="font-medium">{l.libelle}</span>
                          {l.condition && (
                            <span className="italic text-texte-discret">
                              {" "}
                              ({l.condition})
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}

                {liensSortants.length > 0 && (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-texte-attenue hover:text-texte">
                      Arêtes sortantes ({liensSortants.length})
                    </summary>
                    <ul className="mt-1 space-y-0.5 pl-2 text-[0.65rem]">
                      {liensSortants.map((l, i) => (
                        <li key={i} className="truncate">
                          <span className="font-medium">{l.libelle}</span>
                          {" → "}
                          <span className="text-texte-discret">{l.target}</span>
                          {l.condition && (
                            <span className="italic text-texte-discret">
                              {" "}
                              ({l.condition})
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}

                <button
                  type="button"
                  onClick={() => setSelectionId(null)}
                  className="mt-1 text-[0.65rem] text-texte-discret hover:text-texte"
                >
                  Désélectionner
                </button>
              </div>
            )}
          </section>

          {/* Filtres */}
          <section className="border-b border-bordure px-4 py-3">
            <h2 className="text-[0.65rem] font-semibold uppercase tracking-wider text-texte-discret">
              Filtres — Nœuds
            </h2>
            <div className="mt-2 space-y-1">
              {(Object.keys(COULEUR_PAR_TYPE_NOEUD) as TypeNoeudWorkflow[]).map(
                (t) => (
                  <label
                    key={t}
                    className="flex items-center gap-2 text-xs text-texte-attenue"
                  >
                    <input
                      type="checkbox"
                      checked={typesNoeuds[t]}
                      onChange={(e) =>
                        setTypesNoeuds((prev) => ({
                          ...prev,
                          [t]: e.target.checked,
                        }))
                      }
                      className="accent-primaire"
                    />
                    <span
                      className="inline-block size-2 rounded-sm"
                      style={{ background: COULEUR_PAR_TYPE_NOEUD[t] }}
                    />
                    {FORME_LIBELLE[t]}
                  </label>
                ),
              )}
            </div>

            <h2 className="mt-3 text-[0.65rem] font-semibold uppercase tracking-wider text-texte-discret">
              Filtres — Liens
            </h2>
            <div className="mt-2 space-y-1">
              {(Object.keys(STYLE_LIEN) as TypeLienWorkflow[]).map((t) => (
                <label
                  key={t}
                  className="flex items-center gap-2 text-xs text-texte-attenue"
                >
                  <input
                    type="checkbox"
                    checked={typesLiens[t]}
                    onChange={(e) =>
                      setTypesLiens((prev) => ({
                        ...prev,
                        [t]: e.target.checked,
                      }))
                    }
                    className="accent-primaire"
                  />
                  {STYLE_LIEN[t].libelle}
                </label>
              ))}
            </div>
          </section>

          {/* Export */}
          <section className="px-4 py-3">
            <h2 className="text-[0.65rem] font-semibold uppercase tracking-wider text-texte-discret">
              Export formel
            </h2>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <BoutonCopie
                onClick={() => copierTexte(dot, "DOT")}
                actif={copie === "DOT"}
              >
                DOT (Graphviz)
              </BoutonCopie>
              <BoutonCopie
                onClick={() =>
                  copierTexte(JSON.stringify(jsonExport, null, 2), "JSON")
                }
                actif={copie === "JSON"}
              >
                JSON
              </BoutonCopie>
              <BoutonCopie
                onClick={() => copierTexte(matriceFormatee, "Matrice")}
                actif={copie === "Matrice"}
              >
                Matrice d&apos;adjacence
              </BoutonCopie>
            </div>
            {copie && (
              <p className="mt-1.5 text-[0.65rem] text-succes">
                ✓ {copie} copié dans le presse-papier
              </p>
            )}
          </section>
        </aside>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Composants utilitaires                                              */
/* ------------------------------------------------------------------ */

function BoutonCopie({
  onClick,
  actif,
  children,
}: {
  onClick: () => void;
  actif: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border px-2 py-1 text-[0.65rem] font-medium transition-colors ${
        actif
          ? "border-succes/40 bg-succes-faible text-succes"
          : "border-bordure bg-surface text-texte-attenue hover:bg-surface-2 hover:text-texte"
      }`}
    >
      {children}
    </button>
  );
}
