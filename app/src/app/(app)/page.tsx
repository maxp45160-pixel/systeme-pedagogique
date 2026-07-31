import { Suspense } from "react";
import { chargerContexte } from "@/lib/store/context";
import { SqueletteContenu } from "@/components/layout/squelette";
import { calculerActivite, evenementsRecents } from "@/lib/engine/historique";
import { EntetePage } from "@/components/layout/entete-page";
import { CarteEtatGlobal } from "@/components/dashboard/etat-global";
import { CarteProchaineAction } from "@/components/dashboard/prochaine-action";
import { CarteProgressionRecente } from "@/components/dashboard/progression-recente";
import { CarteActivite } from "@/components/dashboard/activite";

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
  const evenements = evenementsRecents(ctx.donnees.evidence, 6, ctx.now);
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
        <CarteProchaineAction recommandations={ctx.recommandations} />
      </div>

      {/*
        Vue d'ensemble : tout le reste, en retrait derrière un titre discret et
        un généreux espace. Aucune donnée retirée — seulement hiérarchisée.
        `[&>*]:min-w-0` empêche un intitulé en `truncate` d'élargir la piste.
      */}
      <section className="mt-10">
        <h2 className="mb-4 font-serif text-lg italic text-texte-discret">— vue d&apos;ensemble</h2>
        <div className="grid gap-4 lg:grid-cols-3 [&>*]:min-w-0">
          <div className="lg:col-span-3">
            <CarteEtatGlobal global={ctx.global} etats={ctx.etats} />
          </div>

          <div className="lg:col-span-3">
            <CarteProgressionRecente evenements={evenements} />
          </div>

          <div className="lg:col-span-3">
            <CarteActivite activite={activite} now={ctx.now} />
          </div>
        </div>
      </section>
    </>
  );
}
