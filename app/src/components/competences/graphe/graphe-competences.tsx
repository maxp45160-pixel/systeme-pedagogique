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
import { couleurDomaine } from "@/lib/ui/couleurs-domaines";

export function GrapheCompetences({
  donnees,
  compteId,
}: {
  donnees: DonneesGraphe;
  compteId: string;
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
  const [panneauOuvert, setPanneauOuvert] = useState(true);
  const [focusIndex, setFocusIndex] = useState(0);
  /**
   * Le survol pilote un redessin Canvas impératif (`dessinerRef.current()`),
   * pas un re-rendu React — une `ref` suffit et évite un re-rendu du
   * composant à chaque `pointermove`.
   */
  const survolIdRef = useRef<string | null>(null);

  // Réglages : chargés côté client (localStorage n'existe pas au rendu serveur).
  useEffect(() => {
    setReglagesState(lireReglagesGraphe(compteId));
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
    const domaines = [...new Set(donnees.noeuds.map((n) => n.domaineId).filter(Boolean))].sort() as string[];
    const indexDomaine = new Map(domaines.map((d, i) => [d, i]));
    const competencesCouvertes = new Set(
      donnees.liens.filter((l) => l.type === "exercice").flatMap((l) => [l.source, l.target]),
    );
    return { indexDomaine, totalDomaines: domaines.length, competencesCouvertes };
  }, [donnees.noeuds, donnees.liens]);

  /* ------------------------------------------------------------------ */
  /* Dessin                                                              */
  /* ------------------------------------------------------------------ */

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

    const afficherLibelles = camera.zoom >= reglages.seuilLibelles;
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

  const dessinerRef = useRef(dessiner);
  dessinerRef.current = dessiner;

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

    if (reduitMouvement) {
      // Convergence hors écran : pas d'animation visible, un seul dessin final.
      sim.stop();
      for (let i = 0; i < 300; i++) sim.tick();
      dessinerRef.current();
    } else {
      sim.on("tick", () => dessinerRef.current());
    }

    return () => {
      sim.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noeudsAAfficher, liensAffiches, reglages.forces]);

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
      dessinerRef.current();
    }

    redimensionner();
    const observateur = new ResizeObserver(redimensionner);
    observateur.observe(conteneur);
    return () => observateur.disconnect();
  }, []);

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
      const rayon = n.rayon * camera.zoom;
      const d = Math.hypot(xEcran - px, yEcran - py);
      if (d <= rayon + 2 && d < meilleureDistance) {
        meilleureDistance = d;
        trouve = n;
      }
    }
    return trouve;
  }, []);

  const naviguerVersNoeud = useCallback(
    (n: NoeudGraphe) => {
      if (n.type === "competence") router.push(`/competences/${encodeURIComponent(n.id.slice("competence:".length))}`);
      else if (n.type === "exercice") router.push(`/exercices/${encodeURIComponent(n.id.slice("exercice:".length))}`);
      // Un thème n'a pas de fiche dédiée : la portée se travaille depuis le
      // compositeur de séance, pas depuis le graphe.
    },
    [router],
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
          aria-label="Graphe des compétences — flèches pour parcourir, Entrée pour ouvrir"
          onKeyDown={onKeyDown}
          className="block h-full w-full cursor-grab touch-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primaire"
        />

        {/* Légende — toujours visible, un seul point de vérité avec le dessin (rendu-canvas.ts) */}
        <div className="pointer-events-none absolute bottom-2 left-2 space-y-1 rounded-md border border-bordure bg-surface/90 px-2.5 py-2 text-[0.6875rem] text-texte-attenue backdrop-blur-sm">
          {(Object.keys(STYLE_PAR_TYPE_LIEN) as TypeLien[])
            .filter((t) => reglages.typesLiensVisibles[t])
            .map((t) => (
              <div key={t} className="flex items-center gap-1.5">
                <span
                  className="inline-block h-0 w-4 border-t-2"
                  style={{
                    borderStyle: STYLE_PAR_TYPE_LIEN[t].pointille ? "dashed" : "solid",
                    borderColor: "var(--texte-attenue)",
                  }}
                />
                {STYLE_PAR_TYPE_LIEN[t].libelle}
              </div>
            ))}
          {reglages.axeCouleur === "domaine" && contexteCouleur.totalDomaines > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5 border-t border-bordure pt-1.5">
              {[...contexteCouleur.indexDomaine.entries()].map(([id, idx]) => (
                <span key={id} className="flex items-center gap-1">
                  <span
                    className="inline-block size-2 rounded-full"
                    style={{ background: couleurDomaine(idx, contexteCouleur.totalDomaines) }}
                  />
                  {id}
                </span>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setPanneauOuvert((o) => !o)}
          className="absolute right-2 top-2 rounded-md border border-bordure bg-surface/90 px-2.5 py-1.5 text-xs font-medium text-texte-attenue backdrop-blur-sm hover:text-texte"
        >
          {panneauOuvert ? "Masquer les réglages" : "Réglages"}
        </button>
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
