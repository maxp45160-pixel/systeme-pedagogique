import { Suspense } from "react";
import { chargerContexte } from "@/lib/store/context";
import { compteCourant } from "@/lib/supabase/server";
import { EntetePage } from "@/components/layout/entete-page";
import { SqueletteContenu } from "@/components/layout/squelette";
import { CarteProfil } from "@/components/dashboard/carte-profil";
import { PanneauCompte } from "@/components/profil/panneau-compte";

/**
 * Le compte, ses réglages et son profil d'apprentissage — sur une page.
 *
 * Trois modales disparaissent en devenant cette page : « Compte et réglages »,
 * « Danger compte » et « Supprimer ou réinitialiser les données ». La dernière
 * garde sa confirmation modale, qui est une garde avant un geste irréversible ;
 * les deux autres n'étaient que du rangement, et le rangement d'un écran de
 * réglages est une page.
 *
 * La carte de profil vient du tableau de bord, où elle occupait une place que
 * l'action du jour lui disputait — c'est une donnée qu'on met à jour de temps
 * en temps, pas une chose qu'on regarde en ouvrant l'application.
 */
export default async function PageCompte() {
  return (
    <>
      <EntetePage
        titre="Compte"
        sousTitre="Ton profil d'apprentissage, la connexion au tuteur, l'apparence et tes données."
      />
      <Suspense fallback={<SqueletteContenu />}>
        <ContenuCompte />
      </Suspense>
    </>
  );
}

async function ContenuCompte() {
  const [ctx, compte] = await Promise.all([chargerContexte(), compteCourant()]);

  return (
    <div className="space-y-6">
      {/*
        Ce que le profil déclare, et ce qui lui manque — au-dessus du formulaire
        qui permet de le compléter. L'ancienne carte renvoyait vers une modale ;
        ici la cible est juste en dessous.
      */}
      <CarteProfil user={ctx.donnees.user} />

      <PanneauCompte
        profil={ctx.donnees.user}
        compteId={ctx.donnees.user.id}
        courriel={compte?.email ?? null}
      />
    </div>
  );
}
