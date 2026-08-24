"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Modale } from "@/components/ui/modale";
import { cx } from "@/components/ui/primitives";
import { IconeAmpoule, IconeCours, IconeDocuments, IconeExercices, IconeFleche, IconeFormule, IconeNote, IconePlus, IconeProjet } from "@/components/ui/icones";
import { creerNoteAction } from "@/lib/store/document-actions";
import { definitionTypeDocument } from "@/lib/documents/types-documents";
import {
  erreurFichierPiece,
  estMimePieceJointe,
  mimeDepuisNomFichier,
  MIME_PDF,
} from "@/lib/documents/pieces-jointes";
import { televerserFichier } from "@/lib/documents/televersement-fichier";
import { titreDepuisNomFichier } from "@/lib/documents/titre-depuis-fichier";
import type { IntentionCours } from "@/lib/domain/protocole-cours";
import { ModaleCompetence } from "@/components/referentiel/modale-competence";
import { ModaleReferentiel } from "@/components/referentiel/modale-referentiel";
import { ParcoursNouveauProjet } from "@/components/projets/modale-nouveau-projet";
import type { CompetenceModale } from "@/lib/domain/proprietes-generation";

/**
 * La création de **documents typés** dans Mes cours, et les destinations que
 * les liens profonds ouvrent.
 *
 * Ce module fait deux choses, et il faut les tenir séparées :
 *
 * 1. **Un menu**, qui ne propose que ce que le `+` du rail ne sait pas faire —
 *    ressource, cours (PDF), formule. Voir `actionsPourVue`.
 * 2. **Sept destinations**, montées ci-dessous et atteintes par `?creation=` :
 *    la palette ⌘K du Bureau et l'état vide des domaines y mènent. Elles ne
 *    sont pas dans le menu, elles sont au bout d'un lien.
 *
 * ## Pourquoi le menu s'est réduit (ADR-126, révise ADR-120)
 *
 * ADR-120 affirmait que ce menu et le `+` « ne se recouvrent pas ». C'était
 * faux sur trois gestes : le `+` monte **exactement** `ModaleReferentiel`,
 * `ModaleCompetence` et `ParcoursNouveauProjet`. Une seule entrée avait été
 * vérifiée — la création de note, en dur sur « Note libre » — et la conclusion
 * avait été étendue aux sept.
 *
 * Ce qui reste vrai, et qui justifie les entrées gardées :
 *
 * - **Les formats typés.** `reference` et `formule` portent des sections
 *   déclarées (`definitionTypeDocument`) que la saisie ci-dessous remplit. Le
 *   `+` crée toujours une « Note libre », quoi qu'on lui demande.
 * - **Aucun appel au tuteur** — pour `ressource` et `formule`. Ce chemin-ci
 *   n'en fait aucun : zéro génération décomptée (ADR-116), et il fonctionne
 *   quota épuisé. L'argument ne valait PAS pour domaine, compétence et projet —
 *   ces trois modales appellent le tuteur elles-mêmes, qu'on y arrive par le
 *   menu ou par le `+`.
 *
 * ## Pourquoi « cours » ne suit plus cette règle (ADR-129, révise ADR-126)
 *
 * Déposer un cours commence par le PDF, pas par une saisie : la fiche support
 * est créée à partir du fichier, le PDF est attaché, et la lecture par le
 * tuteur — qui décompte — est enchaînée. Saisir la fiche reste un travail sur
 * le cours, dans l'espace de travail ; ce n'est plus le geste d'entrée.
 */
export type CreationAtelier =
  | "domaine"
  | "competence"
  | "ressource"
  | "cours"
  | "formule"
  | "projet"
  | "feynman";

const CREATIONS_ATELIER: readonly CreationAtelier[] = [
  "domaine",
  "competence",
  "ressource",
  "cours",
  "formule",
  "projet",
  "feynman",
];

const LIBELLES_CREATION: Record<CreationAtelier, string> = {
  domaine: "Ajouter un domaine",
  competence: "Ajouter une compétence",
  ressource: "Ajouter une ressource",
  cours: "Déposer un cours (PDF)",
  formule: "Enregistrer une formule",
  projet: "Lancer un projet",
  feynman: "Faire une explication Feynman",
};

