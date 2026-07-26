import Link from "next/link";
import { chargerContexte } from "@/lib/store/context";
import type { ErrorItem } from "@/lib/domain/types";
import { changerStatutErreur } from "@/lib/store/actions";
import { EntetePage } from "@/components/layout/entete-page";
import {
  Carte,
  classesBouton,
  CodeCompetence,
  cx,
  Etiquette,
  EtatVide,
  Statistique,
} from "@/components/ui/primitives";
import { Depliant } from "@/components/ui/explication";
import { formatDateCourte, formatDateRelative } from "@/lib/engine/dates";

const STATUTS = [
  { cle: "nouvelle", libelle: "Nouvelle", ton: "alerte" as const },
  { cle: "en-cours", libelle: "En cours", ton: "info" as const },
  { cle: "corrigee", libelle: "Corrigée", ton: "succes" as const },
  { cle: "consolidee", libelle: "Consolidée", ton: "succes" as const },
];

/** Nombre d'éléments prioritaires affichés — volontairement limité. */
const LIMITE_PRIORITAIRES = 3;

export default async function PageErreurs() {
  const ctx = await chargerContexte();
  const erreurs = ctx.donnees.errors.filter((e) => !e.archivee);

  // Priorité : fréquence × nombre de contextes, statut non résolu d'abord.
  const aConsolider = erreurs
    .filter((e) => e.statut === "nouvelle" || e.statut === "en-cours")
    .sort((a, b) => {
      const ca = new Set(a.occurrences.map((o) => o.contexte)).size;
      const cb = new Set(b.occurrences.map((o) => o.contexte)).size;
      return b.occurrences.length * cb - a.occurrences.length * ca;
    });

  const prioritaires = aConsolider.slice(0, LIMITE_PRIORITAIRES);
  const autres = erreurs.filter((e) => !prioritaires.includes(e));

  return (
    <>
      <EntetePage
        titre="Erreurs"
        sousTitre="Une erreur est une donnée pédagogique : elle indique où le raisonnement se rompt. Ce registre ne recense que ce qui se répète ou persiste — une maladresse ponctuelle n'y figure pas."
      />

      {erreurs.length === 0 ? (
        <Carte>
          <EtatVide
            titre="Aucune erreur récurrente enregistrée"
            message="C'est l'état normal au démarrage : une erreur n'est consignée ici que lorsqu'elle réapparaît dans plusieurs contextes, porte sur un concept fondamental, ou persiste après correction."
          />
        </Carte>
      ) : (
        <div className="space-y-4">
          <Carte>
            <div className="flex flex-wrap gap-x-8 gap-y-4 px-4 py-4">
              <Statistique
                libelle="À consolider"
                valeur={aConsolider.length}
                precision="nouvelles ou en cours"
              />
              <Statistique
                libelle="Résolues"
                valeur={erreurs.filter((e) => e.statut === "corrigee" || e.statut === "consolidee").length}
                precision="démontrées corrigées"
              />
              <Statistique
                libelle="Occurrences cumulées"
                valeur={erreurs.reduce((s, e) => s + e.occurrences.length, 0)}
              />
            </div>
          </Carte>

          {prioritaires.length > 0 && (
            <div>
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <h2 className="text-sm font-semibold tracking-tight">Erreurs à consolider</h2>
                <span className="text-xs text-texte-discret">
                  {LIMITE_PRIORITAIRES} au maximum, pour rester actionnable
                </span>
              </div>
              <div className="space-y-3">
                {prioritaires.map((e) => (
                  <CarteErreur key={e.id} erreur={e} prioritaire modeDemo={ctx.mode === "demo"} />
                ))}
              </div>
            </div>
          )}

          {autres.length > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-semibold tracking-tight">Autres erreurs suivies</h2>
              <div className="space-y-3">
                {autres.map((e) => (
                  <CarteErreur key={e.id} erreur={e} modeDemo={ctx.mode === "demo"} />
                ))}
              </div>
            </div>
          )}

          <p className="text-xs text-texte-discret">
            Aucune erreur n&apos;est supprimée de ce registre. Le passage au statut « corrigée » puis
            « consolidée » demande une preuve : une erreur ne disparaît pas parce qu&apos;on l&apos;a
            comprise, mais parce qu&apos;on ne la refait plus.
          </p>
        </div>
      )}
    </>
  );
}

