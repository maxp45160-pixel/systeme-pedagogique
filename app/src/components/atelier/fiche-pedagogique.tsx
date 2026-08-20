"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AUTONOMIE, NIVEAUX } from "@/lib/domain/types";
import { formatDateCourte, formatDateHeure } from "@/lib/engine/dates";
import type {
  VueCompetenceAtelier,
  VueDomaineAtelier,
  VueThemeAtelier,
  VueExerciceProjectionAtelier,
  VuePedagogiqueAtelier,
  DocumentLieAtelier,
  ObservationAtelier,
} from "@/lib/documents/vue-atelier";
import { Bouton, CodeCompetence, cx } from "@/components/ui/primitives";
import type { EtapeParcours } from "@/lib/engine/parcours";
import { urlComposerAutonome } from "@/lib/domain/navigation-exercice";
import { AppartenanceEnsembles } from "./appartenance-ensembles";
import { RelationsCompetence } from "./relations-competence";
import {
  IconeDocuments,
  IconeExercices,
  IconeFleche,
  IconeTheme,
} from "@/components/ui/icones";
import { Radar } from "@/components/charts";
import { BoutonReviser } from "@/components/referentiel/bouton-reviser";
import { GestionDomaine } from "@/components/referentiel/gestion-domaine";
import { ModaleCompetence } from "@/components/referentiel/modale-competence";
import { BoutonGenerer } from "@/components/exercices/bouton-generer";
import type { CalibrageModale, CompetenceModale } from "@/components/exercices/proprietes-generation";
import { Markdown } from "@/components/ui/markdown";
import { ConcepteurSeance, type DonneesSeance } from "@/components/seances/concepteur-seance";
import type { ElementAtelier } from "./types-atelier";
import { creerDocumentBrutAction, supprimerDocumentAction } from "@/lib/store/document-actions";
import {
  BoutonSuppressionCarte,
  ModaleConfirmationSuppression,
} from "./modale-confirmation-suppression";
import { retirerCompetences, rattacherCompetences, restaurerDomaine } from "@/lib/store/referentiel-actions";
import { retirerTheme } from "@/lib/store/theme-actions";

/*
 * Le retour vit dans la barre supérieure de l'Atelier — `RetourAtelier`, dans
 * `espace-documentaire.tsx`. Les fiches en rendaient un second, collant, juste
 * en dessous : deux rangées de chrome pour une seule navigation, et sur un
 * domaine celui du haut ne pouvait rien faire. Il n'en reste qu'un.
 */

const LIBELLES_PALIERS: Record<string, string> = {
  fondamentaux: "Fondamentaux",
  intermediaire: "Intermédiaire",
  avance: "Avancé",
};

const LIBELLES_CONFIANCE: Record<string, string> = {
  nulle: "Aucune",
  faible: "Faible",
  moyenne: "Moyenne",
  forte: "Forte",
};

function dateCourte(date: string | null): string {
  if (!date) return "Aucune activité";
  return formatDateCourte(date);
}

function pourcentage(valeur: number | null): string {
  return valeur === null ? "—" : `${Math.round(valeur * 100)} %`;
}

function libelleResultatObservation(resultat: "reussi" | "partiel" | "echec"): string {
  return resultat === "reussi" ? "Réussie" : resultat === "partiel" ? "Partielle" : "À revoir";
}

function Barre({ valeur, libelle }: { valeur: number; libelle: string }) {
  const estEvalue = valeur > 0;
  return (
    <div className="grid grid-cols-[9rem_minmax(0,1fr)_3.25rem] items-center gap-4 text-sm">
      <span className="truncate text-texte-attenue">{libelle}</span>
      <span className="h-2 overflow-hidden rounded-full bg-surface-3">
        <span
          className={cx("block h-full rounded-full", estEvalue ? "bg-primaire" : "bg-transparent")}
          style={{ width: `${Math.round(valeur * 100)}%` }}
        />
      </span>
      <span className={cx("chiffres text-right font-medium", estEvalue ? "text-texte" : "text-texte-discret")}>
        {Math.round(valeur * 100)}%
      </span>
    </div>
  );
}

