"use client";

/**
 * Visualisation interactive du graphe de workflow — Canvas + d3-force.
 *
 * Supporte deux perspectives complémentaires :
 *   1. Parcours UX (User Journey) : sous-états interactifs, triggers, 3 actes et clusters.
 *   2. Architecture Code (AST) : arborescence filesystem, imports et server actions.
 *
 * Fournit le pan/zoom/drag, simulation d3-force, filtres dynamiques, infobulles,
 * inspection des triggers, et export formel (DOT avec clusters, JSON, matrice).
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
import {
  parcourirWorkflow,
  statistiquesGraphe,
  type NoeudWorkflow,
  type LienWorkflow,
  type TypeNoeudWorkflow,
  type TypeLienWorkflow,
  type StatistiquesGraphe,
  type PerspectiveWorkflow,
  type GroupeWorkflow,
} from "@/lib/domain/workflow-graphe";
import {
  exporterDOT,
  exporterJSON,
  matriceAdjacence,
  type ExportJSON,
} from "@/lib/domain/workflow-export";
import { conserverPositions, liensRelies, mouvementReduit, observerTailleCanvas } from "@/lib/ui/graphe-d3";

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
  primaireFaible: string;
}

export interface DonneesPerspectiveGraphe {
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

export interface GrapheWorkflowVizProps {
  architecture?: DonneesPerspectiveGraphe;
  ux?: DonneesPerspectiveGraphe;
  uxAtomique?: DonneesPerspectiveGraphe;
  /** Fallbacks pour rétrocompatibilité directe */
  noeuds?: NoeudWorkflow[];
  liens?: LienWorkflow[];
  inatteignables?: NoeudWorkflow[];
  profondeurs?: Record<string, number>;
  stats?: StatistiquesGraphe;
  dot?: string;
  jsonExport?: ExportJSON;
  matriceNoeuds?: string[];
  matriceData?: number[][];
}

/* ------------------------------------------------------------------ */
/* Constantes de style                                                 */
/* ------------------------------------------------------------------ */

const COULEUR_PAR_TYPE_NOEUD: Record<TypeNoeudWorkflow, string> = {
  page: "#3b82f6",
  "sous-vue": "#059669",
  modal: "#8b5cf6",
  tiroir: "#10b981",
  etape: "#f59e0b",
  action: "#ef4444",
};

const FORME_LIBELLE: Record<TypeNoeudWorkflow, string> = {
  page: "Page",
  "sous-vue": "Sous-état UX",
  modal: "Modale",
  tiroir: "Tiroir",
  etape: "Étape (3 Actes)",
  action: "Action / Effet",
};

const GROUPES_CONFIG: Record<
  GroupeWorkflow,
  { libelle: string; couleur: string; x: number; y: number }
> = {
  dashboard: { libelle: "Dashboard & Pilotage", couleur: "#3b82f6", x: -200, y: -160 },
  atelier: { libelle: "Atelier Documentaire", couleur: "#059669", x: 260, y: -180 },
  seances: { libelle: "Cahier", couleur: "#8b5cf6", x: -260, y: 180 },
  exercice: { libelle: "Boucle Exercice", couleur: "#f59e0b", x: 220, y: 190 },
  tuteur: { libelle: "Compagnon Tuteur IA", couleur: "#06b6d4", x: -460, y: 0 },
  profil: { libelle: "Profil & Compte", couleur: "#64748b", x: 500, y: 0 },
};

const STYLE_LIEN: Record<
  TypeLienWorkflow,
  { libelle: string; pointille: number[]; epaisseur: number; couleur: string }
> = {
  navigation: { libelle: "Navigation", pointille: [], epaisseur: 1.8, couleur: "#3b82f6" },
  ouverture: { libelle: "Ouverture modale/tiroir", pointille: [8, 4], epaisseur: 1.4, couleur: "#8b5cf6" },
  transition: { libelle: "Transition d'état", pointille: [4, 4], epaisseur: 1.5, couleur: "#f59e0b" },
  interaction: { libelle: "Interaction / Geste", pointille: [2, 3], epaisseur: 1.6, couleur: "#059669" },
  soumission: { libelle: "Soumission action", pointille: [], epaisseur: 2.2, couleur: "#ef4444" },
  retour: { libelle: "Fermeture / Retour", pointille: [3, 5], epaisseur: 1.1, couleur: "#94a3b8" },
};

const RAYON_PAR_TYPE: Record<TypeNoeudWorkflow, number> = {
  page: 24,
  "sous-vue": 18,
  modal: 18,
  tiroir: 16,
  etape: 16,
  action: 12,
};

/** Espacement horizontal entre colonnes de profondeur BFS (Vue Architecture). */
const ESPACEMENT_X = 260;
const DECALAGE_Y_TYPE: Record<TypeNoeudWorkflow, number> = {
  page: 0,
  "sous-vue": 50,
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
  primaireFaible: "#eef6f1",
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
    primaireFaible: lire("--primaire-faible", REPLIS.primaireFaible),
  };
}

/* ------------------------------------------------------------------ */
/* Composant Principal                                                 */
/* ------------------------------------------------------------------ */