const TYPES_DOCUMENT: Record<"ressource" | "formule", {
  titre: string;
  type: string;
  titreInitial: string;
  placeholder: string;
}> = {
  ressource: {
    titre: "Ajouter une ressource",
    type: "reference",
    titreInitial: "Nouvelle ressource",
    placeholder: "Ex. article, PDF ou ressource à garder",
  },
  formule: {
    titre: "Enregistrer une formule",
    type: "formule",
    titreInitial: "Nouvelle formule",
    placeholder: "Ex. formule de Bayes et conditions d’application",
  },
};

const ICONES_CREATION: Record<CreationAtelier, typeof IconePlus> = {
  domaine: IconeDocuments,
  competence: IconeAmpoule,
  ressource: IconeDocuments,
  cours: IconeCours,
  formule: IconeFormule,
  projet: IconeProjet,
  feynman: IconeAmpoule,
};

/**
 * Les suggestions d'amorçage de la capture d'intention (ADR-130) — les trois
 * valeurs de l'enum serveur, dans le style du point d'entrée assisté.
 */
const SUGGESTIONS_INTENTION_COURS: readonly {
  valeur: IntentionCours;
  libelle: string;
  Icone: typeof IconeNote;
}[] = [
  { valeur: "memoriser", libelle: "Mémoriser", Icone: IconeNote },
  { valeur: "maitriser", libelle: "Maîtriser les notions", Icone: IconeExercices },
  { valeur: "comprendre", libelle: "Comprendre le contenu", Icone: IconeAmpoule },
];

function estCreationAtelier(valeur: string | undefined): valeur is CreationAtelier {
  return Boolean(valeur && CREATIONS_ATELIER.includes(valeur as CreationAtelier));
}

/**
 * Ce que le menu PROPOSE — un sous-ensemble strict de ce qu'il sait ouvrir.
 *
 * Les deux documents typés saisis (ressource, formule) et le dépôt de cours
 * PDF (ADR-129). Domaine, compétence et projet en sont sortis : le `+` monte
 * littéralement les mêmes modales (`ModaleReferentiel`, `ModaleCompetence`,
 * `ParcoursNouveauProjet`), et celles-ci appellent le tuteur de toute façon —
 * le menu n'y était pas le chemin gratuit qu'ADR-120 lui prêtait. « Explication
 * Feynman » en sort aussi : démarrer une activité n'est pas créer un objet.
 *
 * Hors de la vue « Ressources », le menu n'a donc plus rien à proposer et ne
 * s'affiche pas. Il reste monté : les liens profonds `?creation=` continuent
 * d'ouvrir les sept modales (palette ⌘K, état vide des domaines).
 */
function actionsPourVue(vue: "domaines" | "ressources" | "graphe"): CreationAtelier[] {
  return vue === "ressources" ? ["ressource", "cours", "formule"] : [];
}

