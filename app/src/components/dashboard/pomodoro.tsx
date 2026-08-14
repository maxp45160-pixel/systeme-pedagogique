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
import { Bouton, Carte, EnTeteCarte, cx } from "@/components/ui/primitives";
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
  // Le premier affichage doit être 24:59 pour un cycle de 25 minutes. Le
  // décompte représente la seconde en cours, pas une seconde supplémentaire
  // ajoutée par l'arrondi d'une échéance future.
  return Math.max(0, Math.ceil((etat.finPrevue - maintenant) / 1000) - 1);
}

function jouerSignalFin(): void {
  if (typeof window === "undefined") return;
  try {
    const contexte = new window.AudioContext();
    const oscillateur = contexte.createOscillator();
    const gain = contexte.createGain();
    const debut = contexte.currentTime;
    oscillateur.type = "sine";
    oscillateur.frequency.setValueAtTime(880, debut);
    oscillateur.frequency.setValueAtTime(660, debut + 0.18);
    gain.gain.setValueAtTime(0.0001, debut);
    gain.gain.exponentialRampToValueAtTime(0.16, debut + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, debut + 0.42);
    oscillateur.connect(gain);
    gain.connect(contexte.destination);
    oscillateur.addEventListener("ended", () => void contexte.close(), { once: true });
    oscillateur.start(debut);
    oscillateur.stop(debut + 0.42);
  } catch {
    // Le navigateur peut refuser l'AudioContext : le signal visuel reste actif.
  }
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
  const [signalFin, setSignalFin] = useState<PhasePomodoro | null>(null);
  const intervalle = useRef<ReturnType<typeof setInterval> | null>(null);
  const etatCourant = useRef(etat);
  const effacementSignal = useRef<number | null>(null);

  useEffect(() => {
    etatCourant.current = etat;
  }, [etat]);

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
      const e = etatCourant.current;
      if (e.finPrevue !== undefined && instant >= e.finPrevue) {
        const phaseTerminee = e.phase;
        const suivante: PhasePomodoro = phaseTerminee === "focus" ? "pause" : "focus";
        const prochain = {
          ...e,
          phase: suivante,
          finPrevue: instant + dureesDe(e)[suivante] * 60_000,
          resteAuArret: undefined,
        } satisfies EtatPersiste;
        etatCourant.current = prochain;
        setEtat(prochain);
        setSignalFin(phaseTerminee);
        jouerSignalFin();
        if (effacementSignal.current) window.clearTimeout(effacementSignal.current);
        effacementSignal.current = window.setTimeout(() => setSignalFin(null), 8_000);
      }
      setMaintenant(instant);
    }, 1000);
    return () => {
      if (intervalle.current) clearInterval(intervalle.current);
      if (effacementSignal.current) window.clearTimeout(effacementSignal.current);
    };
  }, [enMarche]);

  function demarrer() {
    const instant = Date.now();
    setMaintenant(instant);
    setSignalFin(null);
    setEtat((e) => ({
      ...e,
      // `secondesRestantes` retire la seconde en cours pour afficher 24:59 au
      // départ ; on la restitue à la reprise d'un minuteur suspendu afin de ne
      // pas perdre une seconde à chaque cycle pause/reprise.
      finPrevue: instant + (e.resteAuArret ?? dureesDe(e)[e.phase] * 60) * 1000 +
        (e.resteAuArret === undefined ? 0 : 1000),
      resteAuArret: undefined,
    }));
  }

  function suspendre() {
    const instant = Date.now();
    setMaintenant(instant);
    setSignalFin(null);
    setEtat((e) => ({
      ...e,
      finPrevue: undefined,
      resteAuArret: secondesRestantes(e, instant),
    }));
  }

  function reinitialiser() {
    // Les durées réglées survivent : réinitialiser remet le compteur à zéro,
    // pas les préférences. Effacer les deux d'un même bouton obligerait à
    // re-régler après chaque cycle interrompu.
    setSignalFin(null);
    setMaintenant(Date.now());
    setEtat((e) => ({ phase: "focus", ...(e.dureesMin ? { dureesMin: e.dureesMin } : {}) }));
  }

  function oublierReglages() {
    setSignalFin(null);
    setEtat(etatInitial());
    effacerSession(cle);
  }

  function changerPhase(phase: PhasePomodoro) {
    setSignalFin(null);
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
    setSignalFin(null);
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

        {signalFin && (
          <div
            role="status"
            aria-live="assertive"
            className="mt-3 rounded-lg border border-succes/40 bg-succes-faible px-3 py-2 text-center text-xs font-medium text-succes animate-pulse"
          >
            {LIBELLES[signalFin]} terminée · {LIBELLES[etat.phase].toLocaleLowerCase("fr-FR")} lancée
          </div>
        )}

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

/**
 * Pastille compacte indiquant le temps restant du Pomodoro quand il est actif.
 * S'insère dans l'en-tête ou la barre mobile.
 */
export function PastillePomodoroGlobale({ compteId }: { compteId: string }) {
  const hydrate = useEstHydrate();
  const cle = cleParCompte("pomodoro", compteId);
  const [etat, setEtat] = useState<EtatPersiste>(() => lireSession<EtatPersiste>(cle) ?? etatInitial());
  const [maintenant, setMaintenant] = useState(() => Date.now());

  useEffect(() => {
    if (!hydrate) return;
    const intervalle = setInterval(() => {
      const e = lireSession<EtatPersiste>(cle);
      if (e) setEtat(e);
      setMaintenant(Date.now());
    }, 1000);
    return () => clearInterval(intervalle);
  }, [hydrate, cle]);

  if (!hydrate || etat.finPrevue === undefined) return null;

  const reste = secondesRestantes(etat, maintenant);
  const estFocus = etat.phase === "focus";

  return (
    <div
      className={cx(
        "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium shadow-sm transition-all animate-pulse",
        estFocus
          ? "border border-primaire/30 bg-primaire-faible text-primaire"
          : "border border-succes/30 bg-succes-faible text-succes",
      )}
      title={`Pomodoro (${LIBELLES[etat.phase]}) en cours`}
    >
      <span>{estFocus ? "⏱️" : "☕"}</span>
      <span className="font-mono tabular-nums font-semibold">{formaterMMSS(reste)}</span>
    </div>
  );
}

