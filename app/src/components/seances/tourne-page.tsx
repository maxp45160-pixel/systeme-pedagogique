"use client";

import {
  forwardRef,
  useImperativeHandle,
  useRef,
  type ReactNode,
} from "react";

const DUREE = 320;
const COURBE = "cubic-bezier(.36,.06,.24,1)";
const ANGLE = 96;

export interface TournePageHandle {
  tourner: (sens: 1 | -1) => void;
}

export const TournePage = forwardRef<TournePageHandle, { children: ReactNode }>(
  function TournePage({ children }, ref) {
    const racine = useRef<HTMLDivElement>(null);
    const hote = useRef<HTMLDivElement>(null);

    useImperativeHandle(ref, () => ({
      tourner(sens: 1 | -1) {
        if (typeof window === "undefined") return;
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

        const scene = hote.current;
        const feuillet = racine.current?.querySelector<HTMLElement>("[data-feuillet]");
        if (!scene || !feuillet) return;
        if (typeof feuillet.animate !== "function") return;

        const boite = feuillet.getBoundingClientRect();
        const repere = scene.getBoundingClientRect();
        if (boite.width === 0 || boite.height === 0) return;

        const versLaGauche = sens > 0;

        const calque = document.createElement("div");
        calque.className = versLaGauche
          ? "feuillet-tournant"
          : "feuillet-tournant vers-la-droite";
        calque.setAttribute("aria-hidden", "true");
        calque.style.top = `${boite.top - repere.top}px`;
        calque.style.left = `${boite.left - repere.left}px`;
        calque.style.width = `${boite.width}px`;
        calque.style.height = `${boite.height}px`;

        const recto = document.createElement("div");
        recto.className = "face-feuillet";
        const verso = document.createElement("div");
        verso.className = "face-feuillet verso";

        const photo = document.createElement("div");
        photo.className = "photo-feuillet";
        photo.innerHTML = feuillet.innerHTML;
        recto.appendChild(photo);

        const classeLustre = versLaGauche
          ? "lustre-feuillet"
          : "lustre-feuillet vers-la-droite";
        const lustre = document.createElement("div");
        lustre.className = classeLustre;
        recto.appendChild(lustre);

        const lustreVerso = document.createElement("div");
        lustreVerso.className = classeLustre;
        verso.appendChild(lustreVerso);

        calque.append(recto, verso);

        const ombre = document.createElement("div");
        ombre.className = versLaGauche
          ? "ombre-du-pli"
          : "ombre-du-pli vers-la-droite";
        ombre.setAttribute("aria-hidden", "true");
        ombre.style.top = `${boite.top - repere.top}px`;
        ombre.style.left = `${boite.left - repere.left}px`;
        ombre.style.width = `${boite.width}px`;
        ombre.style.height = `${boite.height}px`;

        scene.append(ombre, calque);

        const signe = versLaGauche ? -1 : 1;
        const animRotation = calque.animate(
          [
            { transform: "rotateY(0deg)", opacity: 1 },
            { transform: `rotateY(${signe * ANGLE * 0.55}deg)`, opacity: 1, offset: 0.55 },
            { transform: `rotateY(${signe * ANGLE}deg)`, opacity: 0 },
          ],
          { duration: DUREE, easing: COURBE, fill: "forwards" },
        );

        for (const reflet of [lustre, lustreVerso]) {
          reflet.animate(
            [{ opacity: 0 }, { opacity: 0.32, offset: 0.5 }, { opacity: 0 }],
            { duration: DUREE, easing: "ease-in-out" },
          );
        }

        ombre.animate(
          [{ opacity: 0 }, { opacity: 0.28, offset: 0.4 }, { opacity: 0 }],
          { duration: DUREE, easing: "ease-out" },
        );

        animRotation.finished
          .catch(() => {})
          .finally(() => {
            calque.remove();
            ombre.remove();
          });
      },
    }));

    return (
      <div ref={racine} className="tourne-page relative">
        {children}
        <div ref={hote} className="hote-du-tour" aria-hidden />
      </div>
    );
  },
);
