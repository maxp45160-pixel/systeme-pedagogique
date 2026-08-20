"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  VueCompetenceAtelier,
  DocumentLieAtelier,
} from "@/lib/documents/vue-atelier";
import type { ElementAtelier } from "../types-atelier";
import { CodeCompetence, cx } from "@/components/ui/primitives";
import type { EtapeParcours } from "@/lib/engine/parcours";
import { RelationsCompetence } from "../relations-competence";
import { IconeFleche } from "@/components/ui/icones";
import { BoutonGenerer } from "@/components/exercices/bouton-generer";
import type { CalibrageModale, CompetenceModale } from "@/components/exercices/proprietes-generation";
import { ConcepteurSeance, type DonneesSeance } from "@/components/seances/concepteur-seance";
import { creerDocumentBrutAction, supprimerDocumentAction } from "@/lib/store/document-actions";
import {
  BoutonSuppressionCarte,
  ModaleConfirmationSuppression,
} from "../modale-confirmation-suppression";
import {
  Mesure,
  ObservationLiee,
  dateCourte,
  LIBELLES_PALIERS,
  LIBELLES_REPERES,
} from "./elements-fiche";

/** Les onglets du volet droit : une nature d'élément par onglet. */
type VoletCompetence = "observations" | "exercices" | "ressources" | "relations";

