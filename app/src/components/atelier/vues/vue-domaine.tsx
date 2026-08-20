"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  construirePistesDomaine,
  type EntretienDomaineAtelier,
  type PisteDomaineAtelier,
  type VueDomaineAtelier,
} from "@/lib/documents/vue-atelier";
import { Bouton } from "@/components/ui/primitives";
import { IconeDocuments } from "@/components/ui/icones";
import { BoutonReviser } from "@/components/referentiel/bouton-reviser";
import { restaurerDomaine } from "@/lib/store/referentiel-actions";
import { motifsNonAtomique } from "@/lib/domain/atomicite";
import {
  Indicateur,
  dateCourte,
  LIBELLES_PALIERS,
  LIBELLES_REPERES,
  libelleImportance,
} from "./elements-fiche";

function PistesDomaine({
  pistes,
}: {
  pistes: Array<{ titre: string; items: PisteDomaineAtelier[] }>;
}) {
  if (pistes.length === 0) return null;

  return (
    <section className="rounded-xl border border-info/25 bg-info-faible/35 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-texte">Repères pour ce domaine</h3>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-texte-attenue">
            Le système les déduit de tes exercices, séances et traces de travail. La carte globale ne fournit ici que des idées à vérifier. Rien ne change ici : ce sont des invitations à regarder, pas des affirmations.
          </p>
        </div>
        <span className="rounded-full border border-info/30 bg-surface px-2 py-0.5 text-xs font-semibold tabular-nums text-info">
          {pistes.reduce((total, famille) => total + famille.items.length, 0)}
        </span>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {pistes.map((famille, familleIndex) => (
          <div key={`${famille.titre}-${familleIndex}`} className="rounded-lg border border-bordure bg-surface p-3">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-xs font-semibold text-texte">{famille.titre}</h4>
              <span className="text-[0.6875rem] tabular-nums text-texte-discret">{famille.items.length}</span>
            </div>
            <ul className="mt-2 space-y-2">
              {famille.items.slice(0, 4).map((piste, pisteIndex) => (
                <li key={`${famille.titre}-${piste.code ?? piste.titre}-${pisteIndex}`} className="text-xs">
                  <p className="font-medium text-texte">{piste.titre}</p>
                  <p className="mt-0.5 text-texte-discret">{piste.motif}</p>
                </li>
              ))}
            </ul>
            {famille.items.length > 4 && (
              <p className="mt-2 text-[0.6875rem] text-texte-discret">
                {famille.items.length - 4} autre{famille.items.length - 4 > 1 ? "s" : ""} piste{famille.items.length - 4 > 1 ? "s" : ""} dans l’analyse globale.
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

export function VueDomaine({
  vue,
  ouvrirElement,
  compteId,
  entretien,
  onRestaurerDomaine,
}: {
  vue: VueDomaineAtelier;
  ouvrirElement: (id: string) => void;
  compteId: string;
  entretien?: EntretienDomaineAtelier;
  onRestaurerDomaine?: (domaineId: string) => void;
}) {
  const router = useRouter();
  const [restaurationEnCours, demarrerRestauration] = useTransition();
  const groupes = ["fondamentaux", "intermediaire", "avance"].map((palier) => ({
    palier,
    items: vue.competences.filter((competence) => competence.palier === palier),
  }));
  const couverture = vue.competences.length ? vue.nombreEvaluees / vue.competences.length : 0;
  const intitulesParCode = new Map([
    ...vue.skills.map((skill) => [skill.code, skill.intitule] as const),
    ...vue.competences.map((competence) => [competence.code, competence.titre] as const),
  ]);
  const libellesCompetences = (codes: string[]) =>
    codes.map((code) => intitulesParCode.get(code) ?? "Repère à préciser").join(", ");
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
  const pistes = construirePistesDomaine(vue, entretien);
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
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primaire">Domaine</p>
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
            </div>
          </div>

          {(!vue.domaine.archive && compteId) || vue.domaine.archive ? (
            <div className="flex items-center gap-2 shrink-0">
              {!vue.domaine.archive && compteId && (
                <BoutonReviser
                  domaineId={vue.domaine.id}
                  domaineNom={vue.domaine.nom}
                  competences={competencesRevisables}
                  compteId={compteId}
                />
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
            <Indicateur libelle="Compétences" valeur={String(vue.competences.length)} precision={`${vue.nombreEvaluees} déjà rencontrée${vue.nombreEvaluees > 1 ? "s" : ""}`} />
            <Indicateur libelle="Chemin parcouru" valeur={`${Math.round(couverture * 100)} %`} precision="Compétences déjà rencontrées" />
            <Indicateur libelle="Traces de travail" valeur={String(vue.nombreObservations)} precision="Constats gardés en mémoire" />
            <Indicateur libelle="Exercices" valeur={String(vue.nombreExercices)} precision={`Dernière activité : ${dateCourte(vue.derniereActivite)}`} />
        </div>

        <div className="space-y-8">
            <PistesDomaine pistes={pistes} />
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
                          {competence.rattachee && (
                            <p className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-accent/10 px-1.5 py-0.5 text-[0.625rem] font-medium text-accent">
                              Portée par {competence.porteurNom}
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
        </div>

      </div>
    </div>
  );
}