export function GrapheWorkflowViz(props: GrapheWorkflowVizProps) {
  const [perspective, setPerspective] = useState<PerspectiveWorkflow>("ux");

  // Sélection du jeu de données selon la perspective
  const donneesCourantes = useMemo<DonneesPerspectiveGraphe>(() => {
    if (perspective === "ux" && props.ux) return props.ux;
    if (perspective === "ux-atomique" && props.uxAtomique) return props.uxAtomique;
    if (perspective === "architecture" && props.architecture) return props.architecture;
    if (props.architecture) return props.architecture;
    if (props.ux) return props.ux;

    // Rétrocompatibilité directe
    return {
      noeuds: props.noeuds ?? [],
      liens: props.liens ?? [],
      inatteignables: props.inatteignables ?? [],
      profondeurs: props.profondeurs ?? {},
      stats: props.stats ?? {
        totalNoeuds: 0,
        totalLiens: 0,
        atteignables: 0,
        inatteignables: 0,
        puits: [],
        sources: [],
        diametreBFS: 0,
        degreSortantMoyen: 0,
        degreEntrantMoyen: 0,
      },
      dot: props.dot ?? "",
      jsonExport: props.jsonExport ?? ({} as ExportJSON),
      matriceNoeuds: props.matriceNoeuds ?? [],
      matriceData: props.matriceData ?? [],
    };
  }, [perspective, props]);

  const {
    noeuds,
    liens,
    profondeurs,
    stats,
    dot,
    jsonExport,
    matriceNoeuds,
    matriceData,
  } = donneesCourantes;

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
  const [afficherCadre, setAfficherCadre] = useState(false);

  // Filtres par type de nœuds
  const [typesNoeuds, setTypesNoeuds] = useState<Record<TypeNoeudWorkflow, boolean>>({
    page: true,
    "sous-vue": true,
    modal: true,
    tiroir: true,
    etape: true,
    action: true,
  });

  // Filtres par groupe UX
  const [groupesFiltres, setGroupesFiltres] = useState<Record<GroupeWorkflow, boolean>>({
    dashboard: true,
    atelier: true,
    seances: true,
    exercice: true,
    tuteur: true,
    profil: true,
  });

  // Filtres par type de liens
  const [typesLiens] = useState<Record<TypeLienWorkflow, boolean>>({
    navigation: true,
    ouverture: true,
    transition: true,
    interaction: true,
    soumission: true,
    retour: true,
  });

  /* ── Filtrage ── */

  const nombreLiensCadre = useMemo(() => {
    return liens.filter((l) => l.cadre).length;
  }, [liens]);

  const noeudsVisibles = useMemo(() => {
    return noeuds.filter((n) => {
      if (!typesNoeuds[n.type]) return false;
      if (perspective === "ux" && n.groupe && !groupesFiltres[n.groupe]) return false;
      return true;
    });
  }, [noeuds, typesNoeuds, groupesFiltres, perspective]);

  const idsVisibles = useMemo(
    () => new Set(noeudsVisibles.map((n) => n.id)),
    [noeudsVisibles],
  );

  const liensVisibles = useMemo(
    () =>
      liens.filter(
        (l) =>
          typesLiens[l.type] &&
          (afficherCadre || !l.cadre) &&
          idsVisibles.has(l.source) &&
          idsVisibles.has(l.target),
      ),
    [liens, typesLiens, afficherCadre, idsVisibles],
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

  /* ── Dessin Canvas ── */

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

    // Grille de points d'arrière-plan
    const pas = 32 * camera.zoom;
    if (pas >= 6) {
      const decalageX = ((largeur / 2 + camera.x * camera.zoom) % pas) - pas;
      const decalageY = ((hauteur / 2 + camera.y * camera.zoom) % pas) - pas;
      ctx.fillStyle = palette.bordure;
      for (let x = decalageX; x < largeur + pas; x += pas) {
        for (let y = decalageY; y < hauteur + pas; y += pas) {
          ctx.beginPath();
          ctx.arc(x, y, 0.85, 0, Math.PI * 2);
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

    // Liens — courbes quadratiques avec flèches
    for (const l of liensRef.current) {
      const source = l.source as NoeudSimule;
      const cible = l.target as NoeudSimule;
      if (source.x === undefined || cible.x === undefined) continue;

      const sId = typeof l.source === "string" ? l.source : l.source.id;
      const tId = typeof l.target === "string" ? l.target : l.target.id;
      const concerne = survol !== null && (sId === survol || tId === survol);
      const opacite = survol === null || concerne ? 0.75 : 0.08;

      const ax = largeur / 2 + (source.x! + camera.x) * camera.zoom;
      const ay = hauteur / 2 + (source.y! + camera.y) * camera.zoom;
      const bx = largeur / 2 + (cible.x! + camera.x) * camera.zoom;
      const by = hauteur / 2 + (cible.y! + camera.y) * camera.zoom;
      const style = STYLE_LIEN[l.type] ?? STYLE_LIEN.navigation;

      // Courbure pour éviter les chevauchements
      const dx = bx - ax;
      const dy = by - ay;
      const dist = Math.hypot(dx, dy);
      const courbure = dist > 220 ? 32 : dist > 110 ? 20 : 12;
      const cxPoint = (ax + bx) / 2 - (dy / (dist || 1)) * courbure;
      const cyPoint = (ay + by) / 2 + (dx / (dist || 1)) * courbure;

      ctx.save();
      ctx.globalAlpha = opacite;
      ctx.strokeStyle = style.couleur;
      ctx.lineWidth = style.epaisseur * camera.zoom;
      ctx.setLineDash(style.pointille.map((v) => v * camera.zoom));

      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.quadraticCurveTo(cxPoint, cyPoint, bx, by);
      ctx.stroke();

      // Flèche terminale orientée
      const tFleche = 0.96;
      const fxA = (1 - tFleche) * (1 - tFleche) * ax + 2 * (1 - tFleche) * tFleche * cxPoint + tFleche * tFleche * bx;
      const fyA = (1 - tFleche) * (1 - tFleche) * ay + 2 * (1 - tFleche) * tFleche * cyPoint + tFleche * tFleche * by;
      const angle = Math.atan2(by - fyA, bx - fxA);
      const rayonCible = cible.rayon * camera.zoom;
      const pointe = {
        x: bx - Math.cos(angle) * (rayonCible + 4),
        y: by - Math.sin(angle) * (rayonCible + 4),
      };
      const tailleFleche = 7.5 * camera.zoom;
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

      // Libellé de lien si concerné ou zoom élevé
      if (concerne && camera.zoom >= 0.5) {
        const texteLien = l.declencheur ? `${l.declencheur}` : l.libelle;
        ctx.font = `600 ${Math.max(9, 10 * camera.zoom)}px var(--police-texte, sans-serif)`;
        ctx.fillStyle = palette.texte;
        const mesure = ctx.measureText(texteLien);
        ctx.fillStyle = palette.surface;
        ctx.globalAlpha = 0.92;
        ctx.beginPath();
        ctx.roundRect(cxPoint - mesure.width / 2 - 3, cyPoint - 7, mesure.width + 6, 14, 3);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = style.couleur;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(texteLien, cxPoint, cyPoint);
      }

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
      const couleurBase = COULEUR_PAR_TYPE_NOEUD[n.type] ?? "#4a90d9";
      ctx.fillStyle = couleurBase;

      // Dessin géométrique par type
      ctx.beginPath();
      switch (n.type) {
        case "action":
          // Losange
          ctx.moveTo(px, py - rayon * 1.15);
          ctx.lineTo(px + rayon * 1.15, py);
          ctx.lineTo(px, py + rayon * 1.15);
          ctx.lineTo(px - rayon * 1.15, py);
          ctx.closePath();
          break;
        case "sous-vue":
          // Pilule arrondie
          ctx.roundRect(px - rayon * 1.1, py - rayon * 0.75, rayon * 2.2, rayon * 1.5, 8);
          break;
        case "modal":
          // Rect arrondi
          ctx.roundRect(px - rayon, py - rayon * 0.7, rayon * 2, rayon * 1.4, 4);
          break;
        case "tiroir":
          // Onglet rect
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

      // Anneau de contour pour les groupes en mode UX
      if (perspective !== "architecture" && n.groupe && GROUPES_CONFIG[n.groupe]) {
        ctx.lineWidth = 2 * camera.zoom;
        ctx.strokeStyle = GROUPES_CONFIG[n.groupe].couleur;
        ctx.stroke();
      }

      if (estSurvole || estSelectionne) {
        ctx.lineWidth = estSelectionne ? 3.5 : 2.5;
        ctx.strokeStyle = palette.texte;
        ctx.stroke();
      }
      ctx.restore();

      // Badge et Libellé
      const afficherLibelle = camera.zoom >= 0.55 || estSurvole || estVoisin;
      if (afficherLibelle && !estompe) {
        ctx.save();
        const fontSize = Math.max(10, 11 * Math.min(camera.zoom, 1.5));
        ctx.font = `600 ${fontSize}px var(--police-texte, sans-serif)`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";

        const texteBadge = n.badge ? `[${n.badge}] ` : "";
        const texteComplet = `${texteBadge}${n.libelle}`;
        const libelleTronque =
          texteComplet.length > 32 ? `${texteComplet.slice(0, 31)}…` : texteComplet;
        const mesure = ctx.measureText(libelleTronque);
        const padH = 5;
        const padV = 2.5;
        const lblY = py + rayon + 5;

        // Fond du texte
        ctx.fillStyle = palette.surface;
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.roundRect(
          px - mesure.width / 2 - padH,
          lblY - padV,
          mesure.width + padH * 2,
          fontSize + padV * 2 + 1,
          4,
        );
        ctx.fill();

        ctx.globalAlpha = 1;
        ctx.fillStyle = palette.texte;
        ctx.fillText(libelleTronque, px, lblY);
        ctx.restore();
      }
    }

    // Infobulle de survol
    if (survol) {
      const n = noeudsRef.current.find((x) => x.id === survol);
      if (n && n.x !== undefined && n.y !== undefined) {
        const px = largeur / 2 + (n.x + camera.x) * camera.zoom;
        const py = hauteur / 2 + (n.y + camera.y) * camera.zoom;

        const lignes: string[] = [
          n.badge ? `${n.badge} — ${n.libelle}` : n.libelle,
          `Type : ${FORME_LIBELLE[n.type]}`,
          ...(n.groupe ? [`Groupe : ${GROUPES_CONFIG[n.groupe]?.libelle ?? n.groupe}`] : []),
          ...(n.url ? [`URL : ${n.url}`] : []),
          ...(n.condition ? [`Condition : ${n.condition}`] : []),
          `Profondeur BFS : ${profondeurs[n.id] ?? "0"}`,
          ...(n.description ? [`« ${n.description} »`] : []),
        ];

        ctx.save();
        ctx.font = "11px var(--police-texte, sans-serif)";
        const largeurTexte = Math.min(
          380,
          Math.max(...lignes.map((l) => ctx.measureText(l).width)),
        );
        const pad = 9;
        const boiteX = px + 16;
        const boiteY = py - 10;
        const boiteL = largeurTexte + pad * 2;
        const boiteH = lignes.length * 16 + pad * 2 - 4;

        ctx.fillStyle = palette.surface2;
        ctx.strokeStyle = palette.bordure;
        ctx.lineWidth = 1;
        ctx.shadowColor = "rgba(0,0,0,0.12)";
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.roundRect(boiteX, boiteY, boiteL, boiteH, 6);
        ctx.fill();
        ctx.stroke();

        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        lignes.forEach((ligne, i) => {
          ctx.fillStyle =
            i === 0
              ? palette.texte
              : i === lignes.length - 1 && n.description
              ? palette.texteDiscret
              : palette.texteAttenue;
          ctx.font =
            i === 0
              ? "bold 11px var(--police-texte, sans-serif)"
              : i === lignes.length - 1 && n.description
              ? "italic 10px var(--police-texte, sans-serif)"
              : "11px var(--police-texte, sans-serif)";
          ctx.fillText(ligne, boiteX + pad, boiteY + pad + i * 16, largeurTexte);
        });
        ctx.restore();
      }
    }
  }, [selectionId, profondeurs, perspective]);

  const dessinerRef = useRef(dessiner);
  useEffect(() => {
    dessinerRef.current = dessiner;
  }, [dessiner]);

  /* ── Simulation d3-force ── */

  useEffect(() => {
    const reduitMouvement = mouvementReduit();

    const compteurParColonne = new Map<number, number>();
    const noeudsSimules: NoeudSimule[] = noeudsVisibles.map((n) => {
      const prof = profondeurs[n.id] ?? 0;
      const rang = compteurParColonne.get(prof) ?? 0;
      compteurParColonne.set(prof, rang + 1);

      // Calcul de position initiale
      let posX = prof * ESPACEMENT_X;
      let posY = DECALAGE_Y_TYPE[n.type] + rang * 65;

      if (perspective !== "architecture" && n.groupe && GROUPES_CONFIG[n.groupe]) {
        const cluster = GROUPES_CONFIG[n.groupe];
        posX = cluster.x + (rang % 3) * 60 - 60;
        posY = cluster.y + Math.floor(rang / 3) * 60 - 60;
      }

      return {
        ...n,
        rayon: RAYON_PAR_TYPE[n.type] ?? 16,
        x: posX,
        y: posY,
      };
    });

    const parId = new Map(noeudsSimules.map((n) => [n.id, n]));

    // Conserver les positions si existantes
    conserverPositions(noeudsRef.current, noeudsSimules);

    const liensSimules = liensRelies(liensVisibles, parId);

    noeudsRef.current = noeudsSimules;
    liensRef.current = liensSimules;

    simulationRef.current?.stop();
    const estModeUx = perspective !== "architecture";
    const sim = forceSimulation(noeudsSimules)
      .force("charge", forceManyBody<NoeudSimule>().strength(estModeUx ? -450 : -600))
      .force(
        "link",
        forceLink<NoeudSimule, LienSimule>(liensSimules)
          .id((n) => n.id)
          .distance(estModeUx ? 110 : 160)
          .strength(0.25),
      )
      .force("collide", forceCollide<NoeudSimule>((n) => n.rayon + 18));

    if (estModeUx) {
      // Clustering spatial par groupe UX
      sim.force(
        "x",
        forceX<NoeudSimule>((n) => (n.groupe ? GROUPES_CONFIG[n.groupe]?.x ?? 0 : 0)).strength(0.35),
      );
      sim.force(
        "y",
        forceY<NoeudSimule>((n) => (n.groupe ? GROUPES_CONFIG[n.groupe]?.y ?? 0 : 0)).strength(0.35),
      );
    } else {
      // Colonnes BFS de gauche à droite
      sim.force(
        "x",
        forceX<NoeudSimule>((n) => (profondeurs[n.id] ?? 0) * ESPACEMENT_X).strength(0.7),
      );
      sim.force("y", forceY<NoeudSimule>((n) => DECALAGE_Y_TYPE[n.type]).strength(0.06));
    }

    sim
      .force("center", forceCenter(0, 0).strength(0.01))
      .alphaDecay(0.035)
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
  }, [noeudsVisibles, liensVisibles, perspective, profondeurs]);

  /* ── Redimensionnement ── */

  useEffect(() => {
    const conteneur = conteneurRef.current;
    const canvas = canvasRef.current;
    if (!conteneur || !canvas) return;

    return observerTailleCanvas(conteneur, canvas, (taille) => {
      tailleRef.current = taille;
      dessinerRef.current();
    });
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

  /* ── Interactions souris & Gestes ── */

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
        dragRef.current.noeud.fx = (x - largeur / 2) / camera.zoom - camera.x;
        dragRef.current.noeud.fy = (y - hauteur / 2) / camera.zoom - camera.y;
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
        /* déjà libéré */
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

  /* ── Pressepapier & Exports ── */

  const copierTexte = useCallback(async (texte: string, nom: string) => {
    await navigator.clipboard.writeText(texte);
    setCopie(nom);
    setTimeout(() => setCopie(null), 1800);
  }, []);

  const { statsCourantes, dotCourant, jsonExportCourant, matriceFormatee } = useMemo(() => {
    const toutAffiche =
      afficherCadre &&
      Object.values(typesNoeuds).every(Boolean) &&
      (perspective !== "ux" || Object.values(groupesFiltres).every(Boolean));

    const titrePerspective =
      perspective === "architecture"
        ? "Architecture AST"
        : perspective === "ux-atomique"
          ? "Parcours UX Atomique"
          : "Parcours UX Synthèse";

    if (toutAffiche && stats.totalNoeuds > 0) {
      const max = Math.max(...matriceNoeuds.map((n) => n.length), 0);
      const en_tete =
        " ".repeat(max + 2) + matriceNoeuds.map((_, i) => String(i).padStart(2)).join(" ");
      const lignesMatrice = matriceData.map((row, i) => {
        const nom = matriceNoeuds[i].padEnd(max + 2);
        return nom + row.map((v) => String(v).padStart(2)).join(" ");
      });

      const enteteStats = [
        `/*`,
        `Métriques — ${titrePerspective}`,
        ``,
        `|V| nœuds`,
        `    ${stats.totalNoeuds}`,
        `|E| arêtes`,
        `    ${stats.totalLiens}`,
        `Atteignables`,
        `    ${stats.atteignables}`,
        `Inatteignables`,
        `    ${stats.inatteignables}`,
        `Diamètre BFS`,
        `    ${stats.diametreBFS}`,
        `Degré sortant moy.`,
        `    ${stats.degreSortantMoyen.toFixed(2)}`,
        ``,
        `${stats.puits.length} puits (fins de parcours) :`,
        ``,
        ...stats.puits.map((p) => `    • ${p}`),
        `*/`,
        ``,
      ].join("\n");

      return {
        statsCourantes: stats,
        dotCourant: dot,
        jsonExportCourant: jsonExport,
        matriceFormatee: [enteteStats, en_tete, ...lignesMatrice].join("\n"),
      };
    }

    const sousGraphe = { noeuds: noeudsVisibles, liens: liensVisibles };
    const racine = noeudsVisibles.some((n) => n.id === "page:/")
      ? "page:/"
      : (noeudsVisibles[0]?.id ?? "page:/");

    if (noeudsVisibles.length === 0) {
      return {
        statsCourantes: stats,
        dotCourant: "",
        jsonExportCourant: jsonExport,
        matriceFormatee: "",
      };
    }

    try {
      const resBfs = parcourirWorkflow(sousGraphe, racine);
      const st = statistiquesGraphe(resBfs, sousGraphe);
      const dt = exporterDOT(resBfs.noeuds, resBfs.liens, {
        titre: `${titrePerspective}${!afficherCadre ? " [Sans cadre]" : ""}`,
        stats: st,
        avecLibelles: true,
        avecLibellesAretes: true,
        avecConditions: true,
      });
      const js = exporterJSON(resBfs, sousGraphe);
      const mat = matriceAdjacence(resBfs.noeuds, resBfs.liens);

      const max = Math.max(...mat.noeuds.map((n) => n.length), 0);
      const en_tete =
        " ".repeat(max + 2) + mat.noeuds.map((_, i) => String(i).padStart(2)).join(" ");
      const lignesMatrice = mat.matrice.map((row, i) => {
        const nom = mat.noeuds[i].padEnd(max + 2);
        return nom + row.map((v) => String(v).padStart(2)).join(" ");
      });

      const enteteStats = [
        `/*`,
        `Métriques — ${titrePerspective} (${!afficherCadre ? "sans cadre" : "filtré"})`,
        ``,
        `|V| nœuds`,
        `    ${st.totalNoeuds}`,
        `|E| arêtes`,
        `    ${st.totalLiens}`,
        `Atteignables`,
        `    ${st.atteignables}`,
        `Inatteignables`,
        `    ${st.inatteignables}`,
        `Diamètre BFS`,
        `    ${st.diametreBFS}`,
        `Degré sortant moy.`,
        `    ${st.degreSortantMoyen.toFixed(2)}`,
        ``,
        `${st.puits.length} puits (fins de parcours) :`,
        ``,
        ...st.puits.map((p) => `    • ${p}`),
        `*/`,
        ``,
      ].join("\n");

      return {
        statsCourantes: st,
        dotCourant: dt,
        jsonExportCourant: js,
        matriceFormatee: [enteteStats, en_tete, ...lignesMatrice].join("\n"),
      };
    } catch {
      return {
        statsCourantes: stats,
        dotCourant: dot,
        jsonExportCourant: jsonExport,
        matriceFormatee: "",
      };
    }
  }, [
    afficherCadre,
    typesNoeuds,
    groupesFiltres,
    perspective,
    stats,
    dot,
    jsonExport,
    matriceNoeuds,
    matriceData,
    noeudsVisibles,
    liensVisibles,
  ]);

  const recentrerCamera = useCallback(() => {
    cameraRef.current = { x: 0, y: 0, zoom: 0.5 };
    dessinerRef.current();
  }, []);

  /* ── Rendu JSX ── */

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-surface">
      {/* Barre d'en-tête avec Sélecteur de Perspective */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-bordure px-4 bg-surface-2/60">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-texte-discret">
            Perspective :
          </span>
          <div className="inline-flex rounded-lg border border-bordure bg-surface p-0.5 shadow-sm">
            <button
              type="button"
              onClick={() => {
                setPerspective("ux");
                recentrerCamera();
              }}
              className={`flex items-center gap-2 rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                perspective === "ux"
                  ? "bg-primaire text-primaire-contraste shadow-sm"
                  : "text-texte-attenue hover:text-texte"
              }`}
            >
              <span>Parcours Synthèse</span>
              <span className="rounded-full bg-surface-2/40 px-1.5 py-0.2 text-[0.65rem] font-mono">
                {props.ux?.stats.totalNoeuds ?? "?"}
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setPerspective("ux-atomique");
                recentrerCamera();
              }}
              className={`flex items-center gap-2 rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                perspective === "ux-atomique"
                  ? "bg-primaire text-primaire-contraste shadow-sm"
                  : "text-texte-attenue hover:text-texte"
              }`}
            >
              <span>Parcours Atomique</span>
              <span className="rounded-full bg-surface-2/40 px-1.5 py-0.2 text-[0.65rem] font-mono">
                {props.uxAtomique?.stats.totalNoeuds ?? "?"}
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setPerspective("architecture");
                recentrerCamera();
              }}
              className={`flex items-center gap-2 rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                perspective === "architecture"
                  ? "bg-primaire text-primaire-contraste shadow-sm"
                  : "text-texte-attenue hover:text-texte"
              }`}
            >
              <span>Architecture Code (AST)</span>
              <span className="rounded-full bg-surface-2/40 px-1.5 py-0.2 text-[0.65rem] font-mono">
                {props.architecture?.stats.totalNoeuds ?? "?"}
              </span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-texte-attenue">
          <button
            type="button"
            onClick={() => setAfficherCadre((v) => !v)}
            className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
              afficherCadre
                ? "border-primaire bg-primaire-faible text-primaire"
                : "border-bordure bg-surface text-texte-attenue hover:bg-surface-2"
            }`}
            title="Afficher/masquer les arêtes transversales du cadre (rail, tuteur flottant, modale +)"
          >
            {afficherCadre ? "Cadre global inclus" : "Cadre global masqué"}
          </button>
          <button
            type="button"
            onClick={recentrerCamera}
            className="rounded-md border border-bordure bg-surface px-2.5 py-1 text-xs font-medium hover:bg-surface-2"
          >
            Recentrer (0,0)
          </button>
          <button
            type="button"
            onClick={() => setPanneauOuvert((o) => !o)}
            className="rounded-md border border-bordure bg-surface px-2.5 py-1 text-xs font-medium hover:bg-surface-2"
          >
            {panneauOuvert ? "Masquer le panneau" : "Afficher le panneau"}
          </button>
        </div>
      </header>

      {/* Zone Graphique Principale */}
      <div className="flex flex-1 overflow-hidden">
        {/* Canvas d3-force */}
        <div ref={conteneurRef} className="relative min-w-0 flex-1">
          <canvas
            ref={canvasRef}
            tabIndex={0}
            role="application"
            aria-label="Graphe du workflow — déplacer les nœuds, molette pour zoomer"
            className="block h-full w-full cursor-grab touch-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primaire"
          />

          {/* Légende flottante */}
          <div className="pointer-events-none absolute bottom-3 left-3 space-y-2 rounded-lg border border-bordure bg-surface/92 p-3 text-[0.6875rem] text-texte-attenue backdrop-blur-sm shadow-md">
            {perspective !== "architecture" && (
              <div>
                <div className="mb-1 text-[0.6rem] font-semibold uppercase tracking-wider text-texte-discret">
                  Sous-systèmes UX
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                  {(Object.keys(GROUPES_CONFIG) as GroupeWorkflow[]).map((g) => (
                    <div key={g} className="flex items-center gap-1.5">
                      <span
                        className="size-2.5 rounded-sm"
                        style={{ background: GROUPES_CONFIG[g].couleur }}
                      />
                      <span className="truncate">{GROUPES_CONFIG[g].libelle}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <div className="mb-1 text-[0.6rem] font-semibold uppercase tracking-wider text-texte-discret">
                Types de nœuds
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
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
              </div>
            </div>

            <div>
              <div className="mb-1 text-[0.6rem] font-semibold uppercase tracking-wider text-texte-discret">
                Types de liens
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {(Object.keys(STYLE_LIEN) as TypeLienWorkflow[])
                  .filter((t) => typesLiens[t])
                  .map((t) => (
                    <div key={t} className="flex items-center gap-1.5">
                      <span
                        className="inline-block h-0 w-3.5 border-t-2"
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
            </div>
          </div>
        </div>

        {/* Panneau latéral d'analyse & inspection */}
        {panneauOuvert && (
          <aside className="flex w-84 shrink-0 flex-col overflow-y-auto border-l border-bordure bg-surface-2 text-sm">
            {/* Métriques */}
            <section className="border-b border-bordure px-4 py-3">
              <h2 className="text-[0.65rem] font-semibold uppercase tracking-wider text-texte-discret">
                Métriques — {perspective === "architecture" ? "Architecture AST" : perspective === "ux-atomique" ? "Parcours UX Atomique" : "Parcours UX Synthèse"}
              </h2>
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                <dt className="text-texte-attenue">|V| nœuds</dt>
                <dd className="font-mono font-medium">{statsCourantes.totalNoeuds}</dd>
                <dt className="text-texte-attenue">|E| arêtes</dt>
                <dd className="font-mono font-medium">{statsCourantes.totalLiens}</dd>
                <dt className="text-texte-attenue">Atteignables</dt>
                <dd className="font-mono font-medium">{statsCourantes.atteignables}</dd>
                <dt className="text-texte-attenue">Inatteignables</dt>
                <dd className="font-mono font-medium">{statsCourantes.inatteignables}</dd>
                <dt className="text-texte-attenue">Diamètre BFS</dt>
                <dd className="font-mono font-medium">{statsCourantes.diametreBFS}</dd>
                <dt className="text-texte-attenue">Degré sortant moy.</dt>
                <dd className="font-mono font-medium">
                  {statsCourantes.degreSortantMoyen.toFixed(2)}
                </dd>
              </dl>

              {statsCourantes.puits.length > 0 && (
                <div className="mt-2">
                  <p className="text-[0.65rem] font-medium text-alerte">
                    {statsCourantes.puits.length} puits (fins de parcours) :
                  </p>
                  <ul className="mt-0.5 text-[0.65rem] text-texte-discret">
                    {statsCourantes.puits.map((id) => (
                      <li key={id} className="truncate">
                        • {id}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>

            {/* Détail du Nœud Sélectionné */}
            <section className="border-b border-bordure px-4 py-3">
              <h2 className="text-[0.65rem] font-semibold uppercase tracking-wider text-texte-discret">
                {noeudSelectionne
                  ? "Inspection du Nœud"
                  : "Cliquer un nœud pour inspecter ses triggers"}
              </h2>
              {noeudSelectionne ? (
                <div className="mt-2 space-y-2 text-xs">
                  <div>
                    <span className="text-texte-attenue">Libellé : </span>
                    <span className="font-semibold text-texte">
                      {noeudSelectionne.libelle}
                    </span>
                  </div>
                  <div>
                    <span className="text-texte-attenue">ID : </span>
                    <span className="font-mono text-[0.6875rem]">{noeudSelectionne.id}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <span
                      className="inline-block rounded-sm px-1.5 py-0.5 text-[0.65rem] font-medium text-white"
                      style={{
                        background:
                          COULEUR_PAR_TYPE_NOEUD[noeudSelectionne.type],
                      }}
                    >
                      {FORME_LIBELLE[noeudSelectionne.type]}
                    </span>
                    {noeudSelectionne.groupe && (
                      <span
                        className="inline-block rounded-sm px-1.5 py-0.5 text-[0.65rem] font-medium text-white"
                        style={{
                          background:
                            GROUPES_CONFIG[noeudSelectionne.groupe]?.couleur ?? "#64748b",
                        }}
                      >
                        {GROUPES_CONFIG[noeudSelectionne.groupe]?.libelle}
                      </span>
                    )}
                    {noeudSelectionne.badge && (
                      <span className="inline-block rounded-sm border border-bordure bg-surface px-1.5 py-0.5 text-[0.65rem] font-medium text-texte-attenue">
                        {noeudSelectionne.badge}
                      </span>
                    )}
                    {noeudSelectionne.heuristique && (
                      <span className="inline-block rounded-sm border border-dashed border-bordure px-1.5 py-0.5 text-[0.65rem] font-medium text-texte-discret">
                        heuristique
                      </span>
                    )}
                  </div>
                  {noeudSelectionne.description && (
                    <p className="rounded-md border border-bordure/60 bg-surface p-2 text-[0.6875rem] italic text-texte-attenue leading-relaxed">
                      « {noeudSelectionne.description} »
                    </p>
                  )}
                  {noeudSelectionne.url && (
                    <div>
                      <span className="text-texte-attenue">URL : </span>
                      <span className="font-mono text-primaire">{noeudSelectionne.url}</span>
                    </div>
                  )}

                  {/* Arêtes entrantes avec déclencheurs */}
                  {liensEntrants.length > 0 && (
                    <details className="mt-1" open>
                      <summary className="cursor-pointer font-medium text-texte-attenue hover:text-texte">
                        Transitions entrantes ({liensEntrants.length})
                      </summary>
                      <ul className="mt-1 space-y-1.5 pl-1 text-[0.65rem]">
                        {liensEntrants.map((l, i) => (
                          <li key={i} className="rounded border border-bordure/40 bg-surface p-1.5">
                            <div className="font-medium text-texte truncate">
                              ← {l.source}
                            </div>
                            <div className="text-texte-attenue">
                              Geste : <span className="font-medium">{l.libelle}</span>
                            </div>
                            {l.declencheur && (
                              <div className="text-primaire font-mono text-[0.625rem]">
                                {l.declencheur}
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}

                  {/* Arêtes sortantes avec déclencheurs */}
                  {liensSortants.length > 0 && (
                    <details className="mt-1" open>
                      <summary className="cursor-pointer font-medium text-texte-attenue hover:text-texte">
                        Transitions sortantes ({liensSortants.length})
                      </summary>
                      <ul className="mt-1 space-y-1.5 pl-1 text-[0.65rem]">
                        {liensSortants.map((l, i) => (
                          <li key={i} className="rounded border border-bordure/40 bg-surface p-1.5">
                            <div className="font-medium text-texte truncate">
                              → {l.target}
                            </div>
                            <div className="text-texte-attenue">
                              Action : <span className="font-medium">{l.libelle}</span>
                            </div>
                            {l.declencheur && (
                              <div className="text-primaire font-mono text-[0.625rem]">
                                {l.declencheur}
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}

                  <button
                    type="button"
                    onClick={() => setSelectionId(null)}
                    className="mt-2 w-full rounded border border-bordure bg-surface py-1 text-[0.65rem] text-texte-discret hover:text-texte"
                  >
                    Désélectionner
                  </button>
                </div>
              ) : (
                <p className="mt-2 text-xs text-texte-discret">
                  Sélectionnez un nœud dans le Canvas pour afficher ses triggers et liaisons.
                </p>
              )}
            </section>

            {/* Filtre Cadre Transversal & Navigation persistante */}
            <section className="border-b border-bordure px-4 py-3 bg-surface-2/40">
              <div className="flex items-center justify-between">
                <h2 className="text-[0.65rem] font-semibold uppercase tracking-wider text-texte-discret">
                  Cadre & Surfaces Globales
                </h2>
                <span className="rounded-full bg-surface px-1.5 py-0.5 text-[0.6rem] font-mono text-texte-attenue border border-bordure">
                  {nombreLiensCadre} arêtes
                </span>
              </div>
              <p className="mt-1 text-[0.6875rem] text-texte-attenue leading-tight">
                Rail desktop, barre mobile, bouton tuteur flottant et modale besoin (+).
              </p>
              <label className="mt-2.5 flex items-center gap-2.5 text-xs text-texte cursor-pointer font-medium select-none">
                <input
                  type="checkbox"
                  checked={afficherCadre}
                  onChange={(e) => setAfficherCadre(e.target.checked)}
                  className="size-3.5 rounded accent-primaire cursor-pointer"
                />
                <span>Afficher les arêtes du cadre</span>
              </label>
            </section>

            {/* Filtres par Sous-systèmes UX (si mode UX) */}
            {perspective === "ux" && (
              <section className="border-b border-bordure px-4 py-3">
                <h2 className="text-[0.65rem] font-semibold uppercase tracking-wider text-texte-discret">
                  Filtres — Sous-systèmes UX
                </h2>
                <div className="mt-2 space-y-1.5">
                  {(Object.keys(GROUPES_CONFIG) as GroupeWorkflow[]).map((g) => (
                    <label
                      key={g}
                      className="flex items-center gap-2 text-xs text-texte-attenue cursor-pointer hover:text-texte"
                    >
                      <input
                        type="checkbox"
                        checked={groupesFiltres[g]}
                        onChange={(e) =>
                          setGroupesFiltres((prev) => ({
                            ...prev,
                            [g]: e.target.checked,
                          }))
                        }
                        className="accent-primaire"
                      />
                      <span
                        className="size-2.5 rounded-sm"
                        style={{ background: GROUPES_CONFIG[g].couleur }}
                      />
                      <span>{GROUPES_CONFIG[g].libelle}</span>
                    </label>
                  ))}
                </div>
              </section>
            )}

            {/* Filtres par Types */}
            <section className="border-b border-bordure px-4 py-3">
              <h2 className="text-[0.65rem] font-semibold uppercase tracking-wider text-texte-discret">
                Filtres — Types de nœuds
              </h2>
              <div className="mt-2 space-y-1">
                {(Object.keys(COULEUR_PAR_TYPE_NOEUD) as TypeNoeudWorkflow[]).map(
                  (t) => (
                    <label
                      key={t}
                      className="flex items-center gap-2 text-xs text-texte-attenue cursor-pointer hover:text-texte"
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
            </section>

            {/* Exports Formels */}
            <section className="px-4 py-3">
              <h2 className="text-[0.65rem] font-semibold uppercase tracking-wider text-texte-discret">
                Export formel ({perspective === "ux" ? "UX Journey" : "AST Code"})
              </h2>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <BoutonCopie
                  onClick={() => copierTexte(dotCourant, "DOT")}
                  actif={copie === "DOT"}
                >
                  DOT (Graphviz)
                </BoutonCopie>
                <BoutonCopie
                  onClick={() =>
                    copierTexte(JSON.stringify(jsonExportCourant, null, 2), "JSON")
                  }
                  actif={copie === "JSON"}
                >
                  JSON
                </BoutonCopie>
                <BoutonCopie
                  onClick={() => copierTexte(matriceFormatee, "Matrice")}
                  actif={copie === "Matrice"}
                >
                  Matrice
                </BoutonCopie>
              </div>
              {copie && (
                <p className="mt-1.5 text-[0.65rem] text-succes">
                  {copie} copié dans le presse-papier
                </p>
              )}
            </section>
          </aside>
        )}
      </div>
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
