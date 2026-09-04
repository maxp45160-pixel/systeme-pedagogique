"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Modale } from "@/components/ui/modale";
import { cx } from "@/components/ui/primitives";
import { IconeAmpoule, IconeCours, IconeDocuments, IconeExercices, IconeFleche, IconeFormule, IconeNote, IconePlus, IconeProjet } from "@/components/ui/icones";
import { creerNoteAction } from "@/lib/store/document-actions";
import { creerEngagement } from "@/lib/store/engagement-actions";
import { definitionTypeDocument } from "@/lib/documents/types-documents";
import type { RoleNote } from "@/lib/documents/roles-note";
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
import { ApercuFormulesTexte, PaletteFormulesTexte } from "@/components/ui/palette-formules";
import { ModaleReferentiel } from "@/components/referentiel/modale-referentiel";
import { ParcoursNouveauProjet } from "@/components/projets/modale-nouveau-projet";
import type { CompetenceModale } from "@/lib/domain/proprietes-generation";
import { useIntention, type UsageDomaineIntention } from "@/components/intention/contexte-intention";

/**
 * La création de **documents typés** dans Mes cours, et les destinations que
 * les liens profonds ouvrent.
 *
 * Ce module fait deux choses, et il faut les tenir séparées :
 *
 * 1. **Un menu contextuel** : formats documentaires dans Ressources, et les
 *    deux cadres déclarés de domaine dans Domaines. Voir `actionsPourVue`.
 * 2. **Sept destinations**, montées ci-dessous et atteintes par `?creation=` :
 *    la palette ⌘K et les liens profonds continuent d'y mener, indépendamment
 *    des entrées visibles dans le menu courant.
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
 *
 * ## Pourquoi Domaines retrouve « Ajouter » (ADR-142)
 *
 * Le retour d'usage a réfuté l'hypothèse d'ADR-126 : après le retrait du menu,
 * il n'existait plus de geste explicite pour construire le référentiel depuis
 * sa surface canonique. Les deux choix ci-dessous posent directement l'usage
 * déclaré et ouvrent la saisie manuelle, sans appel au tuteur.
 */
export type CreationAtelier =
  | "domaine"
  | "competence"
  | "ressource"
  | "cours"
  | "cours-ecrit"
  | "note"
  | "definition"
  | "exercice-donne"
  | "devoir"
  | "formule"
  | "projet"
  | "feynman";

const CREATIONS_ATELIER: readonly CreationAtelier[] = [
  "domaine",
  "competence",
  "ressource",
  "cours",
  "cours-ecrit",
  "note",
  "definition",
  "exercice-donne",
  "devoir",
  "formule",
  "projet",
  "feynman",
];

const LIBELLES_CREATION: Record<CreationAtelier, string> = {
  domaine: "Ajouter un domaine",
  competence: "Ajouter une compétence",
  ressource: "Ajouter une ressource",
  cours: "Déposer un cours (PDF)",
  "cours-ecrit": "Écrire un cours",
  note: "Écrire une note",
  definition: "Ajouter une définition",
  "exercice-donne": "Ajouter un exercice donné",
  devoir: "Ajouter un devoir",
  formule: "Enregistrer une formule",
  projet: "Lancer un projet",
  feynman: "Faire une explication Feynman",
};

type CreationDocument = "ressource" | "formule" | "cours-ecrit" | "note" | "definition" | "exercice-donne" | "devoir";

