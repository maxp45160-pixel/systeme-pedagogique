import Link from "next/link";
import { chargerContexte } from "@/lib/store/context";
import { calculerActivite, evenementsRecents } from "@/lib/engine/historique";
import { EntetePage } from "@/components/layout/entete-page";
import { BoutonActiverDemo } from "@/components/layout/bandeau-demo";
import { CarteEtatGlobal } from "@/components/dashboard/etat-global";
import { CarteProchaineAction } from "@/components/dashboard/prochaine-action";
import { CarteProgressionRecente } from "@/components/dashboard/progression-recente";
import { CarteObjectifs } from "@/components/dashboard/objectifs";
import { CarteActivite } from "@/components/dashboard/activite";
import { Carte, EnTeteCarte, Etiquette } from "@/components/ui/primitives";

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
        actions={ctx.mode === "reel" ? <BoutonActiverDemo libelle="Mode démonstration" /> : undefined}
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
              modeDemo={ctx.mode === "demo"}
            />
          </div>

          <div className="lg:col-span-2">
            <CarteProgressionRecente evenements={evenements} modeDemo={ctx.mode === "demo"} />
          </div>

          <div className="lg:col-span-1">
            <CarteBadges badges={ctx.badges} />
          </div>

          <div className="lg:col-span-2">
            <CarteActivite activite={activite} now={ctx.now} />
          </div>
        </div>
      </section>
    </>
  );
}

/**
 * Badges obtenus. Rares par construction : six accomplissements seulement,
 * chacun adossé à une preuve identifiée. Un badge sans source ne peut pas
 * exister dans ce système.
 */
function CarteBadges({
  badges,
}: {
  badges: { badge: { titre: string; description: string }; date: string; source: string }[];
}) {
  return (
    <Carte>
      <EnTeteCarte
        titre="Jalons"
        legende={badges.length === 0 ? "Six jalons possibles" : `${badges.length} obtenu(s)`}
      />
      <div className="px-4 py-3">
        {badges.length === 0 ? (
          <p className="text-xs text-texte-attenue">
            Les jalons marquent des premières fois qui comptent : première résolution autonome,
            première modélisation, premier transfert. Ils apparaîtront quand une preuve les
            justifiera.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {badges.map((b, i) => (
              <li key={i}>
                <div className="flex items-baseline gap-2">
                  <Etiquette ton="succes">✓</Etiquette>
                  <span className="text-xs font-medium">{b.badge.titre}</span>
                </div>
                <p className="mt-0.5 pl-1 text-[0.6875rem] text-texte-discret">{b.source}</p>
              </li>
            ))}
          </ul>
        )}
        <Link
          href="/progression"
          className="mt-3 inline-block text-xs text-primaire hover:underline"
        >
          Voir la progression détaillée
        </Link>
      </div>
    </Carte>
  );
}
