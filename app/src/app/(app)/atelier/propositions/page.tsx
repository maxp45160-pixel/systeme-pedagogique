import { Suspense } from "react";

import { EntetePage } from "@/components/layout/entete-page";
import { SquelettePage } from "@/components/layout/squelette";
import { LotPropositions } from "@/components/referentiel/lot-propositions";
import { chargerContexte } from "@/lib/store/context";
import { chargerLotPropositions } from "@/lib/store/relecture-referentiel";
import { lireEnSections } from "@/lib/domain/propositions-lisibles";

/**
 * L'écran des propositions de référentiel — ADR-108.
 *
 * ## Pourquoi il vit sous l'Atelier, et non dans le rail
 *
 * Le rail décrit trois pôles de travail — piloter, visualiser, travailler — et
 * son commentaire dit explicitement qu'il ne décrit que des destinations
 * actives (ADR-063). Les propositions ne sont pas un quatrième pôle : elles
 * portent sur le référentiel, que l'Atelier porte déjà. Une route enfant allume
 * l'entrée « Atelier » sans ajouter de destination à mémoriser.
 *
 * On y arrive par l'avis du tableau de bord, qui est le vrai point d'entrée :
 * un écran qu'il faut penser à visiter reproduirait, un cran plus haut, le
 * défaut que cette ADR corrige.
 *
 * ## Aucune relecture n'est déclenchée par ce rendu
 *
 * La page LIT ce qui a été produit. Produire un lot appelle un fournisseur de
 * modèle, et un rendu de page n'est pas l'endroit où attendre quatre secondes.
 * La production passe par `POST /api/referentiel/relecture` — bouton explicite,
 * ou tâche de fond au chargement de l'Atelier.
 */

export default async function PagePropositions() {
  return (
    <Suspense fallback={<SquelettePage />}>
      <ContenuPropositions />
    </Suspense>
  );
}

async function ContenuPropositions() {
  const [ctx, lot] = await Promise.all([chargerContexte(), chargerLotPropositions()]);
  const sections = lireEnSections(lot.propositions, ctx.referentiel);

  return (
    <>
      <EntetePage
        titre="Propositions"
        sousTitre="Ce que votre référentiel gagnerait à ranger, relier ou apprendre. Rien ne s'écrit sans votre accord, et ce que vous refusez ne revient pas."
      />
      <LotPropositions sections={sections} relectureDue={lot.relectureDue} />
    </>
  );
}
