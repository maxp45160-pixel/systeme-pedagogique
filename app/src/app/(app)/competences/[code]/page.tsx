import Link from "next/link";
import { notFound } from "next/navigation";
import { chargerContexte } from "@/lib/store/context";
import { libelleDomaine } from "@/lib/domain/referentiel-compte";
import {
  AUTONOMIE,
  LIBELLES_DIMENSIONS,
  NIVEAUX,
  POIDS_DIMENSIONS,
  type Dimension,
} from "@/lib/domain/types";
import { EntetePage } from "@/components/layout/entete-page";
import {
  BarreProgression,
  Carte,
  classesBouton,
  CodeCompetence,
  cx,
  EnTeteCarte,
  Etiquette,
  EtatVide,
  JaugeNiveau,
  Statistique,
  TagConfiance,
} from "@/components/ui/primitives";
import { Depliant, PanneauExplication, Reserves } from "@/components/ui/explication";
import { FacteursRevision } from "@/components/ui/facteurs-revision";
import { IconeFleche } from "@/components/ui/icones";
import { BoutonGenerer } from "@/components/exercices/bouton-generer";
import { BoutonEvolution } from "@/components/competences/modale-evolution";
import {
  calibragesPourModale,
  competencesPourModale,
} from "@/components/exercices/proprietes-generation";
import { TiroirTuteur } from "@/components/tuteur/tiroir-tuteur";
import { construireEtatInitialTuteur } from "@/lib/tutor/etat-initial";
import { formatDateCourte, formatDateRelative } from "@/lib/engine/dates";
import { prochaineRevision } from "@/lib/engine/spaced";

const DIMENSIONS: Dimension[] = [
  "comprehension",
  "application",
  "transfert",
  "integration",
  "justification",
];

