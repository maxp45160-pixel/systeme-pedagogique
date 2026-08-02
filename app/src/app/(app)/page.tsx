import { Suspense } from "react";
import { redirect } from "next/navigation";
import { chargerContexte } from "@/lib/store/context";
import { SqueletteContenu } from "@/components/layout/squelette";
import { calculerActivite, evenementsRecents } from "@/lib/engine/historique";
import { EntetePage } from "@/components/layout/entete-page";
import { CarteEtatGlobal } from "@/components/dashboard/etat-global";
import { CarteProchaineAction } from "@/components/dashboard/prochaine-action";
import { RevisionsDues } from "@/components/dashboard/revisions-dues";
import { CarteProgressionRecente } from "@/components/dashboard/progression-recente";
import { CarteActivite } from "@/components/dashboard/activite";
import { Depliant } from "@/components/ui/explication";

export default function TableauDeBord() {
  // La date du jour ne dépend d'aucune lecture : `ctx.now` n'est rien d'autre
  // qu'un `new Date()` posé à l'entrée de `chargerContexte`.
  const dateJour = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  return (
    <>
      {/*
        Le sous-titre ne se dédouble plus selon qu'il existe ou non des preuves :
        la variante « une seule action suffit » disait, en plus court, ce que
        l'encart d'initialisation ci-dessous dit déjà en entier. Une phrase de
        moins, aucune information perdue — et un en-tête qui n'attend plus la
        lecture des preuves pour s'afficher.
      */}
      <EntetePage
        titre="Tableau de bord"
        surtitre={dateJour}
        sousTitre="Ta prochaine action — le reste suit, en retrait."
      />

      <Suspense fallback={<SqueletteContenu />}>
        <ContenuTableauDeBord />
      </Suspense>
    </>
  );
}

async function ContenuTableauDeBord() {
  const ctx = await chargerContexte();

  // Compte neuf : il n'y a rien à mettre sur ce tableau de bord, et une grille
  // de tirets ne dit pas quoi faire. On envoie construire le référentiel — la
  // seule action possible tant qu'il n'existe pas (ADR-026).
  //
  // La redirection vit ici, pas dans le layout : les autres écrans ont chacun
  // un état vide qui dit ce qui manque, et forcer un passage obligatoire les
  // rendrait inaccessibles à quelqu'un qui veut simplement regarder.
  if (ctx.referentiel.skills.length === 0) {
    redirect("/demarrer");
  }

  const evenements = evenementsRecents(ctx.donnees.evidence, ctx.referentiel.parCode, 6, ctx.now);
  const activite = calculerActivite(ctx.donnees.sessions, ctx.now);
  const aucunePreuve = ctx.global.nombrePreuves === 0;

  return (
    <>
      {/*
        Au démarrage, l'écran est volontairement vide (protocole anti-hallucination).
        La note est resserrée à une ligne et renvoie directement à l'action.
      */}
      {aucunePreuve && (
        <div className="mb-6 flex items-start gap-2.5 rounded-carte border border-info/30 bg-info-faible px-4 py-2.5 text-sm">
          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-info" aria-hidden />
          <p className="text-texte-attenue">
            <strong className="font-medium text-info">Système en cours d&apos;initialisation.</strong>{" "}
            Aucun niveau ne s&apos;affiche tant qu&apos;un diagnostic n&apos;a pas eu lieu — commence par
            l&apos;action ci-dessous.
          </p>
        </div>
      )}

      {/* Action prioritaire : seule et dominante, rien ne la concurrence. */}
      <div className="[&>*]:min-w-0">
        <CarteProchaineAction
          recommandations={ctx.recommandations}
          referentiel={ctx.referentiel}
          now={ctx.now}
        />
      </div>

      {/*
        « À réviser » : les compétences dont l'intervalle de répétition espacée
        est dépassé, triées par retard. Placé APRÈS l'action prioritaire — rien
        ne doit concurrencer la carte accentuée — et AVANT la vue d'ensemble.
        La compétence n°1 est exclue : elle porte déjà son étiquette « Révision
        due » et son bouton dans `CarteProchaineAction`.
      */}
      <RevisionsDues
        etats={ctx.etats}
        now={ctx.now}
        codeExclu={ctx.recommandations[0]?.etat.skill.code}
      />

      {/*
        Vue d'ensemble : tout le reste, en retrait derrière un titre discret.
        Aucune donnée retirée — seulement hiérarchisée, et réordonnée pour que
        le bandeau d'activité soit lisible sans défilement : l'ancienne grille
        `lg:grid-cols-3` ne servait à rien, tous ses enfants occupaient les trois
        pistes. `[&>*]:min-w-0` empêche un intitulé en `truncate` d'élargir la
        piste.
      */}
      <section className="mt-6">
        <h2 className="mb-3 font-serif text-lg italic text-texte-discret">— vue d&apos;ensemble</h2>
        <div className="space-y-4 [&>*]:min-w-0">
          {/* Une année pleine, étalée sur toute la largeur de la carte. */}
          <CarteActivite activite={activite} now={ctx.now} semaines={52} cellule={16} />

          <CarteEtatGlobal global={ctx.global} etats={ctx.etats} />

          {/*
            La progression récente est une lecture de contrôle, pas une lecture
            d'entrée : elle passe au repos derrière un `<details>` natif, donc
            sans JavaScript. Rien n'est retiré.
          */}
          <Depliant resume={`Progression récente — ${evenements.length} dernière${evenements.length > 1 ? "s" : ""} preuve${evenements.length > 1 ? "s" : ""}`}>
            <CarteProgressionRecente evenements={evenements} />
          </Depliant>
        </div>
      </section>
    </>
  );
}
