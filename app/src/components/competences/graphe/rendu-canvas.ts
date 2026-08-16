/**
 * Dessin Canvas 2D — fonctions pures, aucun état React.
 *
 * Corrige les défauts de rendu de la version précédente :
 *
 *  - `ctx.fillStyle = "var(--texte)"` ne fonctionne pas : Canvas 2D ne
 *    résout pas les variables CSS, l'affectation était silencieusement
 *    ignorée et tous les libellés héritaient de la couleur précédente. Ici,
 *    `resoudrePalette()` lit les variables une seule fois via
 *    `getComputedStyle`, à charge de l'appelant de la relire au changement
 *    de thème (clair/sombre) — la version précédente était calibrée
 *    uniquement pour le sombre alors que le thème par défaut du projet est
 *    clair.
 *  - la légende annonçait les liens `semantic` en pointillé et les liens
 *    `inter-domaine` en trait plein — inversé par rapport au dessin réel.
 *    Ici, un seul point de vérité (`STYLE_PAR_TYPE_LIEN`) pilote à la fois
 *    le dessin et la légende.
 */

import type { NoeudGraphe, TypeLien } from "@/lib/domain/graphe";
import { couleurDomaine } from "@/lib/ui/couleurs-domaines";
import type { AxeCouleur } from "./reglages-graphe";
import type { LienSimule, NoeudSimule } from "./moteur-force";

export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

export interface Palette {
  texte: string;
  texteAttenue: string;
  texteDiscret: string;
  surface: string;
  surface2: string;
  bordure: string;
  primaire: string;
  succes: string;
  alerte: string;
}

const REPLIS: Palette = {
  texte: "#1a1814",
  texteAttenue: "#6b6355",
  texteDiscret: "#8f8a7a",
  surface: "#ffffff",
  surface2: "#f5f3ee",
  bordure: "#ddd7c9",
  primaire: "#2f6f4f",
  succes: "#2f6f4f",
  alerte: "#b3492c",
};

/** Lit les variables CSS une fois — à rappeler au changement de thème. */
export function resoudrePalette(): Palette {
  if (typeof window === "undefined") return REPLIS;
  const style = getComputedStyle(document.documentElement);
  const lire = (nom: string, repli: string) => style.getPropertyValue(nom).trim() || repli;
  return {
    texte: lire("--texte", REPLIS.texte),
    texteAttenue: lire("--texte-attenue", REPLIS.texteAttenue),
    texteDiscret: lire("--texte-discret", REPLIS.texteDiscret),
    surface: lire("--surface", REPLIS.surface),
    surface2: lire("--surface-2", REPLIS.surface2),
    bordure: lire("--bordure", REPLIS.bordure),
    primaire: lire("--primaire", REPLIS.primaire),
    succes: lire("--succes", REPLIS.succes),
    alerte: lire("--alerte", REPLIS.alerte),
  };
}

/* ------------------------------------------------------------------ */
/* Style des liens — UN SEUL point de vérité, dessin ET légende         */
/* ------------------------------------------------------------------ */

export const STYLE_PAR_TYPE_LIEN: Record<
  TypeLien,
  { libelle: string; pointille: boolean; fleche: boolean }
> = {
  prerequis: { libelle: "Prérequis déclaré", pointille: false, fleche: true },
  theme: { libelle: "Même thème", pointille: false, fleche: false },
  exercice: { libelle: "Ciblées par le même exercice", pointille: false, fleche: false },
  similarite: { libelle: "Proximité de vocabulaire", pointille: true, fleche: false },
  document: { libelle: "Lien Markdown", pointille: false, fleche: true },
};

function couleurLien(type: TypeLien, palette: Palette): string {
  switch (type) {
    case "prerequis":
      return palette.primaire;
    case "theme":
      return palette.succes;
    case "exercice":
      return palette.texteDiscret;
    case "similarite":
      return palette.alerte;
    case "document":
      return palette.primaire;
  }
}

/* ------------------------------------------------------------------ */
/* Couleur des nœuds — axe réglable                                    */
/* ------------------------------------------------------------------ */

export interface ContexteCouleur {
  indexDomaine: Map<string, number>;
  totalDomaines: number;
  /** Ids de compétence reliées à au moins un exercice (lien type "exercice"). */
  competencesCouvertes: Set<string>;
}

function niveauDeEtiquettes(n: NoeudGraphe): number | null {
  const tag = n.etiquettes.find((e) => e.startsWith("niveau:"));
  if (!tag) return null;
  const valeur = tag.slice("niveau:".length);
  if (valeur === "aucune-preuve") return null;
  const n2 = Number(valeur);
  return Number.isFinite(n2) ? n2 : null;
}

/** Rouge (faible) → vert (maîtrisé), gris si aucune preuve. */
function couleurMaitrise(niveau: number | null, palette: Palette): string {
  if (niveau === null) return palette.texteDiscret;
  const t = niveau / 5;
  const hue = t * 120; // 0 = rouge, 120 = vert
  return `hsl(${hue}, 55%, 45%)`;
}

