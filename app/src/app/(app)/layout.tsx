import { Suspense } from "react";
import { redirect } from "next/navigation";
import { compteCourant } from "@/lib/supabase/server";
import { lireAccesCourant } from "@/lib/store/acces";
import { Sidebar } from "@/components/layout/sidebar";
import { NavMobile } from "@/components/layout/nav-mobile";
import { PastillePropositions } from "@/components/layout/pastille-propositions";
import { CompteMobile } from "@/components/layout/compte";
import { ProfilPage } from "@/components/dev/profil-page";
import { ProfilWrapper } from "@/components/dev/profil-wrapper";
import { ProfilTracker } from "@/components/dev/profil-tracker";
import { ProfilFlottant } from "@/components/dev/profil-flottant";
import { TuteurGlobal } from "@/components/tuteur/tuteur-global";
import { resoudreIdentite } from "@/lib/domain/identite";
import { FournisseurIntention } from "@/components/intention/fournisseur-intention";
import { FournisseurOnboarding } from "@/components/onboarding/onboarding-context";
import { PastillePomodoroGlobale } from "@/components/seances/pomodoro";
import { chargerDomaines } from "@/lib/store/referentiel";

/**
 * Cadre du carnet : rail de navigation, marge.
 *
 * Le groupe `(app)` n'apparaît pas dans les URL. Il sépare les pages qui ont besoin du cadre de
 * celles qui n'en veulent pas (connexion, retour OAuth).
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const compte = await compteCourant();
  if (!compte) redirect("/login");

  /*
    Un accès suspendu sort du cadre applicatif (ADR-074).

    Ce n'est pas la barrière — RLS l'est, et un compte suspendu ne lirait de
    toute façon aucune ligne. C'est ce qui évite d'afficher une application
    intégralement vide, sans un mot pour dire pourquoi. La lecture est mémoïsée
    par requête : elle ne coûte qu'un aller-retour, une fois par rendu.
  */
  const acces = await lireAccesCourant();
  if (acces?.suspenduLe) redirect("/suspendu");
  /*
    Le cadre ne lit que les domaines, pas le référentiel complet : c'est la
    seule chose qu'il en montre (le point d'entrée `+` ci-dessous), et la page
    reçoit déjà compétences et rattachements par la RPC `charger_tout`.
    Mémoïsé par requête comme `chargerReferentiel` l'était.
  */
  const domaines = await chargerDomaines();
  const administrateur = acces?.role === "admin";

  /*
    Les propositions de référentiel, comptées sur « Tableau de bord ».

    Sur la destination de PILOTAGE, et non sur celle qui les arbitre
    (« Mes cours »), déplacée le 24/08/2026 : le tableau de bord porte déjà la
    carte des propositions, et c'est de là qu'on décide de ce qu'on fait
    maintenant. La pastille et la carte disent alors la même chose au même
    endroit — le rail ramène au tableau de bord, le tableau de bord mène à
    l'arbitrage. Le lien de la pastille, lui, continue de sauter directement à
    `/atelier/propositions`.

    Sous `Suspense` avec un repli VIDE, et c'est structurant : le rail est
    rendu sur CHAQUE page, la lecture ne doit donc jamais retarder le cadre.
    Un repli vide plutôt qu'un point gris — un compteur qui s'affiche avant de
    savoir ce qu'il compte annonce une chose qui, le plus souvent, n'existe
    pas. `chargerLotPropositions` est mémoïsé par requête : la pastille du rail
    et celle de la barre mobile ne provoquent qu'une lecture, et la page des
    propositions la partage.
  */
  const pastilles = {
    "/app": (
      <Suspense fallback={null}>
        <PastillePropositions className="absolute right-2.5 top-1/2 -translate-y-1/2 rail-reduit:right-1 rail-reduit:top-1 rail-reduit:translate-y-0" />
      </Suspense>
    ),
  };
  const pastillesMobile = {
    "/app": (
      <Suspense fallback={null}>
        <PastillePropositions />
      </Suspense>
    ),
  };

  const identite = resoudreIdentite(compte);
  const session = {
    courriel: compte.email ?? null,
    nom: identite.nom,
    avatar: identite.avatarUrl,
    // Identifiant du compte — isole la clé API saisie côté client (voir
    // `cle-client.ts` et `cleParCompte`).
    compteId: compte.id,
  };

  return (
    /*
      Le point d'entrée `+` et l'onboarding enveloppent tout le cadre : ses déclencheurs
      vivent dans le rail et dans la barre mobile.
    */
    <FournisseurOnboarding compteId={session.compteId}>
      <FournisseurIntention
        compteId={session.compteId}
        domainesExistants={domaines
          .filter((domaine) => !domaine.archive)
          .map(({ id, nom, prefixe }) => ({ id, nom, prefixe }))}
      >
        <div className="flex min-h-screen">
          <Sidebar session={session} administrateur={administrateur} pastilles={pastilles} />

          <div className="flex min-w-0 flex-1 flex-col">
            {/*
              Barre supérieure mobile : le nom du système et l'accès au compte.

              Le pied du rail — compte, export du journal, déconnexion, thème — est
              `hidden lg:flex`. Sans ce bouton, aucun de ces réglages n'était
              atteignable sur mobile (ADR-025).
            */}
            <div className="flex h-12 items-center justify-between gap-2 border-b border-bordure bg-surface px-4 lg:hidden">
              <div className="flex items-center gap-2 min-w-0">
                <div className="truncate text-sm font-semibold tracking-tight">
                  Système pédagogique
                </div>
                <PastillePomodoroGlobale compteId={session.compteId} />
              </div>
              <CompteMobile session={session} />
            </div>

            {/*
              Marge de carnet : filet discret courant sur toute la hauteur de la
              fenêtre (desktop). Le `flex-1` est ce qui le rend continu — porté par
              le bloc de contenu seul, le trait s'arrêtait à la dernière carte et
              laissait le bas de l'écran vide. Les paddings verticaux sont posés à
              l'intérieur du bloc pour que la bordure les englobe.
            */}
            <main className="flex flex-1 flex-col px-4 sm:px-6 lg:px-10">
              <div className="mx-auto w-full max-w-7xl flex-1 pb-24 pt-6 lg:border-l lg:border-marge lg:pb-12 lg:pl-10 lg:pt-8 2xl:max-w-[100rem]">
                <ProfilWrapper compteId={compte.id}>
                  <ProfilTracker compteId={compte.id} />
                  <ProfilPage compteId={compte.id}>{children}</ProfilPage>
                </ProfilWrapper>
              </div>
            </main>
          </div>

          <NavMobile pastilles={pastillesMobile} />
          <ProfilFlottant compteId={compte.id} />
          <TuteurGlobal />
        </div>
      </FournisseurIntention>
    </FournisseurOnboarding>
  );
}
