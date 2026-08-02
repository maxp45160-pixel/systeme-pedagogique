import { Suspense } from "react";
import Link from "next/link";
import { chargerContexte } from "@/lib/store/context";
import { SqueletteContenu } from "@/components/layout/squelette";

import { AUTONOMIE } from "@/lib/domain/types";
import { activiteSurFenetre, calculerActivite, photographies } from "@/lib/engine/historique";
import { joursDepuis } from "@/lib/engine/dates";
import { EntetePage } from "@/components/layout/entete-page";
import {
  Carte,
  CorpsCarte,
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
  // `semaines` : profondeur de la grille de régularité. Toujours au moins un peu
  // plus large que la fenêtre demandée — une grille strictement à la taille de
  // la période ne montrerait plus ce dont la période se détache.
  { cle: "semaine", libelle: "Cette semaine", jours: 7, pas: 1, semaines: 9 },
  { cle: "mois", libelle: "Ce mois", jours: 30, pas: 3, semaines: 13 },
  { cle: "trimestre", libelle: "3 derniers mois", jours: 90, pas: 7, semaines: 26 },
  { cle: "debut", libelle: "Depuis le début", jours: 365, pas: 21, semaines: 53 },
] as const;

type Periode = (typeof PERIODES)[number];

/**
 * L'en-tête et le sélecteur de période ne dépendent que de l'URL : ils sont
 * rendus immédiatement, et la lecture des preuves — le seul poste vraiment
 * coûteux de cette page — se fait derrière une frontière `<Suspense>`. Changer
 * de période reste donc réactif même pendant le calcul.
 */
export default async function PageProgression(props: {
  searchParams: Promise<{ periode?: string }>;
}) {
  const { periode: periodeBrute } = await props.searchParams;
  const periode = PERIODES.find((p) => p.cle === periodeBrute) ?? PERIODES[1];

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

      <Suspense key={periode.cle} fallback={<SqueletteContenu />}>
        <ContenuProgression periode={periode} />
      </Suspense>
    </>
  );
}

