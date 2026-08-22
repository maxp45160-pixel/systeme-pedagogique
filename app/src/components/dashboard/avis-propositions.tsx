import Link from "next/link";

import { Carte } from "@/components/ui/primitives";
import { IconeFleche } from "@/components/ui/icones";
import { chargerLotPropositions } from "@/lib/store/relecture-referentiel";

/**
 * L'avis qui dit qu'il y a des propositions à regarder — ADR-108.
 *
 * ## Pourquoi il existe
 *
 * ADR-108 prescrit « une surface unique », et le diagnostic qui l'ouvre est
 * que quatre détecteurs tournaient dans le vide faute d'écran. Un écran seul
 * dans l'Atelier reproduirait ce défaut d'un cran : il faudrait penser à le
 * visiter. La demande d'origine était « recevoir des propositions », pas
 * « aller les chercher ».
 *
 * ## Pourquoi il ne dit qu'un nombre
 *
 * Il ne recopie aucune proposition. Arbitrer demande de lire un motif, et un
 * motif tronqué sur un tableau de bord se refuse mal — or un refus ne revient
 * pas. Le tableau de bord signale ; l'arbitrage se fait où il y a la place de
 * lire.
 *
 * ## Il ne rend rien quand il n'y a rien
 *
 * Pas d'état vide, pas de « 0 proposition », pas de « relire ». Un bloc
 * permanent qui dit « rien » chaque jour apprend à ne plus regarder cet
 * endroit — et le jour où il dit quelque chose, on ne le voit plus.
 */
export async function AvisPropositions() {
  const lot = await chargerLotPropositions();
  const total = lot.propositions.length;
  if (total === 0) return null;

  return (
    <Carte interactive>
      <Link
        href="/atelier/propositions"
        className="flex items-center justify-between gap-4 p-4"
      >
        <div className="min-w-0">
          <p className="text-sm font-medium">
            {total === 1
              ? "Une proposition pour votre référentiel"
              : `${total} propositions pour votre référentiel`}
          </p>
          <p className="mt-0.5 text-xs text-texte-attenue">
            De quoi le ranger, le relier, ou l&apos;élargir. Rien ne s&apos;écrit sans vous.
          </p>
        </div>
        <IconeFleche className="size-4 shrink-0 text-texte-discret" />
      </Link>
    </Carte>
  );
}
