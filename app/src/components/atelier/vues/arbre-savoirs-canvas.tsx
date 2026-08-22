"use client";

/**
 * L'arbre des savoirs — un canevas, trois profondeurs.
 *
 * Régions de la carte, domaines du compte, compétences : le même arbre, qu'on
 * traverse au zoom plutôt qu'en changeant d'écran. Les libellés apparaissent
 * par palier (`SEUILS_LIBELLES`), ce qui fait que dézoomer donne la carte des
 * grands ensembles et zoomer donne le détail, sans qu'aucun bouton ne le
 * commande.
 *
 * ## Pourquoi une simulation à part
 *
 * `competences/graphe/moteur-force.ts` regroupe des nœuds par domaine autour de
 * centres polaires : c'est un graphe à plat, teinté. Ici la structure est une
 * **contenance** à trois étages, et chaque étage a son rayon de repos. Plier le
 * moteur existant à cette contrainte l'aurait rendu illisible pour les deux
 * usages ; la mécanique d3 partagée se réduit de toute façon à quelques appels.
 *
 * ## Le placement initial ne tire pas au sort
 *
 * `Math.random()` ferait de chaque chargement une image différente, donc rien
 * ne serait comparable d'une fois sur l'autre. Les positions de départ sont
 * dérivées de l'index du nœud dans un ordre déjà stable
 * (`construireArbreSavoirs` trie ses sorties). Deux ouvertures donnent le même
 * arbre.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceRadial,
  forceSimulation,
  type Simulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";
import type {
  ArbreSavoirs,
  LienArbreSavoirs,
  NiveauArbre,
  NoeudArbreSavoirs,
} from "@/lib/domain/arbre-savoirs";
import { resoudrePalette, type Palette } from "@/components/competences/graphe/rendu-canvas";
import { cx } from "@/components/ui/primitives";

interface NoeudSimule extends NoeudArbreSavoirs, SimulationNodeDatum {
  rayon: number;
}
interface LienSimule extends Omit<LienArbreSavoirs, "source" | "target">, SimulationLinkDatum<NoeudSimule> {
  source: string | NoeudSimule;
  target: string | NoeudSimule;
}

/**
 * Rayon de repos de chaque étage, en unités de simulation.
 *
 * Les régions ne sont PAS à zéro : `forceRadial(0)` les empilerait toutes au
 * centre, où seule la collision les séparerait, au hasard. Un petit anneau les
 * répartit et laisse la hiérarchie se lire de l'intérieur vers l'extérieur.
 */
const RAYON_PAR_NIVEAU: Record<NiveauArbre, number> = {
  region: 95,
  domaine: 250,
  competence: 450,
};

/** Taille de base d'un nœud, avant la part du poids. */
const TAILLE_PAR_NIVEAU: Record<NiveauArbre, number> = {
  region: 16,
  domaine: 11,
  competence: 5,
};

/** À partir de quel zoom un étage écrit son nom. C'est ça, les trois zooms. */
const SEUILS_LIBELLES: Record<NiveauArbre, number> = {
  region: 0,
  domaine: 0.55,
  competence: 1.15,
};

const ZOOM_MIN = 0.25;
const ZOOM_MAX = 3.5;

function rayon(noeud: NoeudArbreSavoirs): number {
  // Racine carrée : un poids quadruple donne une aire quadruple, pas un rayon
  // quadruple — sinon les gros nœuds écrasent tout à l'œil.
  return TAILLE_PAR_NIVEAU[noeud.niveau] + Math.sqrt(noeud.poids) * 1.8;
}

