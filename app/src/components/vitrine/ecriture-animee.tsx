"use client";

import { useEffect, useState } from "react";

/**
 * Ligne « en cours d'écriture » de la vitrine : fait défiler des exemples
 * d'exercices comme s'ils s'écrivaient. Purement décoratif — le texte est
 * figé (première phrase, sans curseur) si le visiteur refuse le mouvement.
 */
const PHRASES = [
  "Factoriser x² - 5x + 6",
  "Cinq phrases au subjonctif",
  "Present perfect ou past simple ?",
  "Résoudre l'équation du second degré",
];

export function EcritureAnimee() {
  const [texte, setTexte] = useState("");

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const id = setTimeout(() => setTexte(PHRASES[0]), 0);
      return () => clearTimeout(id);
    }
    let indexPhrase = 0;
    let indexCaractere = 0;
    let efface = false;
    let minuteur: ReturnType<typeof setTimeout>;

    const tick = () => {
      const phrase = PHRASES[indexPhrase];
      indexCaractere += efface ? -1 : 1;
      setTexte(phrase.slice(0, indexCaractere));
      if (!efface && indexCaractere > phrase.length) {
        efface = true;
        minuteur = setTimeout(tick, 1800);
        return;
      }
      if (efface && indexCaractere === 0) {
        efface = false;
        indexPhrase = (indexPhrase + 1) % PHRASES.length;
      }
      minuteur = setTimeout(tick, efface ? 28 : 62);
    };

    minuteur = setTimeout(tick, 400);
    return () => clearTimeout(minuteur);
  }, []);

  return (
    <p
      aria-hidden
      className="w-full max-w-xs rounded-md border border-bordure-forte bg-surface px-3 py-2.5 text-left font-mono text-[0.8125rem] text-texte-attenue"
    >
      {texte}
      <span className="ml-0.5 inline-block h-4 w-[7px] animate-pulse bg-primaire align-[-2px]" />
    </p>
  );
}
