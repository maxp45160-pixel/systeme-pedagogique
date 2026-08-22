"use client";

/**
 * Chrono du mode épreuve — habillage seul.
 *
 * Il réutilise `usePomodoro` tel quel : même état en `sessionStorage` isolé
 * par compte (`cleParCompte`), même discipline — il n'écrit RIEN en base,
 * ne pré-remplit aucune durée, n'entre dans aucun calcul. La seule différence
 * avec `Pomodoro` est l'habillage : un bandeau large et lisible, pensé pour
 * rester sous les yeux pendant toute la séance (persona concours daté).
 *
 * ⚠️ Le temps qu'il affiche n'est pas une mesure : `dureeMin` reste la somme
 * observée des tentatives à la clôture (ADR-071), jamais le décompte du
 * minuteur.
 */

import { Bouton, cx } from "@/components/ui/primitives";
import { IconeMinuteur } from "@/components/ui/icones";
import { usePomodoro } from "./pomodoro";

function formaterMMSS(secondes: number): string {
  const m = Math.floor(secondes / 60);
  const s = secondes % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function ChronoEpreuve({ compteId }: { compteId: string }) {
  const { hydrate, etat, enMarche, reste, demarrer, suspendre } = usePomodoro(compteId);

  return (
    <div className="border-b border-bordure/60 bg-fond/60">
      <div className="flex items-center justify-between gap-4 px-4 py-2 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-primaire/30 bg-primaire-faible text-primaire" aria-hidden>
            <IconeMinuteur className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-texte-discret">
              Mode épreuve · {etat.phase === "pause" ? "Pause" : "Concentration"}
            </p>
            <p className="chiffres font-mono text-2xl font-medium tabular-nums leading-tight">
              {hydrate ? formaterMMSS(reste) : "--:--"}
            </p>
          </div>
        </div>
        {hydrate &&
          (enMarche ? (
            <Bouton variante="secondaire" taille="petite" onClick={suspendre}>
              Suspendre
            </Bouton>
          ) : (
            <Bouton variante="principal" taille="petite" onClick={demarrer}>
              Lancer le chrono
            </Bouton>
          ))}
      </div>
      <div
        aria-hidden
        className={cx(
          "h-px w-full",
          enMarche && hydrate ? "bg-primaire/40" : "bg-transparent",
        )}
      />
    </div>
  );
}
