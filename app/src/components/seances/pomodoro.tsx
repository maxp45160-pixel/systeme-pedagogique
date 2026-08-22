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

import { useCallback, useEffect, useRef, useState } from "react";
import { Bouton, Carte, EnTeteCarte, cx } from "@/components/ui/primitives";
import { IconeFermer } from "@/components/ui/icones";
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

const EVENT_POMODORO_SYNC = "pedagogie:pomodoro-sync";

/**
 * Hook Pomodoro partagé — synchronisé à la seconde près entre tous les composants montés.
 */
export function usePomodoro(compteId: string) {
  const hydrate = useEstHydrate();
  const cle = cleParCompte("pomodoro", compteId);

  const [etat, setEtat] = useState<EtatPersiste>(() => lireSession<EtatPersiste>(cle) ?? etatInitial());
  const [maintenant, setMaintenant] = useState(() => Date.now());
  const [signalFin, setSignalFin] = useState<PhasePomodoro | null>(null);
  const etatCourant = useRef(etat);
  const effacementSignal = useRef<number | null>(null);

  useEffect(() => {
    etatCourant.current = etat;
  }, [etat]);

  // Synchronisation réactive inter-composants et inter-onglets
  useEffect(() => {
    if (!hydrate) return;
    function surSync() {
      const e = lireSession<EtatPersiste>(cle);
      if (e) {
        setEtat(e);
        etatCourant.current = e;
      }
      setMaintenant(Date.now());
    }
    window.addEventListener(EVENT_POMODORO_SYNC, surSync);
    window.addEventListener("storage", surSync);
    return () => {
      window.removeEventListener(EVENT_POMODORO_SYNC, surSync);
      window.removeEventListener("storage", surSync);
    };
  }, [hydrate, cle]);

  const enMarche = etat.finPrevue !== undefined;
  const reste = secondesRestantes(etat, maintenant);
  const durees = dureesDe(etat);

  const diffuser = useCallback((prochain: EtatPersiste) => {
    setEtat(prochain);
    etatCourant.current = prochain;
    ecrireSession(cle, prochain);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(EVENT_POMODORO_SYNC));
    }
  }, [cle]);

  // Horloge active quand un cycle tourne
  useEffect(() => {
    if (!enMarche) return;
    const intervalle = setInterval(() => {
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
        diffuser(prochain);
        setSignalFin(phaseTerminee);
        jouerSignalFin();
        if (effacementSignal.current) window.clearTimeout(effacementSignal.current);
        effacementSignal.current = window.setTimeout(() => setSignalFin(null), 8_000);
      }
      setMaintenant(instant);
    }, 1000);
    return () => {
      clearInterval(intervalle);
      if (effacementSignal.current) window.clearTimeout(effacementSignal.current);
    };
  }, [enMarche, diffuser]);

  function demarrer() {
    const instant = Date.now();
    setMaintenant(instant);
    setSignalFin(null);
    const e = etatCourant.current;
    const prochain = {
      ...e,
      finPrevue: instant + (e.resteAuArret ?? dureesDe(e)[e.phase] * 60) * 1000 +
        (e.resteAuArret === undefined ? 0 : 1000),
      resteAuArret: undefined,
    };
    diffuser(prochain);
  }

  function suspendre() {
    const instant = Date.now();
    setMaintenant(instant);
    setSignalFin(null);
    const e = etatCourant.current;
    const prochain = {
      ...e,
      finPrevue: undefined,
      resteAuArret: secondesRestantes(e, instant),
    };
    diffuser(prochain);
  }

  function reinitialiser() {
    setSignalFin(null);
    setMaintenant(Date.now());
    const e = etatCourant.current;
    const prochain = {
      phase: "focus" as const,
      ...(e.dureesMin ? { dureesMin: e.dureesMin } : {}),
    };
    diffuser(prochain);
  }

  function oublierReglages() {
    setSignalFin(null);
    effacerSession(cle);
    diffuser(etatInitial());
  }

  function changerPhase(phase: PhasePomodoro) {
    setSignalFin(null);
    const e = etatCourant.current;
    const prochain = { ...e, phase, finPrevue: undefined, resteAuArret: undefined };
    diffuser(prochain);
  }

  function reglerDuree(phase: PhasePomodoro, valeur: number) {
    setSignalFin(null);
    const e = etatCourant.current;
    const dureesMin = { ...dureesDe(e), [phase]: bornerDuree(valeur) };
    const prochain = {
      ...e,
      dureesMin,
      ...(e.phase === phase ? { finPrevue: undefined, resteAuArret: undefined } : {}),
    };
    diffuser(prochain);
  }

  return {
    hydrate,
    etat,
    enMarche,
    reste,
    durees,
    signalFin,
    demarrer,
    suspendre,
    reinitialiser,
    oublierReglages,
    changerPhase,
    reglerDuree,
  };
}

