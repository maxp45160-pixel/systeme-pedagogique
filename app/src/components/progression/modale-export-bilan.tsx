"use client";

import { useState } from "react";
import { cx, classesLienBouton } from "@/components/ui/primitives";
import {
  IconeDocuments,
  IconeFermer,
  IconeValide,
  IconeMarque,
  IconeImprimer,
  IconeCalendrier,
} from "@/components/ui/icones";
import type { DonneesExportBilan } from "@/lib/domain/export-bilan";
import { estOuvert, joursRestants, libelleCompte } from "@/lib/domain/engagement";

interface Props {
  donnees: DonneesExportBilan;
  bilanMarkdown: string;
  nomApprenant?: string;
  dateExport: string;
}

export function ModaleExportBilan({
  donnees,
  bilanMarkdown,
  nomApprenant,
  dateExport,
}: Props) {
  const [estOuvertModale, setEstOuvertModale] = useState(false);
  const [ongletActif, setOngletActif] = useState<"document" | "markdown">("document");
  const [aCopie, setACopie] = useState(false);

  const copierPressePapier = async () => {
    try {
      await navigator.clipboard.writeText(bilanMarkdown);
      setACopie(true);
      setTimeout(() => setACopie(false), 2500);
    } catch {
      // Fallback
    }
  };

  const imprimer = () => {
    window.print();
  };

  // Séparation des compétences
  const solides = donnees.etats.filter((e) => e.niveau !== null && e.niveau >= 2);
  const enCours = donnees.etats.filter((e) => e.niveau !== null && e.niveau === 1);
  const aAborder = donnees.etats.filter((e) => e.niveau === null || e.niveau === 0);
  const engagementsActifs = (donnees.engagements ?? []).filter(estOuvert);

  return (
    <>
      <button
        type="button"
        onClick={() => setEstOuvertModale(true)}
        className={cx(
          classesLienBouton("secondaire"),
          "inline-flex items-center gap-2 !py-1.5 !px-3 text-xs font-medium",
        )}
      >
        <IconeDocuments className="size-3.5" />
        <span>Exporter le bilan</span>
      </button>

      {estOuvertModale && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="titre-modale-export"
          className="fixed inset-0 z-50 flex items-center justify-center bg-fond/80 p-3 sm:p-6 backdrop-blur-xs"
        >
          {/* Style d'impression dédié A4 Portrait */}
          <style dangerouslySetInnerHTML={{ __html: `
            @page {
              size: A4 portrait;
              margin: 12mm 15mm;
            }
            @media print {
              body * {
                visibility: hidden !important;
              }
              #bilan-document-imprimable,
              #bilan-document-imprimable * {
                visibility: visible !important;
              }
              #bilan-document-imprimable {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                max-width: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
                border: none !important;
                box-shadow: none !important;
                background: white !important;
                color: black !important;
              }
              .no-print {
                display: none !important;
              }
            }
          ` }} />

          <div className="flex max-h-[92vh] w-full max-w-3xl flex-col rounded-carte border border-bordure bg-surface shadow-2xl">
            {/* En-tête de la modale */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-bordure px-5 py-3.5 sm:px-6">
              <div className="flex items-center gap-2.5">
                <div className="flex size-7 items-center justify-center rounded-lg bg-primaire-faible text-primaire">
                  <IconeMarque className="size-4" />
                </div>
                <div>
                  <h3 id="titre-modale-export" className="font-serif text-base font-medium text-texte">
                    Bilan de compétences officiel
                  </h3>
                  <p className="text-xs text-texte-attenue">
                    Généré le {dateExport} {nomApprenant ? `pour ${nomApprenant}` : ""}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Onglets Aperçu / Markdown */}
                <div className="flex rounded-lg border border-bordure bg-surface-2 p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setOngletActif("document")}
                    className={cx(
                      "rounded-md px-2.5 py-1 font-medium transition-colors",
                      ongletActif === "document"
                        ? "bg-surface text-texte shadow-xs"
                        : "text-texte-attenue hover:text-texte",
                    )}
                  >
                    Relevé stylisé
                  </button>
                  <button
                    type="button"
                    onClick={() => setOngletActif("markdown")}
                    className={cx(
                      "rounded-md px-2.5 py-1 font-medium transition-colors",
                      ongletActif === "markdown"
                        ? "bg-surface text-texte shadow-xs"
                        : "text-texte-attenue hover:text-texte",
                    )}
                  >
                    Markdown brut
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setEstOuvertModale(false)}
                  className="rounded p-1 text-texte-discret hover:bg-surface-2 hover:text-texte"
                  aria-label="Fermer"
                >
                  <IconeFermer className="size-4" />
                </button>
              </div>
            </div>

            {/* Corps défilable */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-fond/50">
              {ongletActif === "document" ? (
                /* Document stylisé (servant aussi à l'impression directe) */
                <div
                  id="bilan-document-imprimable"
                  className="mx-auto max-w-2xl rounded-xl border border-bordure bg-surface p-6 sm:p-8 text-texte shadow-xs"
                >
                  {/* Cartouche d'en-tête officiel */}
                  <div className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-bordure pb-5">
                    <div>
                      <div className="flex items-center gap-2 text-primaire">
                        <IconeMarque className="size-5" />
                        <span className="font-mono text-xs font-semibold tracking-wider uppercase">
                          Système pédagogique
                        </span>
                      </div>
                      <h1 className="mt-1 font-serif text-xl sm:text-2xl font-bold tracking-tight text-texte">
                        Relevé officiel de compétences
                      </h1>
                      <p className="mt-1 text-xs text-texte-attenue">
                        Relevé individuel certifié par observations directes
                      </p>
                    </div>

                    <div className="text-right text-xs">
                      {nomApprenant && (
                        <div className="font-medium text-texte">
                          Apprenant : <strong className="font-semibold">{nomApprenant}</strong>
                        </div>
                      )}
                      <div className="text-texte-discret">Édité le {dateExport}</div>
                    </div>
                  </div>

                  {/* 1. Synthèse globale en 4 blocs métriques */}
                  <div className="mt-6">
                    <h2 className="font-mono text-xs font-semibold uppercase tracking-wider text-texte-discret">
                      1. Synthèse globale mesurée
                    </h2>
                    <div className="mt-2.5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                      <div className="rounded-lg border border-bordure bg-fond p-3">
                        <div className="text-[0.6875rem] font-medium text-texte-attenue">Score global</div>
                        <div className="mt-1 font-serif text-lg font-bold text-texte">
                          {donnees.scoreGlobal !== null ? `${donnees.scoreGlobal} / 100` : "Non mesuré"}
                        </div>
                      </div>

                      <div className="rounded-lg border border-bordure bg-fond p-3">
                        <div className="text-[0.6875rem] font-medium text-texte-attenue">Compétences actives</div>
                        <div className="mt-1 font-serif text-lg font-bold text-texte">
                          {donnees.nombreCompetences}
                        </div>
                      </div>

                      <div className="rounded-lg border border-bordure bg-fond p-3">
                        <div className="text-[0.6875rem] font-medium text-texte-attenue">Exercices réussis</div>
                        <div className="mt-1 font-serif text-lg font-bold text-texte">
                          {donnees.nombreExercices}
                        </div>
                      </div>

                      <div className="rounded-lg border border-bordure bg-fond p-3">
                        <div className="text-[0.6875rem] font-medium text-texte-attenue">Jours actifs (30j)</div>
                        <div className="mt-1 font-serif text-lg font-bold text-texte">
                          {donnees.joursActifs} j.
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 2. Compétences consolidées */}
                  <div className="mt-6">
                    <div className="flex items-baseline justify-between">
                      <h2 className="font-mono text-xs font-semibold uppercase tracking-wider text-texte-discret">
                        2. Compétences consolidées (Niveau 2+)
                      </h2>
                      <span className="font-mono text-xs text-texte-attenue">{solides.length} consolidée(s)</span>
                    </div>

                    {solides.length === 0 ? (
                      <p className="mt-2 text-xs italic text-texte-attenue">
                        Aucune compétence consolidée au niveau 2+ pour le moment.
                      </p>
                    ) : (
                      <div className="mt-2.5 divide-y divide-bordure-faible rounded-lg border border-bordure bg-fond/50">
                        {solides.map((etat) => (
                          <div key={etat.skill.code} className="flex flex-wrap items-center justify-between gap-2 p-2.5 text-xs">
                            <div className="min-w-0">
                              <div className="font-medium text-texte">
                                {etat.skill.intitule}
                              </div>
                              <div className="font-mono text-[0.6875rem] text-texte-discret">
                                {etat.skill.code}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="rounded bg-primaire-faible px-2 py-0.5 font-mono text-[0.6875rem] font-medium text-primaire">
                                Niveau {etat.niveau}/4
                              </span>
                              <span className="text-[0.6875rem] text-texte-attenue">
                                {etat.observations.length} observation(s)
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 3. Compétences en cours d'acquisition */}
                  <div className="mt-6">
                    <div className="flex items-baseline justify-between">
                      <h2 className="font-mono text-xs font-semibold uppercase tracking-wider text-texte-discret">
                        3. Compétences en cours d&apos;acquisition (Niveau 1)
                      </h2>
                      <span className="font-mono text-xs text-texte-attenue">{enCours.length} en cours</span>
                    </div>

                    {enCours.length === 0 ? (
                      <p className="mt-2 text-xs italic text-texte-attenue">
                        Aucune compétence actuellement au niveau 1.
                      </p>
                    ) : (
                      <div className="mt-2.5 divide-y divide-bordure-faible rounded-lg border border-bordure bg-fond/50">
                        {enCours.map((etat) => (
                          <div key={etat.skill.code} className="flex flex-wrap items-center justify-between gap-2 p-2.5 text-xs">
                            <div className="min-w-0">
                              <div className="font-medium text-texte">
                                {etat.skill.intitule}
                              </div>
                              <div className="font-mono text-[0.6875rem] text-texte-discret">
                                {etat.skill.code}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="rounded bg-surface-2 px-2 py-0.5 font-mono text-[0.6875rem] font-medium text-texte-attenue">
                                Niveau 1/4
                              </span>
                              <span className="text-[0.6875rem] text-texte-attenue">
                                {etat.observations.length} observation(s)
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 4. Compétences à aborder ou démontrer */}
                  {aAborder.length > 0 && (
                    <div className="mt-6">
                      <div className="flex items-baseline justify-between">
                        <h2 className="font-mono text-xs font-semibold uppercase tracking-wider text-texte-discret">
                          4. Compétences à aborder ou démontrer ({aAborder.length})
                        </h2>
                      </div>
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {aAborder.slice(0, 12).map((etat) => (
                          <span
                            key={etat.skill.code}
                            className="inline-flex items-center rounded-md border border-bordure bg-fond px-2 py-1 text-[0.6875rem] text-texte-attenue"
                          >
                            {etat.skill.intitule}
                          </span>
                        ))}
                        {aAborder.length > 12 && (
                          <span className="inline-flex items-center px-2 py-1 text-[0.6875rem] italic text-texte-discret">
                            + {aAborder.length - 12} autre(s) compétence(s)
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 5. Échéances préparées */}
                  {engagementsActifs.length > 0 && (
                    <div className="mt-6">
                      <h2 className="font-mono text-xs font-semibold uppercase tracking-wider text-texte-discret">
                        5. Échéances & Objectifs déclarés
                      </h2>
                      <div className="mt-2.5 space-y-2">
                        {engagementsActifs.map((eng) => (
                          <div key={eng.id} className="flex items-center justify-between rounded-lg border border-bordure bg-fond p-2.5 text-xs">
                            <div className="flex items-center gap-2">
                              <IconeCalendrier className="size-3.5 text-primaire" />
                              <span className="font-medium text-texte">{eng.libelle}</span>
                            </div>
                            <span className="font-mono text-[0.6875rem] text-texte-attenue">
                              {eng.echeanceLe} ({libelleCompte(joursRestants(eng.echeanceLe, donnees.dateExport))})
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Note de bas de page méthodologique */}
                  <div className="mt-8 border-t border-bordure pt-4 text-[0.6875rem] leading-relaxed text-texte-discret">
                    <strong>Garantie méthodologique :</strong> Ce bilan est issu du Système pédagogique. Les niveaux et évaluations indiqués sont dérivés uniquement d&apos;observations directes et vérifiées lors de séances de travail, sans aucune extrapolation statistique ni fabrication de note.
                  </div>
                </div>
              ) : (
                /* Vue Markdown brut */
                <div className="rounded-lg border border-bordure bg-fond p-4 font-mono text-xs leading-relaxed text-texte selection:bg-primaire selection:text-primaire-contraste">
                  <pre className="whitespace-pre-wrap font-mono">{bilanMarkdown}</pre>
                </div>
              )}
            </div>

            {/* Pied de page & actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-bordure bg-surface-2 px-5 py-3.5 sm:px-6">
              <p className="text-xs text-texte-discret">
                Prêt pour dossier de suivi, professeur, tuteur ou export Obsidian / Notion.
              </p>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={copierPressePapier}
                  className={cx(
                    classesLienBouton("secondaire"),
                    "inline-flex items-center gap-2 text-xs",
                  )}
                >
                  {aCopie ? (
                    <>
                      <IconeValide className="size-3.5 text-succes" />
                      <span>Copié en Markdown !</span>
                    </>
                  ) : (
                    <>
                      <IconeDocuments className="size-3.5" />
                      <span>Copier en Markdown</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={imprimer}
                  className={cx(
                    classesLienBouton("principal"),
                    "inline-flex items-center gap-2 text-xs",
                  )}
                >
                  <IconeImprimer className="size-3.5" />
                  <span>Imprimer / PDF (Portrait A4)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
