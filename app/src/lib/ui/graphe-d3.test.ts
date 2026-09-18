import { describe, expect, it, vi } from "vitest";
import { lierInteractionsCanvas } from "./graphe-d3";

interface NoeudTest {
  id: string;
  x: number;
  y: number;
  fx?: number | null;
  fy?: number | null;
}

function recette(zoomMin = 0.15) {
  class CanvasMemoire extends EventTarget {
    getBoundingClientRect = () => ({ left: 20, top: 30 });
    setPointerCapture = vi.fn();
    releasePointerCapture = vi.fn();
  }
  const surface = new CanvasMemoire();
  const canvas = surface as unknown as HTMLCanvasElement;
  const noeud: NoeudTest = { id: "A", x: 4, y: 6 };
  let cible: NoeudTest | null = noeud;
  const restart = vi.fn();
  const simulation = { alphaTarget: vi.fn<(alpha: number) => { restart: typeof restart }>(() => ({ restart })) };
  const refs = {
    cameraRef: { current: { x: 10, y: -5, zoom: 2 } },
    tailleRef: { current: { largeur: 800, hauteur: 600 } },
    dragRef: { current: null as { noeud: NoeudTest } | null },
    panRef: { current: null as { x: number; y: number } | null },
    deplaceRef: { current: false },
    survolIdRef: { current: null as string | null },
    simulationRef: { current: simulation as typeof simulation | null },
    dessinerRef: { current: vi.fn() },
  };
  const noeudSousCurseur = vi.fn<(x: number, y: number) => NoeudTest | null>(() => cible);
  const surClic = vi.fn();
  const installer = () => lierInteractionsCanvas(canvas, { ...refs, noeudSousCurseur, surClic, zoomMin });
  const ajout = vi.spyOn(surface, "addEventListener");
  const retrait = vi.spyOn(surface, "removeEventListener");
  const nettoyer = installer();
  function envoyer(type: string, clientX = 500, clientY = 390, deltaY = 0) {
    const event = Object.assign(new Event(type, { cancelable: true }), { clientX, clientY, deltaY, pointerId: 7 });
    surface.dispatchEvent(event);
    return event;
  }
  return { surface, noeud, refs, simulation, restart, surClic, noeudSousCurseur,
    envoyer, nettoyer, installer, ajout, retrait, cibler: (n: NoeudTest | null) => { cible = n; } };
}

