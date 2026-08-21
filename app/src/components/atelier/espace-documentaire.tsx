"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Markdown } from "@/components/ui/markdown";
import { cx } from "@/components/ui/primitives";
import dynamic from "next/dynamic";
import { IconeFleche, IconeRecherche } from "@/components/ui/icones";
import { IconeDocument } from "@/components/ui/icone-document";
import { createNavigateurClient } from "@/lib/supabase/client";
import { analyserDocumentMarkdown } from "@/lib/documents/markdown";
import {
  documentEnLectureSeule,
  estDocumentPreuve,
  estFicheExercice,
} from "@/lib/documents/nature-document";
import { formatDateCourte } from "@/lib/engine/dates";
import {
  separerFrontMatterEtCorps,
  recomposerDocumentComplet,
  domVersMarkdown,
  detecterEtatFormatage,
  ETAT_FORMATAGE_DEFAUT,
  type EtatFormatage,
} from "@/lib/documents/wysiwyg-markdown";
import { BUCKET_PIECES_JOINTES, MAX_PDF_OCTETS, MIME_PDF, nomPdfValide } from "@/lib/documents/pieces-jointes";
import type { DonneesGraphe } from "@/lib/domain/graphe";
import { urlComposerAutonome } from "@/lib/domain/navigation-exercice";
/*
 * Le graphe (et `d3-force` avec lui) ne voyage que quand la vue graphe est
 * ouverte : en import statique, son chunk partait avec l'atelier pour tout le
 * monde, consulté ou non.
 */
const GrapheCompetences = dynamic(
  () =>
    import("@/components/competences/graphe/graphe-competences").then(
      (m) => m.GrapheCompetences,
    ),
  {
    loading: () => (
      <div className="grid flex-1 place-items-center text-sm text-texte-attenue">
        Préparation du graphe…
      </div>
    ),
  },
);
import {
  definitionTypeDocument,
  natureSnapshot,
  type PieceJointeDocument,
  type SnapshotDocument,
} from "@/lib/documents/types-documents";
import {
  lireDocumentAction,
  lirePiecesJointesAction,
  preparerTeleversementPdfAction,
  enregistrerPieceJointeAction,
  annulerTeleversementPdfAction,
  lireSnapshotAction,
  sauvegarderDocumentAction,
  supprimerPieceJointeAction,
  supprimerDocumentAction,
} from "@/lib/store/document-actions";
import type {
  EntretienDomaineAtelier,
  VueDomaineAtelier,
  VueCompetenceAtelier,
} from "@/lib/documents/vue-atelier";
import {
  FichePedagogiqueAtelier,
  PanneauPedagogiqueAtelier,
  panneauPedagogiqueUtile,
} from "./fiche-pedagogique";
import type { CalibrageModale, CompetenceModale } from "@/lib/domain/proprietes-generation";
import type { DonneesSeance } from "@/components/seances/concepteur-seance";
import { rangerDocument, type RangementAtelier } from "@/lib/documents/rangement-atelier";
import { EditeurDirect } from "./editeur-document";
import { VueTousLesDomaines, BarreVuesAtelier, type VueAtelier } from "./vues-synthese-atelier";
import { VueRessources } from "./vues-ressources-atelier";
import { PanneauExerciceAtelier } from "./panneaux-document-atelier";
import { LIBELLES_TRIS_DOMAINES, type TriDomaine } from "@/lib/documents/tri-domaines";
import type { ElementAtelier } from "./types-atelier";

export type { ElementAtelier };

/**
 * Une fiche capturée par la personne, par opposition à une projection ou à une
 * production du système. C'est le seul ensemble qu'elle peut supprimer — et
 * seulement tant qu'aucune version figée ne s'y attache.
 */
function estNoteCapturee(element: ElementAtelier): boolean {
  const role = element.frontMatter.role;
  return element.source === "document" && (role === "support" || role === "operationnel");
}

/**
 * Formate proprement une date liée au document en exploitant les différentes sources
 * possibles (updatedAt, frontmatter created_at / produced_at, ou date du premier snapshot).
 */
function formaterDateDocument(element: ElementAtelier): string | null {
  const dateStr =
    element.updatedAt ||
    (typeof element.frontMatter.created_at === "string" ? element.frontMatter.created_at : null) ||
    (typeof element.frontMatter.produced_at === "string" ? element.frontMatter.produced_at : null) ||
    element.snapshots[0]?.capturedAt ||
    null;

  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return formatDateCourte(dateStr);
  } catch {
    return null;
  }
}

function documentDepuisAnalyse(
  document: ReturnType<typeof analyserDocumentMarkdown>,
  rangementPrecedent?: RangementAtelier,
): ElementAtelier {
  const definition = document.type ? definitionTypeDocument(document.type) : null;
  const estPreuve = estDocumentPreuve(document);
  /*
   * Les rattachements ne se recalculent pas côté client : ils viennent des
   * liens résolus par le serveur contre le référentiel du compte. Réécrire
   * `rangement` depuis le seul Markdown ferait tomber la ressource dans « à
   * trier » à chaque enregistrement, alors qu'elle cite bien des compétences.
   */
  const rangement = rangementPrecedent ?? rangerDocument({
    estPreuve,
    role: document.frontMatter.role,
    competencesCitees: [],
  });
  return {
    id: document.id,
    titre: document.titre,
    type: document.type ?? (estPreuve ? "preuve" : "document"),
    typeLibelle: definition?.libelle ?? (estPreuve ? "Preuve" : document.type ?? "Document"),
    categorie: definition?.categorie ?? (estPreuve ? "action" : "connaissance"),
    rangement,
    contenuMd: document.contenuMd,
    contenuCharge: true,
    schemaCompatible: document.schemaCompatible,
    frontMatter: document.frontMatter,
    liens: document.liens,
    sortants: [],
    entrants: [],
    snapshots: [],
    tentatives: [],
    source: "document",
    lectureSeule: documentEnLectureSeule(document),
  };
}

/**
 * Les vues de l'Atelier, qui ne sont pas des fiches.
 *
 * `transversal` a disparu avec le second classement qu'il ouvrait ; `themes` et
 * `ressources` prennent sa place, et chacun ne montre qu'une seule famille
 * d'objets.
 */
const VUES_ATELIER = new Set<string>([
  "domaines",
  "ressources",
  "graphe",
  "domaines-archives",
]);

const TITRES_VUES: Record<string, string> = {
  domaines: "Domaines",
  ressources: "Ressources",
  graphe: "Graphe",
  "domaines-archives": "Domaines archivés",
};

/**
 * Le retour, qui remplace le fil d'Ariane.
 *
 * Le fil d'Ariane dépliait `Domaines / Algèbre / Compétences / Fondamentaux` —
 * quatre segments dont trois n'existaient que dans le code qui venait de les
 * calculer. Il ne reste que ce que la base sait dire : la zone d'où l'on vient,
 * et le domaine quand il y en a un.
 *
 * C'est **le seul** retour de l'Atelier : les fiches en rendaient un second,
 * collant, quatre rems plus bas. Sur un domaine, le premier ne pouvait rien
 * faire — `rangement.domaineId` d'un domaine est le domaine lui-même, donc
 * « Retour au domaine » ramenait à l'écran affiché. Un domaine remonte
 * maintenant à sa liste, et une fiche nomme le domaine où elle vit.
 */
function RetourAtelier({
  element,
  ouvrirElement,
  changerVue,
}: {
  element: ElementAtelier;
  ouvrirElement: (id: string) => void;
  changerVue: (vue: VueAtelier) => void;
}) {
  const vue = element.vuePedagogique;
  const { zone, domaineId } = element.rangement;

  /*
   * La destination se lit d'abord sur la vue pédagogique, qui sait de quel
   * objet il s'agit ; `rangement` ne sert que pour les documents bruts.
   */
  const cible = (() => {
    if (vue?.kind === "domaine") {
      /* `domaines-archives` est une vue de l'Atelier sans onglet : elle passe par `ouvrirElement`. */
      const liste = vue.domaine.archive ? "domaines-archives" : "domaines";
      return {
        libelle: vue.domaine.archive ? "Domaines archivés" : "Domaines",
        action: () => ouvrirElement(liste),
      };
    }
    if (vue?.kind === "competence") {
      return {
        libelle: vue.domaineNom,
        action: () => ouvrirElement(`domaine:${vue.domaineId}`),
      };
    }
    if (vue?.kind === "exercice") {
      return {
        libelle: vue.domaineNom,
        action: () => ouvrirElement(`domaine:${vue.domaineId}`),
      };
    }
    if (zone === "domaine" && domaineId) {
      return {
        libelle: "Retour au domaine",
        action: () => ouvrirElement(`domaine:${domaineId}`),
      };
    }
    if (zone === "ressource") {
      return {
        libelle: "Retour aux ressources",
        action: () => changerVue("ressources"),
      };
    }
    return {
      libelle: "Retour aux domaines",
      action: () => changerVue("domaines"),
    };
  })();

  return (
    <div className="flex min-w-0 items-center">
      <button
        type="button"
        onClick={cible.action}
        className="flex shrink-0 items-center gap-1.5 rounded-lg border border-bordure-controle bg-surface px-2.5 py-1.5 text-xs font-medium text-texte-attenue transition-colors hover:text-texte cursor-pointer"
      >
        <span aria-hidden>←</span>
        <span className="max-w-[12rem] truncate">{cible.libelle}</span>
      </button>
    </div>
  );
}

