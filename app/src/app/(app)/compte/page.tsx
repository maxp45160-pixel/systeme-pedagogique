import { Suspense } from "react";
import { chargerContexte } from "@/lib/store/context";
import { compteCourant } from "@/lib/supabase/server";
import { resoudreIdentite } from "@/lib/domain/identite";
import {
  cheminRetourSain,
  estOngletCompte,
} from "@/lib/domain/onglets-compte";
import { EntetePage } from "@/components/layout/entete-page";
import { SqueletteContenu } from "@/components/layout/squelette";
import { PanneauCompte } from "@/components/profil/panneau-compte";
import { lireQuotaTuteur } from "@/lib/store/quota-tuteur";

/**
 * Le compte, ses réglages et son profil d'apprentissage organisés par onglets.
 *
 * `?onglet=tuteur` ouvre directement l'onglet de la clé IA (deep-link posé par
 * les bandeaux d'échec du tuteur) ; `?retour=/…` ramène l'utilisateur à
 * l'endroit où il bloquait, après l'enregistrement.
 */
export default async function PageCompte(props: {
  searchParams: Promise<{ onglet?: string; retour?: string }>;
}) {
  const { onglet, retour } = await props.searchParams;

  return (
    <>
      <EntetePage
        titre="Compte et réglages"
        sousTitre="Votre profil d'apprentissage, connexion au tuteur, apparence et données."
      />
      <Suspense fallback={<SqueletteContenu />}>
        <ContenuCompte
          ongletInitial={estOngletCompte(onglet) ? onglet : undefined}
          retour={cheminRetourSain(retour)}
        />
      </Suspense>
    </>
  );
}

async function ContenuCompte({
  ongletInitial,
  retour,
}: {
  ongletInitial?: "profil" | "tuteur" | "preferences" | "donnees";
  retour?: string;
}) {
  const [ctx, compte, quota] = await Promise.all([
    chargerContexte(),
    compteCourant(),
    lireQuotaTuteur(),
  ]);
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
        ongletInitial={ongletInitial}
        retour={retour}
        quota={quota}
      />
    </div>
  );
}
