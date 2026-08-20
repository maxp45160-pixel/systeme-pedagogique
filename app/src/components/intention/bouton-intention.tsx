"use client";

import { IconePlus } from "@/components/ui/icones";
import { useIntention } from "./contexte-intention";

/**
 * Les deux déclencheurs du point d'entrée `+`.
 *
 * Deux composants et non un seul paramétré : le rail et la barre mobile n'ont
 * ni la même forme, ni le même rôle visuel — l'un est une entrée de liste
 * dominante, l'autre est le centre de gravité de la barre. Un composant unique
 * finirait en empilement de variantes pour deux usages qui ne convergent pas.
 *
 * Le libellé est le même dans les deux : « Nouveau besoin », pas « Créer ».
 * Ce bouton ne demande pas quoi créer — c'est tout l'objet du chantier.
 */

const LIBELLE = "Nouveau besoin";

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
 *
 * Rendu comme une pastille en relief plutôt qu'un onglet : ce n'est pas une
 * destination, et le montrer comme les autres entrées laisserait croire qu'il
 * y a une page derrière.
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