const TYPES_DOCUMENT: Record<CreationDocument, {
  titre: string;
  type: string;
  role: RoleNote;
  titreInitial: string;
  libelleTitre: string;
  placeholder: string;
  contexteLibelle: string;
  contextePlaceholder: string;
  /** Champ central du geste ; les autres sections passent en précisions. */
  sectionPrincipale?: string;
  aidePrincipale?: string;
}> = {
  ressource: {
    titre: "Ajouter une ressource",
    type: "reference",
    role: "support",
    titreInitial: "Nouvelle ressource",
    libelleTitre: "Titre",
    placeholder: "Ex. article, PDF ou ressource à garder",
    contexteLibelle: "Contexte",
    contextePlaceholder: "Pourquoi voulez-vous garder cette fiche ?",
  },
  formule: {
    titre: "Enregistrer une formule",
    type: "formule",
    role: "support",
    titreInitial: "Nouvelle formule",
    libelleTitre: "Nom de la formule",
    placeholder: "Ex. formule de Bayes et conditions d’application",
    contexteLibelle: "Contexte",
    contextePlaceholder: "Dans quel cours ou problème utilisez-vous cette formule ?",
  },
  "cours-ecrit": {
    titre: "Écrire un cours",
    type: "cours",
    role: "support",
    titreInitial: "",
    libelleTitre: "Titre du cours",
    placeholder: "Ex. Chapitre 3 — Coûts de production",
    contexteLibelle: "Contexte du cours",
    contextePlaceholder: "Ex. séance du 12 septembre, chapitre 3",
    sectionPrincipale: "Contenu",
    aidePrincipale: "Saisissez directement le cours. Les objectifs et points à retenir restent disponibles en précisions.",
  },
  note: {
    titre: "Écrire une note",
    type: "note",
    role: "support",
    titreInitial: "",
    libelleTitre: "Titre de la note",
    placeholder: "Ex. Questions à revoir après le cours",
    contexteLibelle: "Contexte",
    contextePlaceholder: "Où et pourquoi avez-vous pris cette note ?",
    sectionPrincipale: "Idées",
    aidePrincipale: "Écrivez la note telle qu’elle doit rester dans votre cours.",
  },
  definition: {
    titre: "Ajouter une définition",
    type: "definition",
    role: "support",
    titreInitial: "",
    libelleTitre: "Notion définie",
    placeholder: "Ex. Élasticité-prix de la demande",
    contexteLibelle: "Contexte",
    contextePlaceholder: "Dans quel cours ou chapitre intervient cette notion ?",
    sectionPrincipale: "Définition",
    aidePrincipale: "Donnez une formulation précise ; l’exemple et les pièges sont facultatifs.",
  },
  "exercice-donne": {
    titre: "Ajouter un exercice donné",
    type: "exercice-donne",
    role: "operationnel",
    titreInitial: "",
    libelleTitre: "Référence de l’exercice",
    placeholder: "Ex. Feuille 2 — Exercice 4",
    contexteLibelle: "Contexte",
    contextePlaceholder: "Ex. TD du 18 septembre",
    sectionPrincipale: "Énoncé",
    aidePrincipale: "Recopiez l’énoncé reçu. Données, consignes et correction peuvent être ajoutées ensuite.",
  },
  devoir: {
    titre: "Ajouter un devoir",
    type: "devoir",
    role: "operationnel",
    titreInitial: "",
    libelleTitre: "Titre du devoir",
    placeholder: "Ex. Dissertation — Sujet 1",
    contexteLibelle: "Contexte",
    contextePlaceholder: "Ex. devoir de macroéconomie du semestre 1",
    sectionPrincipale: "Consigne",
    aidePrincipale: "Saisissez ce qui est demandé. La date de rendu reste indépendante du contenu.",
  },
};

