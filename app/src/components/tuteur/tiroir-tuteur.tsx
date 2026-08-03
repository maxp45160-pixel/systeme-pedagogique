"use client";

/**
 * Tiroir du tuteur — le chat en panneau coulissant (lot 3).
 *
 * Le tuteur n'est plus une destination de navigation : il devient un tiroir,
 * ouvert là où poser une question a un sens — pendant une tentative
 * (`/exercices/[id]`), ou sur une fiche compétence (`/competences/[code]`).
 *
 * Le tiroir garde l'énoncé visible : c'est la réponse directe au défaut
 * « demander de l'aide envoie sur /tuteur et on perd de vue l'énoncé ».
 *
 * La conversation est la même que sur `/tuteur` — même `sessionStorage` par
 * compte (`cleParCompte`, ADR-029). Un lien « ouvrir en pleine page » permet
 * de passer au chat plein écran pour les longues conversations.
 *
 * Pas de bouton flottant global : le tiroir s'ouvre depuis les endroits où
 * poser une question a un sens, pas partout.
 */

import { useState } from "react";
import Link from "next/link";
import { ChatTuteur, type EtatContexteTuteur } from "@/components/tuteur/chat";
import { classesBouton } from "@/components/ui/primitives";

export function TiroirTuteur({
  etatInitial,
  competenceCiblee,
  exerciceCible,
  codesCompetences,
  compteId,
  libelle = "Demander de l'aide au tuteur",
}: {
  etatInitial: EtatContexteTuteur;
  competenceCiblee?: string;
  exerciceCible?: string;
  codesCompetences: string[];
  compteId: string;
  libelle?: string;
}) {
  const [ouvert, setOuvert] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className={classesBouton("secondaire", "petite")}
      >
        {libelle}
      </button>

      {ouvert && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Tuteur"
          onClick={() => setOuvert(false)}
        >
          <div
            className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-bordure bg-surface shadow-[var(--ombre-surcouche)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 border-b border-bordure px-4 py-3">
              <div className="min-w-0">
                <h2 className="font-serif text-sm font-medium">IA Tutor</h2>
                <p className="truncate text-[0.6875rem] text-texte-discret">
                  Il reçoit les protocoles du système et l&apos;état réel de tes compétences.
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Link
                  href={`/tuteur${exerciceCible ? `?exercice=${encodeURIComponent(exerciceCible)}` : competenceCiblee ? `?competence=${encodeURIComponent(competenceCiblee)}` : ""}`}
                  className="text-[0.6875rem] text-primaire hover:underline"
                >
                  Ouvrir en pleine page
                </Link>
                <button
                  type="button"
                  onClick={() => setOuvert(false)}
                  aria-label="Fermer"
                  className="rounded-md px-2 py-1 text-sm text-texte-attenue transition-colors hover:bg-surface-2 hover:text-texte"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              <ChatTuteur
                etatInitial={etatInitial}
                competenceCiblee={competenceCiblee}
                exerciceCible={exerciceCible}
                codesCompetences={codesCompetences}
                compteId={compteId}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
