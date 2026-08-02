import Link from "next/link";
import type { Recommandation } from "@/lib/engine/recommend";
import { DIFFICULTES, LIBELLES_DIMENSIONS, type Referentiel } from "@/lib/domain/types";
import { libelleDomaine } from "@/lib/domain/referentiel-compte";
import { prochaineRevision } from "@/lib/engine/spaced";
import {
  Carte,
  classesBouton,
  CodeCompetence,
  Etiquette,
  JaugeNiveau,
} from "@/components/ui/primitives";
import { Depliant } from "@/components/ui/explication";
import { IconeFeuille, IconeFleche } from "@/components/ui/icones";
import { formatDuree } from "@/lib/engine/dates";
import { BoutonGenerer } from "@/components/exercices/bouton-generer";

/**
 * « Que dois-je faire maintenant ? »
 *
 * Carte centrale de l'application : une seule action mise en avant, avec sa
 * justification. La raison affichée est produite par le moteur à partir des
 * facteurs réellement dominants — ce n'est pas un texte d'encouragement.
 */
export function CarteProchaineAction({
  recommandations,
  referentiel,
  now,
  compteId,
}: {
  recommandations: Recommandation[];
  referentiel: Referentiel;
  now: Date;
  compteId: string;
}) {
  const [principale, ...alternatives] = recommandations;
  if (!principale) return null;

  const { etat, exercice, raison, difficulteCible, dureeEstimeeMin } = principale;
  const revision = prochaineRevision(etat, now);

  return (
    <Carte accent className="relative overflow-hidden">
      {/* Épine pine en haut : signale la carte prioritaire de l'écran. */}
      <div className="absolute inset-x-0 top-0 h-1 bg-primaire" aria-hidden />
      {/* Filigrane botanique : discret, purement décoratif. */}
      <IconeFeuille
        className="pointer-events-none absolute -bottom-8 -right-6 size-40 text-primaire opacity-[0.06]"
      />

      <div className="relative px-5 py-4 sm:px-6">
        <div className="flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-primaire" aria-hidden />
          <span className="text-[0.6875rem] font-semibold uppercase tracking-wider text-primaire">
            Prochaine meilleure action
          </span>
        </div>

        <h2 className="mt-2 font-serif text-[1.45rem] font-medium leading-snug tracking-tight">
          {exercice ? exercice.titre : etat.prochaineEtape}
        </h2>

        <p className="mt-2 max-w-xl text-sm text-texte-attenue">{raison}</p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Etiquette ton="primaire" mono>
            {etat.skill.code}
          </Etiquette>
          <Etiquette>{libelleDomaine(referentiel, etat.skill.domaine)}</Etiquette>
          <Etiquette className="chiffres">
            Difficulté {exercice?.difficulte ?? difficulteCible}/5 ·{" "}
            {DIFFICULTES[exercice?.difficulte ?? difficulteCible]}
          </Etiquette>
          <Etiquette>≈ {formatDuree(dureeEstimeeMin)}</Etiquette>
          {etat.preuves.length === 0 && <Etiquette ton="info">Diagnostic</Etiquette>}
          {revision.due && <Etiquette ton="alerte">Révision due</Etiquette>}
        </div>

        <div className="mt-3 rounded-md border border-bordure bg-surface-2 px-3 py-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-xs font-medium">{etat.skill.intitule}</p>
              <p className="chiffres mt-0.5 text-[0.6875rem] text-texte-discret">
                {etat.niveau === null
                  ? "Niveau inconnu — jamais évaluée"
                  : `Niveau actuel ${etat.niveau}/5 · confiance ${etat.confiance}`}
              </p>
            </div>
            <div className="w-20 shrink-0 pt-1">
              <JaugeNiveau niveau={etat.niveau} taille="compacte" />
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {exercice ? (
            <Link href={`/exercices/${exercice.id}`} className={classesBouton("principal")}>
              Commencer
              <IconeFleche className="size-4" />
            </Link>
          ) : (
            /*
              Repli assumé : aucun exercice disponible pour cette compétence —
              soit elle n'en a jamais eu, soit le seul qui existait vient
              d'échouer et ne revient pas sans progrès démontré. La modale de
              génération remplace le détour par le tuteur : on crée là où on est.
            */
            <BoutonGenerer
              competences={referentiel.actifs.map((s) => ({
                code: s.code,
                intitule: s.intitule,
                domaine: s.domaine,
              }))}
              competenceInitiale={etat.skill.code}
              calibrage={
                principale.calibration
                  ? {
                      difficulteConseillee: principale.calibration.difficulteConseillee,
                      dimensionFaible: principale.calibration.dimensionFaible,
                      reserves: principale.calibration.explication.reserves,
                    }
                  : null
              }
              compteId={compteId}
              libelle="Générer un exercice"
            />
          )}
          <Link
            href={`/competences/${etat.skill.code}`}
            className={classesBouton("secondaire")}
          >
            Voir la compétence
          </Link>
        </div>

        <div className="mt-4 border-t border-bordure pt-3">
          <Depliant resume="Pourquoi cette action plutôt qu'une autre ?">
            <div className="rounded-md border border-bordure bg-surface-2 p-3 text-xs">
              <p className="mb-2 text-texte-attenue">
                Facteurs pris en compte pour {etat.skill.code}, du plus au moins déterminant :
              </p>
              <dl className="space-y-1">
                {principale.facteurs.map((f, i) => (
                  <div
                    key={i}
                    className="flex items-baseline justify-between gap-3 border-b border-bordure/60 pb-1 last:border-0"
                  >
                    <dt className="text-texte-attenue">{f.libelle}</dt>
                    <dd
                      className={`chiffres shrink-0 font-medium ${
                        f.contribution < 0 ? "text-texte-discret" : ""
                      }`}
                    >
                      {f.contribution > 0 ? "+" : ""}
                      {Math.round(f.contribution)}
                    </dd>
                  </div>
                ))}
              </dl>

              {/*
                3ᵉ maillon (ADR-028). La difficulté visée n'est plus déduite du
                seul niveau : elle vient de ce que la dernière tentative a
                produit. Un nombre qui bouge doit dire pourquoi (P3).
              */}
              {principale.calibration && principale.calibration.verdicts.length > 0 && (
                <div className="mt-3 border-t border-bordure/60 pt-2">
                  <p className="mb-1.5 text-texte-attenue">
                    Difficulté {principale.difficulteCible}/5 —{" "}
                    {principale.calibration.difficulteConseillee === null
                      ? "déduite du niveau, faute de tentative exploitable :"
                      : "dérivée de tes tentatives :"}
                  </p>
                  <ul className="space-y-1">
                    {principale.calibration.verdicts.map((v) => (
                      <li key={v.exerciceId} className="text-texte-attenue">
                        · <span className="font-medium">{v.titre}</span> (difficulté {v.difficulte})
                        — {v.raison}
                      </li>
                    ))}
                  </ul>
                  {principale.calibration.dimensionFaible && (
                    <p className="mt-1.5 text-texte-attenue">
                      Dimension la plus faible :{" "}
                      <span className="font-medium">
                        {LIBELLES_DIMENSIONS[principale.calibration.dimensionFaible.dimension]}
                      </span>{" "}
                      ({principale.calibration.dimensionFaible.moyenne} sur{" "}
                      {principale.calibration.dimensionFaible.observations} tentative
                      {principale.calibration.dimensionFaible.observations > 1 ? "s" : ""}) — c&apos;est
                      elle qu&apos;il faut faire travailler.
                    </p>
                  )}
                  {principale.calibration.explication.reserves.map((r, i) => (
                    <p key={i} className="mt-1 text-texte-discret">
                      {r}
                    </p>
                  ))}
                </div>
              )}

              {alternatives.length > 0 && (
                <>
                  <p className="mt-3 mb-1.5 text-texte-attenue">Suivantes dans la file :</p>
                  <ul className="space-y-1">
                    {alternatives.slice(0, 4).map((r) => (
                      <li key={r.etat.skill.code} className="flex items-baseline gap-2">
                        <CodeCompetence code={r.etat.skill.code} />
                        <Link
                          href={`/competences/${r.etat.skill.code}`}
                          className="min-w-0 flex-1 truncate text-texte-attenue hover:text-texte"
                        >
                          {r.etat.skill.intitule}
                        </Link>
                        <span className="chiffres shrink-0 text-texte-discret">
                          {Math.round(r.valeur)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </Depliant>
        </div>
      </div>
    </Carte>
  );
}
