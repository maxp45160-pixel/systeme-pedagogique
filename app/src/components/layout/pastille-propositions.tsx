import Link from "next/link";

import { chargerLotPropositions } from "@/lib/store/relecture-referentiel";
import { cx } from "@/components/ui/primitives";

/**
 * Le nombre de propositions de référentiel à arbitrer, posé sur la destination
 * de pilotage — ADR-108, révisé le 24/08/2026.
 *
 * ## Pourquoi une pastille et non une carte
 *
 * L'avis vivait dans une carte du tableau de bord (« 28 propositions pour votre
 * référentiel »). Elle disait un nombre et un lien — soit tout ce qu'une
 * pastille dit — en occupant la largeur d'une colonne, sur un seul écran. Le
 * rail est visible partout : le signal cesse d'être une chose à croiser sur la
 * page d'accueil, et cesse en même temps de prendre de la place.
 *
 * Ce qui ne change pas : elle ne recopie aucune proposition. Arbitrer demande
 * de lire un motif, et un motif tronqué se refuse mal — or un refus ne revient
 * pas. La pastille signale ; l'arbitrage se fait là où il y a la place de lire.
 *
 * ## Elle est elle-même le lien
 *
 * Et elle doit l'être : la destination du rail mène au tableau de bord, pas aux
 * propositions. Sans lien propre, la pastille annonçait un nombre sans donner
 * accès à ce qu'il compte, et `/atelier/propositions` redevenait ce qu'ADR-108
 * lui reprochait déjà — un écran atteignable de nulle part (constaté par
 * Maxime le 24/08/2026, aussitôt après le retrait de la carte).
 *
 * D'où le montage : elle est posée EN DEHORS du lien de navigation, en frère
 * dans le `<li>`, jamais imbriquée dedans. Deux `<a>` l'un dans l'autre sont
 * invalides, et le navigateur défait l'imbrication à sa façon.
 *
 * ## Elle ne rend rien quand il n'y a rien
 *
 * Pas de « 0 », pas de point gris. Un compteur permanent qui affiche zéro
 * apprend à ne plus regarder cet endroit — et le jour où il compte quelque
 * chose, on ne le voit plus.
 */
export async function PastillePropositions({ className }: { className?: string }) {
  const lot = await chargerLotPropositions();
  const total = lot.propositions.length;
  if (total === 0) return null;

  return <PastilleNombre total={total} lien className={className} />;
}

/**
 * Le rond rouge lui-même, sans lecture.
 *
 * Séparé de `PastillePropositions` pour que la carte du tableau de bord — qui
 * connaît déjà son total — porte EXACTEMENT le même rond que le rail, sans
 * relire quoi que ce soit. C'est ce qui répond à « d'où viennent ces notifs
 * rouges ? » : le même objet, sur le compteur et sur ce qu'il compte. Deux
 * ronds dessinés séparément auraient fini par diverger, et la réponse avec eux.
 *
 * `lien` : dans le rail, la pastille doit mener quelque part par elle-même —
 * la destination du rail ne va pas aux propositions. Sur la carte, non : la
 * carte entière est déjà le lien, et un `<a>` dans un `<a>` est invalide.
 */
export function PastilleNombre({
  total,
  lien = false,
  className,
}: {
  total: number;
  lien?: boolean;
  className?: string;
}) {
  const libelle =
    total === 1
      ? "1 proposition à arbitrer"
      : `${total} propositions à arbitrer`;
  const classes = cx(
    "inline-flex h-[1.125rem] min-w-[1.125rem] shrink-0 items-center justify-center rounded-full bg-danger px-1 text-[0.625rem] font-semibold leading-none text-white",
    lien && "transition-opacity hover:opacity-80",
    className,
  );
  // Au-delà de 99, le rond s'allongerait plus que le libellé qu'il suit.
  const contenu = <span aria-hidden>{total > 99 ? "99+" : total}</span>;

  // Le nombre seul ne dit pas de quoi il parle : lu par une synthèse vocale,
  // « 5 » collé au nom de la destination n'a aucun sens.
  if (!lien) {
    return (
      <span className={classes} aria-label={libelle} title={libelle} role="img">
        {contenu}
      </span>
    );
  }

  return (
    <Link href="/atelier/propositions" className={classes} aria-label={libelle} title={libelle}>
      {contenu}
    </Link>
  );
}