export function ArbreSavoirsCanvas({
  arbre,
  couleursDomaines,
  ouvrirElement,
}: {
  arbre: ArbreSavoirs;
  /** Teinte par domaine, partagée avec le reste de l'Atelier. */
  couleursDomaines: Record<string, string>;
  ouvrirElement: (id: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const conteneurRef = useRef<HTMLDivElement | null>(null);
  const noeudsRef = useRef<NoeudSimule[]>([]);
  const liensRef = useRef<LienSimule[]>([]);
  const simulationRef = useRef<Simulation<NoeudSimule, LienSimule> | null>(null);
  const cameraRef = useRef({ x: 0, y: 0, zoom: 0.7 });
  const [survol, setSurvol] = useState<NoeudSimule | null>(null);
  const [zoomAffiche, setZoomAffiche] = useState(0.7);

  const palette = useMemo<Palette>(() => resoudrePalette(), []);

  const couleurNoeud = useCallback(
    (noeud: NoeudArbreSavoirs): string => {
      if (noeud.etat === "fantome") return palette.texteDiscret;
      if (noeud.niveau === "region") return palette.texteAttenue;
      return (noeud.domaineId && couleursDomaines[noeud.domaineId]) || palette.primaire;
    },
    [couleursDomaines, palette],
  );

  /* ── Simulation ──────────────────────────────────────────────────── */

  useEffect(() => {
    const noeuds: NoeudSimule[] = arbre.noeuds.map((noeud, index) => {
      /*
       * Départ déterministe : un angle dérivé de l'index, sur le cercle de son
       * étage. Le nombre d'or évite que les nœuds voisins partent collés.
       */
      const angle = index * 2.399963;
      const distance = RAYON_PAR_NIVEAU[noeud.niveau] || 40;
      return {
        ...noeud,
        rayon: rayon(noeud),
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance,
      };
    });
    const presents = new Set(noeuds.map((noeud) => noeud.id));
    const liens: LienSimule[] = arbre.liens
      .filter((lien) => presents.has(lien.source) && presents.has(lien.target))
      .map((lien) => ({ ...lien }));

    noeudsRef.current = noeuds;
    liensRef.current = liens;

    const simulation = forceSimulation(noeuds)
      .force("charge", forceManyBody<NoeudSimule>().strength((n) => -30 - n.rayon * 4))
      .force(
        "lien",
        forceLink<NoeudSimule, LienSimule>(liens)
          .id((n) => n.id)
          /* Une contenance tient court et ferme ; un prérequis tire de loin. */
          .distance((l) => (l.type === "contient" ? 60 : 150))
          .strength((l) => (l.type === "contient" ? 0.9 : 0.12)),
      )
      .force("collision", forceCollide<NoeudSimule>((n) => n.rayon + 6))
      /* Chaque étage sur son anneau : c'est ce qui fait lire la hiérarchie. */
      .force(
        "anneau",
        forceRadial<NoeudSimule>((n) => RAYON_PAR_NIVEAU[n.niveau]).strength((n) =>
          n.niveau === "region" ? 0.6 : 0.35,
        ),
      )
      .alpha(1)
      .alphaDecay(0.02);

    simulationRef.current = simulation;
    return () => {
      simulation.stop();
    };
  }, [arbre]);

  /* ── Rendu ───────────────────────────────────────────────────────── */

  const dessiner = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const largeur = canvas.width / (window.devicePixelRatio || 1);
    const hauteur = canvas.height / (window.devicePixelRatio || 1);
    const camera = cameraRef.current;

    ctx.save();
    ctx.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);
    ctx.clearRect(0, 0, largeur, hauteur);

    const projeter = (x: number, y: number) => ({
      x: (x + camera.x) * camera.zoom + largeur / 2,
      y: (y + camera.y) * camera.zoom + hauteur / 2,
    });

    /* Le voisinage déclaré du nœud survolé — jamais un voisinage deviné. */
    const voisins = new Set<string>();
    if (survol) {
      voisins.add(survol.id);
      for (const lien of liensRef.current) {
        const s = typeof lien.source === "string" ? lien.source : lien.source.id;
        const t = typeof lien.target === "string" ? lien.target : lien.target.id;
        if (s === survol.id) voisins.add(t);
        if (t === survol.id) voisins.add(s);
      }
    }

    // ── Arêtes ──
    for (const lien of liensRef.current) {
      const source = lien.source as NoeudSimule;
      const cible = lien.target as NoeudSimule;
      if (typeof source === "string" || typeof cible === "string") continue;
      if (source.x === undefined || cible.x === undefined) continue;

      const a = projeter(source.x, source.y ?? 0);
      const b = projeter(cible.x!, cible.y ?? 0);
      const eclaire = !survol || voisins.has(source.id) || voisins.has(cible.id);

      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = lien.type === "prerequis" ? palette.primaire : palette.bordure;
      ctx.globalAlpha = eclaire ? (lien.type === "prerequis" ? 0.55 : 0.35) : 0.07;
      ctx.lineWidth = lien.type === "prerequis" ? 1.4 : 1;
      ctx.setLineDash(lien.fantome ? [4, 4] : []);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // ── Nœuds ──
    for (const noeud of noeudsRef.current) {
      if (noeud.x === undefined || noeud.y === undefined) continue;
      const p = projeter(noeud.x, noeud.y);
      const r = Math.max(1.5, noeud.rayon * camera.zoom);
      const eclaire = !survol || voisins.has(noeud.id);
      const couleur = couleurNoeud(noeud);

      ctx.globalAlpha = eclaire ? 1 : 0.15;

      // Un halo pour ce qui a été travaillé récemment.
      if (noeud.actif) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, r + 5, 0, Math.PI * 2);
        ctx.fillStyle = couleur;
        ctx.globalAlpha = eclaire ? 0.16 : 0.05;
        ctx.fill();
        ctx.globalAlpha = eclaire ? 1 : 0.15;
      }

      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);

      if (noeud.etat === "fantome" || noeud.etat === "ouverte") {
        /* Creux : rien n'a encore été démontré là. Le dire par le remplissage
           plutôt que par une couleur de plus. */
        ctx.fillStyle = palette.surface;
        ctx.fill();
        ctx.strokeStyle = couleur;
        ctx.lineWidth = 1.5;
        ctx.setLineDash(noeud.etat === "fantome" ? [3, 3] : []);
        ctx.stroke();
        ctx.setLineDash([]);
      } else {
        ctx.fillStyle = couleur;
        ctx.fill();
      }

      // Anneau de maîtrise : plein, net, sans introduire de teinte nouvelle.
      if (noeud.etat === "maitrisee") {
        ctx.beginPath();
        ctx.arc(p.x, p.y, r + 3, 0, Math.PI * 2);
        ctx.strokeStyle = palette.succes;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // ── Libellés, par palier de zoom ──
      const seuil = SEUILS_LIBELLES[noeud.niveau];
      if (camera.zoom >= seuil || (survol && voisins.has(noeud.id))) {
        const taille =
          noeud.niveau === "region" ? 14 : noeud.niveau === "domaine" ? 12 : 10.5;
        ctx.font = `${noeud.niveau === "competence" ? 500 : 600} ${taille}px var(--police-texte, sans-serif)`;
        ctx.fillStyle =
          noeud.niveau === "competence" ? palette.texteAttenue : palette.texte;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.globalAlpha = eclaire ? 1 : 0.12;
        ctx.fillText(noeud.libelle, p.x, p.y + r + 4);
      }
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }, [couleurNoeud, palette, survol]);

  /*
   * Le dessin courant, lu par les ecouteurs natifs et par la simulation.
   *
   * Sans ce relais, `simulation.on("tick")` figerait la premiere version de
   * `dessiner` -- celle qui ne connait pas encore le survol -- et le canevas
   * cesserait de reagir au deuxieme rendu.
   */
  const dessinerRef = useRef(dessiner);
  useEffect(() => {
    dessinerRef.current = dessiner;
    dessiner();
  }, [dessiner]);

  /*
   * On dessine quand quelque chose bouge, pas soixante fois par seconde.
   * Une boucle `requestAnimationFrame` permanente occupait un coeur meme sur
   * un arbre immobile.
   */
  useEffect(() => {
    const simulation = simulationRef.current;
    if (!simulation) return;
    simulation.on("tick", () => dessinerRef.current());
    return () => {
      simulation.on("tick", null);
    };
  }, [arbre]);

  /* ── Dimensions ──────────────────────────────────────────────────── */

  useEffect(() => {
    const conteneur = conteneurRef.current;
    const canvas = canvasRef.current;
    if (!conteneur || !canvas) return;

    const redimensionner = () => {
      const ratio = window.devicePixelRatio || 1;
      const rect = conteneur.getBoundingClientRect();
      canvas.width = rect.width * ratio;
      canvas.height = rect.height * ratio;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
    };
    redimensionner();

    if (typeof ResizeObserver === "undefined") return;
    const observateur = new ResizeObserver(redimensionner);
    observateur.observe(conteneur);
    return () => observateur.disconnect();
  }, []);

  /* ── Interactions ────────────────────────────────────────────────── */

  const noeudSous = useCallback((clientX: number, clientY: number): NoeudSimule | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const camera = cameraRef.current;
    const x = (clientX - rect.left - rect.width / 2) / camera.zoom - camera.x;
    const y = (clientY - rect.top - rect.height / 2) / camera.zoom - camera.y;

    let trouve: NoeudSimule | null = null;
    let meilleur = Infinity;
    for (const noeud of noeudsRef.current) {
      if (noeud.x === undefined || noeud.y === undefined) continue;
      const dx = noeud.x - x;
      const dy = noeud.y - y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const portee = noeud.rayon + 6 / camera.zoom;
      if (distance <= portee && distance < meilleur) {
        meilleur = distance;
        trouve = noeud;
      }
    }
    return trouve;
  }, []);

  const glissementRef = useRef<{ x: number; y: number } | null>(null);

  /*
   * `wheel` en ecouteur NATIF et non passif.
   *
   * React attache `onWheel` en passif : `preventDefault()` n'y a aucun effet,
   * et la page defile pendant qu'on croit zoomer. Le graphe des competences
   * porte deja la meme correction, pour la meme raison.
   *
   * Le zoom est ancre sur le curseur : le point du monde sous la souris y
   * reste apres l'echelle. Sans cela, zoomer sur une branche la fait fuir.
   */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function surMolette(evenement: WheelEvent) {
      evenement.preventDefault();
      const cible = canvasRef.current;
      if (!cible) return;
      const rect = cible.getBoundingClientRect();
      const x = evenement.clientX - rect.left;
      const y = evenement.clientY - rect.top;
      const camera = cameraRef.current;

      const mondeX = (x - rect.width / 2) / camera.zoom - camera.x;
      const mondeY = (y - rect.height / 2) / camera.zoom - camera.y;
      const facteur = Math.exp(-evenement.deltaY * 0.001);
      camera.zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, camera.zoom * facteur));
      camera.x = (x - rect.width / 2) / camera.zoom - mondeX;
      camera.y = (y - rect.height / 2) / camera.zoom - mondeY;
      setZoomAffiche(camera.zoom);
      dessinerRef.current();
    }

    canvas.addEventListener("wheel", surMolette, { passive: false });
    return () => canvas.removeEventListener("wheel", surMolette);
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-bordure bg-surface px-3.5 py-2.5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[0.6875rem] text-texte-attenue">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-texte-discret" />
            Région
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-primaire" />
            Domaine
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-1.5 rounded-full border border-primaire bg-surface" />
            À travailler
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-succes" />
            Maîtrisée
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded-full bg-primaire" />
            Prérequis
          </span>
        </div>
        <span className="chiffres text-[0.6875rem] text-texte-discret">
          zoom {zoomAffiche.toFixed(1)}× · molette pour zoomer, glisser pour déplacer
        </span>
      </div>

      {arbre.domainesNonClasses.length > 0 && (
        <p className="rounded-lg border border-bordure bg-surface-2/60 px-3 py-2 text-[0.6875rem] leading-relaxed text-texte-attenue">
          {arbre.domainesNonClasses.length} domaine
          {arbre.domainesNonClasses.length > 1 ? "s" : ""} sans classement flotte
          {arbre.domainesNonClasses.length > 1 ? "nt" : ""} hors des régions : rien ne dit encore
          où {arbre.domainesNonClasses.length > 1 ? "ils vont" : "il va"}.
        </p>
      )}

      <div
        ref={conteneurRef}
        className="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-bordure bg-surface-2/40"
      >
        <canvas
          ref={canvasRef}
          className={cx("block h-full w-full", survol ? "cursor-pointer" : "cursor-grab")}
          onPointerDown={(evenement) => {
            glissementRef.current = { x: evenement.clientX, y: evenement.clientY };
            evenement.currentTarget.setPointerCapture(evenement.pointerId);
          }}
          onPointerMove={(evenement) => {
            const glissement = glissementRef.current;
            if (glissement) {
              const camera = cameraRef.current;
              camera.x += (evenement.clientX - glissement.x) / camera.zoom;
              camera.y += (evenement.clientY - glissement.y) / camera.zoom;
              glissementRef.current = { x: evenement.clientX, y: evenement.clientY };
              dessinerRef.current();
              return;
            }
            const sous = noeudSous(evenement.clientX, evenement.clientY);
            setSurvol((precedent) => (precedent?.id === sous?.id ? precedent : sous));
          }}
          onPointerUp={(evenement) => {
            const glissement = glissementRef.current;
            glissementRef.current = null;
            /* Un déplacement n'est pas un clic : on n'ouvre que sur un vrai clic. */
            const bouge =
              glissement !== null &&
              (Math.abs(evenement.clientX - glissement.x) > 3 ||
                Math.abs(evenement.clientY - glissement.y) > 3);
            if (bouge) return;
            const sous = noeudSous(evenement.clientX, evenement.clientY);
            if (!sous || sous.etat === "fantome" || sous.niveau === "region") return;
            ouvrirElement(
              sous.niveau === "domaine" ? sous.id : sous.id.replace(/^competence:/, ""),
            );
          }}
          onPointerLeave={() => {
            glissementRef.current = null;
            setSurvol(null);
          }}
        />

        {survol && (
          <div className="pointer-events-none absolute left-3 top-3 max-w-xs rounded-lg border border-bordure bg-surface px-3 py-2 shadow-[var(--ombre-levee)]">
            <p className="text-sm font-semibold leading-snug text-texte">{survol.libelle}</p>
            <p className="mt-0.5 text-[0.6875rem] text-texte-discret">
              {survol.niveau === "region"
                ? "Région de la carte des savoirs"
                : survol.niveau === "domaine"
                  ? `Domaine · ${survol.poids} compétence${survol.poids > 1 ? "s" : ""}`
                  : survol.etat === "fantome"
                    ? "Citée en prérequis, jamais créée"
                    : survol.etat === "maitrisee"
                      ? "Maîtrisée"
                      : survol.etat === "en-cours"
                        ? `En cours · ${survol.poids} trace${survol.poids > 1 ? "s" : ""}`
                        : "À travailler"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