export function ActionsCreationAtelier({
  compteId,
  domainesExistants,
  competences,
  vue,
  creationInitiale,
  domaineInitial,
}: {
  compteId: string;
  domainesExistants: { id: string; nom: string; prefixe: string }[];
  competences: CompetenceModale[];
  vue: "domaines" | "ressources" | "graphe";
  creationInitiale?: string;
  domaineInitial?: string;
}) {
  const racine = useRef<HTMLDivElement>(null);
  const [menuOuvert, setMenuOuvert] = useState(false);
  const [creation, setCreation] = useState<CreationAtelier | null>(
    estCreationAtelier(creationInitiale) ? creationInitiale : null,
  );

  useEffect(() => {
    if (!menuOuvert) return;

    function fermerSiExterieur(event: PointerEvent) {
      if (event.target instanceof Node && !racine.current?.contains(event.target)) {
        setMenuOuvert(false);
      }
    }

    function fermerAvecEchap(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOuvert(false);
    }

    document.addEventListener("pointerdown", fermerSiExterieur);
    document.addEventListener("keydown", fermerAvecEchap);
    return () => {
      document.removeEventListener("pointerdown", fermerSiExterieur);
      document.removeEventListener("keydown", fermerAvecEchap);
    };
  }, [menuOuvert]);

  const actions = useMemo(() => actionsPourVue(vue), [vue]);
  const ouvrirCreation = (action: CreationAtelier) => {
    setMenuOuvert(false);
    setCreation(action);
  };
  const fermerCreation = () => {
    setCreation(null);
    if (creationInitiale && typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("creation");
      window.history.replaceState(null, "", url);
    }
  };

  return (
    <>
      {actions.length > 0 && (
      <div ref={racine} className="relative shrink-0">
        <button
          type="button"
          onClick={() => setMenuOuvert((ouvert) => !ouvert)}
          aria-expanded={menuOuvert}
          aria-haspopup="menu"
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-primaire px-3 py-1.5 text-xs font-semibold text-texte-inverse shadow-sm transition-colors hover:bg-primaire-survol focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primaire/40"
        >
          <IconePlus className="size-3.5" />
          <span>Créer</span>
        </button>

        {menuOuvert && (
          <div
            role="menu"
            aria-label="Actions de création"
            className="absolute right-0 top-full z-40 mt-2 w-64 overflow-hidden rounded-xl border border-bordure bg-surface p-1.5 shadow-[var(--ombre-surcouche)]"
          >
            {actions.map((action) => {
              const Icone = ICONES_CREATION[action];
              return (
                <button
                  key={action}
                  type="button"
                  role="menuitem"
                  onClick={() => ouvrirCreation(action)}
                  className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs text-texte-attenue transition-colors hover:bg-primaire-faible hover:text-primaire"
                >
                  <Icone className="size-4 shrink-0" />
                  <span>{LIBELLES_CREATION[action]}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
      )}

      {creation === "domaine" && (
        <ModaleReferentiel compteId={compteId} onFermer={fermerCreation} />
      )}
      {creation === "competence" && (
        <ModaleCompetence
          compteId={compteId}
          domainesExistants={domainesExistants}
          modeCible="competence"
          domaineInitial={domaineInitial}
          onFermer={fermerCreation}
        />
      )}
      {creation === "cours" && (
        <ModaleDepotCours
          domainesExistants={domainesExistants}
          domaineInitial={domaineInitial}
          onFermer={fermerCreation}
        />
      )}
      {(creation === "ressource" || creation === "formule") && (
        <ModaleCreationDocument
          domainesExistants={domainesExistants}
          domaineInitial={domaineInitial}
          type={creation}
          onFermer={fermerCreation}
        />
      )}
      {creation === "projet" && (
        <ParcoursNouveauProjet
          accountId={compteId}
          intentionInitiale="Je veux construire un projet pratique"
          onFermer={fermerCreation}
        />
      )}
      {creation === "feynman" && (
        <ModaleFeynman competences={competences} onFermer={fermerCreation} />
      )}
    </>
  );
}

/**
 * « Déposer mon cours » : le PDF d'abord, la fiche ensuite (ADR-129).
 *
 * Le geste d'entrée est le dépôt du fichier. La fiche support de type `cours`
 * est créée automatiquement — titre dérivé du nom du fichier, contexte qui
 * décrit le geste, domaine choisi en un clic — puis le PDF y est attaché et
 * l'espace de travail s'ouvre sur la lecture par le tuteur (`?lecture=1`) :
 * extraction, proposition de compétences, relecture case par case. C'est le
 * chemin existant d'ADR-113, atteint sans saisie préalable.
 *
 * La lecture décompte le quota (ADR-116) : c'est assumé et validé — la boucle
 * doit avancer d'elle-même jusqu'à la proposition, qui reste la seule écriture
 * au référentiel après relecture humaine.
 */
function ModaleDepotCours({
  domainesExistants,
  domaineInitial,
  onFermer,
}: {
  domainesExistants: { id: string; nom: string; prefixe: string }[];
  domaineInitial?: string;
  onFermer: () => void;
}) {
  const router = useRouter();
  const [fichier, setFichier] = useState<File | null>(null);
  const [depotActif, setDepotActif] = useState(false);
  const [domaine, setDomaine] = useState(domaineInitial ?? "transversal");
  const [intention, setIntention] = useState<IntentionCours>("maitriser");
  const [intentionLibre, setIntentionLibre] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  function choisirFichier(fichierChoisi: File | undefined) {
    setErreur(null);
    if (!fichierChoisi) return;
    const mime = estMimePieceJointe(fichierChoisi.type)
      ? fichierChoisi.type
      : mimeDepuisNomFichier(fichierChoisi.name);
    if (mime !== MIME_PDF) {
      setErreur("Le cours se dépose en PDF.");
      return;
    }
    const motifRefus = erreurFichierPiece(fichierChoisi);
    if (motifRefus) {
      setErreur(motifRefus);
      return;
    }
    setFichier(fichierChoisi);
  }

  async function deposer() {
    if (!fichier) {
      setErreur("Choisissez d'abord le PDF de votre cours.");
      return;
    }
    setEnCours(true);
    setErreur(null);
    try {
      const fiche = await creerNoteAction(
        "support",
        "cours",
        titreDepuisNomFichier(fichier.name),
        {
          contexte: `Cours déposé depuis le fichier « ${fichier.name} »`.slice(0, 200),
          domaine,
          intentionCours: intention,
          intentionLibre: intentionLibre.trim(),
        },
      );
      await televerserFichier(fiche.id, fichier);
      onFermer();
      router.push(`/atelier?note=${encodeURIComponent(fiche.id)}&lecture=1`);
      router.refresh();
    } catch (cause) {
      setErreur(
        cause instanceof Error
          ? cause.message
          : "Le dépôt a échoué. La fiche existe peut-être déjà sans son PDF.",
      );
      setEnCours(false);
    }
  }

  return (
    <Modale
      titre="Déposer mon cours"
      sousTitre="Le PDF devient votre cours : le tuteur le lit et propose des compétences, que vous relisez avant tout enregistrement."
      largeur="xl"
      onFermer={onFermer}
      pied={
        <>
          <button
            type="button"
            onClick={onFermer}
            className="cursor-pointer rounded-lg border border-bordure-controle px-3 py-1.5 text-xs font-medium text-texte-attenue transition-colors hover:bg-surface-2"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={() => void deposer()}
            disabled={enCours || !fichier}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-primaire px-3 py-1.5 text-xs font-semibold text-texte-inverse transition-colors hover:bg-primaire-survol disabled:cursor-not-allowed disabled:opacity-50"
          >
            {enCours ? "Dépôt en cours…" : "Déposer et faire lire"}
            {!enCours && <IconeFleche className="size-3.5" />}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div
          className={cx(
            "rounded-lg border border-dashed px-3 py-6 text-center transition-colors",
            depotActif ? "border-primaire bg-primaire-faible/35" : "border-bordure-contraste",
          )}
          onDragEnter={(event) => {
            event.preventDefault();
            setDepotActif(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setDepotActif(true);
          }}
          onDragLeave={(event) => {
            if (event.currentTarget === event.target) setDepotActif(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setDepotActif(false);
            choisirFichier(event.dataTransfer.files?.[0]);
          }}
        >
          <input
            id="depot-cours-fichier"
            type="file"
            accept=".pdf,application/pdf"
            onChange={(event) => {
              choisirFichier(event.currentTarget.files?.[0]);
              event.currentTarget.value = "";
            }}
            className="sr-only"
          />
          <label htmlFor="depot-cours-fichier" className="cursor-pointer text-sm font-medium hover:text-primaire">
            {fichier ? fichier.name : "Déposer ou choisir un PDF"}
          </label>
          <p className="mt-1 text-[0.6875rem] text-texte-discret">PDF seulement · 10 Mo maximum</p>
        </div>

        <label className="block">
          <span className="text-xs font-medium text-texte">Domaine</span>
          <select
            value={domaine}
            onChange={(event) => setDomaine(event.target.value)}
            className="mt-1.5 w-full cursor-pointer rounded-lg border border-bordure-controle bg-surface px-3 py-2 text-sm outline-none focus:border-primaire focus:ring-1 focus:ring-primaire/20"
          >
            <option value="transversal">Transversal</option>
            {domainesExistants.map((domaineExistant) => (
              <option key={domaineExistant.id} value={domaineExistant.id}>
                {domaineExistant.nom}
              </option>
            ))}
          </select>
        </label>

        {/*
         * La capture d'intention reprend le style du point d'entrée assisté
         * (`CaptureIntention`) : une phrase libre, des suggestions d'amorçage,
         * le geste principal dans le pied de modale. Cliquer une suggestion
         * CHOISIT l'intention — elle reste visible sélectionnée, car le dépôt
         * du fichier reste le geste à valider.
         */}
        <div>
          <textarea
            value={intentionLibre}
            onChange={(event) => setIntentionLibre(event.target.value.slice(0, 500))}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void deposer();
              }
            }}
            rows={3}
            placeholder="Ex. : j'ai un examen dans deux semaines et je dois surtout retenir les définitions"
            className="w-full resize-none rounded-xl border border-bordure-controle bg-surface px-3.5 py-3 text-sm outline-none transition-all placeholder:text-texte-discret focus:border-primaire focus:ring-1 focus:ring-primaire/20"
          />
          <div className="mt-1 flex items-center justify-between text-[0.6875rem] text-texte-discret">
            <span>Une intention libre, ou choisissez une orientation ci-dessous</span>
            <span>Entrée pour déposer · Maj+Entrée nouvelle ligne</span>
          </div>
        </div>

        <div>
          <p className="mb-2 text-[0.6875rem] font-semibold uppercase tracking-wider text-texte-attenue">
            Suggestions d’amorçage rapide :
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {SUGGESTIONS_INTENTION_COURS.map(({ valeur, libelle, Icone }) => (
              <button
                key={valeur}
                type="button"
                onClick={() => setIntention(valeur)}
                aria-pressed={intention === valeur}
                className={cx(
                  "group flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-xs transition-colors",
                  intention === valeur
                    ? "border-primaire bg-primaire-faible/30"
                    : "border-bordure bg-surface-2/60 hover:border-primaire/40 hover:bg-primaire-faible/30",
                )}
              >
                <Icone
                  className={cx(
                    "size-4 shrink-0 transition-transform group-hover:scale-110",
                    intention === valeur ? "text-primaire" : "text-texte-discret group-hover:text-primaire",
                  )}
                />
                <span
                  className={cx(
                    "font-medium",
                    intention === valeur ? "text-primaire" : "text-texte group-hover:text-primaire",
                  )}
                >
                  {libelle}
                </span>
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[0.6875rem] leading-relaxed text-texte-discret">
            Cette intention oriente le protocole de séances que le tuteur
            concevra depuis le PDF — vous le relisez avant toute création.
          </p>
        </div>

        {erreur && <p className="rounded-lg bg-danger-faible px-3 py-2 text-xs text-danger">{erreur}</p>}
      </div>
    </Modale>
  );
}

function ModaleCreationDocument({
  domainesExistants,
  domaineInitial,
  type,
  onFermer,
}: {
  domainesExistants: { id: string; nom: string; prefixe: string }[];
  domaineInitial?: string;
  type: "ressource" | "formule";
  onFermer: () => void;
}) {
  const router = useRouter();
  const [titre, setTitre] = useState(TYPES_DOCUMENT[type].titreInitial);
  const [contexte, setContexte] = useState("");
  const [domaine, setDomaine] = useState(domaineInitial ?? "transversal");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useState(false);
  const definition = TYPES_DOCUMENT[type];
  /*
   * La saisie reflète le rendu : une zone par section déclarée du type
   * (Résumé, Passages utiles…), pas seulement un contexte unique. Rester vide
   * est valide — les sections restent dans la fiche, à compléter plus tard.
   */
  const sectionsDocument = useMemo(
    () => definitionTypeDocument(definition.type)?.sections ?? ["Contenu"],
    [definition.type],
  );
  const [valeursSections, setValeursSections] = useState<Record<string, string>>({});

  async function creer() {
    const titreNettoye = titre.trim();
    const contexteNettoye = contexte.trim();
    if (!titreNettoye || !contexteNettoye) {
      setErreur("Renseignez un titre et le contexte de cette fiche.");
      return;
    }

    demarrer(true);
    setErreur(null);
    try {
      const fiche = await creerNoteAction(
        "support",
        definition.type,
        titreNettoye,
        { contexte: contexteNettoye, domaine },
        valeursSections,
      );
      onFermer();
      router.push(`/atelier?note=${encodeURIComponent(fiche.id)}`);
      router.refresh();
    } catch (cause) {
      setErreur(cause instanceof Error ? cause.message : "Création impossible.");
      demarrer(false);
    }
  }

  return (
    <Modale
      titre={definition.titre}
      sousTitre="La fiche s’ouvrira dans vos cours. Vous pourrez ensuite y joindre un PDF."
      largeur="xl"
      onFermer={onFermer}
      pied={
        <>
          <button
            type="button"
            onClick={onFermer}
            className="cursor-pointer rounded-lg border border-bordure-controle px-3 py-1.5 text-xs font-medium text-texte-attenue transition-colors hover:bg-surface-2"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={() => void creer()}
            disabled={enCours}
            className="cursor-pointer rounded-lg bg-primaire px-3 py-1.5 text-xs font-semibold text-texte-inverse transition-colors hover:bg-primaire-survol disabled:cursor-not-allowed disabled:opacity-50"
          >
            {enCours ? "Création…" : "Créer la fiche"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <label className="block">
          <span className="text-xs font-medium text-texte">Titre</span>
          <input
            value={titre}
            onChange={(event) => setTitre(event.target.value)}
            className="mt-1.5 w-full rounded-lg border border-bordure-controle bg-surface px-3 py-2 text-sm outline-none transition-colors placeholder:text-texte-discret focus:border-primaire focus:ring-1 focus:ring-primaire/20"
            placeholder={definition.placeholder}
            autoFocus
          />
        </label>

        <label className="block">
          <span className="text-xs font-medium text-texte">Contexte</span>
          <textarea
            value={contexte}
            onChange={(event) => setContexte(event.target.value)}
            rows={4}
            className="mt-1.5 w-full resize-none rounded-lg border border-bordure-controle bg-surface px-3 py-2 text-sm outline-none transition-colors placeholder:text-texte-discret focus:border-primaire focus:ring-1 focus:ring-primaire/20"
            placeholder="Pourquoi voulez-vous garder cette fiche ?"
          />
        </label>

        {sectionsDocument.map((section) => (
          <label key={section} className="block">
            <span className="text-xs font-medium text-texte">{section}</span>
            <textarea
              value={valeursSections[section] ?? ""}
              onChange={(event) =>
                setValeursSections((anciennes) => ({
                  ...anciennes,
                  [section]: event.target.value,
                }))
              }
              rows={3}
              className="mt-1.5 w-full resize-none rounded-lg border border-bordure-controle bg-surface px-3 py-2 text-sm outline-none transition-colors placeholder:text-texte-discret focus:border-primaire focus:ring-1 focus:ring-primaire/20"
              placeholder={`Contenu de la section « ${section} » (facultatif ici)`}
            />
          </label>
        ))}

        <label className="block">
          <span className="text-xs font-medium text-texte">Domaine</span>
          <select
            value={domaine}
            onChange={(event) => setDomaine(event.target.value)}
            className="mt-1.5 w-full cursor-pointer rounded-lg border border-bordure-controle bg-surface px-3 py-2 text-sm outline-none focus:border-primaire focus:ring-1 focus:ring-primaire/20"
          >
            <option value="transversal">Transversal</option>
            {domainesExistants.map((domaineExistant) => (
              <option key={domaineExistant.id} value={domaineExistant.id}>
                {domaineExistant.nom}
              </option>
            ))}
          </select>
        </label>

        {erreur && <p className="rounded-lg bg-danger-faible px-3 py-2 text-xs text-danger">{erreur}</p>}
      </div>
    </Modale>
  );
}

function ModaleFeynman({
  competences,
  onFermer,
}: {
  competences: CompetenceModale[];
  onFermer: () => void;
}) {
  const router = useRouter();
  const [recherche, setRecherche] = useState("");
  const terme = recherche.trim().toLocaleLowerCase("fr");
  const competencesFiltrees = useMemo(
    () =>
      competences.filter((competence) =>
        `${competence.intitule} ${competence.code} ${competence.domaine}`
          .toLocaleLowerCase("fr")
          .includes(terme),
      ),
    [competences, terme],
  );

  return (
    <Modale
      titre="Faire une explication Feynman"
      sousTitre="Choisissez la compétence que vous voulez reformuler avec vos propres mots."
      largeur="xl"
      onFermer={onFermer}
    >
      <div className="space-y-3">
        <input
          value={recherche}
          onChange={(event) => setRecherche(event.target.value)}
          placeholder="Rechercher une compétence…"
          aria-label="Rechercher une compétence pour Feynman"
          className="w-full rounded-lg border border-bordure-controle bg-surface px-3 py-2 text-sm outline-none focus:border-primaire focus:ring-1 focus:ring-primaire/20"
          autoFocus
        />
        <div className="max-h-[50vh] space-y-1 overflow-y-auto">
          {competencesFiltrees.map((competence) => (
            <button
              key={competence.code}
              type="button"
              onClick={() => {
                onFermer();
                router.push(`/expliquer?code=${encodeURIComponent(competence.code)}`);
              }}
              className="flex w-full cursor-pointer items-start gap-3 rounded-lg border border-bordure bg-surface-2/50 px-3 py-2.5 text-left transition-colors hover:border-primaire/40 hover:bg-primaire-faible"
            >
              <IconeAmpoule className="mt-0.5 size-4 shrink-0 text-primaire" />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-texte">{competence.intitule}</span>
                <span className="mt-0.5 block text-[0.6875rem] text-texte-discret">
                  {competence.code} · {competence.domaine}
                </span>
              </span>
            </button>
          ))}
          {competencesFiltrees.length === 0 && (
            <p className="py-8 text-center text-xs text-texte-discret">Aucune compétence ne correspond.</p>
          )}
        </div>
      </div>
    </Modale>
  );
}
