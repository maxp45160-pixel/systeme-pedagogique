import Link from "next/link";

import { Carte } from "@/components/ui/primitives";
import { IconeFleche } from "@/components/ui/icones";
import { chargerLotPropositions } from "@/lib/store/relecture-referentiel";
import { PastilleNombre } from "@/components/layout/pastille-propositions";

/**
 * L'entrée du tableau de bord vers les propositions à arbitrer — ADR-108,
 * révisée par ADR-118.
 *
 * ## Deux surfaces, et ce n'est pas un doublon
 *
 * La pastille du rail est un **signal** : elle suit sur toutes les pages, et
 * dit qu'il y a quelque chose sans jamais déranger. Cette carte est une
 * **entrée de pilotage** : le tableau de bord est l'endroit où l'on décide de
 * ce qu'on fait maintenant (arbitrage de Maxime, 24/08/2026), et ranger son
 * référentiel en fait partie. Les retirer l'une pour l'autre revient chaque
 * fois à perdre une moitié : la carte seule ne se voit que sur un écran, la
 * pastille seule ne propose rien.
 *
 * ## Elle ne dit qu'un nombre
 *
 * Elle ne recopie aucune proposition. Arbitrer demande de lire un motif, et un
 * motif tronqué sur un tableau de bord se refuse mal — or un refus ne revient
 * pas. Le tableau de bord signale ; l'arbitrage se fait où il y a la place de
 * lire.
 *
 * ## Elle ne rend rien quand il n'y a rien
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
          <p className="flex items-center gap-2 text-sm font-medium">
            {/*
              Le même rond que dans le rail, sur ce qu'il compte : c'est ce qui
              répond à « d'où vient cette notification rouge ? » sans une phrase
              d'explication. Pas un lien ici — la carte entière en est un.
            */}
            <PastilleNombre total={total} />
            <span className="min-w-0 truncate">
              {total === 1
                ? "Une proposition pour votre référentiel"
                : `${total} propositions pour votre référentiel`}
            </span>
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
