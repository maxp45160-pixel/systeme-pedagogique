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
 *  - **poser** — sur un feuillet ouvert, on retient le jour ET le rang ;
 *  - **reprendre** — arrivé sur `/seances` sans jour, on va chercher le dernier.
 *
 * Le rang compte autant que le jour depuis qu'un jour porte plusieurs
 * feuillets : rouvrir une journée à trois séances sur la première alors qu'on
 * s'était arrêté à la troisième, c'est perdre exactement ce qu'un marque-page
 * sert à garder.
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
  rang,
  jours,
  /** Vrai quand l'URL ne portait aucun jour : c'est le seul cas où l'on redirige. */
  reprendre = false,
}: {
  compteId: string;
  jour: string;
  /** Le feuillet ouvert dans ce jour, déjà borné par le serveur. */
  rang: number;
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
      const pose = lirePose(cle);
      const voulue = pageDOuverture(pose?.jour, jours, new Date());
      /*
       * Le rang n'est pas revalidé ici : le composant ne sait pas combien de
       * feuillets porte le jour visé, et deviner produirait un mauvais rang
       * plutôt qu'aucun. Le serveur le bornera (`rangDOuverture`) — un rang
       * périmé retombe sur le dernier feuillet, jamais sur du vide.
       */
      const rangVoulu = voulue === pose?.jour ? Math.max(1, pose.rang) : 1;
      if (voulue !== jour || rangVoulu !== rang) {
        router.replace(lienFeuillet(voulue, rangVoulu));
        return;
      }
    }

    ecrireLocal(cle, { jour, rang });
  }, [compteId, jour, rang, jours, reprendre, router]);

  return null;
}

interface PoseMarquePage {
  jour: string;
  rang: number;
}

/**
 * Le marque-page tel qu'il a été posé.
 *
 * Les marque-pages écrits avant les feuillets sont une simple chaîne de
 * caractères : on les lit encore, au rang 1. Les jeter obligerait à rouvrir le
 * cahier au jour courant la première fois — une régression silencieuse pour qui
 * l'avait posé ailleurs.
 */
function lirePose(cle: string): PoseMarquePage | null {
  const brut = lireLocal<string | PoseMarquePage>(cle);
  if (!brut) return null;
  if (typeof brut === "string") return { jour: brut, rang: 1 };
  if (typeof brut.jour !== "string") return null;
  return { jour: brut.jour, rang: typeof brut.rang === "number" ? brut.rang : 1 };
}

function lienFeuillet(jour: string, rang: number): string {
  const base = `/seances?jour=${encodeURIComponent(jour)}`;
  return rang > 1 ? `${base}&f=${rang}` : base;
}