export function VueCompetence({
  vue,
  titre,
  ouvrirElement,
  elements,
  compteId,
  generation,
  donneesSeance,
}: {
  vue: VueCompetenceAtelier;
  titre: string;
  ouvrirElement: (id: string) => void;
  elements?: ElementAtelier[];
  /** Le journal de rectification n'existe que sous la boucle adaptative. */
  compteId?: string;
  generation?: { competences: CompetenceModale[]; calibrages: Record<string, CalibrageModale> };
  donneesSeance?: DonneesSeance;
}) {
  const router = useRouter();
  const [volet, setVolet] = useState<VoletCompetence>("observations");
  const [documentASupprimer, setDocumentASupprimer] = useState<DocumentLieAtelier | null>(null);
  const [creationNoteEnCours, demarrerCreationNote] = useTransition();
  const prochainExercice = vue.exercices[0];

  async function creerNotePourCompetence() {
    demarrerCreationNote(async () => {
      try {
        const codeNettoye = vue.code.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-");
        const idRandom = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
        const id = `note-${codeNettoye}-${idRandom}`;
        const titreDoc = `Note sur ${titre}`;
        const contenuInitial = [
          "---",
          `titre: "${titreDoc}"`,
          "type: note",
          "role: support",
          `contexte: "${titre}"`,
          `domaine: "${vue.domaineNom || "transversal"}"`,
          "---",
          `# ${titreDoc}`,
          "",
          `Fiche de travail et traces associées à « ${titre} ».`,
          "",
          "## Notes",
          "",
          "- ",
        ].join("\n");

        await creerDocumentBrutAction(id, contenuInitial);
        router.refresh();
        ouvrirElement(id);
      } catch (err) {
        console.error("Erreur lors de la création de la note:", err);
      }
    });
  }

  const volets: Array<{ id: VoletCompetence; libelle: string; compteur: number }> = [
    { id: "observations", libelle: "Traces", compteur: vue.observations.length },
    { id: "exercices", libelle: "Exercices", compteur: vue.exercices.length },
    { id: "ressources", libelle: "Supports", compteur: vue.documents.length },
    { id: "relations", libelle: "Autour", compteur: vue.connexes.filter((item) => item.relation === "co-mobilisee").length },
  ];

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-y-auto bg-surface-2/40 lg:overflow-hidden">
      {/* En-tête de la compétence */}
      <header className="shrink-0 border-b border-bordure bg-surface px-6 py-4 lg:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-texte-discret">{vue.domaineNom}</span>
              <span aria-hidden className="text-bordure-contraste">·</span>
              <span className="text-texte-discret">{LIBELLES_PALIERS[vue.palier] ?? vue.palier}</span>
              <span aria-hidden className="text-bordure-contraste">·</span>
              <span className="text-texte-discret">
                {LIBELLES_REPERES[vue.confiance] ?? "À découvrir"}
              </span>
            </div>
            <h2 className="mt-2 max-w-3xl font-serif text-[1.375rem] font-medium leading-snug tracking-tight text-texte">
              {titre}
            </h2>
          </div>

          <div className="shrink-0">
            {donneesSeance ? (
              <ConcepteurSeance
                {...donneesSeance}
                preset={{
                  libelle: `Travailler : ${titre}`,
                  codesVises: [vue.code],
                  dureeCibleMin: 30,
                  nombreExercices: 3,
                  domaine: vue.domaineId,
                }}
                libelle="Lancer une séance ciblée"
                variante="principal"
                icone={<IconeFleche className="size-3.5" />}
                className="inline-flex items-center gap-2 rounded-xl bg-primaire px-4 py-2.5 text-xs font-semibold text-texte-inverse shadow-xs hover:bg-primaire-survol transition-colors cursor-pointer"
              />
            ) : generation && compteId ? (
              <BoutonGenerer
                competences={generation.competences}
                competenceInitiale={vue.code}
                calibrages={generation.calibrages}
                compteId={compteId}
                libelle="Générer un exercice"
                variante="principal"
                className="inline-flex items-center gap-2 rounded-xl bg-primaire px-4 py-2.5 text-xs font-semibold text-texte-inverse shadow-xs hover:bg-primaire-survol transition-colors cursor-pointer"
              />
            ) : (
              <Link
                href="/seances"
                className="inline-flex items-center gap-2 rounded-xl bg-primaire px-4 py-2.5 text-xs font-semibold text-texte-inverse shadow-xs hover:bg-primaire-survol transition-colors cursor-pointer"
              >
                <span>Lancer une séance</span>
                <span aria-hidden>→</span>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Repères simples pour se situer */}
      <section
        aria-label="Repères de la compétence"
        className="grid shrink-0 grid-cols-2 gap-y-3 border-b border-bordure bg-surface px-3 py-3 lg:grid-cols-4 lg:px-5 lg:divide-x lg:divide-bordure"
      >
        <Mesure
          libelle="Repère actuel"
          valeur={LIBELLES_REPERES[vue.confiance] ?? "À découvrir"}
          precision={vue.prochaineEtape ?? "Le parcours peut avancer"}
        />
        <Mesure
          libelle="Traces de travail"
          valeur={String(vue.nombreObservations)}
          precision={vue.nombreObservations === 0 ? "Pas encore de trace" : "Constats gardés en mémoire"}
        />
        <Mesure
          libelle="Situations vues"
          valeur={String(vue.nombreContextes)}
          precision={vue.nombreContextes > 0 ? "contextes différents" : "Aucun contexte encore"}
        />
        <Mesure
          libelle="Dernière activité"
          valeur={dateCourte(vue.derniereObservation)}
          precision={`${vue.exercices.length} exercice${vue.exercices.length > 1 ? "s" : ""} associé${vue.exercices.length > 1 ? "s" : ""}`}
        />
      </section>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        {/* Volet de lecture : la prochaine étape, sans tableau de scores. */}
        <div className="min-h-0 space-y-5 overflow-y-auto px-6 py-5 lg:border-r lg:border-bordure lg:px-7">
          <ResteADemontrer vue={vue} prochainExercice={prochainExercice} ouvrirElement={ouvrirElement} />
        </div>

        {/* Volet des éléments */}
        <div className="flex min-h-0 flex-col border-t border-bordure lg:border-t-0">
          <div
            role="tablist"
            aria-label="Éléments liés à la compétence"
            className="flex shrink-0 gap-1 overflow-x-auto border-b border-bordure bg-surface px-4"
          >
            {volets.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={volet === item.id}
                onClick={() => setVolet(item.id)}
                className={cx(
                  "flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-medium transition-colors cursor-pointer",
                  volet === item.id
                    ? "border-primaire text-primaire"
                    : "border-transparent text-texte-discret hover:text-texte",
                )}
              >
                <span>{item.libelle}</span>
                <span className="chiffres rounded-full bg-surface-2 px-1.5 py-0.5 text-[0.625rem] text-texte-discret">
                  {item.compteur}
                </span>
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {volet === "observations" && (
              <>
                <p className="mb-3 text-[0.6875rem] leading-relaxed text-texte-discret">
                  Chaque trace ouvre le document produit au moment du travail, quand il existe.
                </p>
                {vue.observations.length ? (
                  <ul className="space-y-1">
                    {vue.observations.map((observation) => (
                      <li key={observation.id}>
                        <ObservationLiee observation={observation} ouvrirElement={ouvrirElement} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-2.5 py-3 text-xs text-texte-discret">Aucune trace directe.</p>
                )}
              </>
            )}

            {volet === "exercices" && (
              <>
                {vue.exercices.length ? (
                  <ul className="space-y-1">
                    {vue.exercices.map((exercice) => (
                      <li key={exercice.id}>
                        <button
                          type="button"
                          onClick={() => ouvrirElement(`exercice:${exercice.id}`)}
                          className="block w-full rounded-lg border border-bordure bg-surface px-3 py-2.5 text-left transition-colors hover:border-primaire/40 hover:bg-surface-2 cursor-pointer"
                        >
                          <span className="block text-xs font-medium leading-snug text-texte">
                            {exercice.titre}
                          </span>
                          <span className="mt-1 block text-[0.6875rem] text-texte-discret">
                            Difficulté {exercice.difficulte} · {exercice.dureeMin} min ·{" "}
                            {exercice.tentatives} tentative{exercice.tentatives > 1 ? "s" : ""}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-2.5 py-3 text-xs text-texte-discret">Aucun exercice relié.</p>
                )}
                {generation && compteId && (
                  <div className="mt-3 border-t border-bordure/60 pt-3">
                    <BoutonGenerer
                      competences={generation.competences}
                      competenceInitiale={vue.code}
                      calibrages={generation.calibrages}
                      compteId={compteId}
                      libelle="+ Générer un exercice"
                      variante="secondaire"
                      pleineLargeur
                      className="text-xs font-medium text-primaire hover:underline"
                    />
                  </div>
                )}
              </>
            )}

            {volet === "ressources" && (
              <>
                <p className="mb-3 text-[0.6875rem] leading-relaxed text-texte-discret">
                  Les supports de travail seulement : les exercices et les traces ont leur onglet.
                </p>
                {vue.documents.length ? (
                  <ul className="space-y-1">
                    {vue.documents.map((document) => (
                      <li key={document.id} className="group relative">
                        <button
                          type="button"
                          onClick={() => ouvrirElement(document.id)}
                          className="block w-full rounded-lg border border-bordure bg-surface py-2.5 pl-3 pr-9 text-left transition-colors hover:border-primaire/40 hover:bg-surface-2 cursor-pointer"
                        >
                          <span className="block text-xs font-medium leading-snug text-texte">
                            {document.titre}
                          </span>
                          <span className="mt-1 block text-[0.6875rem] capitalize text-texte-discret">
                            {document.type}
                          </span>
                        </button>
                        <BoutonSuppressionCarte
                          titre="Supprimer cette note"
                          onClick={() => setDocumentASupprimer(document)}
                        />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-2.5 py-3 text-xs text-texte-discret">Aucun support lié.</p>
                )}
                <div className="mt-3 border-t border-bordure/60 pt-3">
                  <button
                    type="button"
                    disabled={creationNoteEnCours}
                    onClick={creerNotePourCompetence}
                    className="text-xs font-medium text-primaire hover:underline cursor-pointer disabled:opacity-50"
                  >
                    {creationNoteEnCours ? "Création en cours…" : "+ Créer une note liée"}
                  </button>
                </div>
              </>
            )}

            {volet === "relations" && (
              <div className="space-y-6">
                {compteId && (
                  <RelationsCompetence
                    vue={vue}
                    elements={elements}
                    compteId={compteId}
                    domaines={vue.domainesExistants}
                    ouvrirElement={ouvrirElement}
                  />
                )}
                <CoMobilisees vue={vue} ouvrirElement={ouvrirElement} />
              </div>
            )}
          </div>
        </div>
      </div>

      {documentASupprimer && (
        <ModaleConfirmationSuppression
          titre="Supprimer le document"
          nomElement={documentASupprimer.titre}
          typeElement="document"
          mode="suppression"
          explication="Ce document de travail ou ressource liée sera supprimé."
          texteBoutonConfirmer="Supprimer le document"
          onConfirmer={async () => {
            await supprimerDocumentAction(documentASupprimer.id);
            setDocumentASupprimer(null);
            router.refresh();
          }}
          onFermer={() => setDocumentASupprimer(null)}
        />
      )}
    </div>
  );
}

function ResteADemontrer({
  vue,
  prochainExercice,
  ouvrirElement,
}: {
  vue: VueCompetenceAtelier;
  prochainExercice?: VueCompetenceAtelier["exercices"][number];
  ouvrirElement?: (id: string) => void;
}) {
  const rien = !vue.prochaineEtape && vue.contradictions === 0 && vue.reserves.length === 0;
  if (rien && !prochainExercice) {
    return (
      <div className="rounded-xl border border-bordure bg-surface p-5 shadow-[var(--ombre-posee)]">
        <h3 className="font-serif text-lg font-medium">Rien à signaler pour l’instant</h3>
        <p className="mt-2 text-sm leading-relaxed text-texte-attenue">
          Les traces conservées ne font pas ressortir de suite particulière. Tu peux relire les traces
          de travail ou lancer une séance quand tu veux.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-bordure bg-surface p-6 shadow-[var(--ombre-posee)]">
      <h3 className="font-serif text-lg font-medium">Ce qui peut venir ensuite</h3>

      {vue.prochaineEtape && (
        <p className="mt-3 rounded-lg border border-alerte/30 bg-alerte-faible/40 px-3.5 py-3 text-sm leading-relaxed text-texte">
          {vue.prochaineEtape}
        </p>
      )}

      {prochainExercice && ouvrirElement && (
        <button
          type="button"
          onClick={() => ouvrirElement(`exercice:${prochainExercice.id}`)}
          className="mt-3 flex w-full items-center justify-between gap-3 rounded-lg border border-bordure bg-surface-2/50 px-3.5 py-2.5 text-left transition-colors hover:border-primaire/40 hover:bg-surface-2 cursor-pointer"
        >
          <span className="min-w-0">
            <span className="block text-xs font-semibold text-primaire">Pour avancer</span>
            <span className="mt-0.5 block truncate text-xs text-texte-attenue">{prochainExercice.titre}</span>
          </span>
          <IconeFleche className="size-3.5 shrink-0 text-primaire" />
        </button>
      )}

      {vue.contradictions > 0 && (
        <p className="mt-3 text-xs leading-relaxed text-texte-attenue">
          <strong className="font-medium">
            {vue.contradictions} trace{vue.contradictions > 1 ? "s" : ""} ne va
            {vue.contradictions > 1 ? "nt" : ""} pas toutes dans le même sens.
          </strong>{" "}
          C’est une information à regarder, pas une faute.
        </p>
      )}

      {vue.reserves.length > 0 && (
        <ul className="mt-3 space-y-1">
          {vue.reserves.map((reserve) => (
            <li key={reserve} className="flex gap-2 text-[0.6875rem] leading-relaxed text-texte-discret">
              <span aria-hidden className="mt-1.5 size-1 shrink-0 rounded-full bg-bordure-contraste" />
              <span>{reserve}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CoMobilisees({
  vue,
  ouvrirElement,
}: {
  vue: VueCompetenceAtelier;
  ouvrirElement: (id: string) => void;
}) {
  const observees = vue.connexes.filter((item) => item.relation === "co-mobilisee");
  if (observees.length === 0) return null;

  return (
    <section className="mt-4 rounded-xl border border-bordure bg-surface p-5 shadow-[var(--ombre-posee)]">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-texte-discret">
        Souvent travaillées avec
      </h3>
      <p className="mt-1 text-[0.6875rem] text-texte-discret">
        Vu dans ton travail, pas déduit d’un intitulé : ces repères apparaissent dans les mêmes
        exercices.
      </p>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {observees.map((item) => (
          <li key={item.code}>
            <button
              type="button"
              onClick={() => ouvrirElement(item.code)}
              className="flex w-full items-center gap-2 rounded-lg border border-bordure bg-surface-2 px-3 py-2 text-left transition-colors hover:border-primaire/40 hover:bg-surface-3 cursor-pointer"
            >
              <span className="min-w-0 flex-1 truncate text-xs">{item.intitule}</span>
              <span className="shrink-0 text-[0.625rem] text-texte-discret">
                {item.occurrences}×
              </span>
              {!item.dejaMesuree && (
                <span className="shrink-0 rounded border border-bordure px-1.5 py-0.5 text-[0.5625rem] uppercase tracking-wide text-texte-discret">
                  Pas encore rencontré
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
