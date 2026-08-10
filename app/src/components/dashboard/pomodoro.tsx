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
 * C'est aussi pour cette raison que les durées sont **librement réglables** :
 * 25/5 n'est qu'un point de départ, et comme aucun calcul ne les lit, les
 * changer n'a aucune conséquence ailleurs. Une borne existe malgré tout (1 à
 * 120 min) — elle empêche une faute de frappe de rendre le minuteur inutile,
 * elle ne prétend rien mesurer.
 *
 * L'état (phase, échéance, durées réglées) vit en `sessionStorage`, isolé par
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

const DUREES_PAR_DEFAUT: Record<PhasePomodoro, number> = { focus: 25, pause: 5 };

/** Bornes de saisie, en minutes. Garde-fou de frappe, pas une règle pédagogique. */
export const POMODORO_MIN = 1;
export const POMODORO_MAX = 120;

const LIBELLES: Record<PhasePomodoro, string> = {
  focus: "Concentration",
  pause: "Pause",
};

interface EtatPersiste {
  phase: PhasePomodoro;
  /** Horodatage (ms) auquel le minuteur atteint zéro. Absent : à l'arrêt. */
  finPrevue?: number;
  /** Secondes restantes au moment de la mise en pause manuelle. */
  resteAuArret?: number;
  /** Durées réglées par la personne, en minutes. Absentes = valeurs par défaut. */
  dureesMin?: Record<PhasePomodoro, number>;
}

function etatInitial(): EtatPersiste {
  return { phase: "focus" };
}

/** Les durées effectives — celles réglées, ou celles par défaut. */
function dureesDe(etat: EtatPersiste): Record<PhasePomodoro, number> {
  return etat.dureesMin ?? DUREES_PAR_DEFAUT;
}

/**
 * Secondes restantes, dérivées de l'état persisté et de l'horloge — jamais
 * stockées telles quelles : un décompte écrit chaque seconde en
 * `sessionStorage` n'apporterait rien et userait le stockage pour rien. Seule
 * l'échéance (`finPrevue`) est persistée ; le nombre affiché se recalcule.
 */
function secondesRestantes(etat: EtatPersiste, maintenant: number): number {
  if (etat.finPrevue === undefined) {
    return etat.resteAuArret ?? dureesDe(etat)[etat.phase] * 60;
  }
  return Math.max(0, Math.round((etat.finPrevue - maintenant) / 1000));
}

function formaterMMSS(secondes: number): string {
  const m = Math.floor(secondes / 60);
  const s = secondes % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function bornerDuree(valeur: number): number {
  if (!Number.isFinite(valeur)) return POMODORO_MIN;
  return Math.min(POMODORO_MAX, Math.max(POMODORO_MIN, Math.round(valeur)));
}

export function Pomodoro({ compteId }: { compteId: string }) {
  const hydrate = useEstHydrate();
  const cle = cleParCompte("pomodoro", compteId);

  const [etat, setEtat] = useState<EtatPersiste>(() => lireSession<EtatPersiste>(cle) ?? etatInitial());
  const [maintenant, setMaintenant] = useState(() => Date.now());
  const [reglageOuvert, setReglageOuvert] = useState(false);
  const intervalle = useRef<ReturnType<typeof setInterval> | null>(null);

  const enMarche = etat.finPrevue !== undefined;
  const reste = secondesRestantes(etat, maintenant);
  const durees = dureesDe(etat);

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
      const instant = Date.now();
      setEtat((e) => {
        if (e.finPrevue === undefined || instant < e.finPrevue) return e;
        const suivante: PhasePomodoro = e.phase === "focus" ? "pause" : "focus";
        return {
          ...e,
          phase: suivante,
          finPrevue: instant + dureesDe(e)[suivante] * 60_000,
          resteAuArret: undefined,
        };
      });
      setMaintenant(instant);
    }, 1000);
    return () => {
      if (intervalle.current) clearInterval(intervalle.current);
    };
  }, [enMarche]);

  function demarrer() {
    setEtat((e) => ({
      ...e,
      finPrevue: Date.now() + (e.resteAuArret ?? dureesDe(e)[e.phase] * 60) * 1000,
      resteAuArret: undefined,
    }));
  }

  function suspendre() {
    setEtat((e) => ({
      ...e,
      finPrevue: undefined,
      resteAuArret: secondesRestantes(e, Date.now()),
    }));
  }

  function reinitialiser() {
    // Les durées réglées survivent : réinitialiser remet le compteur à zéro,
    // pas les préférences. Effacer les deux d'un même bouton obligerait à
    // re-régler après chaque cycle interrompu.
    setEtat((e) => ({ phase: "focus", ...(e.dureesMin ? { dureesMin: e.dureesMin } : {}) }));
  }

  function oublierReglages() {
    setEtat(etatInitial());
    effacerSession(cle);
  }

  function changerPhase(phase: PhasePomodoro) {
    setEtat((e) => ({ ...e, phase, finPrevue: undefined, resteAuArret: undefined }));
  }

  /**
   * Régler une durée remet le compteur de cette phase à zéro.
   *
   * Sans cela, passer la concentration de 25 à 50 minutes laisserait afficher
   * les 25 minutes d'avant : le nombre saisi et le nombre affiché diraient deux
   * choses différentes, et on ne saurait pas laquelle fait foi.
   */
  function reglerDuree(phase: PhasePomodoro, valeur: number) {
    setEtat((e) => {
      const dureesMin = { ...dureesDe(e), [phase]: bornerDuree(valeur) };
      return {
        ...e,
        dureesMin,
        ...(e.phase === phase ? { finPrevue: undefined, resteAuArret: undefined } : {}),
      };
    });
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
              {LIBELLES[p]} · {durees[p]} min
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

        <div className="mt-3 text-center">
          <button
            type="button"
            onClick={() => setReglageOuvert((v) => !v)}
            aria-expanded={reglageOuvert}
            className="text-[0.6875rem] text-primaire hover:underline"
          >
            {reglageOuvert ? "Masquer les réglages" : "Régler les durées"}
          </button>
        </div>

        {reglageOuvert && (
          <div className="mt-3 space-y-2 border-t border-bordure pt-3">
            {(["focus", "pause"] as PhasePomodoro[]).map((p) => (
              <label key={p} className="flex items-center justify-between gap-3 text-xs">
                <span className="text-texte-attenue">{LIBELLES[p]}</span>
                <span className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={POMODORO_MIN}
                    max={POMODORO_MAX}
                    value={durees[p]}
                    disabled={enMarche}
                    onChange={(e) => reglerDuree(p, Number(e.target.value))}
                    className="h-7 w-20 rounded-md border border-bordure-controle bg-surface px-1.5 py-1 text-xs text-texte disabled:opacity-50"
                  />
                  <span className="text-texte-discret">min</span>
                </span>
              </label>
            ))}
            <p className="text-[0.6875rem] text-texte-discret">
              De {POMODORO_MIN} à {POMODORO_MAX} minutes. Ces durées ne servent qu&apos;à
              rythmer ton travail : aucun calcul du système ne les lit.
              {enMarche && " Suspends le minuteur pour les modifier."}
            </p>
            <button
              type="button"
              onClick={oublierReglages}
              className="text-[0.6875rem] text-texte-discret hover:underline"
            >
              Revenir à {DUREES_PAR_DEFAUT.focus}/{DUREES_PAR_DEFAUT.pause}
            </button>
          </div>
        )}
      </div>
    </Carte>
  );
}