function Indicateur({ libelle, valeur, precision }: { libelle: string; valeur: string; precision: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-bordure bg-surface px-5 py-4 shadow-[var(--ombre-posee)]">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-texte-discret">{libelle}</p>
      <p className="chiffres mt-2 truncate text-2xl font-semibold tracking-tight text-texte">{valeur}</p>
      <p className="mt-1 text-xs leading-relaxed text-texte-discret">{precision}</p>
    </div>
  );
}

/**
 * Une mesure, posée sans boîte et sur deux lignes.
 *
 * Les quatre encarts bordés et ombrés pesaient autant que les sections qui
 * portent le raisonnement, pour quatre nombres — et trois lignes chacun, ce que
 * la hauteur d'un écran ne permet plus. Le nombre et sa précision partagent
 * désormais la même ligne.
 */
function Mesure({ libelle, valeur, precision }: { libelle: string; valeur: string; precision: string }) {
  return (
    <div className="min-w-0 px-4">
      <p className="text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-texte-discret">{libelle}</p>
      <p className="mt-1 flex min-w-0 items-baseline gap-1.5">
        <span className="chiffres shrink-0 text-base font-semibold tracking-tight text-texte">{valeur}</span>
        <span className="truncate text-[0.6875rem] text-texte-discret">{precision}</span>
      </p>
    </div>
  );
}

/** Les onglets du volet droit : une nature d'élément par onglet. */
type VoletCompetence = "observations" | "exercices" | "ressources" | "relations";

/**
 * Une observation, cliquable quand elle a un document.
 *
 * `documentId` n'est renseigné que si le corpus contient réellement la
 * production — voir `documentDeLaObservation`. Sans lui, la ligne garde exactement
 * la même mise en forme mais n'est pas un bouton : rien ne suggère un clic qui
 * ne mènerait nulle part.
 */
function ObservationLiee({
  observation,
  ouvrirElement,
}: {
  observation: ObservationAtelier;
  ouvrirElement: (id: string) => void;
}) {
  const corps = (
    <>
      <span className="flex items-start justify-between gap-2">
        <span className="min-w-0 text-xs font-medium leading-snug text-texte">{observation.contexte}</span>
        <span
          className={cx(
            "shrink-0 rounded px-1.5 py-0.5 text-[0.625rem]",
            observation.resultat === "reussi"
              ? "bg-succes-faible text-succes"
              : observation.resultat === "partiel"
                ? "bg-info-faible text-info"
                : "bg-danger-faible text-danger",
          )}
        >
          {observation.resultat === "reussi" ? "Solide" : observation.resultat === "partiel" ? "Partiel" : "À revoir"}
        </span>
      </span>
      <span className="mt-1 block text-[0.6875rem] text-texte-discret">
        {dateCourte(observation.date)} · observation {observation.niveauObservation} · {observation.autonomie}
      </span>
    </>
  );

  if (!observation.documentId) {
    return <div className="rounded-lg border border-bordure bg-surface px-3 py-2.5">{corps}</div>;
  }
  return (
    <button
      type="button"
      onClick={() => ouvrirElement(observation.documentId!)}
      className="block w-full rounded-lg border border-bordure bg-surface px-3 py-2.5 text-left transition-colors hover:border-primaire/40 hover:bg-surface-2 cursor-pointer"
    >
      {corps}
    </button>
  );
}


