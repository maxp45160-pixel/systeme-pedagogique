import { chargerContexte } from "@/lib/store/context";
import { calculerActivite, evenementsRecents } from "@/lib/engine/historique";
import { EntetePage } from "@/components/layout/entete-page";
import { CarteEtatGlobal } from "@/components/dashboard/etat-global";
import { CarteProchaineAction } from "@/components/dashboard/prochaine-action";
import { CarteProgressionRecente } from "@/components/dashboard/progression-recente";
import { CarteObjectifs } from "@/components/dashboard/objectifs";
import { CarteActivite } from "@/components/dashboard/activite";

export default async function TableauDeBord() {
  const ctx = await chargerContexte();
  const evenements = evenementsRecents(ctx.donnees.evidence, 6, ctx.now);
  const activite = calculerActivite(ctx.donnees.sessions, ctx.now);
  const aucunePreuve = ctx.global.nombrePreuves === 0;
  const dateJour = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(ctx.now));

  return (
    <>
      <EntetePage
        titre="Tableau de bord"
        surtitre={dateJour}
        sousTitre={
          aucunePreuve
            ? "Une seule action suffit à lancer le suivi."
            : "Ta prochaine action — le reste suit, en retrait."
        }
      />

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

          <div className="lg:col-span-1">
            <CarteObjectifs
              objectifs={ctx.donnees.objectives}
              recommandations={ctx.recommandations}
            />
          </div>

          <div className="lg:col-span-2">
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
