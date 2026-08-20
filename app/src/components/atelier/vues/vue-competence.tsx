"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AUTONOMIE, NIVEAUX } from "@/lib/domain/types";
import { formatDateCourte } from "@/lib/engine/dates";
import type {
  VueCompetenceAtelier,
  DocumentLieAtelier,
} from "@/lib/documents/vue-atelier";
import { CodeCompetence, cx } from "@/components/ui/primitives";
import type { EtapeParcours } from "@/lib/engine/parcours";
import { AppartenanceEnsembles } from "../appartenance-ensembles";
import { RelationsCompetence } from "../relations-competence";
import { IconeFleche } from "@/components/ui/icones";
import { BoutonGenerer } from "@/components/exercices/bouton-generer";
import type { CalibrageModale, CompetenceModale } from "@/components/exercices/proprietes-generation";
import { ConcepteurSeance, type DonneesSeance } from "@/components/seances/concepteur-seance";
import type { ElementAtelier } from "../types-atelier";
import { creerDocumentBrutAction, supprimerDocumentAction } from "@/lib/store/document-actions";
import {
  BoutonSuppressionCarte,
  ModaleConfirmationSuppression,
} from "../modale-confirmation-suppression";
import {
  Barre,
  Mesure,
  ObservationLiee,
  dateCourte,
  pourcentage,
  libelleResultatObservation,
  LIBELLES_PALIERS,
  LIBELLES_CONFIANCE,
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
        const titreDoc = `Note sur ${vue.code} : ${titre}`;
        const contenuInitial = [
          "---",
          `titre: "${titreDoc}"`,
          "type: note",
          "role: support",
          `contexte: "Compétence ${vue.code}"`,
          `domaine: "${vue.domaineNom || "transversal"}"`,
          "---",
          `# ${titreDoc}`,
          "",
          `Fiche de travail et observations associées à la compétence [[${vue.code}]].`,
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
    { id: "observations", libelle: "Observations", compteur: vue.observations.length },
    { id: "exercices", libelle: "Exercices", compteur: vue.exercices.length },
    { id: "ressources", libelle: "Ressources", compteur: vue.documents.length },
    { id: "relations", libelle: "Relations", compteur: vue.prerequis.length + vue.suivantes.length },
  ];

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-y-auto bg-surface-2/40 lg:overflow-hidden">
      {/* En-tête de la compétence */}
      <header className="shrink-0 border-b border-bordure bg-surface px-6 py-4 lg:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <CodeCompetence code={vue.code} />
              <span className="text-texte-discret">{vue.domaineNom}</span>
              <span aria-hidden className="text-bordure-contraste">·</span>
              <span className="text-texte-discret">{LIBELLES_PALIERS[vue.palier] ?? vue.palier}</span>
              <span aria-hidden className="text-bordure-contraste">·</span>
              <span className="text-texte-discret">
                État consolidé · confiance {LIBELLES_CONFIANCE[vue.confiance].toLowerCase()}
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
                  libelle: `Compétence : ${vue.code}`,
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

      {/* Mesures de la compétence */}
      <section
        aria-label="Mesures de la compétence"
        className="grid shrink-0 grid-cols-2 gap-y-3 border-b border-bordure bg-surface px-3 py-3 lg:px-5 xl:grid-cols-5 xl:divide-x xl:divide-bordure"
      >
        <Mesure
          libelle="Observation ponctuelle"
          valeur={vue.etatLot5.observationPonctuelle ? formatDateCourte(vue.etatLot5.observationPonctuelle.date) : "Non mesurée"}
          precision={vue.etatLot5.observationPonctuelle
            ? `${libelleResultatObservation(vue.etatLot5.observationPonctuelle.resultat)} · ${AUTONOMIE[vue.etatLot5.observationPonctuelle.autonomie].libelle}`
            : "Aucune observation directe"}
        />
        <Mesure
          libelle="État consolidé"
          valeur={vue.etatLot5.etatConsolide.niveau === null ? "Non mesuré" : `${vue.etatLot5.etatConsolide.niveau} / 5`}
          precision={vue.etatLot5.etatConsolide.niveau === null
            ? "Aucune mesure à consolider"
            : `${NIVEAUX[vue.etatLot5.etatConsolide.niveau].nom} · confiance ${LIBELLES_CONFIANCE[vue.etatLot5.etatConsolide.confiance].toLowerCase()}`}
        />
        <Mesure
          libelle="Maîtrise"
          valeur={vue.etatLot5.maitrise.maitrisee ? "Établie" : "Non établie"}
          precision={vue.etatLot5.maitrise.manque ?? "Les observations soutiennent cette maîtrise."}
        />
        <Mesure
          libelle="Observations"
          valeur={String(vue.nombreObservations)}
          precision={`${vue.nombreContextes} contexte${vue.nombreContextes > 1 ? "s" : ""} distinct${vue.nombreContextes > 1 ? "s" : ""}`}
        />
        <Mesure libelle="Robustesse" valeur={pourcentage(vue.robustesse)} precision="Solidité de l’acquis" />
        <Mesure
          libelle="Dernière activité"
          valeur={dateCourte(vue.derniereObservation)}
          precision={`${vue.exercices.length} exercice${vue.exercices.length > 1 ? "s" : ""} associé${vue.exercices.length > 1 ? "s" : ""}`}
        />
      </section>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        {/* Volet de lecture : ce que la mesure veut dire. */}
        <div className="min-h-0 space-y-5 overflow-y-auto px-6 py-5 lg:border-r lg:border-bordure lg:px-7">
          <ResteADemontrer vue={vue} prochainExercice={prochainExercice} ouvrirElement={ouvrirElement} />

          <div className="rounded-xl border border-bordure bg-surface p-5 shadow-[var(--ombre-posee)]">
            <h3 className="font-serif text-lg font-medium">Le détail de vos résultats</h3>
            <p className="mt-1 text-xs text-texte-discret">
              Calculée depuis les observations observées ; aucune valeur n’est stockée.
            </p>
            <div className="mt-5 space-y-3">
              {vue.dimensions.map((dimension) => (
                <Barre key={dimension.id} valeur={dimension.valeur} libelle={dimension.libelle} />
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-bordure bg-surface p-5 shadow-[var(--ombre-posee)]">
            <h3 className="font-serif text-lg font-medium">Évolution de la compétence</h3>
            <p className="mt-1 text-xs text-texte-discret">
              Ce que chaque observation a changé, rejoué depuis le journal.
            </p>
            <FriseParcours etapes={vue.parcours} />
          </div>
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
                  Chaque observation ouvre le document produit au moment de la mesure, quand il existe.
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
                  <p className="px-2.5 py-3 text-xs text-texte-discret">Aucune observation directe.</p>
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
                  Les supports de travail seulement : les exercices et les observations ont leur onglet.
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
                <AppartenanceEnsembles vue={vue} ouvrirElement={ouvrirElement} />
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

function FriseParcours({ etapes }: { etapes: EtapeParcours[] }) {
  if (etapes.length === 0) {
    return <p className="mt-4 text-xs text-texte-discret">Rien à afficher pour l’instant. Faites un exercice pour démarrer.</p>;
  }

  return (
    <ol className="mt-4 space-y-4 border-l border-bordure pl-4">
      {etapes.map((etape) => (
        <li key={etape.observationId} className="relative">
          <span
            className={cx(
              "absolute -left-[1.18rem] top-1 size-2 rounded-full border-2 border-surface",
              etape.progression ? "bg-succes" : etape.recul ? "bg-alerte" : etape.premiereMesure ? "bg-info" : "bg-primaire",
            )}
          />
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            {etape.premiereMesure ? (
              <span className="chiffres text-xs font-semibold text-info">
                Première mesure — niveau {etape.niveauApres}
              </span>
            ) : etape.progression || etape.recul ? (
              <span className="chiffres text-xs font-semibold">
                Niveau {etape.niveauAvant} <span aria-hidden className="text-texte-discret">→</span>{" "}
                <span className={etape.progression ? "text-succes" : "text-alerte"}>{etape.niveauApres}</span>
              </span>
            ) : (
              <span className="text-xs font-medium text-texte-attenue">
                {etape.resultat === "reussi" ? "Réussi, niveau confirmé" : etape.resultat === "partiel" ? "Partiellement réussi" : "Non abouti"}
              </span>
            )}
            {etape.nouveauContexte && !etape.premiereMesure && (
              <span className="rounded border border-bordure px-1.5 py-0.5 text-[0.5625rem] uppercase tracking-wide text-texte-discret">
                Contexte inédit
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs">{etape.contexte}</p>
          <p className="mt-0.5 text-[0.625rem] text-texte-discret">
            {dateCourte(etape.date)} · {etape.type} · autonomie {etape.autonomie}
          </p>
        </li>
      ))}
    </ol>
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
  if (rien && !prochainExercice) return null;

  return (
    <div className="rounded-xl border border-bordure bg-surface p-6 shadow-[var(--ombre-posee)]">
      <h3 className="font-serif text-lg font-medium">Ce qui reste à travailler</h3>

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
            <span className="block text-xs font-semibold text-primaire">Exercice associé</span>
            <span className="mt-0.5 block truncate text-xs text-texte-attenue">{prochainExercice.titre}</span>
          </span>
          <IconeFleche className="size-3.5 shrink-0 text-primaire" />
        </button>
      )}

      {vue.contradictions > 0 && (
        <p className="mt-3 text-xs leading-relaxed text-texte-attenue">
          <strong className="font-medium">
            {vue.contradictions} observation{vue.contradictions > 1 ? "s" : ""} s’oppose
            {vue.contradictions > 1 ? "nt" : ""} à la tendance
          </strong>{" "}
          — le niveau en tient compte, et la confiance aussi. Une contradiction est une
          information, pas une faute.
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
        Observé dans ton travail, pas déclaré : ces compétences ont été mises en jeu par les
        mêmes exercices.
      </p>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {observees.map((item) => (
          <li key={item.code}>
            <button
              type="button"
              onClick={() => ouvrirElement(item.code)}
              className="flex w-full items-center gap-2 rounded-lg border border-bordure bg-surface-2 px-3 py-2 text-left transition-colors hover:border-primaire/40 hover:bg-surface-3 cursor-pointer"
            >
              <CodeCompetence code={item.code} />
              <span className="min-w-0 flex-1 truncate text-xs">{item.intitule}</span>
              <span className="shrink-0 text-[0.625rem] text-texte-discret">
                {item.occurrences}×
              </span>
              {!item.dejaMesuree && (
                <span className="shrink-0 rounded border border-bordure px-1.5 py-0.5 text-[0.5625rem] uppercase tracking-wide text-texte-discret">
                  Jamais mesurée
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