function CarteErreur({
  erreur,
  prioritaire,
  modeDemo,
}: {
  erreur: ErrorItem;
  prioritaire?: boolean;
  modeDemo: boolean;
}) {
  const contextes = new Set(erreur.occurrences.map((o) => o.contexte));
  const statut = STATUTS.find((s) => s.cle === erreur.statut)!;
  const derniere = erreur.occurrences.at(-1);

  return (
    <Carte accent={prioritaire}>
      <div className="px-4 py-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold">{erreur.concept}</h3>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <Etiquette ton={statut.ton}>{statut.libelle}</Etiquette>
              <Etiquette>
                {erreur.occurrences.length} occurrence{erreur.occurrences.length > 1 ? "s" : ""}
              </Etiquette>
              <Etiquette ton={contextes.size > 1 ? "alerte" : "neutre"}>
                {contextes.size} contexte{contextes.size > 1 ? "s" : ""}
              </Etiquette>
              {erreur.skillCodes.map((c) => (
                <Link key={c} href={`/competences/${c}`} className="hover:underline">
                  <CodeCompetence code={c} />
                </Link>
              ))}
            </div>
          </div>
          {derniere && (
            <span className="shrink-0 text-[0.6875rem] text-texte-discret">
              dernière fois {formatDateRelative(derniere.date)}
            </span>
          )}
        </div>

        {contextes.size > 1 && (
          <p className="mt-3 rounded-md border border-alerte/25 bg-alerte-faible px-3 py-2 text-xs text-alerte">
            Cette erreur apparaît dans plusieurs contextes : c&apos;est le signe d&apos;une lacune
            probable sur le concept, pas d&apos;une inattention.
          </p>
        )}

        <dl className="mt-3 space-y-2.5 text-xs">
          <div>
            <dt className="font-medium text-texte-attenue">Erreur commise</dt>
            <dd className="mt-0.5">{erreur.description}</dd>
          </div>
          <div>
            <dt className="font-medium text-texte-attenue">Cause probable</dt>
            <dd className="mt-0.5">{erreur.causeProbable}</dd>
          </div>
          <div>
            <dt className="font-medium text-texte-attenue">Correction</dt>
            <dd className="mt-0.5">{erreur.correction}</dd>
          </div>
          {erreur.exemple && (
            <div>
              <dt className="font-medium text-texte-attenue">Exemple</dt>
              <dd className="chiffres mt-0.5 rounded border border-bordure bg-surface-2 px-2 py-1.5 font-mono text-[0.6875rem]">
                {erreur.exemple}
              </dd>
            </div>
          )}
        </dl>

        <div className="mt-3">
          <Depliant resume={`Historique des ${erreur.occurrences.length} occurrence(s)`}>
            <ul className="space-y-1 rounded-md border border-bordure bg-surface-2 p-2.5">
              {erreur.occurrences.map((o, i) => (
                <li key={i} className="flex flex-wrap justify-between gap-2 text-[0.6875rem]">
                  <span className="text-texte-attenue">{o.contexte}</span>
                  <span className="text-texte-discret">{formatDateCourte(o.date)}</span>
                </li>
              ))}
            </ul>
          </Depliant>
        </div>

        {!modeDemo && (
          <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-bordure pt-3">
            <span className="mr-1 text-[0.625rem] uppercase tracking-wider text-texte-discret">
              Statut
            </span>
            {STATUTS.map((s) => (
              <form
                key={s.cle}
                action={changerStatutErreur.bind(
                  null,
                  erreur.id,
                  s.cle as ErrorItem["statut"],
                )}
              >
                <button
                  type="submit"
                  disabled={erreur.statut === s.cle}
                  className={cx(
                    classesBouton(erreur.statut === s.cle ? "principal" : "secondaire", "petite"),
                    erreur.statut === s.cle && "pointer-events-none",
                  )}
                >
                  {s.libelle}
                </button>
              </form>
            ))}
          </div>
        )}
      </div>
    </Carte>
  );
}