const ICONES_CREATION: Record<CreationAtelier, typeof IconePlus> = {
  domaine: IconeDocuments,
  competence: IconeAmpoule,
  ressource: IconeDocuments,
  cours: IconeCours,
  "cours-ecrit": IconeCours,
  note: IconeNote,
  definition: IconeAmpoule,
  "exercice-donne": IconeExercices,
  devoir: IconeProjet,
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
 * La vue « Domaines » ajoute désormais les deux cadres qu'elle gouverne
 * (ADR-142). Le graphe reste sans menu. Les destinations profondes
 * `?creation=` continuent d'ouvrir les modales historiques.
 */
type ActionMenuAtelier = CreationAtelier | UsageDomaineIntention;

const ACTIONS_DOMAINES: Record<UsageDomaineIntention, {
  libelle: string;
  description: string;
  Icone: typeof IconePlus;
}> = {
  module: {
    libelle: "Un module de cours",
    description: "Un enseignement suivi pendant une année ou un semestre.",
    Icone: IconeCours,
  },
  continu: {
    libelle: "Un domaine à long terme",
    description: "Un sujet que vous développez au-delà d’un cours.",
    Icone: IconeAmpoule,
  },
};

function actionsPourVue(vue: "domaines" | "ressources" | "graphe"): ActionMenuAtelier[] {
  if (vue === "domaines") return ["module", "continu"];
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
  const { ouvrir } = useIntention();
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
  const ouvrirCreation = (action: ActionMenuAtelier) => {
    setMenuOuvert(false);
    if (action === "module" || action === "continu") {
      ouvrir({ usageDomaine: action });
      return;
    }
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
          <span>{vue === "domaines" ? "Ajouter" : "Créer"}</span>
        </button>

        {menuOuvert && (
          <div
            role="menu"
            aria-label="Actions de création"
            className="absolute right-0 top-full z-40 mt-2 w-64 overflow-hidden rounded-xl border border-bordure bg-surface p-1.5 shadow-[var(--ombre-surcouche)]"
          >
            {actions.map((action) => {
              const domaine = action === "module" || action === "continu"
                ? ACTIONS_DOMAINES[action]
                : null;
              const Icone = domaine?.Icone ?? ICONES_CREATION[action as CreationAtelier];
              return (
                <button
                  key={action}
                  type="button"
                  role="menuitem"
                  onClick={() => ouvrirCreation(action)}
                  className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs text-texte-attenue transition-colors hover:bg-primaire-faible hover:text-primaire"
                >
                  <Icone className="size-4 shrink-0" />
                  <span>
                    <span className="block font-medium text-texte">
                      {domaine?.libelle ?? LIBELLES_CREATION[action as CreationAtelier]}
                    </span>
                    {domaine?.description && (
                      <span className="mt-0.5 block text-[0.6875rem] leading-snug text-texte-discret">
                        {domaine.description}
                      </span>
                    )}
                  </span>
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
      {creation && creation in TYPES_DOCUMENT && (
        <ModaleCreationDocument
          domainesExistants={domainesExistants}
          domaineInitial={domaineInitial}
          type={creation as CreationDocument}
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
  // L'intention est du texte pédagogique libre : palette de formules (friction 1).
  const intentionRef = useRef<HTMLTextAreaElement>(null);

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
          <div className="mb-1.5 flex justify-end">
            <PaletteFormulesTexte
              champ={intentionRef}
              valeur={intentionLibre}
              onChange={(valeur) => setIntentionLibre(valeur.slice(0, 500))}
            />
          </div>
          <textarea
            ref={intentionRef}
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
          <div className="mt-2">
            <ApercuFormulesTexte valeur={intentionLibre} />
          </div>
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
  type: CreationDocument;
  onFermer: () => void;
}) {
  const router = useRouter();
  const [titre, setTitre] = useState(TYPES_DOCUMENT[type].titreInitial);
  const [contexte, setContexte] = useState("");
  const [domaine, setDomaine] = useState(domaineInitial ?? "transversal");
  const [dateRendu, setDateRendu] = useState("");
  const [documentCree, setDocumentCree] = useState<{ id: string; titre: string } | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useState(false);
  const definition = TYPES_DOCUMENT[type];
  const domaineImpose = domaineInitial
    ? domainesExistants.find((candidat) => candidat.id === domaineInitial)
    : undefined;
  /*
   * La saisie reflète le rendu : une zone par section déclarée du type
   * (Résumé, Passages utiles…), pas seulement un contexte unique. Rester vide
   * est valide — les sections restent dans la fiche, à compléter plus tard.
   */
  const sectionsDocument = useMemo(
    () => {
      const typeDocument = definitionTypeDocument(definition.type);
      return (typeDocument?.sections ?? ["Contenu"]).filter(
        (section) => !typeDocument?.sectionsJournal.includes(section),
      );
    },
    [definition.type],
  );
  const sectionPrincipale = definition.sectionPrincipale;
  const sectionsSecondaires = sectionPrincipale
    ? sectionsDocument.filter((section) => section !== sectionPrincipale)
    : sectionsDocument;
  const [valeursSections, setValeursSections] = useState<Record<string, string>>({});
  // Le contexte est du texte pédagogique libre : palette de formules (friction 1).
  const contexteRef = useRef<HTMLTextAreaElement>(null);

  function ouvrirDocument(fiche: { id: string }) {
    const retour = domaine !== "transversal"
      ? `/atelier?document=${encodeURIComponent(`domaine:${domaine}`)}`
      : "/atelier?vue=ressources";
    onFermer();
    router.push(`/atelier?note=${encodeURIComponent(fiche.id)}&retour=${encodeURIComponent(retour)}`);
    router.refresh();
  }

  async function creerEcheanceDevoir(fiche: { id: string; titre: string }) {
    await creerEngagement({
      type: "rendu",
      libelle: fiche.titre,
      echeanceLe: dateRendu,
      moduleDomaineId: domaine !== "transversal" ? domaine : undefined,
    });
    ouvrirDocument(fiche);
  }

  async function creer() {
    if (documentCree) {
      demarrer(true);
      setErreur(null);
      try {
        await creerEcheanceDevoir(documentCree);
      } catch (cause) {
        setErreur(cause instanceof Error ? cause.message : "La date de rendu n’a pas pu être ajoutée.");
        demarrer(false);
      }
      return;
    }

    const titreNettoye = titre.trim();
    const contexteNettoye = contexte.trim()
      || `${definition.titre} saisi dans ${domaineImpose?.nom ?? "Mes cours"}.`;
    if (!titreNettoye) {
      setErreur(`Renseignez le champ « ${definition.libelleTitre} ».`);
      return;
    }
    if (!sectionPrincipale && !contexte.trim()) {
      setErreur("Renseignez le contexte de cette fiche.");
      return;
    }
    if (sectionPrincipale && !(valeursSections[sectionPrincipale] ?? "").trim()) {
      setErreur(`Renseignez le champ « ${sectionPrincipale} ».`);
      return;
    }

    demarrer(true);
    setErreur(null);
    try {
      const fiche = await creerNoteAction(
        definition.role,
        definition.type,
        titreNettoye,
        { contexte: contexteNettoye, domaine },
        valeursSections,
      );
      if (type === "devoir" && dateRendu) {
        const devoirCree = { id: fiche.id, titre: titreNettoye };
        setDocumentCree(devoirCree);
        try {
          await creerEcheanceDevoir(devoirCree);
        } catch (cause) {
          setErreur(
            `Le devoir est bien enregistré, mais sa date de rendu ne l’est pas encore. ${
              cause instanceof Error ? cause.message : "Réessayez l’ajout de l’échéance."
            }`,
          );
          demarrer(false);
        }
        return;
      }
      ouvrirDocument(fiche);
    } catch (cause) {
      setErreur(cause instanceof Error ? cause.message : "Création impossible.");
      demarrer(false);
    }
  }

  return (
    <Modale
      titre={definition.titre}
      sousTitre={domaineImpose
        ? "La fiche sera rattachée à ce module et restera modifiable dans Mes cours."
        : "La fiche restera modifiable dans Mes cours."}
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
          {documentCree && (
            <button
              type="button"
              onClick={() => ouvrirDocument(documentCree)}
              className="cursor-pointer rounded-lg border border-bordure-controle px-3 py-1.5 text-xs font-medium text-texte-attenue transition-colors hover:bg-surface-2"
            >
              Ouvrir sans date
            </button>
          )}
          <button
            type="button"
            onClick={() => void creer()}
            disabled={enCours}
            className="cursor-pointer rounded-lg bg-primaire px-3 py-1.5 text-xs font-semibold text-texte-inverse transition-colors hover:bg-primaire-survol disabled:cursor-not-allowed disabled:opacity-50"
          >
            {enCours ? "Enregistrement…" : documentCree ? "Réessayer la date" : "Créer la fiche"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {documentCree ? (
          <div className="rounded-lg border border-alerte/30 bg-alerte-faible px-4 py-3 text-sm text-texte-attenue">
            <p className="font-medium text-texte">Le devoir est enregistré.</p>
            <p className="mt-1">Sa date de rendu reste à ajouter. Vous pouvez réessayer sans recréer le devoir.</p>
            {erreur && <p className="mt-2 text-xs text-danger">{erreur}</p>}
          </div>
        ) : (
        <>
        <label className="block">
          <span className="text-xs font-medium text-texte">{definition.libelleTitre}</span>
          <input
            value={titre}
            onChange={(event) => setTitre(event.target.value)}
            className="mt-1.5 w-full rounded-lg border border-bordure-controle bg-surface px-3 py-2 text-sm outline-none transition-colors placeholder:text-texte-discret focus:border-primaire focus:ring-1 focus:ring-primaire/20"
            placeholder={definition.placeholder}
            autoFocus
          />
        </label>

        {!sectionPrincipale && (
        <label className="block">
          <span className="text-xs font-medium text-texte">{definition.contexteLibelle}</span>
          <div className="mt-1.5 flex justify-end">
            <PaletteFormulesTexte
              champ={contexteRef}
              valeur={contexte}
              onChange={setContexte}
            />
          </div>
          <textarea
            ref={contexteRef}
            value={contexte}
            onChange={(event) => setContexte(event.target.value)}
            rows={4}
            className="mt-1.5 w-full resize-none rounded-lg border border-bordure-controle bg-surface px-3 py-2 text-sm outline-none transition-colors placeholder:text-texte-discret focus:border-primaire focus:ring-1 focus:ring-primaire/20"
            placeholder={definition.contextePlaceholder}
          />
          <div className="mt-2">
            <ApercuFormulesTexte valeur={contexte} />
          </div>
        </label>
        )}

        {sectionPrincipale && (
          <SectionCreation
            section={sectionPrincipale}
            valeur={valeursSections[sectionPrincipale] ?? ""}
            onChange={(texte) =>
              setValeursSections((anciennes) => ({
                ...anciennes,
                [sectionPrincipale]: texte,
              }))
            }
            obligatoire
            rows={sectionPrincipale === "Contenu" ? 10 : 6}
            placeholder={definition.aidePrincipale}
          />
        )}

        {!sectionPrincipale && sectionsSecondaires.map((section) => (
          <SectionCreation
            key={section}
            section={section}
            valeur={valeursSections[section] ?? ""}
            onChange={(texte) =>
              setValeursSections((anciennes) => ({
                ...anciennes,
                [section]: texte,
              }))
            }
          />
        ))}

        {type === "devoir" && (
          <label className="block">
            <span className="text-xs font-medium text-texte">
              Date de rendu <span className="font-normal text-texte-discret">(facultative)</span>
            </span>
            <input
              type="date"
              value={dateRendu}
              onChange={(event) => setDateRendu(event.target.value)}
              className="mt-1.5 w-full rounded-lg border border-bordure-controle bg-surface px-3 py-2 text-sm outline-none transition-colors focus:border-primaire focus:ring-1 focus:ring-primaire/20"
            />
            <span className="mt-1 block text-[0.6875rem] text-texte-discret">
              Si elle est renseignée, elle apparaîtra aussi dans les échéances du module.
            </span>
          </label>
        )}

        {sectionPrincipale && sectionsSecondaires.length > 0 && (
          <details className="group rounded-lg border border-bordure bg-surface-2/30">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-xs font-semibold text-texte-attenue">
              Ajouter des précisions
              <IconeFleche className="size-3.5 transition-transform group-open:rotate-90" />
            </summary>
            <div className="space-y-4 border-t border-bordure p-3">
              {sectionsSecondaires.map((section) => (
                <SectionCreation
                  key={section}
                  section={section}
                  valeur={valeursSections[section] ?? ""}
                  onChange={(texte) =>
                    setValeursSections((anciennes) => ({
                      ...anciennes,
                      [section]: texte,
                    }))
                  }
                />
              ))}
            </div>
          </details>
        )}

        {domaineImpose ? (
          <div>
            <span className="text-xs font-medium text-texte">Module</span>
            <p className="mt-1.5 rounded-lg border border-bordure bg-surface-2/50 px-3 py-2 text-sm text-texte">
              {domaineImpose.nom}
            </p>
          </div>
        ) : (
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
        )}

        {erreur && <p className="rounded-lg bg-danger-faible px-3 py-2 text-xs text-danger">{erreur}</p>}
        </>
        )}
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

/**
 * Une section facultative de création manuelle : son titre, sa zone, sa palette.
 *
 * Composant à part parce qu'il lui faut une `ref` par section — un `useRef`
 * dans la boucle de rendu du parent serait un appel de hook conditionnel
 * (même raison que `SectionFicheSaisie`, dans l'espace documentaire).
 */
function SectionCreation({
  section,
  valeur,
  onChange,
  obligatoire = false,
  rows = 3,
  placeholder,
}: {
  section: string;
  valeur: string;
  onChange: (texte: string) => void;
  obligatoire?: boolean;
  rows?: number;
  placeholder?: string;
}) {
  const champ = useRef<HTMLTextAreaElement>(null);
  return (
    <label className="block">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-texte">
          {section}{!obligatoire && <span className="font-normal text-texte-discret"> (facultatif)</span>}
        </span>
        <PaletteFormulesTexte champ={champ} valeur={valeur} onChange={onChange} />
      </div>
      <textarea
        ref={champ}
        value={valeur}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        className="mt-1.5 w-full resize-none rounded-lg border border-bordure-controle bg-surface px-3 py-2 text-sm outline-none transition-colors placeholder:text-texte-discret focus:border-primaire focus:ring-1 focus:ring-primaire/20"
        placeholder={placeholder ?? `Contenu de la section « ${section} »`}
      />
      <div className="mt-2">
        <ApercuFormulesTexte valeur={valeur} />
      </div>
    </label>
  );
}
