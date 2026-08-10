"use client";

/**
 * Minuteur pomodoro — outil de confort seul (lot 4.1, D5).
 *
 * ⚠️ **Aucun lien avec la mesure.** Il n'écrit rien en base, ne pré-remplit
 * aucune durée d'exercice, n'entre dans aucun calcul (`dureeDeReference`,
 * `tentativeMenee`, `calculerActivite`). ADR-045 : `dureeDeReference` compare
 * une tentative à la **médiane des durées réellement observées**, jamais à un
 * minuteur qu'on aurait pu couper avant la fin ou laisser courir après. Un
 * cycle pomodoro n'est pas une tentative, et les deux ne doivent jamais se
 * confondre — ni maintenant, ni par un branchement ultérieur « pour faire
 * simple ».
 *
 * L'état (phase, secondes restantes) vit en `sessionStorage`, isolé par
 * compte via `cleParCompte` — même règle que toute clé de stockage navigateur
 * (CLAUDE.md §8). Lu dans un initialiseur paresseux derrière `useEstHydrate`,
 * jamais dans un `useEffect` : le serveur ne peut pas savoir où en est un
 * minuteur côté client, et un `useEffect` qui le seederait après coup
 * provoquerait la cascade de rendus que React déconseille.
 */

import { useEffect, useRef, useState } from "react";
import { Bouton, Carte, EnTeteCarte } from "@/components/ui/primitives";
import { cleParCompte, ecrireSession, effacerSession, lireSession } from "@/lib/ui/stockage-session";
import { useEstHydrate } from "@/lib/ui/hydratation";

type PhasePomodoro = "focus" | "pause";

const DUREES: Record<PhasePomodoro, number> = {
  focus: 25 * 60,
  pause: 5 * 60,
};

const LIBELLES: Record<PhasePomodoro, string> = {
  focus: "Concentration",
  pause: "Pause",
};

interface EtatPersiste {
  phase: PhasePomodoro;
  /** Horodatage (ms) auquel le minuteur atteint zéro. Absent : en pause (au sens bouton). */
  finPrevue?: number;
  /** Secondes restantes au moment de la mise en pause manuelle. */
  resteAuArret?: number;
}

function etatInitial(): EtatPersiste {
  return { phase: "focus" };
}

/**
 * Secondes restantes, dérivées de l'état persisté et de l'horloge — jamais
 * stockées telles quelles : un décompte écrit chaque seconde en
 * `sessionStorage` n'apporterait rien et userait le stockage pour rien. Seule
 * l'échéance (`finPrevue`) est persistée ; le nombre affiché se recalcule.
 */
function secondesRestantes(etat: EtatPersiste, maintenant: number): number {
  if (etat.finPrevue === undefined) {
    return etat.resteAuArret ?? DUREES[etat.phase];
  }
  return Math.max(0, Math.round((etat.finPrevue - maintenant) / 1000));
}

function formaterMMSS(secondes: number): string {
  const m = Math.floor(secondes / 60);
  const s = secondes % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function Pomodoro({ compteId }: { compteId: string }) {
  const hydrate = useEstHydrate();
  const cle = cleParCompte("pomodoro", compteId);

  const [etat, setEtat] = useState<EtatPersiste>(() => lireSession<EtatPersiste>(cle) ?? etatInitial());
  const [maintenant, setMaintenant] = useState(() => Date.now());
  const intervalle = useRef<ReturnType<typeof setInterval> | null>(null);

  const enMarche = etat.finPrevue !== undefined;
  const reste = secondesRestantes(etat, maintenant);

  // Persiste à chaque changement d'état — après hydratation seulement, pour ne
  // pas écraser une valeur lue avant que le composant ait fini de se poser.
  useEffect(() => {
    if (!hydrate) return;
    ecrireSession(cle, etat);
  }, [hydrate, cle, etat]);

  /*
   * Le décompte affiché avance chaque seconde tant que le minuteur tourne, et
   * la bascule focus ↔ pause à zéro se décide dans le CALLBACK du minuteur —
   * pas dans le corps de l'effet. Un effet qui appelle `setState`
   * synchroniquement à chaque rendu où `reste` vaut 0 déclenche la cascade de
   * rendus que React déconseille ; ici, `setEtat` ne s'exécute que depuis le
   * `setInterval`, un événement externe au rendu, ce qui est exactement ce
   * pour quoi `useEffect` existe (synchroniser avec une horloge).
   */
  useEffect(() => {
    if (!enMarche) return;
    intervalle.current = setInterval(() => {
      const maintenant = Date.now();
      setEtat((e) => {
        if (e.finPrevue === undefined || maintenant < e.finPrevue) return e;
        const suivante: PhasePomodoro = e.phase === "focus" ? "pause" : "focus";
        return { phase: suivante, finPrevue: maintenant + DUREES[suivante] * 1000 };
      });
      setMaintenant(maintenant);
    }, 1000);
    return () => {
      if (intervalle.current) clearInterval(intervalle.current);
    };
  }, [enMarche]);

  function demarrer() {
    setEtat((e) => ({
      phase: e.phase,
      finPrevue: Date.now() + (e.resteAuArret ?? DUREES[e.phase]) * 1000,
    }));
  }

  function suspendre() {
    setEtat((e) => ({ phase: e.phase, resteAuArret: secondesRestantes(e, Date.now()) }));
  }

  function reinitialiser() {
    const initial = etatInitial();
    setEtat(initial);
    effacerSession(cle);
  }

  function changerPhase(phase: PhasePomodoro) {
    setEtat({ phase });
  }

  // Rien à afficher tant que l'état du navigateur n'est pas connu : le serveur
  // rendrait 25:00 et le client corrigerait aussitôt, un écart d'hydratation
  // visible pour rien. Un squelette neutre le temps d'un rendu.
  if (!hydrate) {
    return (
      <Carte>
        <EnTeteCarte titre="Pomodoro" />
        <div className="px-5 py-6 text-center text-2xl chiffres text-texte-discret">--:--</div>
      </Carte>
    );
  }

  return (
    <Carte>
      <EnTeteCarte
        titre="Pomodoro"
        legende="Un minuteur pour rythmer le travail — ne mesure rien, n'écrit rien."
      />
      <div className="px-5 py-4">
        <div className="flex items-center justify-center gap-1.5 text-[0.6875rem]">
          {(["focus", "pause"] as PhasePomodoro[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => changerPhase(p)}
              disabled={enMarche}
              className={
                p === etat.phase
                  ? "rounded border border-primaire/30 bg-primaire-faible px-2 py-0.5 font-medium text-primaire"
                  : "rounded border border-bordure px-2 py-0.5 text-texte-attenue disabled:opacity-50"
              }
            >
              {LIBELLES[p]}
            </button>
          ))}
        </div>

        <p className="chiffres mt-3 text-center text-4xl font-medium tabular-nums">
          {formaterMMSS(reste)}
        </p>

        <div className="mt-4 flex justify-center gap-2">
          {enMarche ? (
            <Bouton variante="secondaire" onClick={suspendre}>
              Suspendre
            </Bouton>
          ) : (
            <Bouton variante="principal" onClick={demarrer}>
              Démarrer
            </Bouton>
          )}
          <Bouton variante="secondaire" onClick={reinitialiser}>
            Réinitialiser
          </Bouton>
        </div>
      </div>
    </Carte>
  );
}
