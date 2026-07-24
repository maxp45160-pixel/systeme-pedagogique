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

  return (
    <>
      <EntetePage
        titre="Tableau de bord"
        sousTitre={
          aucunePreuve
            ? "Le suivi commence à zéro : aucune compétence n'a encore été évaluée par une preuve directe."
            : "Où tu en es, ce que tu as fait récemment, et ce qu'il est le plus utile de travailler maintenant."
        }
        actions={ctx.mode === "reel" ? <BoutonActiverDemo libelle="Mode démonstration" /> : undefined}
      />

      {/*
        Au démarrage, une note explique pourquoi l'écran est vide. C'est une
        conséquence du protocole anti-hallucination, pas un défaut d'amorçage.
      */}
      {aucunePreuve && (
        <div className="mb-5 rounded-carte border border-info/30 bg-info-faible px-4 py-3 text-sm">
          <p className="font-medium text-info">Système en cours d&apos;initialisation</p>
          <p className="mt-1 text-texte-attenue">
            Ton profil déclare un parcours BUT QLIO, ce qui permet de formuler des{" "}
            <strong>hypothèses</strong>{" "}
            sur certains domaines — mais une hypothèse n&apos;est pas une
            preuve. Aucun niveau ne sera affiché avant qu&apos;un diagnostic ait été réalisé. Le plan
            d&apos;évaluation initiale fixe l&apos;ordre : les statistiques d&apos;abord, parce
            qu&apos;elles servent ensuite partout.
          </p>
        </div>
      )}

      {/*
        `[&>*]:min-w-0` : sans cela, les items de grille conservent
        `min-width: auto` et ne rétrécissent pas sous la largeur min-content de
        leur contenu — un intitulé de compétence en `truncate` (nowrap) suffit
        alors à élargir la piste et à faire déborder la page sur mobile.
      */}
      <div className="grid gap-4 lg:grid-cols-3 [&>*]:min-w-0">
        <div className="lg:col-span-2">
          <CarteProchaineAction recommandations={ctx.recommandations} />
        </div>

        <div className="lg:col-span-1">
          <CarteObjectifs
            objectifs={ctx.donnees.objectives}
            recommandations={ctx.recommandations}
            modeDemo={ctx.mode === "demo"}
          />
        </div>

        <div className="lg:col-span-3">
          <CarteEtatGlobal global={ctx.global} etats={ctx.etats} />
        </div>

        <div className="lg:col-span-2">
          <CarteProgressionRecente evenements={evenements} modeDemo={ctx.mode === "demo"} />
        </div>

        <div className="lg:col-span-1 space-y-4">
          <CarteBadges badges={ctx.badges} />
        </div>

        <div className="lg:col-span-3">
          <CarteActivite activite={activite} now={ctx.now} />
        </div>
      </div>
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
