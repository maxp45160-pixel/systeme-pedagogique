"use client";

import { useState, type FormEvent } from "react";
import {
  IconeAmpoule,
  IconeCompetences,
  IconeExercices,
  IconeFleche,
  IconeNote,
  IconePlus,
  IconeProjet,
} from "@/components/ui/icones";
import { useIntention } from "./contexte-intention";

const LIBELLE = "Déclarer un besoin";

/**
 * Rappel sobre du geste d'entrée du funnel dans un état vide.
 *
 * Les vides (Atelier sans domaine, Cahier sans séance) décrivent ce qu'on
 * peut y faire mais n'offraient pas le geste : la ligne nomme « Déclarer un
 * besoin » ET le porte — le mot est le déclencheur, qui ouvre l'instance
 * unique de capture d'intention. Aucun second mécanisme.
 */
export function RappelNouveauBesoin() {
  const { ouvrir } = useIntention();

  return (
    <p className="flex flex-wrap items-center justify-center gap-1.5 text-xs text-texte-discret">
      <IconePlus className="size-3.5 shrink-0" aria-hidden />
      <span>Appuyez sur</span>
      <button
        type="button"
        onClick={() => ouvrir()}
        className="rounded font-semibold text-primaire underline-offset-2 transition-colors hover:text-primaire-fort hover:underline cursor-pointer"
      >
        Déclarer un besoin
      </button>
      <span>pour démarrer.</span>
    </p>
  );
}

/** Déclencheur du rail desktop, posé au-dessus des destinations. */
export function BoutonIntentionRail() {
  const { ouvrir } = useIntention();

  return (
    <button
      type="button"
      onClick={() => ouvrir()}
      aria-label={LIBELLE}
      title={LIBELLE}
      data-tour="nouveau-besoin"
      className="group flex w-full items-center gap-3 rounded-lg bg-[var(--rail-actif)] px-3 py-2.5 text-sm font-medium text-[var(--rail-actif-texte)] shadow-sm transition-opacity hover:opacity-90 rail-reduit:justify-center rail-reduit:px-0"
    >
      <IconePlus className="size-[18px] shrink-0" />
      <span className="truncate rail-reduit:hidden">{LIBELLE}</span>
    </button>
  );
}

/**
 * Déclencheur mobile, au centre de la barre inférieure.
 */
export function BoutonIntentionMobile() {
  const { ouvrir } = useIntention();

  return (
    <button
      type="button"
      onClick={() => ouvrir()}
      aria-label={LIBELLE}
      data-tour="nouveau-besoin"
      className="flex w-full flex-col items-center justify-center py-1.5"
    >
      <span className="flex size-10 items-center justify-center rounded-full bg-primaire text-surface shadow-md">
        <IconePlus className="size-5" />
      </span>
    </button>
  );
}

const SUGGESTIONS_AMORCAGE = [
  {
    libelle: "Séance express 15 min",
    prompt: "Je veux faire une séance courte de 15 minutes pour m'entraîner",
    Icone: IconeExercices,
  },
  {
    libelle: "Réviser mes points faibles",
    prompt: "Je veux retravailler mes compétences les plus fragiles",
    Icone: IconeCompetences,
  },
  {
    libelle: "Créer une fiche de cours",
    prompt: "Je souhaite créer une fiche de synthèse pour résumer mon cours",
    Icone: IconeNote,
  },
  {
    libelle: "Lancer un projet",
    prompt: "Je veux construire un projet pratique",
    Icone: IconeProjet,
  },
];

/**
 * Déclencheur principal du tableau de bord.
 *
 * Conçu comme une barre de chat IA interactive avec bouton d'envoi intégré
 * et suggestions d'amorçage rapide en un clic.
 */
export function BoutonIntentionDashboard() {
  const { ouvrir } = useIntention();
  const [saisie, setSaisie] = useState("");
  const [cadre, setCadre] = useState<"besoin" | "module" | "continu">("besoin");

  const gererSoumission = (e: FormEvent) => {
    e.preventDefault();
    const besoinInitial = saisie.trim() || undefined;
    if (cadre === "besoin") {
      ouvrir(besoinInitial);
    } else {
      ouvrir({ besoinInitial, usageDomaine: cadre });
    }
  };

  const estDeclarationDomaine = cadre !== "besoin";

  return (
    <div className="space-y-2" data-tour="nouveau-besoin">
      {/* Vraie barre de prompt IA immersive avec bouton d'action intégré */}
      <form
        onSubmit={gererSoumission}
        className="group relative flex items-center rounded-xl border border-bordure bg-surface p-1.5 sm:p-2 shadow-xs transition-all hover:border-primaire/50 focus-within:border-primaire focus-within:ring-2 focus-within:ring-primaire/20"
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primaire/15 text-primaire transition-transform group-focus-within:scale-105">
          <IconeAmpoule className="size-4" />
        </span>

        <input
          type="text"
          value={saisie}
          onChange={(e) => setSaisie(e.target.value)}
          placeholder={
            cadre === "module"
              ? "Ex. Algorithmique — semestre 1"
              : cadre === "continu"
                ? "Ex. Programmation Python"
                : "Décrivez ce que vous souhaitez apprendre ou préparer aujourd’hui..."
          }
          className="w-full bg-transparent px-3 py-1.5 text-xs sm:text-sm text-texte placeholder:text-texte-discret focus:outline-none"
        />
        <select
          aria-label="Cadre de déclaration"
          value={cadre}
          onChange={(e) => setCadre(e.target.value as typeof cadre)}
          className="max-w-[11rem] shrink-0 rounded-lg border border-bordure bg-surface px-2 py-1.5 text-[0.6875rem] text-texte-attenue focus:border-primaire focus:outline-none"
        >
          <option value="besoin">Besoin d’apprentissage</option>
          <option value="module">Module académique</option>
          <option value="continu">Progression continue</option>
        </select>

        <button
          type="submit"
          className="flex items-center gap-1.5 rounded-lg bg-primaire px-3.5 py-1.5 text-xs font-medium text-surface shadow-xs transition-all hover:bg-primaire/90 active:scale-95 shrink-0 cursor-pointer"
        >
          <span>{estDeclarationDomaine ? "Déclarer" : "Exprimer"}</span>
          <IconeFleche className="size-3.5" />
        </button>
      </form>

      {/* Raccourcis d'inspiration / Chips */}
      {cadre === "besoin" && <div className="flex flex-wrap items-center gap-1.5 px-1">
        <span className="text-[0.6875rem] font-medium text-texte-discret mr-1">
          Suggestions :
        </span>
        {SUGGESTIONS_AMORCAGE.map(({ libelle, prompt, Icone }) => (
          <button
            key={libelle}
            type="button"
            onClick={() => ouvrir(prompt)}
            className="group/chip inline-flex items-center gap-1.5 rounded-full border border-bordure bg-surface/80 px-2.5 py-0.5 text-[0.6875rem] text-texte-attenue transition-all hover:border-primaire/40 hover:bg-surface hover:text-texte cursor-pointer shadow-2xs"
          >
            <Icone className="size-3 text-texte-discret transition-colors group-hover/chip:text-primaire" />
            <span>{libelle}</span>
          </button>
        ))}
      </div>}
    </div>
  );
}