function VueCompetence({
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
  /*
   * Plus d'onglets : un seul flux.
   *
   * Il y en a eu quatre, puis deux — « Progression » et « Relations &
   * ressources ». Deux onglets, c'est deux clics pour savoir lequel répond à sa
   * question, et une fiche coupée en deux moitiés qui parlent du même objet.
   * Tout se lit maintenant en descendant, dans l'ordre où on se le demande :
   * où j'en suis, ce qui manque, ce que ça a donné, à quoi ça tient.
   *
   * Le volet Contexte, lui, ne s'ouvre plus sur une compétence
   * (`espace-documentaire.tsx`) : il redisait le code, le domaine, le palier,
   * la dernière observation, les mêmes barres de performance et la même prochaine
   * action. La fiche récupère sa largeur.
   */

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

  /*
   * Deux volets, pour que la fiche tienne dans l'écran.
   *
   * En un seul flux vertical, « Éléments associés » finissait sous la ligne de
   * flottaison : il fallait défiler pour savoir si une compétence avait des
   * observations. La lecture — ce qui reste à démontrer, la performance, le parcours
   * — occupe le volet gauche ; les listes tiennent à droite sous des onglets,
   * une nature par onglet. Chaque volet défile pour lui seul, la page ne défile
   * plus.
   */
  const volets: Array<{ id: VoletCompetence; libelle: string; compteur: number }> = [
    { id: "observations", libelle: "Observations", compteur: vue.observations.length },
    { id: "exercices", libelle: "Exercices", compteur: vue.exercices.length },
    { id: "ressources", libelle: "Ressources", compteur: vue.documents.length },
    { id: "relations", libelle: "Relations", compteur: vue.prerequis.length + vue.suivantes.length },
  ];

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-y-auto bg-surface-2/40 lg:overflow-hidden">
      {/*
        L'en-tête ne porte plus qu'une action. Il y avait « Lancer une séance
        ciblée » ici, le même bouton dans le volet Contexte, et « Générer un
        exercice » deux fois : le geste secondaire reste, mais dans l'onglet
        Exercices où il a un sens de proximité.
      */}
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

      {/* Les lectures restent séparées : observation ponctuelle, état consolidé et maîtrise. */}
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
            {/*
              Les barres portent déjà ce que « points forts » et « axes à
              remobiliser » disaient en extrayant les deux extrêmes. Le
              classement reste lisible — les dimensions sont ordonnées — sans
              qu'il faille deux encarts pour montrer quatre lignes d'une liste
              affichée en entier juste en dessous.
            */}
            <div className="mt-5 space-y-3">
              {vue.dimensions.map((dimension) => (
                <Barre key={dimension.id} valeur={dimension.valeur} libelle={dimension.libelle} />
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-bordure bg-surface p-5 shadow-[var(--ombre-posee)]">
            <h3 className="font-serif text-lg font-medium">Parcours</h3>
            <p className="mt-1 text-xs text-texte-discret">
              Ce que chaque observation a changé, rejoué depuis le journal.
            </p>
            <FriseParcours etapes={vue.parcours} />
          </div>
        </div>

        {/* Volet des éléments : une nature par onglet, plus de listes mélangées. */}
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
                        {/*
                          Une observation historique sans document reste lisible mais
                          n'est pas cliquable : mieux vaut un lien absent qu'un
                          lien qui ne mène nulle part.
                        */}
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
                {/*
                  `compteId` sert à relire la configuration du tuteur côté
                  navigateur : la clé du fournisseur est isolée par compte.
                */}
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

/* ------------------------------------------------------------------ */
/* Le parcours d'une compétence                                        */
/* ------------------------------------------------------------------ */

/**
 * La frise des observations, avec ce que chacune a changé.
 *
 * L'ancien « Historique récent » listait un contexte et une date : il disait
 * qu'il s'était passé quelque chose, jamais ce que ça avait changé. Le niveau
 * d'avant chaque observation est pourtant calculable, et `parcoursCompetence` le
 * rejoue.
 *
 * Une observation qui n'a rien déplacé reste affichée, sans mise en avant : ne
 * montrer que les progressions donnerait l'illusion d'une courbe toujours
 * montante, et ferait disparaître le travail de consolidation.
 */
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

/**
 * Ce qu'il reste à démontrer.
 *
 * `prochaineEtape` et les réserves sont produits par `computeSkillState` et
 * n'étaient lus nulle part sur cette fiche. Ils disent la seule chose que
 * quelqu'un vient chercher après avoir regardé son niveau : ce qui manque pour
 * qu'il bouge.
 */
function ResteADemontrer({
  vue,
  prochainExercice,
  ouvrirElement,
}: {
  vue: VueCompetenceAtelier;
  /** L'aperçu remplace le doublon que le volet Contexte affichait sous « Prochaine action ». */
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

/**
 * Les compétences que le travail a reliées à celle-ci.
 *
 * Un fait observé, pas une proximité devinée : ces compétences ont été mises
 * en jeu par les mêmes exercices ou nommées sur les mêmes observations. Le compte
 * est affiché pour que le lien porte sa propre source (P3).
 */
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

/*
 * `Relations` a disparu avec l'onglet qu'il occupait : il affichait deux cadres
 * que rien dans l'interface ne pouvait remplir. Les prérequis et les suites se
 * lisent et s'écrivent maintenant dans `relations-competence.tsx`.
 */

export function VueDomaine({
  vue,
  ouvrirElement,
  compteId,
  modeInitial,
  onRestaurerDomaine,
}: {
  vue: VueDomaineAtelier;
  ouvrirElement: (id: string) => void;
  elements?: ElementAtelier[];
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

                      {/*
                        Une rattachée ne se retire pas d'ici : elle appartient à
                        un autre domaine, et la retirer effacerait ses observations
                        pour tout le monde. Elle se détache — le porteur ne
                        bouge pas (ADR-081).
                      */}
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

function VueTheme({
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
  elements?: ElementAtelier[];
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

  /*
   * Deux onglets, et non plus trois : « Radar & Profil » est remonté en tête
   * de « Compétences », dont il traçait déjà la liste sous forme de radar.
   */
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
              ouvrirElement("transversal");
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
            {/*
              Le radar et la synthèse ouvraient un onglet à eux. Le radar trace
              exactement `vue.competences` — la liste qui suit, sous une autre
              forme : deux onglets pour une donnée, et le choix entre les deux
              n'était pas un choix de contenu. Les compteurs, eux, servent
              d'en-tête à cette liste plutôt que de vivre ailleurs.
            */}
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

function VueExercice({
  vue,
  ouvrirElement,
}: {
  vue: VueExerciceProjectionAtelier;
  ouvrirElement: (id: string) => void;
  elements?: ElementAtelier[];
}) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-surface-2/40">
      <header className="border-b border-bordure bg-surface px-6 py-6 lg:px-8">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="flex min-w-0 items-start gap-4">
            <span className="grid size-14 shrink-0 place-items-center rounded-2xl border border-primaire/20 bg-primaire-faible text-primaire shadow-xs">
              <IconeExercices className="size-7" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-info-faible px-2.5 py-0.5 text-xs font-semibold text-info">
                  Exercice
                </span>
                <span className="rounded-md bg-surface-2 px-2.5 py-0.5 text-xs font-medium text-texte-discret">
                  Difficulté {vue.difficulte}/5
                </span>
                <span className="rounded-md bg-surface-2 px-2.5 py-0.5 text-xs font-medium text-texte-discret">
                  ~{vue.dureeEstimeeMin} min
                </span>
                <span className="rounded-md bg-surface-2 px-2.5 py-0.5 text-xs font-medium text-texte-discret capitalize">
                  {vue.typeExercice}
                </span>
              </div>
              <h2 className="mt-2 font-serif text-[2.2rem] font-medium leading-tight tracking-tight text-texte">
                {vue.titre}
              </h2>
            </div>
          </div>

          <Link
            href={urlComposerAutonome(vue.competences[0]?.code, vue.dureeEstimeeMin)}
            className="inline-flex items-center gap-2 rounded-xl bg-primaire px-5 py-3 text-sm font-semibold text-texte-inverse shadow hover:bg-primaire-survol transition-colors"
          >
            <span>S’exercer dans le cahier</span>
            <IconeFleche className="size-4" />
          </Link>
        </div>
      </header>

      <div className="space-y-6 p-6 lg:p-8">
        {/* Énoncé de l'exercice */}
        <section className="rounded-xl border border-bordure bg-surface p-6 shadow-[var(--ombre-posee)]">
          <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-texte-discret">
            Énoncé de l’exercice
          </h3>
          <div className="prose-exo mt-4 text-sm leading-relaxed text-texte">
            <Markdown contenu={vue.enonce || "Aucun énoncé fourni pour cet exercice."} />
          </div>
        </section>

        {/* Compétences visées */}
        <section className="rounded-xl border border-bordure bg-surface p-6 shadow-[var(--ombre-posee)]">
          <div className="flex items-center justify-between border-b border-bordure pb-3">
            <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-texte-discret">
              Compétences cibles
            </h3>
            <span className="text-xs text-texte-discret">{vue.competences.length} compétence(s)</span>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {vue.competences.map((comp) => (
              <button
                key={comp.code}
                type="button"
                onClick={() => ouvrirElement(comp.code)}
                className="group flex items-center justify-between rounded-xl border border-bordure bg-surface-2/40 p-3.5 text-left transition-all hover:border-primaire/40 hover:bg-surface-2 cursor-pointer"
              >
                <div className="min-w-0 flex-1 pr-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-primaire">{comp.code}</span>
                    <span className="rounded bg-surface-3 px-1.5 py-0.5 text-[0.625rem] text-texte-discret">
                      {LIBELLES_PALIERS[comp.palier] ?? comp.palier}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-medium text-texte truncate group-hover:text-primaire">
                    {comp.titre}
                  </p>
                </div>
                <span className="text-texte-discret transition-transform group-hover:translate-x-1 group-hover:text-primaire">→</span>
              </button>
            ))}
          </div>
        </section>

        {/* Historique des tentatives */}
        <section className="rounded-xl border border-bordure bg-surface p-6 shadow-[var(--ombre-posee)]">
          <div className="flex items-center justify-between border-b border-bordure pb-3">
            <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-texte-discret">
              Historique des tentatives
            </h3>
            <span className="text-xs text-texte-discret">{vue.nombreTentatives} tentative(s)</span>
          </div>
          {vue.tentatives.length > 0 ? (
            <div className="mt-4 space-y-2">
              {vue.tentatives.map((t) => (
                <div
                  key={t.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-bordure bg-surface-2/30 px-4 py-3 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={cx(
                        "rounded px-2 py-0.5 font-semibold text-xs",
                        t.resultat === "reussi"
                          ? "bg-succes-faible text-succes"
                          : t.resultat === "partiel"
                          ? "bg-info-faible text-info"
                          : "bg-danger-faible text-danger",
                      )}
                    >
                      {t.resultat === "reussi" ? "Réussi" : t.resultat === "partiel" ? "Partiel" : "Échec"}
                    </span>
                    <span className="text-texte-discret">
                      {formatDateHeure(t.fin ?? t.debut)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-texte-discret">
                    {t.dureeMin !== undefined && <span>{t.dureeMin} min</span>}
                    <span>{t.indicesUtilises} indice{t.indicesUtilises > 1 ? "s" : ""}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-xs text-texte-discret">
              Aucune tentative enregistrée sur cet exercice. Lance une session pour enregistrer ta première observation.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

export function FichePedagogiqueAtelier({
  vue,
  titre,
  ouvrirElement,
  elements,
  compteId,
  modeInitial,
  generation,
  donneesSeance,
  onRestaurerDomaine,
}: {
  vue: VuePedagogiqueAtelier;
  titre: string;
  ouvrirElement: (id: string) => void;
  elements?: ElementAtelier[];
  compteId: string;
  modeInitial?: "referentiel";
  generation?: { competences: CompetenceModale[]; calibrages: Record<string, CalibrageModale> };
  donneesSeance?: DonneesSeance;
  onRestaurerDomaine?: (domaineId: string) => void;
}) {
  if (vue.kind === "competence") {
    return (
      <VueCompetence
        key={vue.code}
        vue={vue}
        titre={titre}
        ouvrirElement={ouvrirElement}
        elements={elements}
        compteId={compteId}
        generation={generation}
        /*
         * La séance ciblée n'existait que dans le volet Contexte : sans ce
         * passage, retirer le volet supprimait le geste au lieu du doublon.
         */
        donneesSeance={donneesSeance}
      />
    );
  }

  if (vue.kind === "domaine") {
    return (
      <VueDomaine
        vue={vue}
        ouvrirElement={ouvrirElement}
        compteId={compteId}
        modeInitial={modeInitial}
        onRestaurerDomaine={onRestaurerDomaine}
      />
    );
  }

  if (vue.kind === "theme") {
    return (
      <VueTheme
        key={vue.id}
        vue={vue}
        titre={titre}
        ouvrirElement={ouvrirElement}
        compteId={compteId}
        generation={generation}
        donneesSeance={donneesSeance}
      />
    );
  }

  return (
    <VueExercice
      key={vue.id}
      vue={vue}
      ouvrirElement={ouvrirElement}
    />
  );
}

/**
 * Le volet de contexte a-t-il quelque chose à dire sur cet objet ?
 *
 * L'Atelier posait le cadre du volet — en-tête « Contexte », bouton de
 * fermeture, boutons d'ouverture dans la barre haute — avant de savoir s'il y
 * avait un contenu à y mettre. Une compétence n'en a plus.
 */
export function panneauPedagogiqueUtile(vue: VuePedagogiqueAtelier): boolean {
  return vue.kind !== "competence";
}

/*
 * `compteId` et `generation` ne servaient qu'au volet des compétences, qui a
 * disparu : le volet ne génère plus d'exercice, il ne fait que décrire.
 */
export function PanneauPedagogiqueAtelier({
  vue,
  ouvrirElement,
  donneesSeance,
}: {
  vue: VuePedagogiqueAtelier;
  ouvrirElement: (id: string) => void;
  donneesSeance?: DonneesSeance;
}) {
  /*
   * Une compétence n'a plus de volet.
   *
   * Il reprenait, un pouce à droite de la fiche : le code, le domaine, le
   * palier et la dernière observation (déjà dans l'en-tête et les mesures), les
   * mêmes barres de performance, la même prochaine étape, et deux raccourcis
   * vers l'exercice et la ressource que les cartes listent nommément. Rien à
   * garder, et 22 rem de largeur rendus à la fiche.
   *
   * `estPanneauUtile` dit dehors ce que ce `null` dit ici, pour que l'Atelier
   * n'affiche ni le cadre vide ni les boutons qui l'ouvrent.
   */
  if (vue.kind === "competence") return null;

  if (vue.kind === "theme") {
    const paliersCompteurs = {
      fondamentaux: vue.competences.filter((c) => c.palier === "fondamentaux").length,
      intermediaire: vue.competences.filter((c) => c.palier === "intermediaire").length,
      avance: vue.competences.filter((c) => c.palier === "avance").length,
    };

    return (
      <div className="space-y-5 p-4">
        <div>
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-accent">Thème transversal</p>
          <h3 className="mt-1 font-serif text-lg font-medium text-texte">{vue.libelle}</h3>
        </div>

        {/* Prochaine action recommandée */}
        {vue.prochaineActionRecommandee && (
          <section className="rounded-xl border border-alerte/30 bg-alerte-faible p-4 shadow-xs">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-alerte">Prochaine action recommandée</p>
            <p className="mt-2 text-sm font-semibold leading-snug text-texte">{vue.prochaineActionRecommandee.titre}</p>
            <p className="mt-1 text-xs text-texte-attenue">{vue.prochaineActionRecommandee.motif}</p>
            {vue.prochaineActionRecommandee.reserves.map((reserve) => (
              <p key={reserve} className="mt-1 text-xs text-texte-discret">{reserve}</p>
            ))}
            <button
              type="button"
              onClick={() => ouvrirElement(vue.prochaineActionRecommandee!.code)}
              className="mt-3 flex w-full items-center justify-between rounded-lg bg-surface px-3 py-2 text-xs font-semibold text-primaire shadow-xs hover:bg-surface-2 transition-colors cursor-pointer"
            >
              <span>Travailler cette compétence</span>
              <IconeFleche className="size-3.5" />
            </button>
          </section>
        )}

        {/* Répartition par domaine */}
        <div className="rounded-xl border border-bordure bg-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-texte-discret">Couverture par domaine</p>
          <div className="mt-3 space-y-3">
            {vue.domaines.map((d) => {
              const ratio = d.nombreCompetences > 0 ? Math.round((d.nombreEvaluees / d.nombreCompetences) * 100) : 0;
              return (
                <div key={d.id} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-texte truncate">{d.nom}</span>
                    <span className="text-texte-discret">{d.nombreEvaluees}/{d.nombreCompetences} ({ratio}%)</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
                    <div className="h-full rounded-full bg-primaire transition-all" style={{ width: `${ratio}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Synthèse par paliers */}
        <div className="rounded-xl border border-bordure bg-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-texte-discret">Répartition par palier</p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-lg bg-surface-2 p-2">
              <span className="block text-[0.625rem] text-texte-discret">Fondam.</span>
              <span className="chiffres font-semibold text-texte">{paliersCompteurs.fondamentaux}</span>
            </div>
            <div className="rounded-lg bg-surface-2 p-2">
              <span className="block text-[0.625rem] text-texte-discret">Interm.</span>
              <span className="chiffres font-semibold text-texte">{paliersCompteurs.intermediaire}</span>
            </div>
            <div className="rounded-lg bg-surface-2 p-2">
              <span className="block text-[0.625rem] text-texte-discret">Avancé</span>
              <span className="chiffres font-semibold text-texte">{paliersCompteurs.avance}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (vue.kind === "exercice") {
    return (
      <div className="space-y-5 p-4">
        <div>
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-texte-discret">Exercice</p>
          <h3 className="mt-1 font-serif text-lg font-medium text-texte">{vue.titre}</h3>
        </div>
        <div className="rounded-xl border border-bordure bg-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-texte-discret">Informations</p>
          <dl className="mt-3 space-y-2 text-xs">
            <div className="flex justify-between gap-3">
              <dt className="text-texte-discret">Domaine</dt>
              <dd className="font-medium text-texte">{vue.domaineNom}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-texte-discret">Difficulté</dt>
              <dd className="font-medium text-texte">{vue.difficulte} / 5</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-texte-discret">Durée estimée</dt>
              <dd className="font-medium text-texte">~{vue.dureeEstimeeMin} min</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-texte-discret">Tentatives</dt>
              <dd className="font-medium text-texte">{vue.nombreTentatives}</dd>
            </div>
          </dl>
        </div>
        <Link
          href={urlComposerAutonome(vue.competences[0]?.code, vue.dureeEstimeeMin)}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primaire px-4 py-2.5 text-xs font-semibold text-texte-inverse shadow hover:bg-primaire-survol transition-colors"
        >
          <span>S’exercer dans le cahier</span>
          <IconeFleche className="size-3.5" />
        </Link>
      </div>
    );
  }

  if (vue.kind === "domaine") {
    const paliersCompteurs = {
      fondamentaux: vue.competences.filter((c) => c.palier === "fondamentaux").length,
      intermediaire: vue.competences.filter((c) => c.palier === "intermediaire").length,
      avance: vue.competences.filter((c) => c.palier === "avance").length,
    };

    return (
      <div className="space-y-5 p-4">
        <div>
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-texte-discret">Structure du domaine</p>
          <h3 className="mt-1 font-serif text-lg font-medium">{vue.nom}</h3>
        </div>

        {donneesSeance && !vue.domaine.archive && (
          <div className="rounded-xl border border-primaire/25 bg-primaire-faible/30 p-4">
            <p className="text-xs font-semibold text-texte">Entraînement sur le domaine</p>
            <p className="mt-1 text-xs text-texte-attenue leading-relaxed">
              Composer une séance regroupant les compétences de ce domaine.
            </p>
            <div className="mt-3">
              <ConcepteurSeance
                {...donneesSeance}
                preset={{
                  libelle: `Domaine : ${vue.nom}`,
                  codesVises: vue.competences.map((c) => c.code),
                  dureeCibleMin: 45,
                  nombreExercices: Math.max(3, Math.min(vue.competences.length, 6)),
                  domaine: vue.domaine.id,
                }}
                libelle="Lancer une séance domaine"
                pleineLargeur
                variante="principal"
                icone={<IconeFleche className="size-3.5" />}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-primaire px-3 py-2 text-xs font-semibold text-texte-inverse shadow-xs hover:bg-primaire-survol transition-colors cursor-pointer"
              />
            </div>
          </div>
        )}

        <div className="rounded-xl border border-bordure bg-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-texte-discret">Niveaux</p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-lg bg-surface-2 p-2">
              <span className="block text-[0.625rem] text-texte-discret">Fondam.</span>
              <span className="chiffres font-semibold text-texte">{paliersCompteurs.fondamentaux}</span>
            </div>
            <div className="rounded-lg bg-surface-2 p-2">
              <span className="block text-[0.625rem] text-texte-discret">Interm.</span>
              <span className="chiffres font-semibold text-texte">{paliersCompteurs.intermediaire}</span>
            </div>
            <div className="rounded-lg bg-surface-2 p-2">
              <span className="block text-[0.625rem] text-texte-discret">Avancé</span>
              <span className="chiffres font-semibold text-texte">{paliersCompteurs.avance}</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-bordure bg-surface-2/60 p-4">
          <p className="text-xs font-semibold">Organisation réelle</p>
          <p className="mt-2 text-xs leading-relaxed text-texte-discret">
            Cette fiche mère regroupe les compétences du domaine. Les paliers les ordonnent ; ils ne créent pas de nouvelle entité.
          </p>
        </div>
      </div>
    );
  }

  /* Tous les types ont leur branche ; ce retour ferme le typage. */
  return null;
}