export default async function PageCompetence(props: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await props.params;
  const ctx = await chargerContexte();
  const etat = ctx.etatsParCode.get(decodeURIComponent(code).toUpperCase());
  if (!etat) notFound();

  const exercices = ctx.donnees.exercises.filter((e) =>
    e.competences.includes(etat.skill.code),
  );
  const recommandation = ctx.recommandations.find((r) => r.etat.skill.code === etat.skill.code);
  const maitrise = ctx.maitrises.get(etat.skill.code);

  // Contexte du tuteur pour le tiroir — même assemblage que la page /tuteur.
  const etatInitialTuteur = await construireEtatInitialTuteur(ctx);
  const codesCompetences = ctx.etats.map((e) => e.skill.code);
  const domainesExistants = ctx.referentiel.domaines.map((d) => ({
    id: d.id,
    nom: d.nom,
    prefixe: d.prefixe,
  }));

  return (
    <>
      <div className="mb-3">
        <Link href="/competences" className="text-xs text-texte-attenue hover:text-texte">
          ← Toutes les compétences
        </Link>
      </div>

      <EntetePage
        titre={etat.skill.intitule}
        sousTitre={`${etat.skill.code} · ${libelleDomaine(ctx.referentiel, etat.skill.domaine)} · palier ${
          etat.skill.palier === "fondamentaux"
            ? "fondamental"
            : etat.skill.palier === "intermediaire"
              ? "intermédiaire"
              : "avancé"
        }`}
        actions={
          exercices.length > 0 ? (
            <Link href={`/exercices?competence=${etat.skill.code}`} className={classesBouton("secondaire")}>
              {exercices.length} exercice{exercices.length > 1 ? "s" : ""} disponible
              {exercices.length > 1 ? "s" : ""}
            </Link>
          ) : undefined
        }
      />

      <div className="grid gap-4 lg:grid-cols-3 [&>*]:min-w-0">
        {/* --------------------------- État actuel -------------------------- */}
        <div className="lg:col-span-2 space-y-4">
          <Carte>
            <EnTeteCarte
              titre="Niveau évalué"
              legende={
                etat.niveau === null
                  ? "Aucune preuve directe disponible"
                  : `${NIVEAUX[etat.niveau].nom} — ${NIVEAUX[etat.niveau].description}`
              }
              action={<TagConfiance confiance={etat.confiance} />}
            />
            <div className="px-4 py-3.5">
              <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
                <div>
                  <div className="text-[0.6875rem] uppercase tracking-wide text-texte-discret">
                    Niveau
                  </div>
                  <div className="chiffres mt-1 flex items-baseline gap-1">
                    <span
                      className={cx(
                        "text-3xl font-semibold tracking-tight",
                        etat.niveau === null ? "text-texte-discret" : "text-primaire",
                      )}
                    >
                      {etat.niveau ?? "—"}
                    </span>
                    <span className="text-sm text-texte-attenue">/ 5</span>
                  </div>
                  <div className="mt-2 w-32">
                    <JaugeNiveau niveau={etat.niveau} />
                  </div>
                </div>

                <Statistique
                  libelle="Score"
                  valeur={etat.score === null ? null : etat.score.toFixed(1).replace(".", ",")}
                  unite="/ 5"
                  precision="pondéré selon le protocole §12"
                />
                <Statistique
                  libelle="Robustesse"
                  valeur={etat.robustesse === null ? null : etat.robustesse.toFixed(2)}
                  precision="solidité de l'acquis, 0 à 1"
                />
                <Statistique
                  libelle="Preuves"
                  valeur={etat.preuves.length}
                  precision={`${etat.contextesTestes.length} contexte${
                    etat.contextesTestes.length > 1 ? "s" : ""
                  } distinct${etat.contextesTestes.length > 1 ? "s" : ""}`}
                />
                <Statistique
                  libelle="Dernière preuve"
                  valeur={
                    etat.dernierePreuve === null
                      ? null
                      : formatDateRelative(etat.dernierePreuve, ctx.now)
                  }
                  precision={
                    etat.dernierePreuve ? formatDateCourte(etat.dernierePreuve) : "jamais évaluée"
                  }
                />
              </div>

              {/* Détail dimension par dimension — la composition du score. */}
              {etat.statut === "evalue" && (
                <div className="mt-6">
                  <div className="mb-2 text-[0.6875rem] uppercase tracking-wide text-texte-discret">
                    Composition du score
                  </div>
                  <ul className="space-y-2">
                    {DIMENSIONS.map((d) => (
                      <li key={d} className="flex items-center gap-3">
                        <span className="w-28 shrink-0 text-xs text-texte-attenue">
                          {LIBELLES_DIMENSIONS[d]}
                        </span>
                        <div className="flex-1">
                          <BarreProgression fraction={etat.dimensions[d]} />
                        </div>
                        <span className="chiffres w-10 shrink-0 text-right text-xs">
                          {Math.round(etat.dimensions[d] * 100)}%
                        </span>
                        <span className="chiffres w-12 shrink-0 text-right text-[0.625rem] text-texte-discret">
                          {Math.round(POIDS_DIMENSIONS[d] * 100)}%
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-[0.625rem] text-texte-discret">
                    Colonne de droite : poids de la dimension dans le score global.
                  </p>
                </div>
              )}

              <div className="mt-5 border-t border-bordure pt-3">
                <PanneauExplication explication={etat.explication} titre="D'où vient ce niveau ?" />
              </div>
            </div>
          </Carte>

          {/* --------------------------- Preuves ---------------------------- */}
          <Carte>
            <EnTeteCarte
              titre="Preuves"
              legende="Journal complet, dans l'ordre chronologique. Aucune entrée n'est supprimée."
            />
            {etat.preuves.length === 0 ? (
              <EtatVide
                titre="Aucune preuve directe"
                message={
                  etat.skill.hypotheseInitiale
                    ? `Une hypothèse existe (${etat.skill.hypotheseInitiale.justification}) mais elle n'autorise aucun niveau. Un diagnostic est nécessaire.`
                    : "Cette compétence n'a jamais été évaluée. Elle apparaîtra ici dès la première preuve."
                }
                action={
                  exercices.length > 0 ? (
                    <Link href={`/exercices/${exercices[0].id}`} className={classesBouton("principal", "petite")}>
                      Réaliser un diagnostic
                      <IconeFleche className="size-3.5" />
                    </Link>
                  ) : undefined
                }
              />
            ) : (
              <ul className="divide-y divide-bordure">
                {[...etat.preuves].reverse().map((p) => (
                  <li key={p.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Etiquette
                            ton={
                              p.resultat === "reussi"
                                ? "succes"
                                : p.resultat === "partiel"
                                  ? "info"
                                  : "alerte"
                            }
                          >
                            {p.resultat === "reussi"
                              ? "Réussi"
                              : p.resultat === "partiel"
                                ? "Partiel"
                                : "Non abouti"}
                          </Etiquette>
                          <Etiquette>{p.type}</Etiquette>
                          <Etiquette>
                            {p.autonomie} · {AUTONOMIE[p.autonomie].libelle}
                          </Etiquette>
                          <Etiquette>Qualité {p.qualite}</Etiquette>
                          <Etiquette ton={p.niveauPreuve === "A" ? "primaire" : "neutre"}>
                            Preuve {p.niveauPreuve}
                          </Etiquette>
                        </div>
                        <p className="mt-1.5 text-xs text-texte-attenue">
                          Contexte : {p.contexte}
                        </p>
                        {p.commentaire && (
                          <p className="mt-1 text-xs text-texte-attenue">{p.commentaire}</p>
                        )}
                        {p.competencesCombinees && p.competencesCombinees.length > 0 && (
                          <p className="mt-1 text-[0.6875rem] text-texte-discret">
                            Combinée avec : {p.competencesCombinees.join(", ")}
                          </p>
                        )}
                      </div>
                      <span className="shrink-0 text-[0.6875rem] text-texte-discret">
                        {formatDateCourte(p.date)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Carte>
        </div>

        {/* --------------------------- Colonne droite ----------------------- */}
        <div className="space-y-4">
          {/*
            Compétence maîtrisée (ADR-042).

            En tête de colonne, AU-DESSUS de « Prochaine étape » : quand une
            compétence est sue, la question n'est plus « que faire ensuite pour
            l'apprendre » mais « qu'en fait-on ». Rien n'est stocké — le
            prédicat se recalcule à chaque lecture, et une preuve contradictoire
            écrite demain fait disparaître cette carte d'elle-même.

            Pas de carte sur le tableau de bord : une quatrième carte y serait le
            défaut de surface qu'ADR-037 a nommé.
          */}
          {maitrise?.maitrisee && (
            <Carte>
              <EnTeteCarte
                titre="Compétence maîtrisée"
                legende="Dérivée du niveau et de la confiance — jamais stockée"
                action={<Etiquette ton="succes">Maîtrisée</Etiquette>}
              />
              <div className="px-4 py-3.5">
                <p className="text-xs text-texte-attenue">
                  {maitrise.explication.resume}
                </p>
                <div className="mt-3">
                  <BoutonEvolution
                    code={etat.skill.code}
                    intitule={etat.skill.intitule}
                    domaineNom={libelleDomaine(ctx.referentiel, etat.skill.domaine)}
                    nombrePreuves={etat.preuves.length}
                    compteId={ctx.donnees.user.id}
                    competences={competencesPourModale(ctx.referentiel.actifs)}
                    calibrages={calibragesPourModale(ctx.referentiel.actifs, ctx.calibrations)}
                  />
                </div>
                <div className="mt-3 border-t border-bordure pt-3">
                  <PanneauExplication
                    explication={maitrise.explication}
                    titre="D'où vient cette maîtrise ?"
                  />
                </div>
              </div>
            </Carte>
          )}

          <Carte accent>
            <div className="px-4 py-3.5">
              <div className="text-[0.6875rem] font-semibold uppercase tracking-wider text-primaire">
                Prochaine étape
              </div>
              <p className="mt-2 text-sm">{etat.prochaineEtape}</p>
              {recommandation && (
                <p className="mt-2 text-xs text-texte-attenue">{recommandation.raison}</p>
              )}
              {recommandation?.exercice ? (
                <Link
                  href={`/exercices/${recommandation.exercice.id}`}
                  className={cx(classesBouton("principal"), "mt-3 w-full")}
                >
                  Commencer
                  <IconeFleche className="size-4" />
                </Link>
              ) : (
                <div className="mt-3">
                  <BoutonGenerer
                    competences={competencesPourModale(ctx.referentiel.actifs)}
                    competenceInitiale={etat.skill.code}
                    calibrages={calibragesPourModale(ctx.referentiel.actifs, ctx.calibrations)}
                    compteId={ctx.donnees.user.id}
                    libelle="Générer un exercice"
                    variante="principal"
                  />
                </div>
              )}
              <div className="mt-3 border-t border-bordure pt-3">
                <TiroirTuteur
                  etatInitial={etatInitialTuteur}
                  competenceCiblee={`${etat.skill.code} — ${etat.skill.intitule}`}
                  codesCompetences={codesCompetences}
                  compteId={ctx.donnees.user.id}
                  domainesExistants={domainesExistants}
                  libelle="Explique-moi cette compétence"
                />
              </div>
            </div>
          </Carte>

          {/*
            Répétition espacée (spaced.ts) : quand revoir cette compétence ?
            L'intervalle se dérive de l'état (niveau, robustesse, confiance,
            dernier résultat) — jamais d'une date stockée (P1). Une compétence
            sans preuve n'est pas « à réviser » : elle est à diagnostiquer, et
            la carte le dit au lieu d'afficher un intervalle vide.
          */}
          <Carte>
            <EnTeteCarte
              titre="Prochaine révision"
              legende="Répétition espacée — dérivée de l'état, jamais stockée"
            />
            <div className="px-4 py-3.5">
              {(() => {
                const revision = prochaineRevision(etat, ctx.now);
                if (revision.sansPreuve) {
                  return (
                    <p className="text-xs text-texte-attenue">
                      Aucune preuve : cette compétence est à <strong>diagnostiquer</strong>, pas à
                      réviser. {"L'intervalle de révision apparaîtra dès la première preuve."}
                    </p>
                  );
                }
                return (
                  <>
                    <p className="text-sm">
                      {revision.due ? (
                        <span className="font-medium text-primaire">
                          {"Due aujourd'hui —"} {revision.joursEcoules} jour
                          {revision.joursEcoules && revision.joursEcoules > 1 ? "s" : ""} écoulé
                          {revision.joursEcoules && revision.joursEcoules > 1 ? "s" : ""} pour un
                          intervalle de {revision.intervalleJours} jour
                          {revision.intervalleJours > 1 ? "s" : ""}.
                        </span>
                      ) : (
                        <>
                          Dans {revision.intervalleJours - (revision.joursEcoules ?? 0)} jour
                          {revision.intervalleJours - (revision.joursEcoules ?? 0) > 1 ? "s" : ""}{" "}
                          (intervalle {revision.intervalleJours} jour
                          {revision.intervalleJours > 1 ? "s" : ""},{" "}
                          {revision.joursEcoules ?? 0} écoulé
                          {revision.joursEcoules && revision.joursEcoules > 1 ? "s" : ""}).
                        </>
                      )}
                    </p>
                    <Depliant resume="Pourquoi cet intervalle ?">
                      <FacteursRevision facteurs={revision.facteurs} />
                    </Depliant>
                  </>
                );
              })()}
            </div>
          </Carte>

          {etat.contradictions.length > 0 && (
            <Carte>
              <EnTeteCarte
                titre="Preuves contradictoires"
                legende="Conservées, jamais arbitrées au profit de la plus récente"
              />
              <div className="px-4 py-3">
                <p className="text-xs text-texte-attenue">
                  {etat.contradictions.length} preuve(s) s&apos;opposent à la tendance dominante.
                  Conformément au protocole, la confiance a été réduite plutôt que le niveau, et une
                  réévaluation ciblée est souhaitable.
                </p>
                <ul className="mt-2 space-y-1">
                  {etat.contradictions.map((c) => (
                    <li key={c.id} className="text-[0.6875rem] text-texte-discret">
                      {formatDateCourte(c.date)} — {c.contexte}
                    </li>
                  ))}
                </ul>
              </div>
            </Carte>
          )}

          {etat.explication.reserves.length > 0 && (
            <Carte>
              <EnTeteCarte titre="Réserves méthodologiques" />
              <div className="px-4 py-3">
                <Reserves items={etat.explication.reserves} />
              </div>
            </Carte>
          )}

          {etat.contextesTestes.length > 0 && (
            <Carte>
              <EnTeteCarte
                titre="Contextes testés"
                legende="Le transfert se mesure à leur diversité"
              />
              <ul className="px-4 py-3 space-y-1">
                {etat.contextesTestes.map((c) => (
                  <li key={c} className="text-xs text-texte-attenue">
                    · {c}
                  </li>
                ))}
              </ul>
            </Carte>
          )}

          {/*
            Dépendances entre compétences (Chantier 10).
            Les prérequis sont déjà affichés ; on ajoute les DÉPENDANTS —
            les compétences qui citent celle-ci comme prérequis.
          */}
          {(() => {
            const dependants = ctx.referentiel.actifs.filter((s) =>
              s.prerequis.includes(etat.skill.code),
            );
            const aPrerequis = etat.skill.prerequis.length > 0;
            const aDependants = dependants.length > 0;

            if (!aPrerequis && !aDependants) return null;

            return (
              <Carte>
                <EnTeteCarte
                  titre="Dépendances"
                  legende="Prérequis et compétences qui en dépendent"
                />
                {aPrerequis && (
                  <div className="border-b border-bordure">
                    <div className="px-4 pt-2.5 text-[0.625rem] font-semibold uppercase tracking-wider text-texte-discret">
                      Prérequis (indicatifs, non bloquants)
                    </div>
                    <ul className="divide-y divide-bordure/60">
                      {etat.skill.prerequis.map((c) => {
                        const p = ctx.etatsParCode.get(c);
                        return (
                          <li key={c} className="px-4 py-2">
                            <Link
                              href={`/competences/${c}`}
                              className="flex items-center justify-between gap-2 hover:underline"
                            >
                              <span className="min-w-0">
                                <CodeCompetence code={c} />
                                <span className="ml-1.5 text-xs text-texte-attenue">
                                  {p?.skill.intitule.slice(0, 40)}
                                  {p && p.skill.intitule.length > 40 ? "…" : ""}
                                </span>
                              </span>
                              <span className="chiffres shrink-0 text-xs text-texte-discret">
                                {p?.niveau ?? "—"}/5
                              </span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
                {aDependants && (
                  <div>
                    <div className="px-4 pt-2.5 text-[0.625rem] font-semibold uppercase tracking-wider text-texte-discret">
                      Compétences qui en dépendent
                    </div>
                    <ul className="divide-y divide-bordure/60">
                      {dependants.map((s) => {
                        const d = ctx.etatsParCode.get(s.code);
                        return (
                          <li key={s.code} className="px-4 py-2">
                            <Link
                              href={`/competences/${s.code}`}
                              className="flex items-center justify-between gap-2 hover:underline"
                            >
                              <span className="min-w-0">
                                <CodeCompetence code={s.code} />
                                <span className="ml-1.5 text-xs text-texte-attenue">
                                  {s.intitule.slice(0, 40)}
                                  {s.intitule.length > 40 ? "…" : ""}
                                </span>
                              </span>
                              <span className="chiffres shrink-0 text-xs text-texte-discret">
                                {d?.niveau ?? "—"}/5
                              </span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </Carte>
            );
          })()}
        </div>
      </div>

    </>
  );
}