export function couleurNoeud(
  n: NoeudGraphe,
  axe: AxeCouleur,
  ctx: ContexteCouleur,
  palette: Palette,
): string {
  if (n.type === "theme") return palette.succes;
  if (n.type === "exercice") return palette.texteDiscret;
  if (n.type === "document") return palette.primaire;

  switch (axe) {
    case "palier": {
      const palier = n.etiquettes.find((e) => e.startsWith("palier:"))?.slice(7) ?? "";
      const ordre = { fondamentaux: 0, intermediaire: 1, avance: 2 }[palier] ?? 0;
      return couleurDomaine(ordre, 3);
    }
    case "maitrise":
      return couleurMaitrise(niveauDeEtiquettes(n), palette);
    case "couverture":
      return ctx.competencesCouvertes.has(n.id) ? palette.succes : palette.alerte;
    case "domaine":
    default: {
      if (!n.domaineId) return palette.texteDiscret;
      const idx = ctx.indexDomaine.get(n.domaineId) ?? 0;
      return couleurDomaine(idx, ctx.totalDomaines);
    }
  }
}

/* Dessin                                                              */
/* ------------------------------------------------------------------ */

export function dessinerFond(
  ctx: CanvasRenderingContext2D,
  largeur: number,
  hauteur: number,
  camera: Camera,
  palette: Palette,
): void {
  ctx.fillStyle = palette.surface;
  ctx.fillRect(0, 0, largeur, hauteur);

  const pas = 32 * camera.zoom;
  if (pas < 6) return; // zoom arrière : la grille ne fait plus que du bruit
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

function projeter(n: NoeudSimule, largeur: number, hauteur: number, camera: Camera) {
  return {
    x: largeur / 2 + (n.x! + camera.x) * camera.zoom,
    y: hauteur / 2 + (n.y! + camera.y) * camera.zoom,
  };
}

export function dessinerLien(
  ctx: CanvasRenderingContext2D,
  lien: LienSimule,
  largeur: number,
  hauteur: number,
  camera: Camera,
  palette: Palette,
  opacite: number,
): void {
  const source = lien.source as NoeudSimule;
  const cible = lien.target as NoeudSimule;
  if (source.x === undefined || cible.x === undefined) return;
  const a = projeter(source, largeur, hauteur, camera);
  const b = projeter(cible, largeur, hauteur, camera);
  const style = STYLE_PAR_TYPE_LIEN[lien.type];

  ctx.save();
  ctx.globalAlpha = opacite * (0.25 + lien.poids * 0.55);
  ctx.strokeStyle = couleurLien(lien.type, palette);
  ctx.lineWidth = Math.max(0.6, lien.poids * 1.6) * camera.zoom;
  if (style.pointille) ctx.setLineDash([4 * camera.zoom, 3 * camera.zoom]);
  else ctx.setLineDash([]);

  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();

  if (style.fleche) {
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    const rayonCible = cible.rayon * camera.zoom;
    const pointe = {
      x: b.x - Math.cos(angle) * (rayonCible + 2),
      y: b.y - Math.sin(angle) * (rayonCible + 2),
    };
    const taille = 5 * camera.zoom;
    ctx.setLineDash([]);
    ctx.fillStyle = couleurLien(lien.type, palette);
    ctx.beginPath();
    ctx.moveTo(pointe.x, pointe.y);
    ctx.lineTo(
      pointe.x - taille * Math.cos(angle - Math.PI / 6),
      pointe.y - taille * Math.sin(angle - Math.PI / 6),
    );
    ctx.lineTo(
      pointe.x - taille * Math.cos(angle + Math.PI / 6),
      pointe.y - taille * Math.sin(angle + Math.PI / 6),
    );
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

export function dessinerNoeud(
  ctx: CanvasRenderingContext2D,
  n: NoeudSimule,
  largeur: number,
  hauteur: number,
  camera: Camera,
  couleur: string,
  palette: Palette,
  options: {
    survole: boolean;
    selectionne: boolean;
    estompe: boolean;
    afficherLibelle: boolean;
  },
): void {
  if (n.x === undefined || n.y === undefined) return;
  const { x, y } = projeter(n, largeur, hauteur, camera);
  const rayonMinimum = n.type === "theme" ? 7 : n.type === "competence" ? 5 : 4;
  const rayon = Math.max(rayonMinimum, n.rayon * camera.zoom) * (options.survole ? 1.15 : 1);

  ctx.save();
  ctx.globalAlpha = options.estompe ? 0.18 : 1;

  ctx.beginPath();
  if (n.type === "exercice") {
    // Losange — distinct des disques compétence/thème.
    ctx.moveTo(x, y - rayon);
    ctx.lineTo(x + rayon, y);
    ctx.lineTo(x, y + rayon);
    ctx.lineTo(x - rayon, y);
    ctx.closePath();
  } else {
    ctx.arc(x, y, rayon, 0, Math.PI * 2);
  }
  ctx.fillStyle = couleur;
  ctx.fill();

  if (options.selectionne || options.survole) {
    ctx.lineWidth = options.selectionne ? 2.5 : 1.5;
    ctx.strokeStyle = palette.texte;
    ctx.stroke();
  }
  ctx.restore();

  if (options.afficherLibelle && !options.estompe) {
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.fillStyle = palette.texte;
    ctx.font = `${Math.max(12, 12 * Math.min(camera.zoom, 1.4))}px var(--police-texte, sans-serif)`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const libelle = n.libelle.length > 28 ? `${n.libelle.slice(0, 27)}…` : n.libelle;
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    ctx.strokeStyle = palette.surface;
    ctx.strokeText(libelle, x, y + rayon + 4);
    ctx.fillText(libelle, x, y + rayon + 3);
    ctx.restore();
  }
}

export function dessinerTooltip(
  ctx: CanvasRenderingContext2D,
  n: NoeudSimule,
  largeur: number,
  hauteur: number,
  camera: Camera,
  palette: Palette,
): void {
  if (n.x === undefined || n.y === undefined) return;
  const { x, y } = projeter(n, largeur, hauteur, camera);
  const lignes = [n.libelle, ...n.etiquettes.slice(0, 3)];
  ctx.save();
  ctx.font = "12px var(--police-texte, sans-serif)";
  const largeurTexte = Math.max(...lignes.map((l) => ctx.measureText(l).width));
  const pad = 8;
  const boiteX = x + 12;
  const boiteY = y - 10;
  const boiteL = largeurTexte + pad * 2;
  const boiteH = lignes.length * 17 + pad * 2 - 4;

  ctx.fillStyle = palette.surface2;
  ctx.strokeStyle = palette.bordure;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(boiteX, boiteY, boiteL, boiteH, 6);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = palette.texte;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  lignes.forEach((ligne, i) => {
    ctx.fillStyle = i === 0 ? palette.texte : palette.texteAttenue;
    ctx.fillText(ligne, boiteX + pad, boiteY + pad + i * 17);
  });
  ctx.restore();
}

/**
 * Dessine un halo discret et l'étiquette de domaine autour de chaque cluster de compétences.
 */
export function dessinerGroupementsDomaines(
  ctx: CanvasRenderingContext2D,
  noeuds: NoeudSimule[],
  largeur: number,
  hauteur: number,
  camera: Camera,
  palette: Palette,
  ctxCouleur: ContexteCouleur,
  axeCouleur: AxeCouleur,
): void {
  if (axeCouleur !== "domaine") return;

  const parDomaine = new Map<string, NoeudSimule[]>();
  for (const n of noeuds) {
    if (n.domaineId && n.x !== undefined && n.y !== undefined) {
      const liste = parDomaine.get(n.domaineId) ?? [];
      liste.push(n);
      parDomaine.set(n.domaineId, liste);
    }
  }

  ctx.save();
  for (const [domaineId, groupe] of parDomaine.entries()) {
    if (groupe.length === 0) continue;

    let sommeX = 0;
    let sommeY = 0;
    for (const n of groupe) {
      sommeX += n.x!;
      sommeY += n.y!;
    }
    const baryX = sommeX / groupe.length;
    const baryY = sommeY / groupe.length;

    let maxDistCarre = 0;
    for (const n of groupe) {
      const dx = n.x! - baryX;
      const dy = n.y! - baryY;
      const distCarre = dx * dx + dy * dy;
      if (distCarre > maxDistCarre) maxDistCarre = distCarre;
    }

    const { x, y } = projeter({ x: baryX, y: baryY, rayon: 0 } as NoeudSimule, largeur, hauteur, camera);
    const rayonEnglobant = Math.max(38, (Math.sqrt(maxDistCarre) + 24) * camera.zoom);

    const idx = ctxCouleur.indexDomaine.get(domaineId) ?? 0;
    const couleur = couleurDomaine(idx, ctxCouleur.totalDomaines);

    // Halo d'arrière-plan
    ctx.beginPath();
    ctx.arc(x, y, rayonEnglobant, 0, Math.PI * 2);
    ctx.fillStyle = couleur;
    ctx.globalAlpha = 0.045;
    ctx.fill();

    ctx.strokeStyle = couleur;
    ctx.globalAlpha = 0.2;
    ctx.lineWidth = 1;
    ctx.setLineDash([4 * camera.zoom, 4 * camera.zoom]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Nom du domaine au-dessus du groupe
    if (camera.zoom > 0.35) {
      const premierNoeud = groupe[0];
      const nomDomaine =
        premierNoeud.etiquettes.find((e) => e.startsWith("domaine:"))?.slice(8) ?? domaineId;
      ctx.font = `600 ${Math.max(10, Math.min(13, 11 * camera.zoom))}px var(--police-texte, sans-serif)`;
      ctx.fillStyle = palette.texteAttenue;
      ctx.globalAlpha = Math.min(0.85, Math.max(0.3, camera.zoom * 0.9));
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(nomDomaine, x, y - rayonEnglobant - 4);
    }
  }
  ctx.restore();
}
