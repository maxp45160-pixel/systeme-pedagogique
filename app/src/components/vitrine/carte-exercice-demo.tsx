"use client";

import { useState } from "react";
import { cx } from "@/components/ui/primitives";

/**
 * Carte de démonstration du héros : le visiteur choisit son temps disponible
 * et son énergie du moment, la carte affiche l'exercice correspondant.
 *
 * Les six combinaisons sont écrites à la main : c'est une démonstration
 * marketing, pas le moteur de recommandation — aucune donnée réelle n'est
 * lue, aucune requête n'est émise.
 */

type Temps = "10" | "25" | "45";
type Energie = "lourde" | "claire";

interface ExerciceDemo {
  matiere: string;
  titre: string;
  duree: string;
  tags: [string, string, string];
  pourquoi: string;
}

const ACTIONS: Record<`${Temps}-${Energie}`, ExerciceDemo> = {
  "10-lourde": {
    matiere: "Espagnol",
    titre: "Retrouver le bon temps du passé dans cinq phrases",
    duree: "8 à 10 min",
    tags: ["Révision", "5 phrases", "Rien à rédiger"],
    pourquoi:
      "Court, sans rédaction : ça tient en dix minutes même fatigué. Vous avez déjà réussi ce genre de repérage, on consolide plutôt que d'ouvrir un nouveau chantier.",
  },
  "10-claire": {
    matiere: "Mathématiques",
    titre: "Dériver trois fonctions composées",
    duree: "10 min",
    tags: ["Entraînement", "3 calculs", "Votre niveau"],
    pourquoi:
      "Vous n'y avez pas retouché depuis trois semaines, et c'est ce sur quoi reposent les études de fonctions que vous visez.",
  },
  "25-lourde": {
    matiere: "Mathématiques",
    titre: "Lire et commenter un tableau de variations déjà tracé",
    duree: "20 à 25 min",
    tags: ["Compréhension", "4 questions", "Rien à calculer"],
    pourquoi:
      "Le calcul est fait : tout l'effort porte sur la lecture, exactement là où vos deux derniers exercices ont coincé. Long, mais peu fatigant.",
  },
  "25-claire": {
    matiere: "Espagnol",
    titre: "Écrire cinq phrases au subjonctif à partir de situations",
    duree: "25 min",
    tags: ["Rédaction", "5 phrases", "Un cran plus dur"],
    pourquoi:
      "C'est la marche suivante après vos réussites en repérage. La difficulté monte d'un cran, pas de trois.",
  },
  "45-lourde": {
    matiere: "Anglais",
    titre: "Compléter un dialogue avec present perfect ou past simple",
    duree: "35 à 45 min",
    tags: ["Nouveau", "Dialogue", "Sans chrono"],
    pourquoi:
      "Vous venez de commencer l'anglais ici : ce premier vrai exercice posera les bases sans chronomètre ni pression.",
  },
  "45-claire": {
    matiere: "Mathématiques",
    titre: "Un devoir complet : trois exercices enchaînés",
    duree: "40 à 45 min",
    tags: ["Devoir complet", "Format examen", "Chrono possible"],
    pourquoi:
      "Tout ce que vous avez montré jusqu'ici tient sur des exercices courts. Un devoir entier est le seul moyen de savoir si ça tient sur la durée.",
  },
};

const TEMPS: { cle: Temps; libelle: string }[] = [
  { cle: "10", libelle: "10 min" },
  { cle: "25", libelle: "25 min" },
  { cle: "45", libelle: "45 min" },
];

const ENERGIES: { cle: Energie; libelle: string }[] = [
  { cle: "lourde", libelle: "Fatigué" },
  { cle: "claire", libelle: "En forme" },
];

function GroupeSegmente<T extends string>({
  libelle,
  options,
  actif,
  onChange,
}: {
  libelle: string;
  options: { cle: T; libelle: string }[];
  actif: T;
  onChange: (cle: T) => void;
}) {
  return (
    <div>
      <span className="mb-1.5 block font-mono text-[0.6875rem] uppercase tracking-wide text-texte-discret">
        {libelle}
      </span>
      <div className="flex rounded-md border border-bordure-forte bg-fond p-0.5" role="group" aria-label={libelle}>
        {options.map((option) => {
          const estActif = option.cle === actif;
          return (
            <button
              key={option.cle}
              type="button"
              aria-pressed={estActif}
              onClick={() => onChange(option.cle)}
              className={cx(
                "flex-1 rounded px-2 py-1.5 text-[0.8125rem] font-medium transition-colors",
                estActif
                  ? "bg-primaire text-primaire-contraste"
                  : "text-texte-attenue hover:bg-primaire-faible hover:text-texte",
              )}
            >
              {option.libelle}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function CarteExerciceDemo() {
  const [temps, setTemps] = useState<Temps>("25");
  const [energie, setEnergie] = useState<Energie>("claire");

  const exercice = ACTIONS[`${temps}-${energie}`];

  return (
    <section
      aria-label="Démonstration : votre prochain exercice"
      className="w-full overflow-hidden rounded-carte border border-bordure bg-surface shadow-[var(--ombre-carte)]"
    >
      <div className="flex items-center justify-between gap-3 border-b border-bordure bg-surface-2 px-4 py-2.5">
        <span className="font-mono text-[0.6875rem] uppercase tracking-wide text-texte-discret">
          Votre prochain exercice
        </span>
      </div>

      <div className="grid gap-4 px-5 pb-1 pt-4">
        <GroupeSegmente libelle="Le temps que vous avez" options={TEMPS} actif={temps} onChange={setTemps} />
        <GroupeSegmente libelle="Votre énergie du moment" options={ENERGIES} actif={energie} onChange={setEnergie} />
      </div>

      <div key={`${temps}-${energie}`} className="apparition border-t border-bordure px-5 pb-5 pt-4" aria-live="polite">
        <div className="flex items-baseline justify-between gap-3">
          <span className="font-mono text-[0.6875rem] uppercase tracking-wide text-primaire">{exercice.matiere}</span>
          <span className="chiffres font-mono text-xs text-texte-discret">{exercice.duree}</span>
        </div>
        <h3 className="mt-2 font-serif text-lg leading-snug text-texte">{exercice.titre}</h3>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {exercice.tags.map((tag, index) => (
            <span
              key={tag}
              className={
                index === 1
                  ? "rounded-full border border-primaire/30 bg-primaire-faible px-2 py-0.5 font-mono text-[0.625rem] uppercase tracking-wide text-primaire"
                  : "rounded-full border border-bordure px-2 py-0.5 font-mono text-[0.625rem] uppercase tracking-wide text-texte-attenue"
              }
            >
              {tag}
            </span>
          ))}
        </div>
        <p className="mt-3 border-t border-dashed border-bordure-forte pt-3 text-sm leading-relaxed text-texte-attenue">
          <b className="font-semibold text-texte">Pourquoi celle-ci ?</b> {exercice.pourquoi}
        </p>
      </div>
    </section>
  );
}
