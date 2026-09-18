"use client";

import { IconePlus } from "@/components/ui/icones";
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