describe("interactions Canvas partagées", () => {
  it("capture le nœud puis le déplace dans le repère du monde sans déclencher un clic", () => {
    const r = recette();
    r.envoyer("pointerdown");
    expect(r.noeudSousCurseur).toHaveBeenCalledWith(480, 360);
    expect([r.noeud.fx, r.noeud.fy]).toEqual([4, 6]);
    expect(r.simulation.alphaTarget).toHaveBeenCalledWith(0.3);
    expect(r.restart).toHaveBeenCalledOnce();
    expect(r.surface.setPointerCapture).toHaveBeenCalledWith(7);
    r.envoyer("pointermove");
    expect([r.noeud.fx, r.noeud.fy]).toEqual([30, 35]);
    expect(r.refs.dessinerRef.current).toHaveBeenCalledOnce();
    r.envoyer("pointerup");
    expect([r.noeud.fx, r.noeud.fy]).toEqual([null, null]);
    expect(r.refs.dragRef.current).toBeNull();
    expect(r.simulation.alphaTarget).toHaveBeenLastCalledWith(0);
    expect(r.surClic).not.toHaveBeenCalled();
    expect(r.surface.releasePointerCapture).toHaveBeenCalledWith(7);
    r.nettoyer();
  });

  it("déplace la caméra sur le fond selon le zoom, sans relancer la simulation", () => {
    const r = recette();
    r.cibler(null);
    r.envoyer("pointerdown", 100, 100);
    r.envoyer("pointermove", 140, 160);
    expect(r.refs.cameraRef.current).toEqual({ x: 30, y: 25, zoom: 2 });
    expect(r.refs.panRef.current).toEqual({ x: 140, y: 160 });
    r.envoyer("pointerup");
    expect(r.refs.panRef.current).toBeNull();
    expect(r.simulation.alphaTarget).not.toHaveBeenCalled();
    expect(r.surClic).not.toHaveBeenCalled();
    r.nettoyer();
  });

  it("redessine le survol seulement quand le nœud change", () => {
    const r = recette();
    r.envoyer("pointermove");
    r.envoyer("pointermove");
    expect(r.refs.survolIdRef.current).toBe("A");
    expect(r.refs.dessinerRef.current).toHaveBeenCalledOnce();
    r.cibler(null);
    r.envoyer("pointermove");
    r.envoyer("pointermove");
    expect(r.refs.survolIdRef.current).toBeNull();
    expect(r.refs.dessinerRef.current).toHaveBeenCalledTimes(2);
    r.nettoyer();
  });

  it.each(["pointerup", "pointercancel"])("%s sans déplacement conserve le clic historique sur le nœud", type => {
    const r = recette();
    r.envoyer("pointerdown");
    r.envoyer(type);
    expect(r.surClic).toHaveBeenCalledExactlyOnceWith(r.noeud);
    expect(r.refs.dragRef.current).toBeNull();
    r.nettoyer();
  });

  it("annule un drag sans clic même si la capture a déjà été libérée", () => {
    const r = recette();
    r.surface.releasePointerCapture.mockImplementation(() => { throw new Error("Déjà libérée"); });
    r.envoyer("pointerdown");
    r.envoyer("pointermove");
    r.envoyer("pointercancel");
    expect(r.surClic).not.toHaveBeenCalled();
    expect([r.noeud.fx, r.noeud.fy, r.refs.dragRef.current, r.refs.panRef.current]).toEqual([null, null, null, null]);
    expect(r.simulation.alphaTarget).toHaveBeenLastCalledWith(0);
    r.nettoyer();
  });

  it.each([0.15, 0.1])("zoome autour du curseur, bloque le défilement et respecte les limites %s/4.5", zoomMin => {
    const r = recette(zoomMin);
    const pointMonde = () => {
      const c = r.refs.cameraRef.current;
      return { x: 80 / c.zoom - c.x, y: 60 / c.zoom - c.y };
    };
    const avant = pointMonde();
    expect(r.envoyer("wheel", 500, 390, 100).defaultPrevented).toBe(true);
    expect(r.refs.cameraRef.current.zoom).toBeCloseTo(2 * Math.exp(-0.1));
    for (const [delta, attendu] of [[-100000, 4.5], [100000, zoomMin]]) {
      r.envoyer("wheel", 500, 390, delta);
      expect(r.refs.cameraRef.current.zoom).toBe(attendu);
      expect(pointMonde().x).toBeCloseTo(avant.x);
      expect(pointMonde().y).toBeCloseTo(avant.y);
    }
    expect(r.ajout).toHaveBeenCalledWith("wheel", expect.any(Function), { passive: false });
    r.nettoyer();
  });

  it("retire les cinq écouteurs sans réinitialiser les refs ni la simulation", () => {
    const r = recette();
    r.envoyer("pointerdown");
    r.nettoyer();
    expect(r.retrait).toHaveBeenCalledTimes(5);
    for (const [type, callback] of r.ajout.mock.calls) {
      expect(r.retrait).toHaveBeenCalledWith(type, callback);
    }
    r.envoyer("pointerup");
    expect(r.refs.dragRef.current?.noeud).toBe(r.noeud);
    expect([r.noeud.fx, r.noeud.fy]).toEqual([4, 6]);
    expect(r.simulation.alphaTarget).toHaveBeenCalledTimes(1);
    expect(r.surClic).not.toHaveBeenCalled();
    expect(r.envoyer("wheel").defaultPrevented).toBe(false);
  });

  it("retrouve un geste après réinstallation et lit les valeurs courantes des refs", () => {
    const r = recette();
    r.envoyer("pointerdown");
    r.nettoyer();
    const nettoyer = r.installer();
    const dessinInitial = r.refs.dessinerRef.current;
    r.refs.dessinerRef.current = vi.fn();
    r.refs.cameraRef.current = { x: 0, y: 0, zoom: 1 };
    r.refs.tailleRef.current = { largeur: 400, hauteur: 200 };
    r.refs.simulationRef.current = null;
    r.envoyer("pointermove");
    expect([r.noeud.fx, r.noeud.fy]).toEqual([280, 260]);
    expect(dessinInitial).not.toHaveBeenCalled();
    expect(r.refs.dessinerRef.current).toHaveBeenCalledOnce();
    r.envoyer("pointerup");
    expect(r.refs.dragRef.current).toBeNull();
    expect(r.simulation.alphaTarget).toHaveBeenCalledTimes(1);
    nettoyer();
  });
});
