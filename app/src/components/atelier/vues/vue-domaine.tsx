"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { VueDomaineAtelier } from "@/lib/documents/vue-atelier";
import { Bouton, cx } from "@/components/ui/primitives";
import { IconeDocuments } from "@/components/ui/icones";
import { Radar } from "@/components/charts";
import { BoutonReviser } from "@/components/referentiel/bouton-reviser";
import { GestionDomaine } from "@/components/referentiel/gestion-domaine";
import { ModaleCompetence } from "@/components/referentiel/modale-competence";
import {
  BoutonSuppressionCarte,
  ModaleConfirmationSuppression,
} from "../modale-confirmation-suppression";
import { retirerCompetences, rattacherCompetences, restaurerDomaine } from "@/lib/store/referentiel-actions";
import {
  Indicateur,
  dateCourte,
  LIBELLES_PALIERS,
  LIBELLES_CONFIANCE,
} from "./elements-fiche";

export function VueDomaine({
  vue,
  ouvrirElement,
  compteId,
  modeInitial,
  onRestaurerDomaine,
}: {
  vue: VueDomaineAtelier;
  ouvrirElement: (id: string) => void;
  compteId: string;
  modeInitial?: "referentiel";
  onRestaurerDomaine?: (domaineId: string) => void;
}) {
  const router = useRouter();
  const [restaurationEnCours, demarrerRestauration] = useTransition();
  const [palierNouveau, setPalierNouveau] = useState<string | null>(null);
  const [competenceARetirer, setCompetenceARetirer] = useState<VueDomaineAtelier["competences"][number] | null>(null);
  const [detachement, setDetachement] = useState<string | null>(null);
  const [section, setSection] = useState<"structure" | "progression" | "referentiel">(
    modeInitial === "referentiel" && !vue.domaine.archive ? "referentiel" : "structure",
  );
  const groupes = ["fondamentaux", "intermediaire", "avance"].map((palier) => ({
    palier,
    items: vue.competences.filter((competence) => competence.palier === palier),
  }));
  const couverture = vue.competences.length ? vue.nombreEvaluees / vue.competences.length : 0;
  const axes = vue.competences.map((competence) => ({
    libelle: competence.code.replace(`${vue.domaine.prefixe}-`, ""),
    valeur: competence.score === null ? null : Math.round((competence.score / 5) * 100),
  }));
  const sections = [
    { id: "structure" as const, libelle: "Structure" },
    { id: "progression" as const, libelle: "Progression" },
    { id: "referentiel" as const, libelle: "Gérer le référentiel" },
  ];
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
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primaire">Fiche mère</p>
                {vue.domaine.archive && (
                  <span className="rounded-full bg-surface-3 px-2 py-0.5 text-[0.6875rem] font-semibold text-texte-discret">
                    Archivé
                  </span>
                )}
              </div>
              <h2 className="font-serif text-[2.2rem] font-medium tracking-tight text-texte">{vue.nom}</h2>
              {vue.description && (
                <p className="mt-3 max-w-3xl text-base leading-relaxed text-texte-attenue">{vue.description}</p>
              )}
            </div>
          </div>

          {vue.domaine.archive && (
            <div className="flex items-center gap-2 shrink-0">
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
                Restaurer ce domaine
              </Bouton>
            </div>
          )}
        </div>

        {vue.domaine.archive && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-bordure bg-surface-2 px-3.5 py-2.5 text-xs text-texte-attenue">
            <p>
              Ce domaine est archivé : ses compétences sont sorties du pilotage actif, mais toutes ses observations historiques restent protégées en base de données.
            </p>
          </div>
        )}
      </header>
      <div className="border-b border-bordure bg-surface px-6 lg:px-8">
        <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="Sections du domaine">
          {sections.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={section === item.id}
              onClick={() => setSection(item.id)}
              className={cx(
                "shrink-0 border-b-2 px-4 py-3 text-sm font-medium cursor-pointer",
                section === item.id ? "border-primaire text-primaire" : "border-transparent text-texte-discret hover:text-texte",
              )}
            >
              {item.libelle}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-6 p-6 lg:p-8">
        {section !== "referentiel" && (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Indicateur libelle="Compétences" valeur={String(vue.competences.length)} precision={`${vue.nombreEvaluees} sur ${vue.competences.length} compétence${vue.competences.length > 1 ? "s" : ""} évaluée${vue.nombreEvaluees > 1 ? "s" : ""}`} />
            <Indicateur libelle="Couverture" valeur={`${Math.round(couverture * 100)} %`} precision="Compétences avec observation" />
            <Indicateur libelle="Observations" valeur={String(vue.nombreObservations)} precision="Observations conservées" />
            <Indicateur libelle="Exercices" valeur={String(vue.nombreExercices)} precision={`Dernière activité : ${dateCourte(vue.derniereActivite)}`} />
          </div>
        )}

        {section === "structure" && (
          <div className="space-y-8">
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
                            <span className="font-mono text-[0.625rem] text-texte-discret">{competence.code}</span>
                            <span className="chiffres rounded-md bg-surface-2 px-2 py-0.5 text-[0.625rem]">
                              {competence.niveau === null ? "Non mesurée" : `Niveau ${competence.niveau}`}
                            </span>
                          </div>
                          <h4 className="mt-2 text-sm font-semibold leading-snug group-hover:text-primaire">{competence.titre}</h4>
                          {competence.rattachee && (
                            <p className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-accent/10 px-1.5 py-0.5 text-[0.625rem] font-medium text-accent">
                              Portée par {competence.porteurNom}
                            </p>
                          )}
                        </div>
                        <p className="mt-3 text-[0.6875rem] text-texte-discret">
                          {competence.nombreObservations} observation{competence.nombreObservations > 1 ? "s" : ""} · confiance {LIBELLES_CONFIANCE[competence.confiance].toLowerCase()}
                        </p>
                      </button>

                      {!vue.domaine.archive && (
                        competence.rattachee ? (
                          <BoutonSuppressionCarte
                            titre={`Détacher ${competence.code} de ce domaine`}
                            onClick={() => setDetachement(competence.code)}
                          />
                        ) : (
                          <BoutonSuppressionCarte
                            titre="Retirer cette compétence"
                            onClick={() => setCompetenceARetirer(competence)}
                          />
                        )
                      )}
                    </div>
                  ))}

                  {compteId && !vue.domaine.archive && (
                    <button
                      type="button"
                      onClick={() => setPalierNouveau(groupe.palier)}
                      className="group flex min-h-[105px] items-center justify-center gap-3 rounded-xl border-2 border-dashed border-bordure bg-surface/30 p-4 text-center shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-primaire hover:bg-surface hover:shadow-xs cursor-pointer"
                    >
                      <span className="grid size-8 place-items-center rounded-full bg-surface-2 text-sm font-semibold text-texte-discret transition-colors group-hover:bg-primaire-faible group-hover:text-primaire">
                        +
                      </span>
                      <div className="text-left min-w-0">
                        <span className="block text-xs font-semibold text-texte transition-colors group-hover:text-primaire">
                          Ajouter une compétence
                        </span>
                        <span className="block text-[0.6875rem] text-texte-discret">
                          Palier {LIBELLES_PALIERS[groupe.palier]?.toLowerCase()}
                        </span>
                      </div>
                    </button>
                  )}
                </div>
              </section>
            ))}
          </div>
        )}

        {detachement && (
          <ModaleConfirmationSuppression
            titre="Détacher la compétence"
            nomElement={detachement}
            typeElement="competence"
            mode="suppression"
            explication="La compétence cesse de servir ce domaine. Elle reste intacte dans son domaine porteur, avec son code et ses observations."
            texteBoutonConfirmer="Détacher"
            onConfirmer={async () => {
              await rattacherCompetences(vue.domaine.id, [detachement], false);
              setDetachement(null);
              router.refresh();
            }}
            onFermer={() => setDetachement(null)}
          />
        )}

        {competenceARetirer && (
          <ModaleConfirmationSuppression
            titre="Retirer la compétence"
            nomElement={`${competenceARetirer.code} : ${competenceARetirer.titre}`}
            typeElement="competence"
            mode={competenceARetirer.nombreObservations > 0 ? "archivage" : "suppression"}
            explication={
              competenceARetirer.nombreObservations > 0
                ? "Cette compétence possède des observations d’apprentissage. Elle sera archivée sans perte d’historique : ses données restent protégées."
                : "Cette compétence ne possède aucune observation directe. Elle sera retirée du référentiel."
            }
            texteBoutonConfirmer={competenceARetirer.nombreObservations > 0 ? "Confirmer l’archivage" : "Supprimer la compétence"}
            onConfirmer={async () => {
              await retirerCompetences([competenceARetirer.code]);
              setCompetenceARetirer(null);
              router.refresh();
            }}
            onFermer={() => setCompetenceARetirer(null)}
          />
        )}

        {palierNouveau && compteId && (
          <ModaleCompetence
            compteId={compteId}
            domainesExistants={vue.domainesExistants}
            domaineInitial={vue.domaine.nom}
            brancheInitiale={{
              domaine: vue.domaine.nom,
              prefixe: vue.domaine.prefixe,
              description: vue.domaine.description ?? "",
              justification: "",
              competences: [
                {
                  intitule: "",
                  palier: palierNouveau,
                  importance: "1.0",
                },
              ],
            }}
            onFermer={() => setPalierNouveau(null)}
            surEnregistre={() => {
              setPalierNouveau(null);
              router.refresh();
            }}
          />
        )}

        {section === "progression" && (
          <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="rounded-xl border border-bordure bg-surface p-5 shadow-[var(--ombre-posee)]">
              <h3 className="font-serif text-xl font-medium">Radar du domaine</h3>
              <p className="mt-1 text-xs text-texte-discret">Un axe par compétence. Les axes vides ne sont pas des lacunes : rien n’a encore été testé.</p>
              <div className="mt-4"><Radar axes={axes} taille={320} libelle={`Radar par compétence du domaine ${vue.nom}`} /></div>
            </div>
            <div className="rounded-xl border border-bordure bg-surface p-5 shadow-[var(--ombre-posee)]">
              <h3 className="font-serif text-xl font-medium">Lecture</h3>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between gap-3"><dt className="text-texte-discret">Mesurées</dt><dd className="font-semibold">{vue.nombreEvaluees}/{vue.competences.length}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-texte-discret">Observations</dt><dd className="font-semibold">{vue.nombreObservations}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-texte-discret">Dernière activité</dt><dd className="text-right font-semibold">{dateCourte(vue.derniereActivite)}</dd></div>
              </dl>
              {axes.some((axe) => axe.valeur === null) && <p className="mt-5 rounded-lg bg-info-faible p-3 text-xs leading-relaxed text-info">Les axes sans observation sont affichés pour situer la couverture ; ils ne signalent pas une faiblesse.</p>}
            </div>
          </section>
        )}

        {section === "referentiel" && (
          <section className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-primaire/20 bg-primaire-faible/35 p-4">
              <div className="max-w-2xl">
                <h3 className="text-sm font-semibold">Révision assistée</h3>
                <p className="mt-1 text-xs leading-relaxed text-texte-attenue">Décris ce qui manque ou ce qui doit changer. Le tuteur propose un diff du domaine ; rien n’est appliqué sans ta validation.</p>
              </div>
              <BoutonReviser
                domaineId={vue.domaine.id}
                domaineNom={vue.domaine.nom}
                competences={vue.skills.filter((skill) => !skill.archive).map((skill) => ({ code: skill.code, intitule: skill.intitule, palier: skill.palier, observations: vue.retraits[skill.code]?.observations ?? 0, modeRetrait: vue.retraits[skill.code]?.mode ?? "suppression" }))}
                domainesExistants={vue.domainesExistants}
                compteId={compteId}
              />
            </div>
            <GestionDomaine domaine={vue.domaine} skills={vue.skills} retraits={vue.retraits} changements={vue.changements} />
          </section>
        )}
      </div>
    </div>
  );
}
