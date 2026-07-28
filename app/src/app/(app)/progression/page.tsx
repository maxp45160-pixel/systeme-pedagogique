import Link from "next/link";
import { chargerContexte } from "@/lib/store/context";
import { SKILLS } from "@/lib/domain/referentiel";
import { AUTONOMIE } from "@/lib/domain/types";
import { calculerActivite, photographies } from "@/lib/engine/historique";
import { joursDepuis } from "@/lib/engine/dates";
import { EntetePage } from "@/components/layout/entete-page";
import {
  Carte,
  cx,
  EnTeteCarte,
  Etiquette,
  EtatVide,
  Statistique,
  TagConfiance,
} from "@/components/ui/primitives";
import { Courbe, GrilleActivite, LegendeActivite } from "@/components/charts";
import { formatDuree } from "@/lib/engine/dates";

const PERIODES = [
  { cle: "semaine", libelle: "Cette semaine", jours: 7, pas: 1 },
  { cle: "mois", libelle: "Ce mois", jours: 30, pas: 3 },
  { cle: "trimestre", libelle: "3 derniers mois", jours: 90, pas: 7 },
  { cle: "debut", libelle: "Depuis le début", jours: 365, pas: 21 },
] as const;

export default async function PageProgression(props: {
  searchParams: Promise<{ periode?: string }>;
}) {
  const { periode: periodeBrute } = await props.searchParams;
  const periode = PERIODES.find((p) => p.cle === periodeBrute) ?? PERIODES[1];

  const ctx = await chargerContexte();
  const activite = calculerActivite(ctx.donnees.sessions, ctx.now);
  const aucunePreuve = ctx.global.nombrePreuves === 0;

  const photos = aucunePreuve
    ? []
    : photographies(SKILLS, ctx.donnees.evidence, periode.jours, periode.pas, ctx.now);

  const debut = photos[0];
  const fin = photos.at(-1);
  const delta =
    debut?.scoreGlobal !== null &&
    debut?.scoreGlobal !== undefined &&
    fin?.scoreGlobal !== null &&
    fin?.scoreGlobal !== undefined
      ? fin.scoreGlobal - debut.scoreGlobal
      : null;

  const preuvesPeriode = ctx.donnees.evidence.filter(
    (e) => joursDepuis(e.date, ctx.now) <= periode.jours,
  );
  const autonomieMoyenne =
    preuvesPeriode.length === 0
      ? null
      : preuvesPeriode.reduce((s, e) => s + AUTONOMIE[e.autonomie].poids, 0) /
        preuvesPeriode.length;

  const erreursActives = ctx.donnees.errors.filter(
    (e) => !e.archivee && (e.statut === "nouvelle" || e.statut === "en-cours"),
  );
  const erreursResolues = ctx.donnees.errors.filter(
    (e) => e.statut === "corrigee" || e.statut === "consolidee",
  );

  return (
    <>
      <EntetePage
        titre="Progression"
        sousTitre="L'évolution dans le temps. Une progression réelle n'est pas linéaire : les plateaux sont normaux, et une baisse de confiance n'est pas une régression."
        actions={
          <div className="flex flex-wrap rounded-md border border-bordure p-0.5">
            {PERIODES.map((p) => (
              <Link
                key={p.cle}
                href={`/progression?periode=${p.cle}`}
                className={cx(
                  "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                  periode.cle === p.cle
                    ? "bg-primaire-faible text-primaire"
                    : "text-texte-attenue hover:text-texte",
                )}
              >
                {p.libelle}
              </Link>
            ))}
          </div>
        }
      />

      {aucunePreuve ? (
        <Carte>
          <EtatVide
            titre="Aucun historique à afficher"
            message="La progression se construit à partir des preuves enregistrées. Rien ne sera tracé avant le premier exercice terminé — une courbe partant de zéro sans donnée serait une invention."
            action={
              <Link href="/" className="text-xs text-primaire hover:underline">
                Voir l&apos;action recommandée
              </Link>
            }
          />
        </Carte>
      ) : (
        <div className="space-y-4">
          {/* ------------------------ Synthèse de période ------------------- */}
          <Carte>
            <EnTeteCarte
              titre={`Bilan — ${periode.libelle.toLowerCase()}`}
              action={<TagConfiance confiance={ctx.global.confiance} />}
            />
            <div className="px-4 py-4">
              <div className="flex flex-wrap gap-x-8 gap-y-4">
                <Statistique
                  libelle="Progression globale"
                  valeur={ctx.global.scoreGlobal}
                  unite="/ 100"
                  precision={
                    delta === null
                      ? undefined
                      : delta === 0
                        ? "inchangée sur la période"
                        : `${delta > 0 ? "+" : ""}${delta} sur la période`
                  }
                  ton="primaire"
                />
                <Statistique
                  libelle="Preuves sur la période"
                  valeur={preuvesPeriode.length}
                  precision={`${ctx.global.nombrePreuves} au total`}
                />
                <Statistique
                  libelle="Autonomie moyenne"
                  valeur={autonomieMoyenne === null ? null : autonomieMoyenne.toFixed(2)}
                  precision="0 = solution fournie, 1 = pleine initiative"
                />
                <Statistique
                  libelle="Robustesse moyenne"
                  valeur={
                    ctx.global.robustesseMoyenne === null
                      ? null
                      : ctx.global.robustesseMoyenne.toFixed(2)
                  }
                  precision="solidité des acquis"
                />
                <Statistique
                  libelle="Temps de pratique"
                  valeur={formatDuree(activite.minutes30)}
                  precision="30 derniers jours"
                />
              </div>

              {/* Le plateau est nommé, pas présenté comme un échec. */}
              {delta === 0 && preuvesPeriode.length > 0 && (
                <p className="mt-4 rounded-md border border-bordure bg-surface-2 px-3 py-2 text-xs text-texte-attenue">
                  Le score global n&apos;a pas bougé sur la période, alors que{" "}
                  {preuvesPeriode.length} preuve(s) ont été enregistrées. C&apos;est un fonctionnement
                  normal : consolider un niveau demande plusieurs preuves concordantes avant qu&apos;un
                  palier soit franchi. Le travail compte même quand le chiffre ne bouge pas.
                </p>
              )}
              {delta !== null && delta < 0 && (
                <p className="mt-4 rounded-md border border-bordure bg-surface-2 px-3 py-2 text-xs text-texte-attenue">
                  Le score a légèrement baissé. Ce n&apos;est pas une perte de compétence : les
                  niveaux acquis ne se retirent pas. C&apos;est l&apos;effet de l&apos;ancienneté des
                  preuves sur la confiance, qui pondère le score. Réutiliser une compétence ancienne
                  suffit à le rétablir.
                </p>
              )}
            </div>
          </Carte>

          {/* ------------------------ Courbe globale ----------------------- */}
          <Carte>
            <EnTeteCarte
              titre="Progression globale dans le temps"
              legende="Score sur 100, recalculé à chaque point à partir des preuves connues à cette date"
            />
            <div className="px-4 py-4">
              <Courbe
                points={photos.map((p) => ({ date: p.date, valeur: p.scoreGlobal ?? 0 }))}
                max={Math.max(20, ...photos.map((p) => p.scoreGlobal ?? 0)) * 1.15}
                hauteur={120}
                libelle="Progression globale"
              />
              <div className="mt-2 flex items-center justify-between text-[0.6875rem] text-texte-discret">
                <span>{periode.libelle}</span>
                <span>Aujourd&apos;hui</span>
              </div>
            </div>
          </Carte>

          {/* ------------------- Petits multiples par domaine --------------- */}
          <Carte>
            <EnTeteCarte
              titre="Par domaine"
              legende="Une vignette par domaine, à la même échelle — plus lisible que sept courbes superposées"
            />
            <div className="grid gap-4 px-4 py-4 sm:grid-cols-2 lg:grid-cols-3 [&>*]:min-w-0">
              {ctx.global.parDomaine.map((d) => {
                const points = photos.map((p) => ({
                  date: p.date,
                  valeur: p.parDomaine.get(d.domaine) ?? 0,
                }));
                return (
                  <div key={d.domaine}>
                    <div className="mb-1 flex items-baseline justify-between gap-2">
                      <Link
                        href={`/competences?domaine=${d.domaine}`}
                        className="min-w-0 truncate text-xs font-medium hover:underline"
                      >
                        {d.nom}
                      </Link>
                      <span
                        className={cx(
                          "chiffres shrink-0 text-xs font-semibold",
                          d.score === null && "text-texte-discret",
                        )}
                      >
                        {d.score ?? "—"}
                      </span>
                    </div>
                    {d.score === null ? (
                      <div className="flex h-12 items-center justify-center rounded border border-dashed border-bordure text-[0.625rem] text-texte-discret">
                        Aucune preuve
                      </div>
                    ) : (
                      <Courbe points={points} max={100} hauteur={48} libelle={d.nom} />
                    )}
                    <div className="mt-1 text-[0.625rem] text-texte-discret">
                      {d.competencesEvaluees}/{d.competencesTotal} évaluées · {d.preuves} preuve
                      {d.preuves > 1 ? "s" : ""}
                    </div>
                  </div>
                );
              })}
            </div>
          </Carte>

          {/* ------------------------- Erreurs et XP ----------------------- */}
          <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
            <Carte>
              <EnTeteCarte
                titre="Évolution des erreurs"
                legende="Une erreur qui disparaît doit avoir été démontrée résolue"
              />
              <div className="px-4 py-4">
                <div className="flex flex-wrap gap-x-8 gap-y-4">
                  <Statistique
                    libelle="À consolider"
                    valeur={erreursActives.length}
                    precision="nouvelles ou en cours"
                  />
                  <Statistique
                    libelle="Résolues"
                    valeur={erreursResolues.length}
                    precision="corrigées ou consolidées"
                  />
                  <Statistique
                    libelle="Occurrences totales"
                    valeur={ctx.donnees.errors.reduce((s, e) => s + e.occurrences.length, 0)}
                    precision="toutes erreurs confondues"
                  />
                </div>
                {ctx.donnees.errors.length === 0 ? (
                  <p className="mt-3 text-xs text-texte-attenue">
                    Aucune erreur récurrente enregistrée. Une erreur isolée n&apos;est pas consignée
                    ici : seules celles qui se répètent ou persistent le sont.
                  </p>
                ) : (
                  <Link
                    href="/erreurs"
                    className="mt-3 inline-block text-xs text-primaire hover:underline"
                  >
                    Voir les erreurs en détail
                  </Link>
                )}
              </div>
            </Carte>

          </div>

          {/* --------------------------- Régularité ------------------------ */}
          <Carte>
            <EnTeteCarte
              titre="Régularité de travail"
              legende={`${activite.joursActifs30} jours travaillés sur les 30 derniers`}
            />
            <div className="px-4 py-4">
              <GrilleActivite minutesParJour={activite.minutesParJour} semaines={26} now={ctx.now} />
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-[0.6875rem] text-texte-discret">
                  Six mois d&apos;activité. Les interruptions sont visibles sans être signalées comme
                  un problème.
                </p>
                <LegendeActivite />
              </div>
            </div>
          </Carte>

          {/* ------------------------ Réserves globales -------------------- */}
          {ctx.global.reserves.length > 0 && (
            <Carte>
              <EnTeteCarte titre="Ce que ces chiffres ne disent pas" />
              <ul className="px-4 py-3 space-y-1.5">
                {ctx.global.reserves.map((r, i) => (
                  <li key={i} className="flex gap-2 text-xs text-texte-attenue">
                    <Etiquette>{i + 1}</Etiquette>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </Carte>
          )}
        </div>
      )}
    </>
  );
}
