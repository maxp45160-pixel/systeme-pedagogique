"use client";

/**
 * Vue graphe des compétences — façon Obsidian (chantier graphe, ADR-056).
 *
 * Graphe PLAT (pas de niveaux qui se remplacent) : toutes les compétences à
 * l'écran, un panneau de réglages pour filtrer/classer/ajuster les forces,
 * le survol surligne les voisins directs et estompe le reste.
 *
 * Le layout est calculé par `d3-force` (`moteur-force.ts`) : la simulation
 * gère elle-même sa propre boucle et sa propre décroissance d'`alpha` — ce
 * composant n'a besoin de piloter aucune boucle `requestAnimationFrame` pour
 * la physique, seulement pour le zoom/pan (des changements de caméra, pas de
 * positions). C'est ce qui corrige le défaut principal de la version
 * précédente : plus de boucle perpétuelle une fois le graphe stabilisé.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Simulation } from "d3-force";
import type { DonneesGraphe, LienGraphe, NoeudGraphe, TypeLien } from "@/lib/domain/graphe";
import {
  creerNoeudsSimules,
  creerSimulation,
  type LienSimule,
  type NoeudSimule,
} from "./moteur-force";
import {
  couleurNoeud,
  dessinerFond,
  dessinerLien,
  dessinerNoeud,
  dessinerTooltip,
  resoudrePalette,
  STYLE_PAR_TYPE_LIEN,
  type Camera,
  type ContexteCouleur,
  type Palette,
} from "./rendu-canvas";
import { PanneauReglages } from "./panneau-reglages";
import {
  ecrireReglagesGraphe,
  lireReglagesGraphe,
  REGLAGES_PAR_DEFAUT,
  type ReglagesGraphe,
} from "./reglages-graphe";
import { couleurDomaine, indexerDomaines } from "@/lib/ui/couleurs-domaines";

export function GrapheCompetences({
  donnees,
  compteId,
  ouvrirElement,
}: {
  donnees: DonneesGraphe;
  compteId: string;
  ouvrirElement?: (id: string) => void;
}) {
  const router = useRouter();
  const conteneurRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simulationRef = useRef<Simulation<NoeudSimule, LienSimule> | null>(null);
  const noeudsRef = useRef<NoeudSimule[]>([]);
  const liensRef = useRef<LienSimule[]>([]);
  const cameraRef = useRef<Camera>({ x: 0, y: 0, zoom: 1 });
  const paletteRef = useRef<Palette>(resoudrePalette());
  const tailleRef = useRef({ largeur: 0, hauteur: 0 });

  const dragRef = useRef<{ noeud: NoeudSimule } | null>(null);
  const panRef = useRef<{ x: number; y: number } | null>(null);
  const deplaceRef = useRef(false); // drag/pan réel vs simple clic

  const [reglages, setReglagesState] = useState<ReglagesGraphe>(REGLAGES_PAR_DEFAUT);
  const [panneauOuvert, setPanneauOuvert] = useState(false);
  const [legendeOuverte, setLegendeOuverte] = useState(false);
  const [focusIndex, setFocusIndex] = useState(0);
  /**
   * Le survol pilote un redessin Canvas impératif (`dessinerRef.current()`),
   * pas un re-rendu React — une `ref` suffit et évite un re-rendu du
   * composant à chaque `pointermove`.
   */
  const survolIdRef = useRef<string | null>(null);

  // Réglages : chargés côté client (localStorage n'existe pas au rendu serveur).
  // La lecture est DIFFÉRÉE hors du corps de l'effet : un `setState` synchrone
  // dans un effet déclenche des rendus en cascade (règle
  // react-hooks/set-state-in-effect). Le timeout sert uniquement à sortir le
  // setState du corps synchrone de l'effet ; `actif` protège contre un état
  // appliqué après démontage.
  useEffect(() => {
    let actif = true;
    const jeton = setTimeout(() => {
      if (!actif) return;
      setReglagesState(lireReglagesGraphe(compteId));
    }, 0);
    return () => {
      actif = false;
      clearTimeout(jeton);
    };
  }, [compteId]);

  function changerReglages(suivant: ReglagesGraphe) {
    setReglagesState(suivant);
    ecrireReglagesGraphe(compteId, suivant);
  }

  /* ------------------------------------------------------------------ */
  /* Filtrage — visibilité, projection des exercices masqués             */
  /* ------------------------------------------------------------------ */

  const noeudsVisibles = useMemo(
    () => donnees.noeuds.filter((n) => reglages.typesNoeudsVisibles[n.type]),
    [donnees.noeuds, reglages.typesNoeudsVisibles],
  );

  const naviguerVersNoeud = useCallback(
    (n: NoeudGraphe) => {
      if (ouvrirElement) {
        ouvrirElement(n.id);
        return;
      }
      if (n.type === "competence") {
        const code = n.id.slice("competence:".length);
        router.push(`/atelier?document=${encodeURIComponent(code)}`);
      } else if (n.type === "exercice") {
        router.push(`/atelier?document=${encodeURIComponent(n.id)}`);
      } else if (n.type === "document") {
        router.push(`/atelier?document=${encodeURIComponent(n.id.slice("document:".length))}`);
      }
    },
    [router, ouvrirElement],
  );

  const idsVisibles = useMemo(() => new Set(noeudsVisibles.map((n) => n.id)), [noeudsVisibles]);

  /**
   * Liens à dessiner : les liens réels dont les deux extrémités sont
   * visibles, PLUS — quand les nœuds exercice sont masqués — une projection
   * des liens `exercice` en connexions directes entre les compétences
   * co-ciblées. C'est la même donnée, seulement projetée : rien n'est
   * inventé, l'information « ces compétences sont visées par un même
   * exercice » ne disparaît pas quand on masque les exercices eux-mêmes.
   */
  const liensAffiches = useMemo(() => {
    const reels = donnees.liens.filter(
      (l) =>
        reglages.typesLiensVisibles[l.type] &&
        idsVisibles.has(l.source) &&
        idsVisibles.has(l.target) &&
        (l.type !== "similarite" || l.poids >= reglages.seuilSimilarite),
    );

    if (reglages.typesNoeudsVisibles.exercice || !reglages.typesLiensVisibles.exercice) {
      return reels;
    }

    const parHub = new Map<string, string[]>();
    for (const l of donnees.liens) {
      if (l.type !== "exercice") continue;
      const membres = parHub.get(l.source) ?? [];
      if (idsVisibles.has(l.target)) membres.push(l.target);
      parHub.set(l.source, membres);
    }
    const projetes: LienGraphe[] = [];
    for (const membres of parHub.values()) {
      for (let i = 0; i < membres.length - 1; i++) {
        for (let j = i + 1; j < membres.length; j++) {
          projetes.push({
            source: membres[i],
            target: membres[j],
            type: "exercice",
            poids: 0.5,
            oriente: false,
          });
        }
      }
    }
    return [...reels, ...projetes];
  }, [donnees.liens, reglages.typesLiensVisibles, reglages.typesNoeudsVisibles.exercice, idsVisibles, reglages.seuilSimilarite]);

  // Une compétence isolée (sans prérequis, thème ni exercice) reste affichée
  // — c'est une information vraie, pas un défaut à masquer (règle centrale
  // de `lib/domain/graphe.ts`). Seul le TYPE piloté par le panneau filtre.
  const noeudsAAfficher = noeudsVisibles;

  const contexteCouleur: ContexteCouleur = useMemo(() => {
    const { indexDomaine, totalDomaines } = indexerDomaines(donnees.noeuds.map((n) => n.domaineId));
    const competencesCouvertes = new Set(
      donnees.liens.filter((l) => l.type === "exercice").flatMap((l) => [l.source, l.target]),
    );
    return { indexDomaine, totalDomaines, competencesCouvertes };
  }, [donnees.noeuds, donnees.liens]);

  /* ------------------------------------------------------------------ */
  /* Dessin                                                              */
  /* ------------------------------------------------------------------ */

  const ajusterCamera = useCallback(() => {
    const noeuds = noeudsRef.current.filter(
      (noeud) => noeud.x !== undefined && noeud.y !== undefined,
    );
    if (noeuds.length === 0) return;
    const { largeur, hauteur } = tailleRef.current;
    if (largeur <= 0 || hauteur <= 0) return;
    const xs = noeuds.map((noeud) => noeud.x!);
    const ys = noeuds.map((noeud) => noeud.y!);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const largeurMonde = Math.max(120, maxX - minX);
    const hauteurMonde = Math.max(120, maxY - minY);
    const zoom = Math.min(
      1.35,
      Math.max(0.2, Math.min((largeur - 120) / largeurMonde, (hauteur - 120) / hauteurMonde)),
    );
    cameraRef.current = {
      x: -(minX + maxX) / 2,
      y: -(minY + maxY) / 2,
      zoom,
    };
  }, []);

  const zoomer = useCallback((facteur: number) => {
    const camera = cameraRef.current;
    const nouveauZoom = Math.min(2.5, Math.max(0.15, camera.zoom * facteur));
    cameraRef.current = { ...camera, zoom: nouveauZoom };
    dessinerRef.current();
  }, []);

  const dessiner = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { largeur, hauteur } = tailleRef.current;
    const palette = paletteRef.current;
    const camera = cameraRef.current;

    dessinerFond(ctx, largeur, hauteur, camera, palette);

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

    for (const l of liensRef.current) {
      const s = typeof l.source === "string" ? l.source : l.source.id;
      const t = typeof l.target === "string" ? l.target : l.target.id;
      const concerne = survol !== null && (s === survol || t === survol);
      const opacite = survol === null || concerne ? 1 : 0.08;
      dessinerLien(ctx, l, largeur, hauteur, camera, palette, opacite);
    }

    const seuilDensite = noeudsRef.current.length > 55 ? 1.05 : noeudsRef.current.length > 35 ? 0.85 : 0.55;
    const afficherLibelles = camera.zoom >= Math.max(reglages.seuilLibelles, seuilDensite);
    for (const n of noeudsRef.current) {
      const estSurvole = n.id === survol;
      const estVoisin = voisins.has(n.id);
      const estompe = survol !== null && !estSurvole && !estVoisin;
      dessinerNoeud(ctx, n, largeur, hauteur, camera, couleurNoeud(n, reglages.axeCouleur, contexteCouleur, palette), palette, {
        survole: estSurvole,
        selectionne: false,
        estompe,
        afficherLibelle: afficherLibelles || estSurvole || estVoisin,
      });
    }

    if (survol) {
      const n = noeudsRef.current.find((x) => x.id === survol);
      if (n) dessinerTooltip(ctx, n, largeur, hauteur, camera, palette);
    }
  }, [reglages.axeCouleur, reglages.seuilLibelles, contexteCouleur]);

  // Dernier tracé frais, lu par les écouteurs et la simulation. Mise à jour
  // dans un effet et non pendant le rendu : écrire `current` au rendu viole la
  // règle react-hooks/refs et produit un résultat incohérent selon l'ordre de
  // rendu (React peut appeler le corps du composant plusieurs fois).
  const dessinerRef = useRef(dessiner);
  useEffect(() => {
    dessinerRef.current = dessiner;
  }, [dessiner]);

  /* ------------------------------------------------------------------ */
  /* Cycle de vie de la simulation — recréée quand le jeu de nœuds/liens  */
  /* affichés change (filtre) ou quand les forces réglées changent.      */
  /* ------------------------------------------------------------------ */

  useEffect(() => {
    const reduitMouvement =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const noeudsSimules = creerNoeudsSimules(noeudsAAfficher);
    const parId = new Map(noeudsSimules.map((n) => [n.id, n]));
    // Repart des positions précédentes quand le nœud existait déjà — évite
    // que chaque bascule de filtre relance le graphe depuis zéro.
    for (const ancien of noeudsRef.current) {
      const suivant = parId.get(ancien.id);
      if (suivant && ancien.x !== undefined) {
        suivant.x = ancien.x;
        suivant.y = ancien.y;
        suivant.vx = ancien.vx;
        suivant.vy = ancien.vy;
      }
    }

    const liensSimules: LienSimule[] = liensAffiches
      .filter((l) => parId.has(l.source) && parId.has(l.target))
      .map((l) => ({ ...l }));

    noeudsRef.current = noeudsSimules;
    liensRef.current = liensSimules;

    simulationRef.current?.stop();
    const sim = creerSimulation(noeudsSimules, liensSimules, reglages.forces);
    simulationRef.current = sim;
    sim.stop();
    for (let i = 0; i < 90; i++) sim.tick();
    ajusterCamera();

    if (reduitMouvement) {
      // Convergence hors écran : pas d'animation visible, un seul dessin final.
      for (let i = 0; i < 210; i++) sim.tick();
      ajusterCamera();
      dessinerRef.current();
    } else {
      sim.on("tick", () => dessinerRef.current());
      sim.alpha(0.22).restart();
    }

    return () => {
      sim.stop();
    };
  }, [noeudsAAfficher, liensAffiches, reglages.forces, ajusterCamera]);

  /* ------------------------------------------------------------------ */
  /* Redimensionnement — DPR géré, ResizeObserver plutôt que du polling  */
  /* par frame (défaut de la version précédente).                       */
  /* ------------------------------------------------------------------ */

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
      ajusterCamera();
      dessinerRef.current();
    }

    redimensionner();
    const observateur = new ResizeObserver(redimensionner);
    observateur.observe(conteneur);
    return () => observateur.disconnect();
  }, [ajusterCamera]);

  /* ------------------------------------------------------------------ */
  /* Thème clair/sombre — l'app pilote `data-theme` sur <html>.          */
  /* ------------------------------------------------------------------ */

  useEffect(() => {
    const cible = document.documentElement;
    const observateur = new MutationObserver(() => {
      paletteRef.current = resoudrePalette();
      dessinerRef.current();
    });
    observateur.observe(cible, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observateur.disconnect();
  }, []);

  /* ------------------------------------------------------------------ */
  /* Interactions souris/tactile — pan, zoom ancré, drag de nœud,        */
  /* survol. `wheel`/`touch*` en écouteurs NON passifs (bug de la        */
  /* version précédente : React les attache passifs, `preventDefault`    */
  /* n'avait alors aucun effet et la page défilait pendant le zoom).     */
  /* ------------------------------------------------------------------ */

  const noeudSousCurseur = useCallback((xEcran: number, yEcran: number): NoeudSimule | null => {
    const { largeur, hauteur } = tailleRef.current;
    const camera = cameraRef.current;
    let trouve: NoeudSimule | null = null;
    let meilleureDistance = Infinity;
    for (const n of noeudsRef.current) {
      if (n.x === undefined || n.y === undefined) continue;
      const px = largeur / 2 + (n.x + camera.x) * camera.zoom;
      const py = hauteur / 2 + (n.y + camera.y) * camera.zoom;
      const rayonMinimum = n.type === "theme" ? 7 : n.type === "competence" ? 5 : 4;
      const rayon = Math.max(rayonMinimum, n.rayon * camera.zoom);
      const d = Math.hypot(xEcran - px, yEcran - py);
      if (d <= rayon + 2 && d < meilleureDistance) {
        meilleureDistance = d;
        trouve = n;
      }
    }
    return trouve;
  }, []);



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
        if (!deplaceRef.current) naviguerVersNoeud(dragRef.current.noeud);
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
      // Point du monde sous le curseur avant zoom, pour l'y garder après.
      const mondeX = (x - largeur / 2) / camera.zoom - camera.x;
      const mondeY = (y - hauteur / 2) / camera.zoom - camera.y;
      const facteur = Math.exp(-e.deltaY * 0.001);
      camera.zoom = Math.min(4.5, Math.max(0.15, camera.zoom * facteur));
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
  }, [noeudSousCurseur, naviguerVersNoeud]);

  /* ------------------------------------------------------------------ */
  /* Clavier — un nœud « focalisé » cyclable au Tab/flèches, Entrée       */
  /* pour naviguer. La version précédente agissait sur le survol, jamais */
  /* renseigné au clavier : inatteignable sans souris.                  */
  /* ------------------------------------------------------------------ */

  function onKeyDown(e: React.KeyboardEvent<HTMLCanvasElement>) {
    const noeuds = noeudsRef.current;
    if (noeuds.length === 0) return;
    if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === "Tab") {
      e.preventDefault();
      const suivant = (focusIndex + 1) % noeuds.length;
      setFocusIndex(suivant);
      survolIdRef.current = noeuds[suivant].id;
      dessiner();
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      const precedent = (focusIndex - 1 + noeuds.length) % noeuds.length;
      setFocusIndex(precedent);
      survolIdRef.current = noeuds[precedent].id;
      dessiner();
    } else if (e.key === "Enter") {
      const n = noeuds[focusIndex];
      if (n) naviguerVersNoeud(n);
    }
  }

  return (
    <div className="graphe-conteneur">
      <div ref={conteneurRef} className="relative min-w-0 flex-1">
        <canvas
          ref={canvasRef}
          tabIndex={0}
          role="application"
          aria-label="Graphe des compétences et documents — flèches pour parcourir, Entrée pour ouvrir"
          onKeyDown={onKeyDown}
          className="block h-full w-full cursor-grab touch-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primaire"
        />

        <div className="absolute bottom-3 left-3">
          {legendeOuverte && (
            <div className="mb-2 max-w-[min(34rem,calc(100vw-5rem))] space-y-2 rounded-xl border border-bordure bg-surface/95 p-3 text-xs text-texte-attenue shadow-lg backdrop-blur-md">
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {(Object.keys(STYLE_PAR_TYPE_LIEN) as TypeLien[])
                  .filter((t) => reglages.typesLiensVisibles[t])
                  .map((t) => (
                    <div key={t} className="flex items-center gap-1.5">
                      <span
                        className="inline-block h-0 w-5 border-t-2"
                        style={{
                          borderStyle: STYLE_PAR_TYPE_LIEN[t].pointille ? "dashed" : "solid",
                          borderColor: "var(--texte-attenue)",
                        }}
                      />
                      {STYLE_PAR_TYPE_LIEN[t].libelle}
                    </div>
                  ))}
              </div>
              {reglages.axeCouleur === "domaine" && contexteCouleur.totalDomaines > 0 && (
                <div className="flex flex-wrap gap-x-3 gap-y-2 border-t border-bordure pt-2">
                  {[...contexteCouleur.indexDomaine.entries()].map(([id, idx]) => (
                    <span key={id} className="flex items-center gap-1.5">
                      <span
                        className="inline-block size-2.5 rounded-full"
                        style={{ background: couleurDomaine(idx, contexteCouleur.totalDomaines) }}
                      />
                      {id}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={() => setLegendeOuverte((ouverte) => !ouverte)}
            className="rounded-lg border border-bordure bg-surface/95 px-3 py-2 text-xs font-medium text-texte-attenue shadow-sm backdrop-blur-md hover:text-texte"
            aria-expanded={legendeOuverte}
          >
            {legendeOuverte ? "Masquer la légende" : "Légende"}
          </button>
        </div>

        <div className="absolute right-3 top-3 flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-bordure bg-surface/95 shadow-sm backdrop-blur-md">
            <button
              type="button"
              onClick={() => zoomer(1.25)}
              className="grid size-8 place-items-center text-sm font-semibold text-texte-attenue hover:text-texte hover:bg-surface-2 transition-colors rounded-l-lg cursor-pointer"
              title="Zoom avant"
              aria-label="Zoom avant"
            >
              +
            </button>
            <div className="h-4 w-px bg-bordure" />
            <button
              type="button"
              onClick={() => zoomer(0.8)}
              className="grid size-8 place-items-center text-sm font-semibold text-texte-attenue hover:text-texte hover:bg-surface-2 transition-colors cursor-pointer"
              title="Zoom arrière"
              aria-label="Zoom arrière"
            >
              −
            </button>
            <div className="h-4 w-px bg-bordure" />
            <button
              type="button"
              onClick={() => {
                ajusterCamera();
                dessinerRef.current();
              }}
              className="px-2.5 py-1.5 text-xs font-medium text-texte-attenue hover:text-texte hover:bg-surface-2 transition-colors rounded-r-lg cursor-pointer"
              title="Recentrer la vue"
            >
              Recentrer
            </button>
          </div>
          <button
            type="button"
            onClick={() => setPanneauOuvert((o) => !o)}
            className="rounded-lg border border-bordure bg-surface/95 px-3 py-2 text-xs font-medium text-texte-attenue shadow-sm backdrop-blur-md hover:text-texte cursor-pointer"
            aria-expanded={panneauOuvert}
          >
            {panneauOuvert ? "Masquer les réglages" : "Réglages"}
          </button>
        </div>
      </div>

      {panneauOuvert && (
        <PanneauReglages
          reglages={reglages}
          onChange={changerReglages}
          onFermer={() => setPanneauOuvert(false)}
        />
      )}
    </div>
  );
}
