import { Suspense } from "react";
import { chargerContexte } from "@/lib/store/context";
import { compteCourant } from "@/lib/supabase/server";
import { resoudreIdentite } from "@/lib/domain/identite";
import { EntetePage } from "@/components/layout/entete-page";
import { SqueletteContenu } from "@/components/layout/squelette";
import { PanneauCompte } from "@/components/profil/panneau-compte";

/**
 * Le compte, ses réglages et son profil d'apprentissage organisés par onglets.
 */
export default async function PageCompte() {
  return (
    <>
      <EntetePage
        titre="Compte et réglages"
        sousTitre="Votre profil d'apprentissage, connexion au tuteur, apparence et données."
      />
      <Suspense fallback={<SqueletteContenu />}>
        <ContenuCompte />
      </Suspense>
    </>
  );
}

async function ContenuCompte() {
  const [ctx, compte] = await Promise.all([chargerContexte(), compteCourant()]);
  const identite = resoudreIdentite(compte, ctx.donnees.user);
  const profilEnrichi = {
    ...ctx.donnees.user,
    prenom: identite.nom,
    avatarUrl: identite.avatarUrl ?? ctx.donnees.user.avatarUrl,
  };

  return (
    <div className="max-w-4xl">
      <PanneauCompte
        profil={profilEnrichi}
        compteId={ctx.donnees.user.id}
        courriel={compte?.email ?? null}
      />
    </div>
  );
}
