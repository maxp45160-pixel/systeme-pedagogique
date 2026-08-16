"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { IconeFleche, IconeFermer } from "@/components/ui/icones";
import { Bouton, cx } from "@/components/ui/primitives";

export interface EtapeTour {
  id: string;
  /** Sélecteur CSS de l'élément cible (ex: '[data-tour="action-prioritaire"]') */
  cibleSelector?: string;
  titre: string;
  description: string;
  position?: "top" | "bottom" | "left" | "right" | "center";
  badge?: string;
  boutonTexte?: string;
}

interface GuideTourProps {
  tourId: string;
  etapes: EtapeTour[];
  actif: boolean;
  surTerminer: () => void;
  surPasser: () => void;
}

interface RectCible {
  top: number;
  left: number;
  width: number;
  height: number;
  bottom: number;
  right: number;
}

export function GuideTour({
  tourId,
  etapes,
  actif,
  surTerminer,
  surPasser,
}: GuideTourProps) {
  const [indexCourant, setIndexCourant] = useState(0);
  const [rectCible, setRectCible] = useState<RectCible | null>(null);
  const [estMonte, setEstMonte] = useState(false);

  useEffect(() => {
    setEstMonte(true);
  }, []);

  const etape = etapes[indexCourant];
  const estDerniere = indexCourant === etapes.length - 1;

  // Calcul du rectangle de l'élément cible
  const actualiserPosition = useCallback(() => {
    if (!etape || !etape.cibleSelector) {
      setRectCible(null);
      return;
    }

    const el = document.querySelector(etape.cibleSelector);
    if (!el) {
      setRectCible(null);
      return;
    }

    const rect = el.getBoundingClientRect();
    setRectCible({
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
      bottom: rect.bottom,
      right: rect.right,
    });
  }, [etape]);

  useLayoutEffect(() => {
    if (!actif || !etape) return;

    if (etape.cibleSelector) {
      const el = document.querySelector(etape.cibleSelector);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
      }
    }

    // Actualise immédiatement et après un court délai pour les transitions / scrolls
    actualiserPosition();
    const timer = setTimeout(actualiserPosition, 300);

    window.addEventListener("resize", actualiserPosition);
    window.addEventListener("scroll", actualiserPosition, true);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", actualiserPosition);
      window.removeEventListener("scroll", actualiserPosition, true);
    };
  }, [actif, etape, actualiserPosition]);

  const suivant = useCallback(() => {
    if (estDerniere) {
      surTerminer();
    } else {
      setIndexCourant((i) => i + 1);
    }
  }, [estDerniere, surTerminer]);

  const precedent = useCallback(() => {
    setIndexCourant((i) => Math.max(0, i - 1));
  }, []);

  // Raccourcis clavier
  useEffect(() => {
    if (!actif) return;

    function gererTouche(e: KeyboardEvent) {
      if (e.key === "Escape") {
        surPasser();
      } else if (e.key === "ArrowRight") {
        suivant();
      } else if (e.key === "ArrowLeft") {
        precedent();
      }
    }

    window.addEventListener("keydown", gererTouche);
    return () => window.removeEventListener("keydown", gererTouche);
  }, [actif, suivant, precedent, surPasser]);

  if (!estMonte || !actif || !etape) return null;

  // Calcul du style de la boîte de dialogue (popover)
  const positionnerBulle = () => {
    if (!rectCible || etape.position === "center") {
      return {
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        position: "fixed" as const,
      };
    }

    const marge = 16;
    const largeurBulle = 380;
    const position = etape.position || "bottom";

    let top = 0;
    let left = 0;

    switch (position) {
      case "bottom":
        top = rectCible.bottom + marge;
        left = Math.max(
          marge,
          Math.min(
            rectCible.left + (rectCible.width / 2) - (largeurBulle / 2),
            window.innerWidth - largeurBulle - marge,
          ),
        );
        break;
      case "top":
        top = Math.max(marge, rectCible.top - marge - 220);
        left = Math.max(
          marge,
          Math.min(
            rectCible.left + (rectCible.width / 2) - (largeurBulle / 2),
            window.innerWidth - largeurBulle - marge,
          ),
        );
        break;
      case "right":
        left = Math.min(rectCible.right + marge, window.innerWidth - largeurBulle - marge);
        top = Math.max(marge, Math.min(rectCible.top, window.innerHeight - 250));
        break;
      case "left":
        left = Math.max(marge, rectCible.left - largeurBulle - marge);
        top = Math.max(marge, Math.min(rectCible.top, window.innerHeight - 250));
        break;
    }

    // Garde la bulle dans la fenêtre visible
    top = Math.max(marge, Math.min(top, window.innerHeight - 260));

    return {
      top: `${top}px`,
      left: `${left}px`,
      position: "fixed" as const,
    };
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] transition-opacity duration-300"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-titre"
    >
      {/* Masque SVG avec trou transparent (Spotlight) sur l'élément ciblé */}
      <svg
        className="pointer-events-auto absolute inset-0 size-full"
        style={{ fillRule: "evenodd" }}
      >
        <defs>
          <mask id={`mask-spotlight-${tourId}`}>
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {rectCible && (
              <rect
                x={rectCible.left - 8}
                y={rectCible.top - 8}
                width={rectCible.width + 16}
                height={rectCible.height + 16}
                rx="14"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(6, 10, 8, 0.82)"
          mask={`url(#mask-spotlight-${tourId})`}
          className="backdrop-blur-[3px] transition-all duration-300"
        />
      </svg>

      {/* Cadre net, lumineux et stable (sans clignotement) autour de la cible */}
      {rectCible && (
        <div
          className="pointer-events-none fixed rounded-2xl border-2 border-primaire shadow-[0_0_0_4px_rgba(47,111,79,0.25),0_0_35px_rgba(47,111,79,0.35)] transition-all duration-300"
          style={{
            top: `${rectCible.top - 8}px`,
            left: `${rectCible.left - 8}px`,
            width: `${rectCible.width + 16}px`,
            height: `${rectCible.height + 16}px`,
          }}
        />
      )}

      {/* Bulle / Popover explicative */}
      <div
        style={positionnerBulle()}
        className={cx(
          "w-[calc(100vw-32px)] sm:w-[400px] z-[101] rounded-2xl border border-primaire/30 bg-surface p-5 shadow-2xl transition-all duration-300 animate-in fade-in zoom-in-95",
        )}
      >
        {/* En-tête : Badge d'étape + Bouton fermer/skip */}
        <div className="flex items-center justify-between gap-2 border-b border-bordure/60 pb-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-primaire/15 px-2.5 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wider text-primaire">
              {etape.badge ?? `Étape ${indexCourant + 1} / ${etapes.length}`}
            </span>
          </div>

          <button
            type="button"
            onClick={surPasser}
            aria-label="Passer la visite guidée"
            className="rounded-lg p-1 text-texte-discret transition-colors hover:bg-surface-2 hover:text-texte"
            title="Passer (Échap)"
          >
            <IconeFermer className="size-4" />
          </button>
        </div>

        {/* Corps de l'étape */}
        <div className="mt-3.5 space-y-2">
          <h3 id="tour-titre" className="font-serif text-lg font-medium text-texte leading-snug">
            {etape.titre}
          </h3>
          <p className="text-xs leading-relaxed text-texte-attenue">
            {etape.description}
          </p>
        </div>

        {/* Barre de progression avec points (dots) */}
        <div className="mt-5 flex items-center justify-between pt-3 border-t border-bordure/50">
          <div className="flex items-center gap-1.5">
            {etapes.map((_, i) => (
              <span
                key={i}
                className={cx(
                  "h-1.5 rounded-full transition-all duration-300",
                  i === indexCourant
                    ? "w-5 bg-primaire"
                    : i < indexCourant
                      ? "w-2 bg-primaire/40"
                      : "w-1.5 bg-bordure",
                )}
              />
            ))}
          </div>

          {/* Boutons d'action */}
          <div className="flex items-center gap-2">
            {indexCourant > 0 && (
              <Bouton
                variante="secondaire"
                taille="petite"
                onClick={precedent}
              >
                Précédent
              </Bouton>
            )}

            <Bouton
              variante="principal"
              taille="petite"
              onClick={suivant}
              className="group shadow-md"
            >
              <span>{etape.boutonTexte ?? (estDerniere ? "Terminer" : "Suivant")}</span>
              {!estDerniere && <IconeFleche className="size-3 transition-transform group-hover:translate-x-0.5" />}
            </Bouton>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
