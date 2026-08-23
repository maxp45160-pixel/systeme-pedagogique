"use client";

/**
 * Chrono du mode épreuve — habillage seul.
 *
 * Il réutilise `usePomodoro` tel quel : même état en `sessionStorage` isolé
 * par compte (`cleParCompte`), même discipline — il n'écrit RIEN en base,
 * n'entre dans aucun calcul. La durée cible de la séance (`dureeFocusMin`)
 * ne fait que remplacer le défaut de 25 min tant que la personne n'a pas
 * réglé ses propres durées : entrer en épreuve chronométrée doit afficher le
 * temps de l'épreuve, pas celui d'un pomodoro générique.
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

export function ChronoEpreuve({
  compteId,
  dureeFocusMin,
}: {
  compteId: string;
  /** Durée cible de la séance — défaut de focus tant qu'aucun réglage utilisateur n'existe. */
  dureeFocusMin?: number;
}) {
  const { hydrate, etat, enMarche, reste, demarrer, suspendre } = usePomodoro(
    compteId,
    dureeFocusMin ? { focus: Math.min(120, Math.max(1, Math.round(dureeFocusMin))) } : undefined,
  );

  return (
    <div
      className={cx(
        "flex items-center gap-2 rounded-lg border border-primaire/30 bg-primaire-faible px-2.5 py-1",
      )}
      title="Chrono du mode épreuve"
    >
      <IconeMinuteur className="size-4 shrink-0 text-primaire" aria-hidden />
      <span className="chiffres font-mono text-sm font-semibold tabular-nums text-primaire">
        {hydrate ? formaterMMSS(reste) : "--:--"}
      </span>
      <span className="hidden text-[0.625rem] uppercase tracking-wide text-texte-discret sm:inline">
        {etat.phase === "pause" ? "Pause" : "Concentration"}
      </span>
      {hydrate &&
        (enMarche ? (
          <Bouton variante="secondaire" taille="petite" onClick={suspendre}>
            Suspendre
          </Bouton>
        ) : (
          <Bouton variante="principal" taille="petite" onClick={demarrer}>
            Lancer
          </Bouton>
        ))}
    </div>
  );
}