async function ContenuProgression({ periode }: { periode: Periode }) {
  const ctx = await chargerContexte();
  const activite = calculerActivite(ctx.donnees.sessions, ctx.now);
  // Activité mesurée sur la fenêtre demandée, et non sur les 30 jours figés que
  // `calculerActivite` produit : le filtre doit atteindre ces chiffres aussi.
  const activitePeriode = activiteSurFenetre(ctx.donnees.sessions, periode.jours, ctx.now);
  const aucunePreuve = ctx.global.nombrePreuves === 0;

  const photos = aucunePreuve
    ? []
    : photographies(
        ctx.referentiel.actifs,
        ctx.donnees.evidence,
        periode.jours,
        periode.pas,
        ctx.now,
        ctx.referentiel.domaines,
      );

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

  return (
    <>
      {aucunePreuve ? (
        <Carte>
          <EtatVide
            titre="Aucun historique à afficher"
            message="La progression se construit à partir des preuves enregistrées. Rien ne sera tracé avant le premier exercice terminé — une courbe partant de zéro sans donnée serait une invention."
            action={
              <Link href="/" className="text-xs text-primaire hover:underline">
                Voir l'action recommandée
              </Link>
            }
          />
        </Carte>
      ) : (
        <div className="space-y-6">
          {/* ------------------------ Synthèse de période ------------------- */}
          <Carte>
            <EnTeteCarte
              titre={`Bilan — ${periode.libelle.toLowerCase()}`}
              action={<TagConfiance confiance={ctx.global.confiance} />}
            />
            <CorpsCarte>
              {/*
                Deux blocs, deux natures.

                Le score global et la robustesse sont des *états* : ils décrivent
                où en est le suivi aujourd'hui, toutes preuves confondues, et ne
                peuvent pas être « filtrés » par une fenêtre. Les afficher dans
                la même rangée que des mesures de période laissait croire qu'ils
                y répondaient — ils n'ont jamais bougé d'un filtre à l'autre.
                Les séparer explicitement est la seule présentation honnête.
              */}
              <div className="text-[0.6875rem] font-semibold uppercase tracking-wide text-texte-discret">
                Sur la période
              </div>
              <div className="mt-2 flex flex-wrap gap-x-6 gap-y-3">
                <Statistique
                  libelle="Évolution du score"
                  valeur={delta === null ? null : `${delta > 0 ? "+" : ""}${delta}`}
                  precision={
                    delta === null
                      ? "pas assez d'historique"
                      : delta === 0
                        ? "score inchangé"
                        : "points de progression globale"
                  }
                  ton="primaire"
                />
                <Statistique
                  libelle="Preuves"
                  valeur={preuvesPeriode.length}
                  precision={`${ctx.global.nombrePreuves} au total`}
                />
                <Statistique
                  libelle="Autonomie moyenne"
                  valeur={autonomieMoyenne === null ? null : autonomieMoyenne.toFixed(2)}
                  precision="0 = solution fournie, 1 = pleine initiative"
                />
                <Statistique
                  libelle="Temps de pratique"
                  valeur={
                    activitePeriode.seances === 0 ? null : formatDuree(activitePeriode.minutes)
                  }
                  precision={`${activitePeriode.seances} séance${activitePeriode.seances > 1 ? "s" : ""}`}
                />
                <Statistique
                  libelle="Jours travaillés"
                  valeur={activitePeriode.seances === 0 ? null : activitePeriode.joursActifs}
                  precision={`sur ${periode.jours} jours`}
                />
              </div>

              <div className="mt-4 border-t border-bordure pt-3 text-[0.6875rem] font-semibold uppercase tracking-wide text-texte-discret">
                Aujourd'hui, toutes preuves confondues
              </div>
              <div className="mt-2 flex flex-wrap gap-x-6 gap-y-3">
                <Statistique
                  libelle="Progression globale"
                  valeur={ctx.global.scoreGlobal}
                  unite="/ 100"
                  precision="état courant, hors période"
                  ton="primaire"
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
                  libelle="Temps cumulé"
                  valeur={formatDuree(activite.minutesTotal)}
                  precision="depuis le début du suivi"
                />
              </div>

              {/* Le plateau est nommé, pas présenté comme un échec. */}
              {delta === 0 && preuvesPeriode.length > 0 && (
                <p className="mt-4 rounded-md border border-bordure bg-surface-2 px-3 py-2 text-xs text-texte-attenue">
                  Le score global n'a pas bougé sur la période, alors que{" "}
                  {preuvesPeriode.length} preuve(s) ont été enregistrées. C'est un fonctionnement
                  normal : consolider un niveau demande plusieurs preuves concordantes avant qu'un
                  palier soit franchi. Le travail compte même quand le chiffre ne bouge pas.
                </p>
              )}
              {delta !== null && delta < 0 && (
                <p className="mt-4 rounded-md border border-bordure bg-surface-2 px-3 py-2 text-xs text-texte-attenue">
                  Le score a légèrement baissé. Ce n'est pas une perte de compétence : les
                  niveaux acquis ne se retirent pas. C'est l'effet de l'ancienneté des
                  preuves sur la confiance, qui pondère le score. Réutiliser une compétence ancienne
                  suffit à le rétablir.
                </p>
              )}
            </CorpsCarte>
          </Carte>

          {/* ------------------------ Courbe globale ----------------------- */}
          <Carte>
            <EnTeteCarte
              titre="Progression globale dans le temps"
              legende="Score sur 100, recalculé à chaque point à partir des preuves connues à cette date"
            />
            <CorpsCarte>
              <Courbe
                points={photos.map((p) => ({ date: p.date, valeur: p.scoreGlobal ?? 0 }))}
                max={Math.max(20, ...photos.map((p) => p.scoreGlobal ?? 0)) * 1.15}
                hauteur={120}
                libelle="Progression globale"
              />
              <div className="mt-2 flex items-center justify-between text-[0.6875rem] text-texte-discret">
                <span>{periode.libelle}</span>
                <span>Aujourd'hui</span>
              </div>
            </CorpsCarte>
          </Carte>

          {/* ------------------- Petits multiples par domaine --------------- */}
          <Carte>
            <EnTeteCarte
              titre="Par domaine"
              legende="Le grand chiffre est l'état d'aujourd'hui ; la variation à sa gauche et la courbe couvrent la période"
            />
            <CorpsCarte>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 [&>*]:min-w-0">
                {ctx.global.parDomaine.map((d) => {
                  // `?? 0` écrivait une absence de mesure comme un zéro — la
                  // courbe partait donc du sol pour un domaine simplement pas
                  // encore évalué à cette date. On écarte les points non mesurés
                  // au lieu de les inventer (protocole anti-hallucination §7).
                  const points = photos
                    .map((p) => ({ date: p.date, valeur: p.parDomaine.get(d.domaine) }))
                    .filter((p): p is { date: string; valeur: number } => p.valeur !== undefined);
                  const deltaDomaine =
                    points.length >= 2 ? points[points.length - 1].valeur - points[0].valeur : null;
                  return (
                    <div key={d.domaine}>
                      <div className="mb-1 flex items-baseline justify-between gap-2">
                        <Link
                          href={`/competences?domaine=${d.domaine}`}
                          className="min-w-0 truncate text-xs font-medium hover:underline"
                        >
                          {d.nom}
                        </Link>
                        <span className="chiffres shrink-0 text-xs">
                          {deltaDomaine !== null && deltaDomaine !== 0 && (
                            <span
                              className={cx(
                                "mr-1.5 font-medium",
                                deltaDomaine > 0 ? "text-succes" : "text-texte-discret",
                              )}
                            >
                              {deltaDomaine > 0 ? "+" : ""}
                              {deltaDomaine}
                            </span>
                          )}
                          <span
                            className={cx(
                              "font-semibold",
                              d.score === null && "text-texte-discret",
                            )}
                          >
                            {d.score ?? "—"}
                          </span>
                        </span>
                      </div>
                      {d.score === null || points.length === 0 ? (
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
            </CorpsCarte>
          </Carte>

          {/* --------------------------- Régularité ------------------------ */}
          <Carte>
            <EnTeteCarte
              titre="Régularité de travail"
              legende={`${activitePeriode.joursActifs} jour${
                activitePeriode.joursActifs > 1 ? "s" : ""
              } travaillé${activitePeriode.joursActifs > 1 ? "s" : ""} sur les ${periode.jours} derniers`}
            />
            <CorpsCarte>
              <GrilleActivite
                minutesParJour={activite.minutesParJour}
                semaines={periode.semaines}
                now={ctx.now}
              />
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-[0.6875rem] text-texte-discret">
                  La grille déborde volontairement la période : les interruptions sont visibles sans
                  être signalées comme un problème.
                </p>
                <LegendeActivite />
              </div>
            </CorpsCarte>
          </Carte>

          {/* ------------------------ Réserves globales -------------------- */}
          {ctx.global.reserves.length > 0 && (
            <Carte>
              <EnTeteCarte titre="Ce que ces chiffres ne disent pas" />
              <CorpsCarte>
                <ul className="space-y-1.5">
                  {ctx.global.reserves.map((r, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-texte-attenue">
                      <Etiquette>{i + 1}</Etiquette>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </CorpsCarte>
            </Carte>
          )}
        </div>
      )}
    </>
  );
}