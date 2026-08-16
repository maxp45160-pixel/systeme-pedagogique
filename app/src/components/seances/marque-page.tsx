"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { cleMarquePage, ecrireLocal, lireLocal } from "@/lib/ui/stockage-local";
import { pageDOuverture } from "@/lib/domain/pages-cahier";

/**
 * Le marque-page du cahier.
 *
 * Deux gestes, et un seul composant parce qu'ils partagent la même clé :
 *
 *  - **poser** — sur une page ouverte, on retient le jour regardé ;
 *  - **reprendre** — arrivé sur `/seances` sans jour, on va chercher le
 *    dernier.
 *
 * ## Pourquoi côté client
 *
 * Parce que c'est une préférence d'affichage, pas une donnée du compte. La
 * stocker en base demanderait une colonne, une écriture à chaque page tournée,
 * et ferait d'un confort de lecture une donnée que le système prétend détenir.
 *
 * ## Pourquoi une redirection et pas un rendu direct
 *
 * Le serveur ne peut pas connaître le marque-page : il ne voit pas
 * `localStorage`. La page du jour est donc rendue normalement — elle est juste,
 * jamais vide — et ce composant redirige ensuite si un marque-page plus
 * pertinent existe. On ne montre jamais un écran d'attente pour une préférence.
 *
 * `replace` et non `push` : le retour arrière doit sortir du cahier, pas
 * rejouer une redirection que personne n'a demandée.
 */
export function MarquePage({
  compteId,
  jour,
  jours,
  /** Vrai quand l'URL ne portait aucun jour : c'est le seul cas où l'on redirige. */
  reprendre = false,
}: {
  compteId: string;
  jour: string;
  /** Les pages qui existent. Un marque-page qui n'en désigne aucune est périmé. */
  jours: string[];
  reprendre?: boolean;
}) {
  const router = useRouter();

  useEffect(() => {
    const cle = cleMarquePage(compteId);

    if (reprendre) {
      /*
       * `pageDOuverture` tranche, et c'est la même fonction que le serveur
       * appliquerait s'il voyait `localStorage` : un marque-page périmé — le
       * jour d'une séance annulée depuis — ne doit pas rouvrir une page vide.
       */
      const voulue = pageDOuverture(lireLocal<string>(cle), jours, new Date());
      if (voulue !== jour) {
        router.replace(`/seances?jour=${encodeURIComponent(voulue)}`);
        return;
      }
    }

    ecrireLocal(cle, jour);
  }, [compteId, jour, jours, reprendre, router]);

  return null;
}