function trouverElement(id: string, liste: ElementAtelier[]): ElementAtelier | undefined {
  if (!id) return undefined;
  if (VUES_ATELIER.has(id)) {
    const titre = TITRES_VUES[id] ?? "Domaines";
    return {
      id,
      titre,
      type: "liste-domaines",
      typeLibelle: titre,
      categorie: "connaissance",
      rangement: { zone: "domaine", rattachements: [] },
      contenuMd: "",
      contenuCharge: true,
      frontMatter: {},
      liens: [],
      sortants: [],
      entrants: [],
      snapshots: [],
      tentatives: [],
      source: "projection",
      lectureSeule: true,
    };
  }
  const cleanId = id.replace(/^(competence|document|exercice|domaine):/, "");
  return liste.find((element) => {
    const elementCleanId = element.id.replace(/^(competence|document|exercice|domaine):/, "");
    return (
      element.id === id ||
      elementCleanId === cleanId ||
      element.id === `exercice:${cleanId}` ||
      element.id === `domaine:${cleanId}` ||
      element.id === `competence:${cleanId}` ||
      element.id === `document:${cleanId}` ||
      element.frontMatter?.exercice === cleanId ||
      element.frontMatter?.exercice === id
    );
  });
}

export function EspaceDocumentaire({
  elements: elementsInitials,
  couleursDomaines,
  documentDemande,
  graphe,
  generation,
  donneesSeance,
  entretien,
}: {
  elements: ElementAtelier[];
  /** Teinte par domaine, partagée avec le graphe pour qu'un domaine ait une seule couleur. */
  couleursDomaines: Record<string, string>;
  documentDemande?: string;
  graphe: { donnees: DonneesGraphe; compteId: string };
  generation: { competences: CompetenceModale[]; calibrages: Record<string, CalibrageModale> };
  donneesSeance?: DonneesSeance;
  entretien: EntretienDomaineAtelier;
}) {
  const router = useRouter();
  const [elements, setElements] = useState(elementsInitials);

  useEffect(() => {
    // Le routeur remplace cette projection après une mutation serveur ; l'état local
    // doit alors abandonner sa copie optimiste au profit de la nouvelle vérité serveur.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setElements(elementsInitials);
  }, [elementsInitials]);

  const onArchiverDomaine = useCallback((domaineId: string) => {
    setElements((anciens) => {
      const codesDuDomaine = new Set<string>();
      for (const el of anciens) {
        if (
          el.type === "domaine" &&
          el.vuePedagogique &&
          (el.vuePedagogique as VueDomaineAtelier).domaine.id === domaineId
        ) {
          const vue = el.vuePedagogique as VueDomaineAtelier;
          vue.competences.forEach((c) => codesDuDomaine.add(c.code));
        }
      }

      return anciens.map((el) => {
        // Domaine lui-même
        if (
          el.type === "domaine" &&
          el.vuePedagogique &&
          (el.vuePedagogique as VueDomaineAtelier).domaine.id === domaineId
        ) {
          const vue = el.vuePedagogique as VueDomaineAtelier;
          return {
            ...el,
            frontMatter: { ...el.frontMatter, archive: true },
            vuePedagogique: {
              ...vue,
              domaine: { ...vue.domaine, archive: true },
            },
          };
        }

        // Compétence de ce domaine
        if (el.type === "competence" && el.domaineId === domaineId) {
          return {
            ...el,
            frontMatter: { ...el.frontMatter, archive: true },
          };
        }

        // Ressource / Document de ce domaine ou dont toutes les compétences citées sont dans ce domaine
        if (
          el.domaineId === domaineId ||
          (el.type === "document" &&
            el.sortants.length > 0 &&
            el.sortants.every((c) => codesDuDomaine.has(c)))
        ) {
          return {
            ...el,
            frontMatter: { ...el.frontMatter, archive: true },
          };
        }

        return el;
      });
    });
  }, []);

  const onRestaurerDomaine = useCallback((domaineId: string) => {
    setElements((anciens) => {
      const codesDuDomaine = new Set<string>();
      for (const el of anciens) {
        if (
          el.type === "domaine" &&
          el.vuePedagogique &&
          (el.vuePedagogique as VueDomaineAtelier).domaine.id === domaineId
        ) {
          const vue = el.vuePedagogique as VueDomaineAtelier;
          vue.competences.forEach((c) => codesDuDomaine.add(c.code));
        }
      }

      return anciens.map((el) => {
        // Domaine lui-même
        if (
          el.type === "domaine" &&
          el.vuePedagogique &&
          (el.vuePedagogique as VueDomaineAtelier).domaine.id === domaineId
        ) {
          const vue = el.vuePedagogique as VueDomaineAtelier;
          return {
            ...el,
            frontMatter: { ...el.frontMatter, archive: false },
            vuePedagogique: {
              ...vue,
              domaine: { ...vue.domaine, archive: false },
            },
          };
        }

        // Compétence de ce domaine
        if (el.type === "competence" && el.domaineId === domaineId) {
          return {
            ...el,
            frontMatter: { ...el.frontMatter, archive: false },
          };
        }

        // Ressource / Document de ce domaine ou dont les compétences sont dans ce domaine
        if (
          el.domaineId === domaineId ||
          (el.type === "document" &&
            el.sortants.length > 0 &&
            el.sortants.every((c) => codesDuDomaine.has(c)))
        ) {
          return {
            ...el,
            frontMatter: { ...el.frontMatter, archive: false },
          };
        }

        return el;
      });
    });
  }, []);

  const onSupprimerDomaine = useCallback((domaineId: string) => {
    setElements((anciens) =>
      anciens.filter(
        (el) =>
          !(
            el.type === "domaine" &&
            el.vuePedagogique &&
            (el.vuePedagogique as VueDomaineAtelier).domaine.id === domaineId
          ),
      ),
    );
  }, []);

  const onArchiverDocument = useCallback((docId: string) => {
    setElements((anciens) =>
      anciens.map((el) => {
        if (el.id === docId) {
          return {
            ...el,
            frontMatter: { ...el.frontMatter, archive: true },
          };
        }
        return el;
      }),
    );
  }, []);

  const onRestaurerDocument = useCallback((docId: string) => {
    setElements((anciens) =>
      anciens.map((el) => {
        if (el.id === docId) {
          return {
            ...el,
            frontMatter: { ...el.frontMatter, archive: false },
          };
        }
        return el;
      }),
    );
  }, []);

  const onSupprimerDocument = useCallback((docId: string) => {
    setElements((anciens) => anciens.filter((el) => el.id !== docId));
  }, []);
  const selectionInitiale = useMemo(() => {
    if (documentDemande) {
      if (VUES_ATELIER.has(documentDemande)) return documentDemande;
      return trouverElement(documentDemande, elementsInitials)?.id ?? "domaines";
    }
    /*
      L'Atelier ouvre sur le corpus, pas sur un écran d'accueil.

      Il en avait un — la vue de croissance : activité de la semaine, paliers
      franchis, ensembles en construction. C'était un bilan, et un bilan répond
      à « où j'en suis », pas à « où est ma note ». On y arrivait pour consulter
      ses fiches et on lisait d'abord un résumé de ce qu'on avait fait, avant de
      pouvoir cliquer vers ce qu'on cherchait. Ce bilan vit maintenant sur
      `/progression`, avec les autres lectures de la même famille.

      Reste ce pour quoi on ouvre l'Atelier : les domaines et, dessous, les
      compétences, les exercices et les notes.
    */
    return "domaines";
  }, [documentDemande, elementsInitials]);
  const [selection, setSelection] = useState<string | null>(selectionInitiale);
  const [brouillons, setBrouillons] = useState<Record<string, string>>({});
  const [snapshotApercu, setSnapshotApercu] = useState<SnapshotDocument | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [enCours, demarrerTransition] = useTransition();
  const editeurRef = useRef<HTMLDivElement>(null);
  const [etatFormatage, setEtatFormatage] = useState<EtatFormatage>(ETAT_FORMATAGE_DEFAUT);

  const rafraichirEtatFormatage = useCallback(() => {
    if (!editeurRef.current) {
      setEtatFormatage(ETAT_FORMATAGE_DEFAUT);
      return;
    }
    setEtatFormatage(detecterEtatFormatage(editeurRef.current));
  }, []);

  /*
   * Plus d'état de dossiers ouverts.
   *
   * L'explorateur de gauche gardait, par compte et dans `localStorage`, la
   * liste des dossiers dépliés — avec son abonnement `storage`, son
   * `useSyncExternalStore` et un effet d'auto-expansion vers l'élément
   * sélectionné. Toute cette machinerie servait un arbre entièrement **dérivé**
   * des fiches : `Domaines/X/Compétences/Palier` n'existe nulle part en base,
   * c'est `cheminsDepuisDefinition` qui le calcule à chaque rendu. On
   * mémorisait donc la position d'un utilisateur dans un classement qu'il n'a
   * pas fait, et qui se réorganise dès qu'une fiche change de type.
   *
   * Ce que l'arbre servait vraiment — retrouver une fiche — est repris par la
   * recherche, qui rend maintenant ses résultats à plat.
   */
  const [recherche, setRecherche] = useState("");
  const [triDomaines, setTriDomaines] = useState<TriDomaine>("recent");
  const [statutFiltre, setStatutFiltre] = useState<"actifs" | "archives">(
    selectionInitiale === "domaines-archives" ? "archives" : "actifs",
  );
  const [contexteOuvert, setContexteOuvert] = useState(false);
  const [panneauDroitVisible, setPanneauDroitVisible] = useState(true);
  const [cibleLien, setCibleLien] = useState("");
  const [piecesJointesParDocument, setPiecesJointesParDocument] = useState<Record<string, PieceJointeDocument[]>>({});

  const selectionnee =
    selection && VUES_ATELIER.has(selection)
      ? null
      : selection
      ? (trouverElement(selection, elements) ?? null)
      : null;
  const selectionId = selectionnee?.id;
  /*
   * Le volet de contexte ne se montre que s'il a un contenu propre. Sur une
   * fiche compétence il ne faisait que redire la fiche : ni le cadre, ni les
   * boutons qui l'ouvrent n'ont lieu d'être.
   */
  const contexteDisponible = Boolean(
    selectionnee &&
      (!selectionnee.vuePedagogique || panneauPedagogiqueUtile(selectionnee.vuePedagogique)),
  );
  const role = selectionnee?.frontMatter?.role;
  const roleLibelle = role === "support" ? "Support" : role === "operationnel" ? "Opérationnel" : null;
  const dateAffichee = selectionnee ? formaterDateDocument(selectionnee) : null;
  const brouillon = selectionnee ? brouillons[selectionnee.id] ?? selectionnee.contenuMd : "";

  const estModifie = Boolean(
    selectionnee &&
    !selectionnee.lectureSeule &&
    selectionnee.contenuCharge &&
    selectionnee.source === "document" &&
    brouillon !== selectionnee.contenuMd,
  );

  // Avertissement de perte de modifications non enregistrées
  useEffect(() => {
    if (!estModifie) return;
    const avertir = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", avertir);
    return () => window.removeEventListener("beforeunload", avertir);
  }, [estModifie]);

  // Raccourci clavier global Ctrl+K / Cmd+K pour la recherche dans l'Atelier
  useEffect(() => {
    const surClavier = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        // Le champ est désormais toujours monté : plus besoin d'ouvrir quoi que
        // ce soit avant de lui donner le focus.
        const inputRecherche = document.getElementById("recherche-atelier");
        if (inputRecherche) {
          inputRecherche.focus();
          (inputRecherche as HTMLInputElement).select();
        }
      }
    };
    window.addEventListener("keydown", surClavier);
    return () => window.removeEventListener("keydown", surClavier);
  }, []);
  const liensCourants = selectionnee
    ? selectionnee.contenuCharge
      ? analyserDocumentMarkdown(selectionnee.id, brouillon).liens
      : selectionnee.liens
    : [];
  const fichesLiables = elements
    .filter((element) => element.id !== selectionId && !VUES_ATELIER.has(element.id))
    .sort((a, b) => a.titre.localeCompare(b.titre, "fr"));
  const documentSupportId = selectionnee?.frontMatter.role === "support" ? selectionnee.id : null;

  useEffect(() => {
    let actif = true;
    if (!documentSupportId) return () => { actif = false; };
    void lirePiecesJointesAction(documentSupportId)
      .then((pieces) => {
        if (actif) setPiecesJointesParDocument((anciens) => ({ ...anciens, [documentSupportId]: pieces }));
      })
      .catch((erreur: unknown) => {
        if (actif) setMessage(erreur instanceof Error ? erreur.message : "Lecture des PDF impossible");
      });
    return () => { actif = false; };
  }, [documentSupportId]);

  const piecesJointes = documentSupportId ? piecesJointesParDocument[documentSupportId] : undefined;

  const elementsVisibles = useMemo(() => {
    const terme = recherche.trim().toLocaleLowerCase("fr-FR");
    if (!terme) return elements;
    return elements.filter((element) => {
      const tags = element.frontMatter.tags;
      const texteTags = Array.isArray(tags) ? tags.join(" ") : typeof tags === "string" ? tags : "";
      return [element.titre, element.id, element.typeLibelle, texteTags]
        .join(" ")
        .toLocaleLowerCase("fr-FR")
        .includes(terme);
    });
  }, [elements, recherche]);

  const chargerContenuDocument = useCallback((elementId: string) => {
    demarrerTransition(async () => {
      try {
        setMessage(null);
        const resultat = await lireDocumentAction(elementId);
        const analyse = analyserDocumentMarkdown(elementId, resultat.contenuMd);
        setElements((anciens) => anciens.map((ancien) => ancien.id === elementId
          ? {
            ...ancien,
            ...documentDepuisAnalyse(analyse, ancien.rangement),
            contenuCharge: true,
            updatedAt: resultat.updatedAt ?? ancien.updatedAt,
            snapshots: ancien.snapshots,
            sortants: ancien.sortants,
            entrants: ancien.entrants,
          }
          : ancien));
        setBrouillons((anciens) => ({ ...anciens, [elementId]: resultat.contenuMd }));
      } catch (erreur) {
        setMessage(erreur instanceof Error ? erreur.message : "Chargement impossible");
      }
    });
  }, []);

  // Synchronisation avec l'historique du navigateur (boutons retour/suivant de la souris et du navigateur)
  useEffect(() => {
    function synchroniserDepuisHistorique() {
      if (typeof window === "undefined") return;
      const params = new URLSearchParams(window.location.search);
      const docParam = params.get("document");
      if (docParam) {
        const el = trouverElement(docParam, elements);
        setSelection(el ? el.id : docParam);
        if (docParam === "domaines-archives") {
          setStatutFiltre("archives");
        } else if (docParam === "domaines") {
          setStatutFiltre("actifs");
        }
      } else {
        setSelection("domaines");
        setStatutFiltre("actifs");
      }
      setCibleLien("");
      setSnapshotApercu(null);
    }
    window.addEventListener("popstate", synchroniserDepuisHistorique);
    return () => window.removeEventListener("popstate", synchroniserDepuisHistorique);
  }, [elements]);

  useEffect(() => {
    if (!selection) return;
    const element = elements.find((el) => el.id === selection);
    if (element && element.source !== "projection" && !element.contenuCharge) {
      chargerContenuDocument(element.id);
    }
  }, [selection, elements, chargerContenuDocument]);

  /**
   * Bascule entre les quatre entrées. Le graphe en est une : la même matière,
   * regardée autrement — pas une destination séparée.
   */
  function changerVue(vue: VueAtelier) {
    setSelection(vue);
    if (vue === "domaines") {
      setStatutFiltre("actifs");
    }
    setCibleLien("");
    setSnapshotApercu(null);
    window.history.pushState({ documentId: vue }, "", `/atelier?document=${vue}`);
  }

  function trouverCible(cible: string): ElementAtelier | undefined {
    return trouverElement(cible, elements);
  }

  const vueActuelle =
    !selection || selection === "domaines" || selection === "domaines-archives"
      ? "domaines"
      : selection;

  const { nbActifs, nbArchives } = useMemo(() => {
    if (vueActuelle === "domaines") {
      const domainesList = elements.filter((el) => el.type === "domaine" && el.vuePedagogique);
      const actifs = domainesList.filter(
        (el) => !(el.vuePedagogique as VueDomaineAtelier).domaine.archive,
      ).length;
      const archives = domainesList.filter(
        (el) => (el.vuePedagogique as VueDomaineAtelier).domaine.archive,
      ).length;
      return { nbActifs: actifs, nbArchives: archives };
    }

    if (vueActuelle === "ressources") {
      const resList = elements.filter((el) => el.rangement.zone === "ressource");
      const actifs = resList.filter((el) => !el.frontMatter.archive).length;
      const archives = resList.filter((el) => Boolean(el.frontMatter.archive)).length;
      return { nbActifs: actifs, nbArchives: archives };
    }

    return { nbActifs: 0, nbArchives: 0 };
  }, [elements, vueActuelle]);

  const competencesParCode = useMemo(() => {
    const map = new Map<string, { intitule: string; domaine: string }>();
    elements
      .filter((el) => el.type === "competence" && el.vuePedagogique)
      .forEach((el) => {
        const v = el.vuePedagogique as VueCompetenceAtelier;
        map.set(v.code, { intitule: el.titre, domaine: v.domaineNom });
      });
    return map;
  }, [elements]);

  function ouvrirElement(id: string, opts?: { remplacerHistorique?: boolean } | unknown) {
    if (VUES_ATELIER.has(id)) {
      changerVue(id as VueAtelier);
      return;
    }

    const element = trouverElement(id, elements);
    if (!element) {
      const cleanId = id.replace(/^(exercice|document):/, "");
      if (id.startsWith("exercice:") || /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(cleanId)) {
        router.push("/seances");
      }
      return;
    }

    setSelection(element.id);
    setCibleLien("");
    setSnapshotApercu(null);
    const nouvelleUrl = `/atelier?document=${encodeURIComponent(element.id)}`;
    const remplacer = typeof opts === "object" && opts !== null && "remplacerHistorique" in opts && Boolean((opts as { remplacerHistorique?: boolean }).remplacerHistorique);
    if (remplacer) {
      window.history.replaceState({ documentId: element.id }, "", nouvelleUrl);
    } else {
      window.history.pushState({ documentId: element.id }, "", nouvelleUrl);
    }
    if (element.source === "projection" || element.contenuCharge) return;
    chargerContenuDocument(element.id);
  }

  function ouvrirSnapshot(snapshotId: string) {
    if (!selectionnee) return;
    setMessage(null);
    demarrerTransition(async () => {
      try {
        setSnapshotApercu(await lireSnapshotAction(selectionnee.id, snapshotId));
      } catch (erreur) {
        setMessage(erreur instanceof Error ? erreur.message : "Lecture de la version figée impossible");
      }
    });
  }

  function synchroniserContenu(nouveauCorps?: string) {
    if (!selectionnee) return;
    const corpsActuel = nouveauCorps ?? (editeurRef.current ? domVersMarkdown(editeurRef.current) : "");
    const { frontmatterBrut } = separerFrontMatterEtCorps(brouillon);
    const documentComplet = recomposerDocumentComplet(frontmatterBrut, corpsActuel);
    setBrouillons((anciens) => ({ ...anciens, [selectionnee.id]: documentComplet }));
  }

  function executerFormatage(commande: string, valeur?: string) {
    if (!selectionnee || selectionnee.lectureSeule) return;
    editeurRef.current?.focus();
    document.execCommand(commande, false, valeur);
    synchroniserContenu();
  }

  function gererRaccourcisClavier(event: React.KeyboardEvent<HTMLDivElement>) {
    if ((event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey) {
      if (event.key === "b" || event.key === "B") {
        event.preventDefault();
        executerFormatage("bold");
      } else if (event.key === "i" || event.key === "I") {
        event.preventDefault();
        executerFormatage("italic");
      }
    }
  }

  function ajouterLien() {
    if (!selectionnee || selectionnee.lectureSeule || !selectionnee.contenuCharge || selectionnee.schemaCompatible === false || !cibleLien) return;
    const cible = fichesLiables.find((element) => element.id === cibleLien);
    if (!cible) return;
    if (liensCourants.some((lien) => lien.cible === cible.id)) {
      setMessage(`La fiche « ${cible.titre} » est déjà liée.`);
      return;
    }

    if (editeurRef.current) {
      editeurRef.current.focus();
      const badgeHtml = `<span class="wikilien-badge" data-wikilien="${cible.id}">[[${cible.titre || cible.id}]]</span>&nbsp;`;
      document.execCommand("insertHTML", false, badgeHtml);
      synchroniserContenu();
    } else {
      const base = brouillon.trimEnd();
      setBrouillons((anciens) => ({
        ...anciens,
        [selectionnee.id]: `${base}${base ? "\n\n" : ""}[[${cible.id}]]\n`,
      }));
    }
    setCibleLien("");
    setMessage(`Lien vers « ${cible.titre} » inséré. Enregistre la fiche pour le conserver.`);
  }

  function televerserPdf(event: ChangeEvent<HTMLInputElement>) {
    const fichier = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!fichier || !selectionnee || selectionnee.frontMatter.role !== "support") return;
    if (!nomPdfValide(fichier.name) || (fichier.type && fichier.type !== MIME_PDF)) {
      setMessage("Seuls les fichiers PDF peuvent être attachés.");
      return;
    }
    if (fichier.size <= 0 || fichier.size > MAX_PDF_OCTETS) {
      setMessage("Le PDF doit peser entre 1 octet et 10 Mo.");
      return;
    }

    const documentId = selectionnee.id;
    setMessage("Téléversement du PDF…");
    demarrerTransition(async () => {
      let cheminTeleverse: string | null = null;
      try {
        const client = createNavigateurClient();
        if (!client) throw new Error("Supabase n'est pas configuré.");
        const preparation = await preparerTeleversementPdfAction(documentId, fichier.name);
        cheminTeleverse = preparation.chemin;
        const { error } = await client.storage
          .from(BUCKET_PIECES_JOINTES)
          .uploadToSignedUrl(preparation.chemin, preparation.token, fichier, { contentType: MIME_PDF });
        if (error) throw error;
        const piece = await enregistrerPieceJointeAction(documentId, preparation.chemin, fichier.name, fichier.size);
        setPiecesJointesParDocument((anciens) => ({
          ...anciens,
          [documentId]: [piece, ...(anciens[documentId] ?? [])],
        }));
        setMessage("PDF attaché.");
      } catch (erreur) {
        if (cheminTeleverse) {
          try {
            await annulerTeleversementPdfAction(documentId, cheminTeleverse);
          } catch {
            // Le nettoyage reste une tentative secondaire : l'erreur initiale
            // est plus utile à la personne qui vient de téléverser le fichier.
          }
        }
        setMessage(erreur instanceof Error ? erreur.message : "Téléversement du PDF impossible");
      }
    });
  }

  function supprimerPieceJointe(piece: PieceJointeDocument) {
    if (!selectionnee || selectionnee.frontMatter.role !== "support") return;
    if (!window.confirm(`Supprimer le PDF « ${piece.nom} » ?`)) return;
    const documentId = selectionnee.id;
    setMessage(null);
    demarrerTransition(async () => {
      try {
        await supprimerPieceJointeAction(documentId, piece.id);
        setPiecesJointesParDocument((anciens) => ({
          ...anciens,
          [documentId]: (anciens[documentId] ?? []).filter((ancienne) => ancienne.id !== piece.id),
        }));
        setMessage("PDF supprimé.");
      } catch (erreur) {
        setMessage(erreur instanceof Error ? erreur.message : "Suppression du PDF impossible");
      }
    });
  }

  function supprimerNoteSupport() {
    if (!selectionnee || !estNoteCapturee(selectionnee)) return;
    if (!window.confirm(`Supprimer la note « ${selectionnee.titre} » ? Cette action est définitive.`)) return;
    setMessage(null);
    demarrerTransition(async () => {
      try {
        await supprimerDocumentAction(selectionnee.id);
        setElements((anciens) => anciens.filter((element) => element.id !== selectionnee.id));
        setSelection(null);
        setCibleLien("");
        window.history.replaceState(null, "", "/atelier");
        router.refresh();
      } catch (erreur) {
        setMessage(erreur instanceof Error ? erreur.message : "Suppression impossible");
      }
    });
  }

  function sauvegarder(capturerRevision = true) {
    if (!selectionnee || selectionnee.lectureSeule || !selectionnee.contenuCharge || selectionnee.schemaCompatible === false) return;
    setMessage(null);
    const contenuActuel = editeurRef.current
      ? recomposerDocumentComplet(
          separerFrontMatterEtCorps(brouillon).frontmatterBrut,
          domVersMarkdown(editeurRef.current),
        )
      : brouillon;

    demarrerTransition(async () => {
      try {
        const resultat = await sauvegarderDocumentAction(
          selectionnee.id,
          contenuActuel,
          capturerRevision,
          selectionnee.updatedAt,
        );
        const analyse = analyserDocumentMarkdown(selectionnee.id, contenuActuel);
        setElements((anciens) => anciens.map((element) => {
          if (element.id !== selectionnee.id) return element;
          const nouveauxSnapshots = resultat?.snapshot
            ? [resultat.snapshot, ...element.snapshots.filter((s) => s.id !== resultat.snapshot!.id)]
            : element.snapshots;
          return {
            ...element,
            ...documentDepuisAnalyse(analyse, element.rangement),
            contenuCharge: true,
            contenuMd: contenuActuel,
            ...(resultat?.updatedAt ? { updatedAt: resultat.updatedAt } : {}),
            snapshots: nouveauxSnapshots,
          };
        }));
        setBrouillons((anciens) => ({ ...anciens, [selectionnee.id]: contenuActuel }));
        setMessage(
          resultat
            ? resultat.revisionFigee
              ? `Document enregistré · révision v${resultat.version} figée`
              : "Document enregistré"
            : "Aucun changement à enregistrer",
        );
        router.refresh();
      } catch (erreur) {
        setMessage(erreur instanceof Error ? erreur.message : "Enregistrement impossible");
      }
    });
  }

  return (
    <section className="relative -mx-2 flex flex-col overflow-hidden rounded-xl border border-bordure bg-surface shadow-[var(--ombre-levee)] lg:-mx-6 2xl:-mx-8 lg:h-[calc(100vh-12.5rem)] lg:min-h-[34rem]">
      {contexteOuvert && contexteDisponible && (
        <button
          type="button"
          className="fixed inset-0 z-[var(--superposition-tiroir)] bg-black/35 backdrop-blur-[1px] 2xl:hidden"
          onClick={() => setContexteOuvert(false)}
          aria-label="Fermer le panneau de contexte"
        />
      )}
      {/*
        Barre supérieure de navigation et de recherche unifiée de l'Atelier.
        Elle réunit les modes de vue (Domaines, Thèmes, Ressources, Graphe)
        ou le retour vers le corpus, ainsi qu'un champ de recherche compact avec raccourci Ctrl+K.
      */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-bordure bg-surface px-4 py-2.5 shrink-0 min-h-[3.5rem]">
        {!selectionnee ? (
          <div className="flex items-center gap-3">
            <BarreVuesAtelier
              vue={
                (["domaines", "ressources", "graphe"].includes(
                  selection ?? "",
                )
                  ? selection
                  : "domaines") as VueAtelier
              }
              onChanger={changerVue}
            />
          </div>
        ) : (
          <RetourAtelier
            element={selectionnee}
            ouvrirElement={ouvrirElement}
            changerVue={changerVue}
          />
        )}

        <div className="flex items-center gap-2.5 min-w-0">
          {!selectionnee && (vueActuelle === "domaines" || vueActuelle === "ressources") && (
            <div className="flex items-center gap-2">
              {vueActuelle === "domaines" && (
                <div className="flex items-center gap-1.5 shrink-0 text-xs">
                  <label htmlFor="tri-domaines-top" className="text-texte-discret hidden md:inline text-xs">
                    Trier par :
                  </label>
                  <select
                    id="tri-domaines-top"
                    value={triDomaines}
                    onChange={(e) => setTriDomaines(e.target.value as TriDomaine)}
                    className="rounded-lg border border-bordure bg-surface px-2.5 py-1.5 text-xs font-medium text-texte transition-colors hover:border-primaire/40 focus:border-primaire focus:outline-hidden cursor-pointer"
                  >
                    {Object.entries(LIBELLES_TRIS_DOMAINES).map(([cle, libelle]) => (
                      <option key={cle} value={cle}>
                        {libelle}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div
                className="flex items-center gap-1 rounded-lg border border-bordure bg-surface-2 p-1 text-xs shrink-0"
                role="tablist"
                aria-label="Statut"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={statutFiltre === "actifs"}
                  onClick={() => {
                    setStatutFiltre("actifs");
                    if (selection === "domaines-archives") {
                      changerVue("domaines");
                    }
                  }}
                  className={cx(
                    "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all cursor-pointer",
                    statutFiltre === "actifs"
                      ? "bg-surface text-primaire shadow-xs font-semibold"
                      : "text-texte-discret hover:text-texte hover:bg-surface/50",
                  )}
                >
                  <span>Actifs</span>
                  <span className="rounded-full bg-surface-3 px-1.5 py-0.2 text-[10px] font-mono text-texte-discret">
                    {nbActifs}
                  </span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={statutFiltre === "archives"}
                  onClick={() => {
                    setStatutFiltre("archives");
                    if (selection === "domaines" || !selection) {
                      changerVue("domaines-archives" as VueAtelier);
                    }
                  }}
                  className={cx(
                    "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all cursor-pointer",
                    statutFiltre === "archives"
                      ? "bg-surface text-primaire shadow-xs font-semibold"
                      : "text-texte-discret hover:text-texte hover:bg-surface/50",
                  )}
                >
                  <span>Archivés</span>
                  <span className="rounded-full bg-surface-3 px-1.5 py-0.2 text-[10px] font-mono text-texte-discret">
                    {nbArchives}
                  </span>
                </button>
              </div>
            </div>
          )}

          <div className="relative flex items-center">
            <IconeRecherche className="pointer-events-none absolute left-2.5 size-3.5 text-texte-discret" />
            <label className="sr-only" htmlFor="recherche-atelier">
              Rechercher dans l’Atelier (Ctrl+K)
            </label>
            <input
              id="recherche-atelier"
              type="search"
              value={recherche}
              onChange={(event) => setRecherche(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setRecherche("");
                  event.currentTarget.blur();
                }
              }}
              placeholder="Rechercher dans l’Atelier…"
              className="w-52 sm:w-64 lg:w-72 rounded-lg border border-bordure bg-surface-2/60 pl-8 pr-11 py-1.5 text-xs outline-none transition-all placeholder:text-texte-discret focus:w-80 focus:border-primaire focus:bg-surface focus:ring-1 focus:ring-primaire/20"
            />
            {recherche.trim() ? (
              <button
                type="button"
                onClick={() => setRecherche("")}
                className="absolute right-2.5 text-xs text-texte-discret hover:text-texte cursor-pointer"
                title="Effacer la recherche (Échap)"
                aria-label="Effacer la recherche"
              >
                ×
              </button>
            ) : (
              <kbd className="pointer-events-none absolute right-2.5 hidden sm:inline-flex items-center rounded border border-bordure/70 bg-surface px-1.5 py-0.5 text-[10px] font-medium text-texte-discret">
                ⌘K
              </kbd>
            )}
          </div>

          {recherche.trim() ? (
            <span className="hidden sm:inline-flex shrink-0 text-xs font-medium text-primaire">
              {elementsVisibles.length} résultat{elementsVisibles.length > 1 ? "s" : ""}
            </span>
          ) : null}

          {contexteDisponible && (
            <>
              <button
                type="button"
                onClick={() => setContexteOuvert(true)}
                className="flex shrink-0 items-center gap-1.5 rounded-lg border border-bordure-controle bg-surface px-2.5 py-1.5 text-xs font-medium text-texte-attenue transition-colors hover:bg-surface-3 hover:text-texte cursor-pointer 2xl:hidden"
                aria-expanded={contexteOuvert}
                title="Ouvrir le volet de contexte"
              >
                <span>Contexte</span>
                <span aria-hidden>→</span>
              </button>
              {!panneauDroitVisible && (
                <button
                  type="button"
                  onClick={() => setPanneauDroitVisible(true)}
                  className="hidden shrink-0 items-center gap-1.5 rounded-lg border border-bordure-controle bg-surface px-2.5 py-1.5 text-xs font-medium text-texte-attenue transition-colors hover:bg-surface-3 hover:text-texte cursor-pointer 2xl:inline-flex"
                  title="Afficher le volet de contexte"
                >
                  <span>Afficher le contexte</span>
                  <span aria-hidden>→</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/*
        Les résultats se posent **par-dessus** le panneau, ils ne le remplacent
        pas : la vue courante reste en place derrière, et refermer la recherche
        rend exactement l'écran qu'on avait quitté. C'est aussi ce qui garde le
        corps du composant sur une seule branche de rendu — un ternaire
        enveloppant tout le panneau fait renoncer le compilateur React à la
        mémoïsation manuelle qui vit plus haut dans ce fichier.
      */}
      {recherche.trim() && (
        <ResultatsRecherche
          terme={recherche.trim()}
          elements={elementsVisibles}
          couleursDomaines={couleursDomaines}
          ouvrir={(id) => {
            setRecherche("");
            ouvrirElement(id);
          }}
          onFermer={() => setRecherche("")}
        />
      )}

      <div className={cx(
        "flex flex-1 min-h-0 flex-col lg:grid lg:h-full transition-all duration-300",
        contexteDisponible && panneauDroitVisible
          ? "lg:grid-cols-[1fr] 2xl:grid-cols-[minmax(0,1fr)_22rem]"
          : "lg:grid-cols-[1fr]",
      )}>
        <main className="flex h-full min-w-0 flex-1 flex-col min-h-0 overflow-hidden bg-surface">
          {selection === "graphe" ? (
            <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-surface p-4">
              <GrapheCompetences donnees={graphe.donnees} compteId={graphe.compteId} ouvrirElement={ouvrirElement} />
            </div>
          ) : selection === "ressources" ? (
            <VueRessources
              elements={elements}
              ouvrirElement={ouvrirElement}
              changerVue={changerVue}
              competencesParCode={competencesParCode}
              statut={statutFiltre}
              onArchiver={onArchiverDocument}
              onRestaurer={onRestaurerDocument}
              onSupprimer={onSupprimerDocument}
            />
          ) : selection === "domaines" || selection === "domaines-archives" ? (
            <VueTousLesDomaines
              domaines={elements
                .filter((el) => el.type === "domaine" && el.vuePedagogique)
                .filter((el) => {
                  const vue = el.vuePedagogique as VueDomaineAtelier;
                  if (statutFiltre === "archives" || selection === "domaines-archives") return vue.domaine.archive;
                  return !vue.domaine.archive;
                })
                .map((el) => el.vuePedagogique as VueDomaineAtelier)}
              ouvrirElement={ouvrirElement}
              changerVue={changerVue}
              selection={statutFiltre === "archives" || selection === "domaines-archives" ? "domaines-archives" : "domaines"}
              compteId={graphe.compteId}
              tri={triDomaines}
              onArchiver={onArchiverDomaine}
              onRestaurer={onRestaurerDomaine}
              onSupprimer={onSupprimerDomaine}
            />
          ) : selectionnee?.vuePedagogique ? (
            <FichePedagogiqueAtelier
              vue={selectionnee.vuePedagogique}
              titre={selectionnee.titre}
              ouvrirElement={ouvrirElement}
              elements={elements}
              compteId={graphe.compteId}
              generation={generation}
              donneesSeance={donneesSeance}
              entretien={entretien}
              onRestaurerDomaine={onRestaurerDomaine}
            />
          ) : selectionnee ? (
            <>
              {/* Barre d'en-tête du document avec actions épurées */}
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-bordure px-6 py-3.5 shrink-0 bg-surface">
                <div className="min-w-0 space-y-1">
                  {(selectionnee.lectureSeule || selectionnee.schemaCompatible === false) && (
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      {estDocumentPreuve(selectionnee) ? (
                        <span className="rounded-md bg-info-faible px-2 py-0.5 font-medium text-info">
                          Preuve conservée · Lecture seule
                        </span>
                      ) : estFicheExercice(selectionnee) ? (
                        /*
                          Dire où l'énoncé se corrige vraiment : sans cette
                          phrase, « Lecture seule » ressemble à une panne.
                        */
                        <span className="rounded-md bg-info-faible px-2 py-0.5 font-medium text-info">
                          Fiche produite depuis l’exercice · se corrige dans l’exercice
                        </span>
                      ) : selectionnee.lectureSeule ? (
                        <span className="rounded bg-surface-2 px-1.5 py-0.5 text-texte-attenue">
                          Lecture seule
                        </span>
                      ) : null}
                      {selectionnee.schemaCompatible === false && (
                        <span className="rounded bg-alerte-faible px-1.5 py-0.5 font-medium text-alerte">
                          Format non reconnu
                        </span>
                      )}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <h2 className="truncate font-serif text-2xl font-medium tracking-tight text-texte">
                      {selectionnee.titre}
                    </h2>
                    {estModifie && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-alerte-faible px-2.5 py-0.5 text-[0.6875rem] font-medium text-alerte shrink-0" title="Modifications en attente d’enregistrement">
                        <span className="size-1.5 rounded-full bg-alerte" />
                        Non enregistré
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2.5">
                  {message && (
                    <span className="text-xs font-medium text-primaire" aria-live="polite">
                      {message}
                    </span>
                  )}

                  {estNoteCapturee(selectionnee) && (
                    <button
                      type="button"
                      onClick={supprimerNoteSupport}
                      disabled={enCours || selectionnee.snapshots.length > 0}
                      title={selectionnee.snapshots.length > 0 ? "Une version figée protège cette note" : undefined}
                      className="rounded-md border border-danger/35 px-2.5 py-1.5 text-xs font-medium text-danger transition-colors hover:bg-danger-faible disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Supprimer
                    </button>
                  )}

                  {selectionnee.frontMatter.role === "operationnel" && selectionnee.source === "document" && (
                    <Link
                      href={`/atelier?note=${encodeURIComponent(selectionnee.id)}&retour=${encodeURIComponent(`/atelier?document=${encodeURIComponent(selectionnee.id)}`)}`}
                      className="inline-flex items-center gap-1.5 rounded-md bg-primaire px-3 py-1.5 text-xs font-semibold text-texte-inverse shadow-sm hover:bg-primaire-survol transition-colors"
                    >
                      <span>Travailler cette fiche</span>
                      <IconeFleche className="size-3.5" />
                    </Link>
                  )}

                  {selectionnee.type === "exercice" && (
                    <Link
                      href={selectionnee.vuePedagogique?.kind === "exercice"
                        ? urlComposerAutonome(selectionnee.vuePedagogique.competences[0]?.code, selectionnee.vuePedagogique.dureeEstimeeMin)
                        : "/seances"}
                      className="inline-flex items-center gap-1.5 rounded-md bg-primaire px-3 py-1.5 text-xs font-semibold text-texte-inverse shadow-sm hover:bg-primaire-survol transition-colors"
                    >
                      <span>S’exercer dans le cahier</span>
                      <span aria-hidden>→</span>
                    </Link>
                  )}

                  {!selectionnee.lectureSeule && selectionnee.contenuCharge && selectionnee.schemaCompatible !== false && !snapshotApercu && (
                    <button
                      type="button"
                      onClick={() => sauvegarder(true)}
                      disabled={enCours || brouillon === selectionnee.contenuMd}
                      className="rounded-md bg-primaire px-3.5 py-1.5 text-xs font-semibold text-texte-inverse shadow-sm hover:bg-primaire-survol disabled:cursor-not-allowed disabled:opacity-50 transition-colors cursor-pointer"
                    >
                      {enCours ? "Enregistrement…" : "Enregistrer"}
                    </button>
                  )}
                </div>
              </div>

              {/* Corps principal : Éditeur Document Direct */}
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-surface">
                {/* Zone de document éditable en direct */}
                <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
                  {!selectionnee.contenuCharge && selectionnee.source === "document" ? (
                    <div className="flex h-full min-h-[20rem] items-center justify-center rounded-md border border-bordure bg-surface-2 p-5 text-sm text-texte-discret" aria-live="polite">
                      Chargement de la fiche…
                    </div>
                  ) : snapshotApercu ? (
                    <div className="prose-exo min-h-full rounded-lg border border-primaire/30 bg-surface-2/60 p-5 shadow-xs">
                      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-bordure/60 pb-3 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="rounded bg-primaire/15 px-2 py-0.5 font-semibold text-primaire">
                            Archive v{snapshotApercu.version}
                          </span>
                          <span className="text-texte-discret">
                            {natureSnapshot(snapshotApercu.captureReason) === "preuve" ? "Preuve immuable" : "Révision jalonnée"}
                            {snapshotApercu.capturedAt ? ` · ${snapshotApercu.capturedAt.slice(0, 10)}` : ""}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSnapshotApercu(null)}
                          className="inline-flex items-center gap-1 rounded-md border border-bordure bg-surface px-2.5 py-1 font-medium text-texte transition-colors hover:bg-surface-3 cursor-pointer"
                        >
                          <span>Quitter l’archive</span>
                          <span aria-hidden className="text-texte-discret">×</span>
                        </button>
                      </div>
                      <Markdown contenu={snapshotApercu.contenuMd} />
                    </div>
                  ) : (
                    <div className="relative min-h-full rounded-lg border border-bordure bg-surface focus-within:border-primaire transition-colors">
                      {/* Barre d'outils de formatage direct sticky ancrée sur la bordure supérieure avec glissement au survol */}
                      {!selectionnee.lectureSeule && (
                        <div className="group/toolbar sticky top-0 z-30 flex justify-center -mt-px pt-0 px-3 pointer-events-none transition-all duration-300">
                          <div
                            className={cx(
                              "pointer-events-auto flex items-center gap-1 rounded-full border bg-surface/95 backdrop-blur-md px-3 py-1 shadow-sm transition-all duration-300 -translate-y-1/2 group-hover/toolbar:translate-y-2 group-hover/toolbar:opacity-100 group-hover/toolbar:shadow-xl group-hover/toolbar:border-primaire/50 focus-within:translate-y-2 focus-within:opacity-100 focus-within:border-primaire/50 cursor-default",
                              (etatFormatage.bold || etatFormatage.italic || etatFormatage.h2 || etatFormatage.ul || etatFormatage.ol || etatFormatage.blockquote)
                                ? "opacity-95 translate-y-2 border-primaire/60 shadow-md ring-1 ring-primaire/20"
                                : "opacity-35 hover:opacity-100 border-bordure/80",
                            )}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                executerFormatage("bold");
                                rafraichirEtatFormatage();
                              }}
                              className={cx(
                                "flex size-6 items-center justify-center rounded-full text-xs font-bold transition-colors cursor-pointer",
                                etatFormatage.bold
                                  ? "bg-primaire text-texte-inverse shadow-xs font-bold"
                                  : "text-texte hover:bg-primaire/15 hover:text-primaire",
                              )}
                              title="Gras (Ctrl+B)"
                            >
                              B
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                executerFormatage("italic");
                                rafraichirEtatFormatage();
                              }}
                              className={cx(
                                "flex size-6 items-center justify-center rounded-full text-xs italic font-serif transition-colors cursor-pointer",
                                etatFormatage.italic
                                  ? "bg-primaire text-texte-inverse shadow-xs"
                                  : "text-texte hover:bg-primaire/15 hover:text-primaire",
                              )}
                              title="Italique (Ctrl+I)"
                            >
                              I
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                executerFormatage("formatBlock", "<h2>");
                                rafraichirEtatFormatage();
                              }}
                              className={cx(
                                "flex size-6 items-center justify-center rounded-full text-xs font-semibold transition-colors cursor-pointer",
                                etatFormatage.h2
                                  ? "bg-primaire text-texte-inverse shadow-xs font-semibold"
                                  : "text-texte hover:bg-primaire/15 hover:text-primaire",
                              )}
                              title="Titre H2"
                            >
                              H
                            </button>
                            <div className="h-3.5 w-px bg-bordure mx-0.5" />
                            <button
                              type="button"
                              onClick={() => {
                                executerFormatage("insertUnorderedList");
                                rafraichirEtatFormatage();
                              }}
                              className={cx(
                                "flex size-6 items-center justify-center rounded-full text-xs transition-colors cursor-pointer",
                                etatFormatage.ul
                                  ? "bg-primaire text-texte-inverse shadow-xs"
                                  : "text-texte hover:bg-primaire/15 hover:text-primaire",
                              )}
                              title="Liste à puces"
                            >
                              •
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                executerFormatage("insertOrderedList");
                                rafraichirEtatFormatage();
                              }}
                              className={cx(
                                "flex size-6 items-center justify-center rounded-full text-[0.6875rem] font-medium transition-colors cursor-pointer",
                                etatFormatage.ol
                                  ? "bg-primaire text-texte-inverse shadow-xs font-medium"
                                  : "text-texte hover:bg-primaire/15 hover:text-primaire",
                              )}
                              title="Liste numérotée"
                            >
                              1.
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                executerFormatage("formatBlock", "<blockquote>");
                                rafraichirEtatFormatage();
                              }}
                              className={cx(
                                "flex size-6 items-center justify-center rounded-full text-xs transition-colors cursor-pointer",
                                etatFormatage.blockquote
                                  ? "bg-primaire text-texte-inverse shadow-xs"
                                  : "text-texte hover:bg-primaire/15 hover:text-primaire",
                              )}
                              title="Citation"
                            >
                              ”
                            </button>
                            <div className="h-3.5 w-px bg-bordure mx-0.5" />
                            <button
                              type="button"
                              onClick={() => {
                                const selectionText = window.getSelection()?.toString().trim() || "identifiant";
                                document.execCommand(
                                  "insertHTML",
                                  false,
                                  `<span class="wikilien-badge" data-wikilien="${selectionText}">[[${selectionText}]]</span>&nbsp;`,
                                );
                                synchroniserContenu();
                                rafraichirEtatFormatage();
                              }}
                              className="flex h-6 items-center justify-center rounded-full px-1.5 font-mono text-[0.6875rem] font-medium text-primaire hover:bg-primaire/15 transition-colors cursor-pointer"
                              title="Insérer un wikilien [[...]]"
                            >
                              [[ ]]
                            </button>
                          </div>
                        </div>
                      )}
                      <EditeurDirect
                        documentId={selectionnee.id}
                        contenuInitialMd={brouillon}
                        contenuCharge={selectionnee.contenuCharge}
                        lectureSeule={selectionnee.lectureSeule}
                        onSynchroniser={synchroniserContenu}
                        onRaccourci={gererRaccourcisClavier}
                        onSelectionChange={rafraichirEtatFormatage}
                        onOuvrirWikilien={ouvrirElement}
                        ref={editeurRef}
                      />
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <VueTousLesDomaines
              domaines={elements
                .filter((el) => el.type === "domaine" && el.vuePedagogique)
                .filter((el) => !(el.vuePedagogique as VueDomaineAtelier).domaine.archive)
                .map((el) => el.vuePedagogique as VueDomaineAtelier)}
              ouvrirElement={ouvrirElement}
              changerVue={changerVue}
              selection="domaines"
              compteId={graphe.compteId}
            />
          )}
        </main>

        {selectionnee && contexteDisponible && (
          <aside
            key={contexteOuvert ? "ouvert" : "ferme"}
            className={cx(
              "min-h-0 overflow-y-auto border-l border-bordure bg-surface shadow-2xl coulissement-droite transition-all duration-200",
              contexteOuvert
                ? "fixed bottom-4 right-4 top-4 z-[var(--superposition-tiroir)] block w-[min(26rem,calc(100vw-2rem))] rounded-xl border"
                : "hidden",
              panneauDroitVisible
                ? "2xl:static 2xl:z-auto 2xl:block 2xl:h-full 2xl:max-h-full 2xl:w-auto 2xl:rounded-none 2xl:border-y-0 2xl:border-r-0 2xl:shadow-none"
                : "2xl:hidden",
            )}
            aria-label="Contexte du document"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-bordure bg-surface px-4 py-2.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-texte-discret">Contexte</span>
              <button
                type="button"
                onClick={() => {
                  setContexteOuvert(false);
                  setPanneauDroitVisible(false);
                }}
                className="grid size-7 place-items-center rounded-lg border border-bordure text-sm text-texte-attenue hover:bg-surface-2 transition-colors cursor-pointer"
                title="Masquer le volet de contexte"
                aria-label="Fermer le contexte"
              >
                ×
              </button>
            </div>
            {selectionnee.vuePedagogique ? (
              <PanneauPedagogiqueAtelier
                vue={selectionnee.vuePedagogique}
                ouvrirElement={ouvrirElement}
                donneesSeance={donneesSeance}
              />
            ) : selectionnee.type === "exercice" ? (
              <PanneauExerciceAtelier
                element={selectionnee}
                elements={elements}
                ouvrirElement={ouvrirElement}
              />
            ) : (
              <div className="space-y-4 p-5">
                {/* Carte Informations */}
                <div className="rounded-lg border border-bordure bg-surface p-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-texte-discret">
                    Informations
                  </h3>
                  <dl className="mt-3 space-y-2 text-xs">
                    <div className="flex justify-between gap-3">
                      <dt className="text-texte-discret">Type</dt>
                      <dd className="font-medium text-texte">{selectionnee.typeLibelle}</dd>
                    </div>
                    {roleLibelle && (
                      <div className="flex justify-between gap-3">
                        <dt className="text-texte-discret">Rôle</dt>
                        <dd className="font-medium text-texte">{roleLibelle}</dd>
                      </div>
                    )}
                    <div className="flex justify-between gap-3">
                      <dt className="text-texte-discret">Catégorie</dt>
                      <dd className="font-medium text-texte capitalize">{selectionnee.categorie}</dd>
                    </div>
                    {dateAffichee && (
                      <div className="flex justify-between gap-3">
                        <dt className="text-texte-discret">Date</dt>
                        <dd className="font-medium text-texte">{dateAffichee}</dd>
                      </div>
                    )}
                    <div className="flex justify-between items-center gap-3 pt-1 border-t border-bordure/40">
                      <dt className="text-texte-discret">Identifiant</dt>
                      <dd className="truncate font-mono text-[0.6875rem] text-texte-attenue max-w-[11rem]" title={selectionnee.id}>
                        {selectionnee.id}
                      </dd>
                    </div>
                    {selectionnee.snapshots.length > 0 && (
                      <div className="flex justify-between gap-3">
                        <dt className="text-texte-discret">Versions gelées</dt>
                        <dd className="font-medium text-primaire">{selectionnee.snapshots.length}</dd>
                      </div>
                    )}
                  </dl>
                </div>

                {/* Carte Relations */}
                <div className="rounded-lg border border-bordure bg-surface p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-texte-discret">
                      Liens & Compétences
                    </h3>
                    {liensCourants.length > 0 && (
                      <span className="text-[0.6875rem] text-texte-discret font-medium">
                        {liensCourants.length} lien{liensCourants.length > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  <div className="mt-3 space-y-2 text-xs">
                    {liensCourants.length > 0 ? (
                      <div className="space-y-1.5">
                        {liensCourants.map((lien, index) => {
                          const cible = trouverCible(lien.cible);
                          return cible ? (
                            <button
                              key={`${lien.cible}-${index}`}
                              type="button"
                              onClick={() => ouvrirElement(cible.id)}
                              className="flex w-full items-center gap-1.5 rounded-md border border-bordure/50 bg-surface-2/40 px-2.5 py-1.5 text-left text-xs font-medium text-primaire hover:border-primaire/40 hover:bg-surface-2 transition-colors cursor-pointer"
                            >
                              <span className="shrink-0 text-texte-discret">→</span>
                              <span className="truncate">{cible.titre}</span>
                            </button>
                          ) : (
                            <div
                              key={`${lien.cible}-${index}`}
                              className="flex w-full items-center gap-1.5 rounded-md border border-bordure/30 bg-surface-2/20 px-2.5 py-1.5 text-xs text-texte-discret"
                            >
                              <span className="shrink-0">→</span>
                              <span className="truncate">{lien.libelle ?? lien.cible}</span>
                              <span className="shrink-0 text-[0.625rem] text-texte-attenue">(à résoudre)</span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-texte-discret">Aucun lien déclaré.</p>
                    )}

                    {selectionnee.entrants.length > 0 && (
                      <p className="pt-2 text-[0.6875rem] text-texte-attenue">
                        Référencé par {selectionnee.entrants.length} document{selectionnee.entrants.length > 1 ? "s" : ""}.
                      </p>
                    )}

                    {!selectionnee.lectureSeule && selectionnee.contenuCharge && selectionnee.schemaCompatible !== false && fichesLiables.length > 0 && (
                      <div className="border-t border-bordure pt-3 mt-3">
                        <label className="block text-[0.6875rem] font-medium text-texte-attenue mb-1.5" htmlFor="ajouter-lien-fiche">
                          Rattacher une compétence ou ressource
                        </label>
                        <div className="flex gap-1.5">
                          {(() => {
                            const competences = fichesLiables.filter((f) => f.type === "competence");
                            const notes = fichesLiables.filter((f) => f.type === "note" || f.type === "document" || f.source === "document");
                            const exercices = fichesLiables.filter((f) => f.type === "exercice");
                            const autres = fichesLiables.filter((f) => !competences.includes(f) && !notes.includes(f) && !exercices.includes(f));

                            return (
                              <select
                                id="ajouter-lien-fiche"
                                value={cibleLien}
                                onChange={(event) => setCibleLien(event.target.value)}
                                className="min-w-0 flex-1 rounded-md border border-bordure bg-surface-2 px-2.5 py-1.5 text-xs text-texte outline-none focus:border-primaire cursor-pointer"
                              >
                                <option value="">Sélectionner une cible…</option>
                                {competences.length > 0 && (
                                  <optgroup label="Compétences">
                                    {competences.map((fiche) => (
                                      <option key={fiche.id} value={fiche.id}>
                                        {fiche.id} — {fiche.titre}
                                      </option>
                                    ))}
                                  </optgroup>
                                )}
                                {notes.length > 0 && (
                                  <optgroup label="Notes & Documents">
                                    {notes.map((fiche) => (
                                      <option key={fiche.id} value={fiche.id}>
                                        {fiche.titre}
                                      </option>
                                    ))}
                                  </optgroup>
                                )}
                                {exercices.length > 0 && (
                                  <optgroup label="Exercices">
                                    {exercices.map((fiche) => (
                                      <option key={fiche.id} value={fiche.id}>
                                        {fiche.titre}
                                      </option>
                                    ))}
                                  </optgroup>
                                )}
                                {autres.length > 0 && (
                                  <optgroup label="Autres ressources">
                                    {autres.map((fiche) => (
                                      <option key={fiche.id} value={fiche.id}>
                                        {fiche.titre}
                                      </option>
                                    ))}
                                  </optgroup>
                                )}
                              </select>
                            );
                          })()}
                          <button
                            type="button"
                            onClick={ajouterLien}
                            disabled={!cibleLien}
                            className="shrink-0 rounded-md border border-bordure bg-surface px-2.5 py-1.5 text-xs font-medium text-primaire hover:bg-primaire-faible disabled:cursor-not-allowed disabled:opacity-40 transition-colors cursor-pointer"
                          >
                            Ajouter
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Carte Pièces Jointes */}
                {selectionnee.frontMatter.role === "support" && (
                  <div className="rounded-lg border border-bordure bg-surface p-4">
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-texte-discret">Pièces jointes</h3>
                      <span className="text-[0.6875rem] text-texte-discret">{piecesJointes?.length ?? "…"}</span>
                    </div>
                    {piecesJointes === undefined ? (
                      <p className="mt-2 text-xs text-texte-discret">Chargement des PDF…</p>
                    ) : piecesJointes.length > 0 ? (
                      <ul className="mt-2.5 space-y-1.5">
                        {piecesJointes.map((piece) => (
                          <li key={piece.id} className="flex items-center gap-2 rounded-md border border-bordure bg-surface-2/40 px-2.5 py-2 text-xs">
                            {piece.url ? (
                              <a href={piece.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-primaire hover:underline font-medium" title={piece.nom}>
                                {piece.nom}
                              </a>
                            ) : (
                              <span className="min-w-0 flex-1 truncate">{piece.nom}</span>
                            )}
                            <span className="shrink-0 text-[0.625rem] text-texte-discret">{Math.max(1, Math.round(piece.tailleOctets / 1024))} Ko</span>
                            {!selectionnee.lectureSeule && (
                              <button type="button" onClick={() => supprimerPieceJointe(piece)} disabled={enCours} className="shrink-0 text-texte-discret hover:text-danger disabled:opacity-50" aria-label={`Supprimer ${piece.nom}`}>
                                ×
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-xs text-texte-discret">Aucun PDF attaché.</p>
                    )}
                    {!selectionnee.lectureSeule && selectionnee.schemaCompatible !== false && (
                      <label className="mt-3 inline-flex cursor-pointer rounded-md border border-bordure bg-surface px-2.5 py-1.5 text-xs font-medium text-primaire hover:bg-primaire-faible transition-colors has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50">
                        Joindre un PDF
                        <input type="file" accept=".pdf,application/pdf" className="sr-only" onChange={televerserPdf} disabled={enCours} />
                      </label>
                    )}
                    <p className="mt-2 text-[0.6875rem] text-texte-discret">PDF uniquement · 10 Mo max.</p>
                  </div>
                )}

                {/* Carte Versions Gelées */}
                {selectionnee.snapshots.length > 0 && (
                  <div className="rounded-lg border border-bordure bg-surface p-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-texte-discret">
                        Versions gelées
                      </h3>
                      <span className="text-[0.6875rem] text-texte-discret font-medium">
                        {selectionnee.snapshots.length} révision{selectionnee.snapshots.length > 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="mt-2.5 max-h-64 overflow-y-auto pr-1 space-y-1.5 scrollbar-thin">
                      {selectionnee.snapshots.map((snapshot) => (
                        <button
                          key={snapshot.id}
                          type="button"
                          onClick={() => ouvrirSnapshot(snapshot.id)}
                          className="flex w-full items-center justify-between gap-2 rounded-md border border-bordure/50 bg-surface-2/40 px-2.5 py-1.5 text-left text-xs text-texte hover:border-primaire/40 hover:bg-surface-2 transition-colors cursor-pointer font-mono"
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-primaire">v{snapshot.version}</span>
                            <span className="rounded bg-surface-3 px-1.5 py-0.5 text-[0.625rem] text-texte-attenue uppercase font-sans">
                              {natureSnapshot(snapshot.captureReason) === "preuve" ? "preuve" : "révision"}
                            </span>
                          </div>
                          <span className="text-[0.6875rem] text-texte-discret font-sans">
                            {snapshot.capturedAt.slice(0, 10)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </aside>
        )}
      </div>
    </section>
  );
}

/**
 * Ce que l'explorateur de gauche rendait, à plat.
 *
 * L'arbre exigeait de savoir dans quel dossier **calculé** une fiche avait été
 * rangée — `Domaines/X/Compétences/Fondamentaux` n'est écrit nulle part, c'est
 * une projection. Une liste de résultats répond à la même question sans
 * demander ce savoir : le chemin y est affiché comme un repère, pas comme un
 * parcours à refaire.
 */
function ResultatsRecherche({
  terme,
  elements,
  couleursDomaines,
  ouvrir,
  onFermer,
}: {
  terme: string;
  elements: ElementAtelier[];
  couleursDomaines: Record<string, string>;
  ouvrir: (id: string) => void;
  onFermer?: () => void;
}) {
  return (
    <div className="absolute inset-x-0 bottom-0 top-[3.5rem] z-30 overflow-y-auto bg-surface/98 backdrop-blur-sm p-4 sm:p-6 space-y-3">
      <div className="flex items-center justify-between border-b border-bordure pb-2 text-xs">
        <span className="font-medium text-texte">
          {elements.length} résultat{elements.length > 1 ? "s" : ""} pour « <span className="text-primaire">{terme}</span> »
        </span>
        {onFermer && (
          <button
            type="button"
            onClick={onFermer}
            className="flex items-center gap-1 text-texte-discret hover:text-texte transition-colors cursor-pointer"
          >
            <span>Fermer</span>
            <kbd className="rounded border border-bordure bg-surface px-1 text-[10px]">Échap</kbd>
          </button>
        )}
      </div>

      {elements.length === 0 ? (
        <div className="py-12 text-center text-xs text-texte-discret">
          <p>Aucune fiche ne correspond à « {terme} ».</p>
          <p className="mt-1 text-[11px] text-texte-attenue">Essaie un mot-clé, un code de compétence ou un titre.</p>
        </div>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {elements.map((element) => (
            <li key={element.id}>
              <button
                type="button"
                onClick={() => ouvrir(element.id)}
                className="group flex w-full items-start gap-3 rounded-xl border border-bordure bg-surface p-3.5 text-left shadow-xs transition-all hover:-translate-y-0.5 hover:border-primaire/40 hover:bg-surface-2/60 hover:shadow-sm cursor-pointer"
              >
                <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-2 group-hover:bg-primaire-faible transition-colors">
                  <IconeDocument
                    type={element.type}
                    couleur={element.domaineId ? couleursDomaines[element.domaineId] : undefined}
                    className={cx(
                      "size-4 shrink-0",
                      !element.domaineId && "text-texte-discret group-hover:text-primaire",
                      element.source === "projection" && "opacity-70",
                    )}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-texte group-hover:text-primaire transition-colors">
                    {element.titre}
                  </span>
                  <div className="mt-1 flex items-center gap-2 text-[0.6875rem] text-texte-discret">
                    <span className="rounded bg-surface-2 px-1.5 py-0.5 font-medium text-texte-attenue">
                      {element.typeLibelle}
                    </span>
                    {(element.frontMatter.archive ||
                      (element.vuePedagogique?.kind === "domaine" &&
                        (element.vuePedagogique as VueDomaineAtelier).domaine.archive)) && (
                      <span className="rounded bg-surface-3 px-1.5 py-0.5 text-[10px] font-medium text-texte-discret">
                        Archivé
                      </span>
                    )}
                    {element.source === "projection" && (
                      <span className="text-[10px] text-texte-attenue">Lecture seule</span>
                    )}
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
