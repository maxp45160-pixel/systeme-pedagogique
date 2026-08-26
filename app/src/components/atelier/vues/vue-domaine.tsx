"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { VueDomaineAtelier } from "@/lib/documents/vue-atelier";
import type { ProgressionDomaineVue } from "@/lib/documents/progression-domaine";
import { Bouton, Etiquette } from "@/components/ui/primitives";
import { IconeDocuments, IconeRecherche } from "@/components/ui/icones";
import { libelleCompte } from "@/lib/domain/engagement";
import { BoutonEcheance } from "@/components/dashboard/bouton-echeance";
import { BoutonReviser } from "@/components/referentiel/bouton-reviser";
import { ModaleCompetence } from "@/components/referentiel/modale-competence";
import { CompetencesMisesDeCote } from "@/components/referentiel/competences-mises-de-cote";
import { restaurerDomaine } from "@/lib/store/referentiel-actions";
import { motifsNonAtomique } from "@/lib/domain/atomicite";
import {
  Indicateur,
  dateCourte,
  LIBELLES_PALIERS,
  LIBELLES_REPERES,
  libelleImportance,
} from "./elements-fiche";
import { ArbreDomaineVue } from "./arbre-domaine";
import { ClassementDomaine } from "./classement-domaine";
import { CarteEnTeteDomaine } from "@/components/progression/carte-en-tete-domaine";
import { FaitsMarquants } from "@/components/progression/faits-marquants";
import { TopCompetences } from "@/components/progression/top-competences";
import { BilanCroissanceLie } from "@/components/progression/bilan-croissance-lie";
import { ParenteDomaine } from "./parente-domaine";
import { usageDuDomaine } from "@/lib/domain/usage-domaine";
import { ModaleUsageDomaine } from "@/components/referentiel/modale-usage-domaine";

/**
 * Les lectures des mêmes compétences : « Fiches » les liste, « Arbre » les
 * dispose selon les prérequis déclarés, « Progression » dit ce que la pratique
 * du domaine a produit. Le filtre de recherche n'agit que sur la première —
 * filtrer un arbre en couperait les chemins.
 */
type ModeLecture = "fiches" | "arbre" | "progression";