export function Pomodoro({ compteId }: { compteId: string }) {
  const {
    hydrate,
    etat,
    enMarche,
    reste,
    durees,
    signalFin,
    demarrer,
    suspendre,
    reinitialiser,
    oublierReglages,
    changerPhase,
    reglerDuree,
  } = usePomodoro(compteId);

  const [reglageOuvert, setReglageOuvert] = useState(false);

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
            className="mt-3 rounded-lg border border-succes/40 bg-succes-faible px-3 py-2 text-center text-xs font-medium text-succes"
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
/**
 * Le filet ambiant du Bureau (ADR-101) — deux pixels en haut de la fenêtre.
 *
 * Il ne porte AUCUN chiffre, et c'est tout le propos : un décompte lisible
 * réclame un regard toutes les minutes, ce qui est l'inverse de ce qu'un
 * minuteur de concentration devrait produire. Le filet dit seulement que le
 * temps passe, et dans quelle phase. Le nombre reste dans `Pomodoro` et dans
 * la pastille du rail, pour qui va le chercher.
 *
 * Comme tout le reste du minuteur, il n'écrit rien et n'entre dans aucun
 * calcul (ADR-045) : la fraction affichée est dérivée de l'échéance, jamais
 * stockée.
 */
export function FiletPomodoro({ compteId }: { compteId: string }) {
  const { hydrate, etat, enMarche, reste, durees } = usePomodoro(compteId);

  if (!hydrate || !enMarche) return null;

  const total = durees[etat.phase] * 60;
  // `reste` peut dépasser `total` d'une seconde juste après un réglage : on
  // borne plutôt que d'afficher un filet qui déborde.
  const fraction = total > 0 ? Math.max(0, Math.min(1, reste / total)) : 0;
  const estFocus = etat.phase === "focus";

  return (
    <div
      aria-hidden
      className="filet-ambiant pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5"
      title={`Pomodoro (${LIBELLES[etat.phase]}) en cours`}
    >
      <i
        className={cx("block h-full transition-[width] duration-1000 ease-linear", estFocus ? "bg-primaire" : "bg-succes")}
        style={{ width: `${fraction * 100}%` }}
      />
    </div>
  );
}

export function PastillePomodoroGlobale({ compteId }: { compteId: string }) {
  const { hydrate, etat, enMarche, reste, reinitialiser } = usePomodoro(compteId);

  if (!hydrate || !enMarche) return null;

  const estFocus = etat.phase === "focus";

  return (
    <div
      className={cx(
        "flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium shadow-sm transition-all",
        estFocus
          ? "border border-primaire/30 bg-primaire-faible text-primaire"
          : "border border-succes/30 bg-succes-faible text-succes",
      )}
      title={`Pomodoro (${LIBELLES[etat.phase]}) en cours`}
    >
      <span className="font-mono tabular-nums font-semibold">{formaterMMSS(reste)}</span>
      <button
        type="button"
        onClick={reinitialiser}
        aria-label="Fermer le minuteur"
        title="Fermer le minuteur"
        className={cx("rounded-full p-0.5 transition-opacity hover:opacity-70", estFocus ? "text-primaire" : "text-succes")}
      >
        <IconeFermer className="size-3.5" />
      </button>
    </div>
  );
}
