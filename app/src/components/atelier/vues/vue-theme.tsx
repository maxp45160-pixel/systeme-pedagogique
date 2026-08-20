"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { VueThemeAtelier } from "@/lib/documents/vue-atelier";
import { cx } from "@/components/ui/primitives";
import { urlComposerAutonome } from "@/lib/domain/navigation-exercice";
import {
  IconeExercices,
  IconeFleche,
  IconeTheme,
} from "@/components/ui/icones";
import { Radar } from "@/components/charts";
import { BoutonGenerer } from "@/components/exercices/bouton-generer";
import type { CalibrageModale, CompetenceModale } from "@/components/exercices/proprietes-generation";
import { ConcepteurSeance, type DonneesSeance } from "@/components/seances/concepteur-seance";
import { ModaleConfirmationSuppression } from "../modale-confirmation-suppression";
import { retirerTheme } from "@/lib/store/theme-actions";
import {
  Indicateur,
  dateCourte,
  LIBELLES_PALIERS,
  LIBELLES_CONFIANCE,
} from "./elements-fiche";

export function VueTheme({
  vue,
  titre,
  ouvrirElement,
  compteId,
  generation,
  donneesSeance,
}: {
  vue: VueThemeAtelier;
  titre: string;
  ouvrirElement: (id: string) => void;
  compteId?: string;
  generation?: { competences: CompetenceModale[]; calibrages: Record<string, CalibrageModale> };
  donneesSeance?: DonneesSeance;
}) {
  const router = useRouter();
  const [onglet, setOnglet] = useState<"competences" | "exercices">("competences");
  const [filtreDomaine, setFiltreDomaine] = useState<string>("tous");
  const [confirmationSuppressionTheme, setConfirmationSuppressionTheme] = useState(false);

  const competencesFiltrees = vue.competences.filter(
    (c) => filtreDomaine === "tous" || c.domaineId === filtreDomaine,
  );

  const axes = vue.competences.map((c) => ({
    libelle: c.code,
    valeur: c.score === null ? null : Math.round((c.score / 5) * 100),
  }));

  const onglets = [
    { id: "competences" as const, libelle: `Compétences (${vue.competences.length})` },
    { id: "exercices" as const, libelle: `Exercices (${vue.exercices.length})` },
  ];

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-surface-2/40">
      {/* Bannière d'en-tête du thème */}
      <header className="border-b border-bordure bg-surface px-6 py-6 lg:px-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="flex min-w-0 items-start gap-4">
            <span className="grid size-14 shrink-0 place-items-center rounded-2xl border border-accent/25 bg-accent/10 text-accent shadow-xs">
              <IconeTheme className="size-7" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-accent/15 px-2.5 py-0.5 text-xs font-semibold text-accent">
                  Thème transversal
                </span>
                <span className="rounded-md bg-surface-2 px-2.5 py-0.5 text-xs font-medium text-texte-discret">
                  {vue.competences.length} compétence{vue.competences.length > 1 ? "s" : ""}
                </span>
                <span className="rounded-md bg-surface-2 px-2.5 py-0.5 text-xs font-medium text-texte-discret">
                  {vue.domaines.length} domaine{vue.domaines.length > 1 ? "s" : ""}
                </span>
                {vue.origine === "tuteur" && (
                  <span className="rounded-md bg-info-faible px-2 py-0.5 text-[0.6875rem] font-medium text-info">
                    Proposé par le tuteur
                  </span>
                )}
              </div>
              <h2 className="mt-2 font-serif text-[2.2rem] font-medium leading-tight tracking-tight text-texte">
                {titre || vue.libelle}
              </h2>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {donneesSeance ? (
              <ConcepteurSeance
                {...donneesSeance}
                preset={{
                  libelle: vue.libelle,
                  codesVises: vue.competences.map((c) => c.code),
                  dureeCibleMin: 45,
                  nombreExercices: Math.max(3, Math.min(vue.competences.length, 6)),
                  domaine: vue.domaines.length === 1 ? vue.domaines[0]?.id : undefined,
                }}
                libelle="Lancer une séance"
                variante="principal"
                icone={<IconeFleche className="size-3.5" />}
                className="inline-flex items-center gap-2 rounded-xl bg-primaire px-4 py-2.5 text-xs font-semibold text-texte-inverse shadow-xs hover:bg-primaire-survol transition-colors cursor-pointer"
              />
            ) : (
              <Link
                href="/seances"
                className="inline-flex items-center gap-2 rounded-xl bg-primaire px-4 py-2.5 text-xs font-semibold text-texte-inverse shadow-xs hover:bg-primaire-survol transition-colors"
              >
                <span>Lancer une séance</span>
                <IconeFleche className="size-3.5" />
              </Link>
            )}
            {generation && compteId && (
              <BoutonGenerer
                competences={generation.competences}
                competenceInitiale={vue.prochaineActionRecommandee?.code ?? vue.competences[0]?.code}
                calibrages={generation.calibrages}
                compteId={compteId}
                libelle="Générer un exercice"
              />
            )}

            <button
              type="button"
              onClick={() => setConfirmationSuppressionTheme(true)}
              className="grid size-9 place-items-center rounded-xl border border-bordure bg-surface text-texte-discret transition-colors hover:border-danger/30 hover:bg-danger-faible hover:text-danger cursor-pointer"
              title="Supprimer ce thème transversal"
              aria-label="Supprimer ce thème"
            >
              <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18" />
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                <line x1="10" y1="11" x2="10" y2="17" />
                <line x1="14" y1="11" x2="14" y2="17" />
              </svg>
            </button>
          </div>
        </div>

        {confirmationSuppressionTheme && (
          <ModaleConfirmationSuppression
            titre="Supprimer le thème transversal"
            nomElement={vue.libelle}
            typeElement="theme"
            mode="suppression"
            explication="Ce thème transversal sera retiré. Les compétences et exercices qui le composent restent intégralement préservés dans leurs domaines respectifs."
            texteBoutonConfirmer="Supprimer le thème"
            onConfirmer={async () => {
              await retirerTheme(vue.id);
              setConfirmationSuppressionTheme(false);
              router.refresh();
              ouvrirElement("themes");
            }}
            onFermer={() => setConfirmationSuppressionTheme(false)}
          />
        )}

        {vue.intention && (
          <div className="mt-5 max-w-4xl rounded-xl border border-accent/20 bg-accent/10 p-4 shadow-xs">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-accent">
              Intention pédagogique
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-texte font-serif italic">
              « {vue.intention.trim().length < 20 && !vue.intention.includes(" ")
                ? `Approfondissement transversal ciblé sur : ${vue.intention}`
                : vue.intention} »
            </p>
          </div>
        )}
      </header>

      {/* Cartes d'indicateurs synthétiques */}
      <div className="px-6 pt-6 lg:px-8">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Indicateur
            libelle="Compétences"
            valeur={String(vue.competences.length)}
            precision={`${vue.domaines.length} domaine${vue.domaines.length > 1 ? "s" : ""} traversé${vue.domaines.length > 1 ? "s" : ""}`}
          />
          <Indicateur
            libelle="Couverture évaluée"
            valeur={`${Math.round(vue.tauxCouverture * 100)} %`}
            precision={`${vue.nombreEvaluees} sur ${vue.competences.length} compétence${vue.competences.length > 1 ? "s" : ""} évaluée${vue.competences.length > 1 ? "s" : ""}`}
          />
          <Indicateur
            libelle="Observations directes"
            valeur={String(vue.nombreObservations)}
            precision="Observations réelles accumulées"
          />
          <Indicateur
            libelle="Exercices associés"
            valeur={String(vue.nombreExercices)}
            precision={`Dernière activité : ${dateCourte(vue.derniereActivite)}`}
          />
        </div>

        {/* Onglets */}
        <div className="mt-6 flex gap-1 overflow-x-auto border-b border-bordure" role="tablist" aria-label="Sections du thème">
          {onglets.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={onglet === item.id}
              onClick={() => setOnglet(item.id)}
              className={cx(
                "shrink-0 border-b-2 px-4 py-3 text-sm font-medium transition-colors cursor-pointer",
                onglet === item.id ? "border-primaire text-primaire" : "border-transparent text-texte-discret hover:text-texte",
              )}
            >
              {item.libelle}
            </button>
          ))}
        </div>
      </div>

      {/* Corps des onglets */}
      <div className="space-y-6 px-6 py-6 lg:px-8">
        {onglet === "competences" && (
          <div className="space-y-6">
            <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
              <div className="rounded-xl border border-bordure bg-surface p-5 shadow-[var(--ombre-posee)]">
                <h3 className="font-serif text-xl font-medium text-texte">Radar du Thème</h3>
                <p className="mt-1 text-xs text-texte-discret">
                  Vue globale du niveau atteint sur chaque compétence du thème.
                </p>
                <div className="mt-6 flex justify-center">
                  <Radar axes={axes} taille={340} libelle={`Radar thématique de ${vue.libelle}`} />
                </div>
              </div>

              <div className="rounded-xl border border-bordure bg-surface p-5 shadow-[var(--ombre-posee)]">
                <h3 className="font-serif text-lg font-medium text-texte">Synthèse des Acquis</h3>
                <dl className="mt-4 space-y-3 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-texte-discret">Compétences totales</dt>
                    <dd className="font-semibold">{vue.competences.length}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-texte-discret">Évaluées avec observation</dt>
                    <dd className="font-semibold">{vue.nombreEvaluees} ({Math.round(vue.tauxCouverture * 100)}%)</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-texte-discret">Observations directes</dt>
                    <dd className="font-semibold">{vue.nombreObservations}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-texte-discret">Exercices prêts</dt>
                    <dd className="font-semibold">{vue.nombreExercices}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-texte-discret">Dernière activité</dt>
                    <dd className="text-right font-semibold">{dateCourte(vue.derniereActivite)}</dd>
                  </div>
                </dl>

                {vue.prochaineActionRecommandee && (
                  <div className="mt-6 rounded-lg bg-alerte-faible p-3.5 text-xs">
                    <p className="font-semibold text-alerte">Prochaine étape conseillée</p>
                    <p className="mt-1 font-medium text-texte">{vue.prochaineActionRecommandee.titre}</p>
                    <p className="mt-0.5 text-texte-discret">{vue.prochaineActionRecommandee.motif}</p>
                    {vue.prochaineActionRecommandee.reserves.map((reserve) => (
                      <p key={reserve} className="mt-1 text-texte-discret">{reserve}</p>
                    ))}
                    <button
                      type="button"
                      onClick={() => ouvrirElement(vue.prochaineActionRecommandee!.code)}
                      className="mt-2.5 inline-flex items-center gap-1 font-semibold text-primaire hover:underline cursor-pointer"
                    >
                      <span>Voir la compétence</span>
                      <span>→</span>
                    </button>
                  </div>
                )}
              </div>
            </section>

            {/* Filtre par domaine si multi-domaines */}
            {vue.domaines.length > 1 && (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-texte-discret font-medium">Filtrer par domaine :</span>
                <button
                  type="button"
                  onClick={() => setFiltreDomaine("tous")}
                  className={cx(
                    "rounded-lg px-3 py-1.5 font-medium transition-colors cursor-pointer",
                    filtreDomaine === "tous"
                      ? "bg-primaire text-texte-inverse font-semibold"
                      : "bg-surface border border-bordure text-texte hover:bg-surface-2",
                  )}
                >
                  Tous ({vue.competences.length})
                </button>
                {vue.domaines.map((dom) => (
                  <button
                    key={dom.id}
                    type="button"
                    onClick={() => setFiltreDomaine(dom.id)}
                    className={cx(
                      "rounded-lg px-3 py-1.5 font-medium transition-colors cursor-pointer",
                      filtreDomaine === dom.id
                        ? "bg-primaire text-texte-inverse font-semibold"
                        : "bg-surface border border-bordure text-texte hover:bg-surface-2",
                    )}
                  >
                    {dom.nom} ({dom.nombreCompetences})
                  </button>
                ))}
              </div>
            )}

            {/* Grille des cartes de compétences */}
            <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
              {competencesFiltrees.map((comp) => (
                <button
                  key={comp.code}
                  type="button"
                  onClick={() => ouvrirElement(comp.code)}
                  className="group flex flex-col justify-between rounded-xl border border-bordure bg-surface p-4 text-left shadow-[var(--ombre-posee)] transition-all duration-200 hover:-translate-y-1 hover:border-primaire/40 hover:shadow-[var(--ombre-levee)] cursor-pointer"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-semibold text-primaire">
                        {comp.code}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[0.625rem] text-texte-discret">
                          {LIBELLES_PALIERS[comp.palier] ?? comp.palier}
                        </span>
                        <span
                          className={cx(
                            "rounded px-1.5 py-0.5 text-[0.625rem] font-semibold",
                            comp.niveau === null
                              ? "bg-surface-3 text-texte-discret"
                              : comp.niveau >= 3
                              ? "bg-succes-faible text-succes"
                              : "bg-info-faible text-info",
                          )}
                        >
                          {comp.niveau === null ? "Non mesurée" : `Niveau ${comp.niveau} / 5`}
                        </span>
                      </div>
                    </div>

                    <h4 className="mt-2.5 text-sm font-semibold leading-snug text-texte transition-colors group-hover:text-primaire">
                      {comp.titre}
                    </h4>

                    <p className="mt-1.5 text-xs text-texte-discret truncate">
                      {comp.domaineNom}
                    </p>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-bordure/60 pt-2.5 text-[0.6875rem] text-texte-discret">
                    <span>
                      {comp.nombreObservations} observation{comp.nombreObservations > 1 ? "s" : ""} · {LIBELLES_CONFIANCE[comp.confiance]?.toLowerCase() ?? "aucune"}
                    </span>
                    <span className="font-medium text-primaire opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                      Consulter →
                    </span>
                  </div>
                </button>
              ))}
            </div>

            {/* Section Exercices associés au thème */}
            {vue.exercices.length > 0 && (
              <section className="mt-8 rounded-xl border border-bordure bg-surface p-5 shadow-[var(--ombre-posee)]">
                <div className="flex items-center justify-between border-b border-bordure pb-3">
                  <div>
                    <h3 className="font-serif text-lg font-medium text-texte">
                      Exercices associés à ce thème
                    </h3>
                    <p className="mt-0.5 text-xs text-texte-discret">
                      Exercices qui mobilisent les compétences de « {vue.libelle} »
                    </p>
                  </div>
                  <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-semibold text-texte-discret">
                    {vue.exercices.length} disponible{vue.exercices.length > 1 ? "s" : ""}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {vue.exercices.map((ex) => (
                    <div
                      key={ex.id}
                      className="flex flex-col justify-between rounded-lg border border-bordure/80 bg-surface-2/40 p-4 transition-colors hover:border-primaire/40"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 text-[0.6875rem] text-texte-discret">
                          <span className="capitalize">{ex.type}</span>
                          <span>Diff. {ex.difficulte}/5 · {ex.dureeMin} min</span>
                        </div>
                        <h4 className="mt-2 text-sm font-semibold text-texte leading-snug">
                          {ex.titre}
                        </h4>
                      </div>

                      <div className="mt-4 flex items-center justify-between gap-2 pt-2 border-t border-bordure/40">
                        <span className="text-[0.625rem] text-texte-discret">
                          {ex.tentatives} tentative{ex.tentatives > 1 ? "s" : ""}
                        </span>
                        <Link
                          href={urlComposerAutonome(vue.prochaineActionRecommandee?.code ?? vue.competences[0]?.code, ex.dureeMin)}
                          className="inline-flex items-center gap-1 rounded-md bg-primaire-faible px-2.5 py-1 text-xs font-semibold text-primaire hover:bg-primaire hover:text-white transition-colors"
                        >
                          <span>S’exercer</span>
                          <span aria-hidden>→</span>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {onglet === "exercices" && (
          <section className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {vue.exercices.map((ex) => (
                <div
                  key={ex.id}
                  className="flex flex-col justify-between rounded-xl border border-bordure bg-surface p-5 shadow-[var(--ombre-posee)] transition-all hover:border-primaire/40"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="rounded bg-surface-2 px-2 py-0.5 font-medium text-texte-discret capitalize">
                        {ex.type}
                      </span>
                      <span className="text-texte-discret">
                        Diff. {ex.difficulte}/5 · {ex.dureeMin} min
                      </span>
                    </div>
                    <h4 className="mt-3 font-serif text-base font-semibold text-texte leading-snug">
                      {ex.titre}
                    </h4>
                  </div>

                  <div className="mt-6 flex items-center justify-between border-t border-bordure pt-3">
                    <span className="text-xs text-texte-discret">
                      {ex.tentatives} tentative{ex.tentatives > 1 ? "s" : ""}
                    </span>
                    <Link
                      href={urlComposerAutonome(vue.prochaineActionRecommandee?.code ?? vue.competences[0]?.code, ex.dureeMin)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-primaire px-3.5 py-1.5 text-xs font-semibold text-texte-inverse shadow-sm hover:bg-primaire-survol transition-colors"
                    >
                      <span>S’exercer</span>
                      <span aria-hidden>→</span>
                    </Link>
                  </div>
                </div>
              ))}

              {generation && compteId && (
                <div className="flex min-h-[160px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-bordure bg-surface/30 p-6 text-center shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-primaire hover:bg-surface hover:shadow-xs">
                  <span className="grid size-9 place-items-center rounded-full bg-surface-2 text-base font-semibold text-texte-discret mb-2.5">
                    +
                  </span>
                  <BoutonGenerer
                    competences={generation.competences}
                    competenceInitiale={vue.prochaineActionRecommandee?.code ?? vue.competences[0]?.code}
                    themeInitial={vue.libelle}
                    calibrages={generation.calibrages}
                    compteId={compteId}
                    libelle="Générer un exercice"
                    variante="secondaire"
                    className="font-semibold text-primaire hover:underline text-sm"
                  />
                  <p className="mt-1 text-xs text-texte-discret">
                    Entraînement ciblé sur ce thème
                  </p>
                </div>
              )}
            </div>

            {vue.exercices.length === 0 && (!generation || !compteId) && (
              <div className="rounded-xl border border-dashed border-bordure bg-surface p-8 text-center">
                <IconeExercices className="mx-auto size-8 text-texte-discret" />
                <p className="mt-3 text-sm font-semibold text-texte">Aucun exercice disponible pour l’instant</p>
                <p className="mt-1 text-xs text-texte-discret">Génère un premier exercice avec le tuteur pour démarrer l’entraînement sur ce thème.</p>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