export function VueDomaine({
  vue,
  ouvrirElement,
  compteId,
  onRestaurerDomaine,
  domainesExistants = [],
  modeInitial,
}: {
  vue: VueDomaineAtelier;
  ouvrirElement: (id: string) => void;
  compteId: string;
  onRestaurerDomaine?: (domaineId: string) => void;
  domainesExistants?: { id: string; nom: string; prefixe: string }[];
  /** Mode de lecture initial, venu de l'URL (`/atelier?document=…&vue=progression`). */
  modeInitial?: ModeLecture;
}) {
  const router = useRouter();
  const [restaurationEnCours, demarrerRestauration] = useTransition();
  const [ajoutCompetenceOuvert, setAjoutCompetenceOuvert] = useState(false);
  const [usageOuvert, setUsageOuvert] = useState(false);
  /*
   * Trois lectures des mêmes compétences, jamais trois rangements. Le filtre
   * de recherche n'agit que sur la première — voir `ModeLecture`.
   */
  const [mode, setMode] = useState<ModeLecture>(modeInitial ?? "fiches");
  const [rechercheCompetence, setRechercheCompetence] = useState("");
  const termeCompetence = rechercheCompetence.trim().toLocaleLowerCase("fr");
  const usage = usageDuDomaine(vue.domaine);
  const nombreCompetencesHeritees = vue.arbre.rangees.reduce(
    (total, rangee) => total + rangee.noeuds.filter((noeud) => noeud.rattachee).length,
    0,
  );
  const libelleUsage =
    usage.type === "module"
      ? usage.module.closLe
        ? "Module clôturé"
        : "Module académique"
      : usage.type === "continu"
        ? "Progression continue"
        : "Usage à préciser";

  const groupes = useMemo(
    () =>
      ["fondamentaux", "intermediaire", "avance"]
        .map((palier) => ({
          palier,
          items: vue.competences.filter(
            (competence) =>
              competence.palier === palier &&
              `${competence.titre} ${competence.code}`
                .toLocaleLowerCase("fr")
                .includes(termeCompetence),
          ),
        }))
        .filter((groupe) => groupe.items.length > 0),
    [termeCompetence, vue.competences],
  );
  const nombreCompetencesVisibles = groupes.reduce((total, groupe) => total + groupe.items.length, 0);
  const couverture = vue.competences.length ? vue.nombreEvaluees / vue.competences.length : 0;
  const intitulesParCode = new Map([
    ...vue.skills.map((skill) => [skill.code, skill.intitule] as const),
    ...vue.competences.map((competence) => [competence.code, competence.titre] as const),
  ]);
  const libellesCompetences = (codes: string[]) =>
    codes.map((code) => intitulesParCode.get(code) ?? "Repère à préciser").join(", ");
  /*
   * Ce que ce domaine a mis de côté. Lu sur `vue.skills` — la liste que la
   * GOUVERNANCE régit (le namespace de création, ADR-065), pas sur les
   * compétences affichées : une compétence archivée n'est affichée nulle part,
   * c'est précisément le problème que la reprise résout.
   */
  const misesDeCote = vue.skills
    .filter((skill) => skill.archive)
    .map((skill) => ({ code: skill.code, intitule: skill.intitule }));
  const competencesRevisables = vue.skills
    .filter((skill) => !skill.archive)
    .map((skill) => ({
      code: skill.code,
      intitule: skill.intitule,
      palier: skill.palier,
      observations: vue.retraits[skill.code]?.observations ?? 0,
      modeRetrait: vue.retraits[skill.code]?.mode ?? ("suppression" as const),
      reformulationManuelleRequise: motifsNonAtomique(skill.intitule).length > 0,
    }));
  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-surface-2/40">
      <header className="border-b border-bordure bg-surface px-6 py-5 lg:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <span className="grid size-14 place-items-center rounded-2xl bg-primaire-faible text-primaire shrink-0">
              <IconeDocuments className="size-7" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primaire">{libelleUsage}</p>
                {vue.domaine.archive && (
                  <span className="rounded-full bg-surface-3 px-2 py-0.5 text-[0.6875rem] font-semibold text-texte-discret">
                    Mis de côté
                  </span>
                )}
              </div>
              <h2 className="font-serif text-[2.2rem] font-medium tracking-tight text-texte">{vue.nom}</h2>
              {vue.description && (
                <p className="mt-3 max-w-3xl text-base leading-relaxed text-texte-attenue">{vue.description}</p>
              )}
              {usage.type === "module" && (
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-texte-discret">
                  <span className="font-medium text-texte-attenue">
                    Année {usage.module.anneeAcademique}
                  </span>
                  {usage.module.periode && <span>Période {usage.module.periode}</span>}
                  {usage.module.closLe && (
                    <span>Clôturé le {dateCourte(usage.module.closLe)}</span>
                  )}
                  <span>{vue.competences.length} directe{vue.competences.length > 1 ? "s" : ""}</span>
                  <span>{nombreCompetencesHeritees} héritée{nombreCompetencesHeritees > 1 ? "s" : ""}</span>
                </div>
              )}
            </div>
          </div>

          {(!vue.domaine.archive && compteId) || vue.domaine.archive ? (
            <div className="flex items-center gap-2 shrink-0">
              {!vue.domaine.archive && compteId && (
                <>
                  <Bouton
                    variante="secondaire"
                    taille="normale"
                    onClick={() => setUsageOuvert(true)}
                  >
                    {usage.type === "indetermine" ? "Préciser le cadre" : "Modifier le cadre"}
                  </Bouton>
                  <Bouton
                    variante="principal"
                    taille="normale"
                    onClick={() => setAjoutCompetenceOuvert(true)}
                  >
                    Ajouter une compétence
                  </Bouton>
                  <BoutonReviser
                    domaineId={vue.domaine.id}
                    domaineNom={vue.domaine.nom}
                    competences={competencesRevisables}
                    compteId={compteId}
                  />
                </>
              )}
              {vue.domaine.archive && (
                <Bouton
                  variante="principal"
                  taille="normale"
                  enChargement={restaurationEnCours}
                  disabled={restaurationEnCours}
                  onClick={() => {
                    demarrerRestauration(async () => {
                      onRestaurerDomaine?.(vue.domaine.id);
                      await restaurerDomaine(vue.domaine.id);
                      router.refresh();
                    });
                  }}
                >
                  Reprendre ce domaine
                </Bouton>
              )}
            </div>
          ) : null}
        </div>

        {vue.domaine.archive && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-bordure bg-surface-2 px-3.5 py-2.5 text-xs text-texte-attenue">
            <p>
              Ce domaine est mis de côté : il ne propose plus de travail pour l’instant. Les traces déjà conservées restent intactes.
            </p>
          </div>
        )}
      </header>
      <div className="space-y-6 p-6 lg:p-8">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {/* Ce que ce domaine tague ; ses sous-domaines se lisent à part. */}
            <Indicateur libelle="Compétences" valeur={String(vue.competences.length)} precision={`${vue.nombreEvaluees} déjà rencontrée${vue.nombreEvaluees > 1 ? "s" : ""}`} />
            <Indicateur libelle="Chemin parcouru" valeur={`${Math.round(couverture * 100)} %`} precision="Compétences déjà rencontrées" />
            <Indicateur libelle="Traces de travail" valeur={String(vue.nombreObservations)} precision="Constats gardés en mémoire" />
            <Indicateur libelle="Exercices" valeur={String(vue.nombreExercices)} precision={`Dernière activité : ${dateCourte(vue.derniereActivite)}`} />
        </div>

        <div className="space-y-8">
            <ClassementDomaine
              domaineId={vue.domaine.id}
              compteId={compteId}
              rattachement={vue.rattachementCarte}
              classification={vue.classificationCarte}
              modifiable={!vue.domaine.archive && Boolean(compteId)}
            />
            <ParenteDomaine
              domaineId={vue.domaine.id}
              chemin={vue.chemin}
              enfants={vue.enfants}
              destinations={vue.parentsPossibles}
              modifiable={!vue.domaine.archive}
              ouvrirDomaine={(id) => ouvrirElement(`domaine:${id}`)}
            />
            {!vue.domaine.archive && (
              /*
               * Le cadre du module (ADR-138) : les échéances déclarées SUR ce
               * domaine, dérivées des engagements — et le geste qui en déclare
               * une depuis ici, pré-remplie. Rien n'est stocké dans la vue :
               * la liste se recalcule à chaque lecture.
               */
              <section className="rounded-xl border border-bordure bg-surface px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.1em] text-texte-discret">
                    Échéances du module
                  </h3>
                  <BoutonEcheance
                    competences={vue.skills
                      .filter((skill) => !skill.archive)
                      .map(({ code, intitule }) => ({ code, intitule }))}
                    modules={vue.domainesExistants.map(({ id, nom }) => ({ id, nom }))}
                    initial={{ moduleDomaineId: vue.domaine.id }}
                    libelle="Déclarer une échéance pour ce module"
                  />
                </div>
                {vue.echeancesModule.length === 0 ? (
                  <p className="mt-2 text-xs leading-relaxed text-texte-discret">
                    Aucune échéance liée à ce module. Un examen, un rendu, un partiel à date
                    orientera les priorités de travail.
                  </p>
                ) : (
                  <ul className="mt-2 divide-y divide-bordure/60">
                    {vue.echeancesModule.map((echeance) => (
                      <li key={echeance.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 py-1.5">
                        <span className="text-sm font-medium text-texte">{echeance.libelle}</span>
                        <Etiquette ton={echeance.jours < 0 ? "alerte" : echeance.jours <= 3 ? "primaire" : "neutre"}>
                          {libelleCompte(echeance.jours)}
                        </Etiquette>
                        <span className="ml-auto shrink-0 font-mono text-[0.625rem] text-texte-discret">
                          {echeance.echeanceLe}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}
            {vue.ressources.length > 0 && (
              /*
               * Le fil des ressources (R3) : ce qu'on lit pour travailler ce
               * domaine, du plus récemment mobilisé au plus ancien. L'ordre
               * vient du journal — rien n'est stocké, aucune date n'est
               * fabriquée pour une ressource jamais mobilisée.
               */
              <section className="rounded-xl border border-bordure bg-surface px-4 py-4">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.1em] text-texte-discret">
                    Ressources
                  </h3>
                  <span className="chiffres text-[0.6875rem] text-texte-discret">
                    {vue.ressources.length}
                  </span>
                </div>
                <p className="mt-1 text-[0.6875rem] leading-relaxed text-texte-attenue">
                  Ce qu’on lit pour travailler ce domaine, du plus récemment
                  mobilisé au plus ancien.
                </p>
                <ul className="mt-2 divide-y divide-bordure/60">
                  {vue.ressources.map((ressource) => (
                    <li key={ressource.documentId}>
                      <button
                        type="button"
                        onClick={() => ouvrirElement(ressource.documentId)}
                        className="group flex w-full cursor-pointer items-center justify-between gap-3 py-2 text-left"
                      >
                        <span className="min-w-0 truncate text-sm font-medium text-texte transition-colors group-hover:text-primaire">
                          {ressource.titre}
                        </span>
                        <span className="shrink-0 text-[0.6875rem] text-texte-discret">
                          {ressource.derniereActivite
                            ? `Dernière activité : ${dateCourte(ressource.derniereActivite)}`
                            : "Jamais mobilisée"}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-bordure bg-surface px-3.5 py-3">
              <div className="inline-flex rounded-lg border border-bordure bg-surface-2 p-0.5">
                {([
                  ["fiches", "Fiches"],
                  ["arbre", "Arbre"],
                  ["progression", "Progression"],
                ] as const).map(([cle, libelle]) => (
                  <button
                    key={cle}
                    type="button"
                    onClick={() => setMode(cle)}
                    aria-pressed={mode === cle}
                    className={
                      mode === cle
                        ? "rounded-md bg-surface px-3 py-1 text-xs font-semibold text-texte shadow-xs cursor-pointer"
                        : "rounded-md px-3 py-1 text-xs font-medium text-texte-discret transition-colors hover:text-texte cursor-pointer"
                    }
                  >
                    {libelle}
                  </button>
                ))}
              </div>
              {mode === "fiches" ? (
                <>
                  <label className="flex min-w-[15rem] flex-1 items-center gap-2 text-xs text-texte-attenue">
                    <IconeRecherche className="size-4 shrink-0 text-texte-discret" />
                    <span className="sr-only">Filtrer les compétences de ce domaine</span>
                    <input
                      value={rechercheCompetence}
                      onChange={(event) => setRechercheCompetence(event.target.value)}
                      placeholder="Filtrer les compétences de ce domaine…"
                      className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-texte-discret"
                    />
                  </label>
                  <span className="text-[0.6875rem] text-texte-discret">
                    {nombreCompetencesVisibles} / {vue.competences.length} compétence{vue.competences.length > 1 ? "s" : ""} visible{nombreCompetencesVisibles > 1 ? "s" : ""}
                  </span>
                </>
              ) : mode === "arbre" ? (
                <span className="text-[0.6875rem] text-texte-discret">
                  Les traits pleins sont des prérequis déclarés ; les traits pointillés mènent à une compétence absente du périmètre.
                </span>
              ) : (
                <span className="text-[0.6875rem] text-texte-discret">
                  Ce que la pratique de ce domaine a produit — des mesures dérivées du journal, jamais du temps passé.
                </span>
              )}
            </div>
            {mode === "arbre" ? (
              <ArbreDomaineVue
                arbre={vue.arbre}
                intitules={intitulesParCode}
                ouvrirElement={ouvrirElement}
                onCreerCompetence={
                  compteId && !vue.domaine.archive
                    ? () => setAjoutCompetenceOuvert(true)
                    : undefined
                }
              />
            ) : mode === "progression" ? (
              <LectureProgression progression={vue.progression} />
            ) : (
              <>
              {groupes.map((groupe) => (
                <section key={groupe.palier}>
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-semibold uppercase tracking-[0.1em] text-texte-discret">
                        {LIBELLES_PALIERS[groupe.palier]}
                      </h3>
                      <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[0.625rem] font-medium text-texte-discret">
                        {groupe.items.length} fiche{groupe.items.length > 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {groupe.items.map((competence) => (
                      <div key={competence.code} className="group relative">
                        <button
                          type="button"
                          onClick={() => ouvrirElement(competence.code)}
                          className="flex h-full w-full flex-col justify-between rounded-xl border border-bordure bg-surface p-4 text-left shadow-[var(--ombre-posee)] transition-all hover:-translate-y-0.5 hover:border-primaire/30 hover:shadow-[var(--ombre-levee)] cursor-pointer"
                        >
                          <div>
                            <div className="flex items-start justify-between gap-3 pr-8">
                              <span className="chiffres rounded-md bg-surface-2 px-2 py-0.5 text-[0.625rem]">
                                {competence.niveau === null ? "À découvrir" : "Déjà rencontrée"}
                              </span>
                            </div>
                            <h4 className="mt-2 text-sm font-semibold leading-snug group-hover:text-primaire">{competence.titre}</h4>
                            <p className="mt-2 text-[0.6875rem] text-texte-discret">
                              {libelleImportance(competence.importance)}
                              {competence.prerequis.length > 0
                                ? ` · À connaître avant : ${libellesCompetences(competence.prerequis)}`
                                : " · Aucun chemin préalable déclaré"}
                            </p>
                            {competence.suivantes.length > 0 && (
                              <p className="mt-1 text-[0.6875rem] text-texte-discret">
                                Prépare : {libellesCompetences(competence.suivantes)}
                              </p>
                            )}
                            {competence.heritee && (
                              <p className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-accent/10 px-1.5 py-0.5 text-[0.625rem] font-medium text-accent">
                                Vient de {competence.origineNom}
                              </p>
                            )}
                          </div>
                          <p className="mt-3 text-[0.6875rem] text-texte-discret">
                            {competence.nombreObservations} trace{competence.nombreObservations > 1 ? "s" : ""} de travail · {LIBELLES_REPERES[competence.confiance]}
                          </p>
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
              {nombreCompetencesVisibles === 0 && (
                <p className="rounded-xl border border-dashed border-bordure bg-surface/50 px-4 py-8 text-center text-sm text-texte-discret">
                  Aucune compétence ne correspond à cette recherche.
                </p>
              )}
              {/*
                À la SUITE des fiches, jamais mêlée à elles : ce qui est mis de
                côté n'est pas du travail en cours. Absente d'un domaine
                lui-même mis de côté — on le reprend en entier d'abord, et sa
                reprise réactive toutes ses compétences.
              */}
              {!vue.domaine.archive && <CompetencesMisesDeCote competences={misesDeCote} />}
              </>
            )}
        </div>

      </div>
      {ajoutCompetenceOuvert && compteId && (
        <ModaleCompetence
          compteId={compteId}
          domainesExistants={domainesExistants}
          modeCible="competence"
          domaineInitial={vue.domaine.id}
          onFermer={() => setAjoutCompetenceOuvert(false)}
        />
      )}
      {usageOuvert && !vue.domaine.archive && (
        <ModaleUsageDomaine
          domaineId={vue.domaine.id}
          domaineNom={vue.domaine.nom}
          usageInitial={usage}
          onFermer={() => setUsageOuvert(false)}
          onEnregistre={() => router.refresh()}
        />
      )}
    </div>
  );
}

/**
 * La lecture longitudinale du domaine — la surface unique pour « où j'en suis
 * dans ce domaine », là où `/progression?domaine=` doublonnait. Les composants
 * de la page Progression sont réutilisés tels quels : ils ne reçoivent que des
 * props précalculées serveur (`ProgressionDomaineVue`), ils ne savent même pas
 * qu'un filtre existe.
 */
function LectureProgression({ progression }: { progression?: ProgressionDomaineVue }) {
  if (!progression) {
    /*
     * Imprévu seulement : toute fiche domaine porte sa lecture. Le repli dit
     * l'indisponibilité au lieu d'afficher un écran à moitié vide.
     */
    return (
      <p className="rounded-xl border border-dashed border-bordure bg-surface/50 px-4 py-8 text-center text-sm text-texte-discret">
        Lecture indisponible.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <CarteEnTeteDomaine
        domaine={progression.domaine}
        score={progression.score}
        competencesMesurees={progression.competencesMesurees}
        competencesEnVeille={progression.competencesEnVeille}
        observationsTotal={progression.observationsTotal}
        derniereObservation={progression.derniereObservation}
        variation7j={progression.evolution.variation7j}
      />

      <FaitsMarquants
        evolution={progression.evolution}
        carriere={progression.carriere}
        global={progression.global}
      />

      <TopCompetences etats={progression.etats} />

      <BilanCroissanceLie resume={progression.croissance} intitules={progression.intitules} />
    </div>
  );
}
