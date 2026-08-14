"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition, type ChangeEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Markdown } from "@/components/ui/markdown";
import { cx } from "@/components/ui/primitives";
import { IconeChevron, IconeDossier, IconeFleche, IconeTableauBord } from "@/components/ui/icones";
import { IconeDocument } from "@/components/ui/icone-document";
import { createNavigateurClient } from "@/lib/supabase/client";
import { analyserDocumentMarkdown } from "@/lib/documents/markdown";
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
import { GrapheCompetences } from "@/components/competences/graphe/graphe-competences";
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
  supprimerNoteSupportAction,
} from "@/lib/store/document-actions";
import type { VueDomaineAtelier } from "@/lib/documents/vue-atelier";
import { cleParCompte } from "@/lib/ui/stockage-session";
import { BoutonRetour } from "@/components/ui/lien-retour";
import { BoutonOuvrirExplorateur, FichePedagogiqueAtelier, PanneauPedagogiqueAtelier } from "./fiche-pedagogique";
import type { CalibrageModale, CompetenceModale } from "@/components/exercices/proprietes-generation";
import { cheminsDepuisDefinition } from "@/lib/documents/chemins-atelier";
import {
  construireArbreDossiers,
  compterElements,
  trouverNoeudDossier,
  type NoeudDossier,
} from "@/lib/documents/arbre-atelier";
import { EditeurDirect } from "./editeur-document";
import { VueTousLesDomaines, VueTransversale, VueCategorieTransversale, BarreVuesAtelier } from "./vues-synthese-atelier";
import { PanneauExerciceAtelier } from "./panneaux-document-atelier";
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
    return d.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return null;
  }
}

const abonnementsDossiers = new Map<string, Set<() => void>>();

function notifierDossiers(cle: string) {
  for (const ecouter of abonnementsDossiers.get(cle) ?? []) ecouter();
}

function documentDepuisAnalyse(document: ReturnType<typeof analyserDocumentMarkdown>): ElementAtelier {
  const definition = document.type ? definitionTypeDocument(document.type) : null;
  const chemins = cheminsDepuisDefinition(definition, document.frontMatter);
  return {
    id: document.id,
    titre: document.titre,
    type: document.type ?? "document",
    typeLibelle: definition?.libelle ?? document.type ?? "Document",
    categorie: definition?.categorie ?? "connaissance",
    dossier: chemins.dossier,
    dossiersSecondaires: chemins.dossiersSecondaires,
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
    lectureSeule: false,
  };
}

function trouverElement(id: string, liste: ElementAtelier[]): ElementAtelier | undefined {
  if (id === "domaines" || id === "transversal" || id === "domaines-archives") {
    const titre = id === "transversal" ? "Transversal" : id === "domaines-archives" ? "Domaines archivés" : "Domaines";
    return {
      id,
      titre,
      type: "liste-domaines",
      typeLibelle: titre,
      categorie: "connaissance",
      dossier: titre,
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
  dossierDemande,
  modeInitial,
  graphe,
  generation,
  rectificationActive,
}: {
  elements: ElementAtelier[];
  /** Teinte par domaine, partagée avec le graphe pour qu'un domaine ait une seule couleur. */
  couleursDomaines: Record<string, string>;
  documentDemande?: string;
  dossierDemande?: string;
  modeInitial?: "referentiel";
  graphe: { donnees: DonneesGraphe; compteId: string };
  generation: { competences: CompetenceModale[]; calibrages: Record<string, CalibrageModale> };
  /** Corriger une preuve suppose le journal de rectification (boucle adaptative). */
  rectificationActive?: boolean;
}) {
  const router = useRouter();
  const [elements, setElements] = useState(elementsInitials);
  const selectionInitiale = useMemo(() => {
    if (documentDemande) {
      if (
        documentDemande === "domaines" ||
        documentDemande === "transversal" ||
        documentDemande === "domaines-archives"
      ) {
        return documentDemande;
      }
      return trouverElement(documentDemande, elementsInitials)?.id ?? null;
    }
    if (dossierDemande) {
      return `dossier:${dossierDemande}`;
    }
    return null;
  }, [documentDemande, dossierDemande, elementsInitials]);
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

  const cleDossiers = cleParCompte("atelier-dossiers-ouverts", graphe.compteId);
  const abonnementDossiers = useCallback((ecouter: () => void) => {
    const ecouteurs = abonnementsDossiers.get(cleDossiers) ?? new Set<() => void>();
    ecouteurs.add(ecouter);
    abonnementsDossiers.set(cleDossiers, ecouteurs);
    const surStockage = (event: StorageEvent) => {
      if (event.key === cleDossiers) ecouter();
    };
    window.addEventListener("storage", surStockage);
    return () => {
      window.removeEventListener("storage", surStockage);
      ecouteurs.delete(ecouter);
      if (ecouteurs.size === 0) abonnementsDossiers.delete(cleDossiers);
    };
  }, [cleDossiers]);
  const lireDossiers = useCallback(() => {
    try {
      return window.localStorage.getItem(cleDossiers) ?? "[]";
    } catch {
      return "[]";
    }
  }, [cleDossiers]);
  const dossiersStockes = useSyncExternalStore(abonnementDossiers, lireDossiers, () => "[]");
  const dossiersOuverts = useMemo(() => {
    try {
      const chemins = JSON.parse(dossiersStockes);
      return new Set<string>(Array.isArray(chemins) ? chemins.filter((chemin): chemin is string => typeof chemin === "string") : []);
    } catch {
      return new Set<string>();
    }
  }, [dossiersStockes]);
  const [recherche, setRecherche] = useState("");
  const [contexteOuvert, setContexteOuvert] = useState(false);
  const [sidebarOuverte, setSidebarOuverte] = useState(true);
  const [cibleLien, setCibleLien] = useState("");
  const [piecesJointesParDocument, setPiecesJointesParDocument] = useState<Record<string, PieceJointeDocument[]>>({});

  const selectionnee = selection === "domaines" ? null : (elements.find((element) => element.id === selection) ?? null);
  const selectionId = selectionnee?.id;
  const role = selectionnee?.frontMatter?.role;
  const roleLibelle = role === "support" ? "Support" : role === "operationnel" ? "Opérationnel" : null;
  const dateAffichee = selectionnee ? formaterDateDocument(selectionnee) : null;
  const brouillon = selectionnee ? brouillons[selectionnee.id] ?? selectionnee.contenuMd : "";
  const liensCourants = selectionnee
    ? selectionnee.contenuCharge
      ? analyserDocumentMarkdown(selectionnee.id, brouillon).liens
      : selectionnee.liens
    : [];
  const fichesLiables = elements
    .filter((element) => element.source === "document" && element.id !== selectionId)
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
    setMessage(null);
    demarrerTransition(async () => {
      try {
        const resultat = await lireDocumentAction(elementId);
        const analyse = analyserDocumentMarkdown(elementId, resultat.contenuMd);
        setElements((anciens) => anciens.map((ancien) => ancien.id === elementId
          ? {
            ...ancien,
            ...documentDepuisAnalyse(analyse),
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
      const dossierParam = params.get("dossier");
      if (docParam) {
        setSelection(docParam);
      } else if (dossierParam) {
        setSelection(`dossier:${dossierParam}`);
      } else {
        setSelection(null);
      }
      setCibleLien("");
      setSnapshotApercu(null);
    }
    window.addEventListener("popstate", synchroniserDepuisHistorique);
    return () => window.removeEventListener("popstate", synchroniserDepuisHistorique);
  }, []);

  useEffect(() => {
    if (!selection) return;
    const element = elements.find((el) => el.id === selection);
    if (element && element.source !== "projection" && !element.contenuCharge) {
      chargerContenuDocument(element.id);
    }
  }, [selection, elements, chargerContenuDocument]);

  function revenirGrapheGlobal(opts?: { remplacerHistorique?: boolean } | unknown) {
    setSelection(null);
    setCibleLien("");
    setSnapshotApercu(null);
    const remplacer = typeof opts === "object" && opts !== null && "remplacerHistorique" in opts && Boolean((opts as { remplacerHistorique?: boolean }).remplacerHistorique);
    if (remplacer) {
      window.history.replaceState(null, "", "/atelier");
    } else {
      window.history.pushState(null, "", "/atelier");
    }
  }

  function trouverCible(cible: string): ElementAtelier | undefined {
    return trouverElement(cible, elements);
  }

  const arbreDossiers = useMemo(() => construireArbreDossiers(elementsVisibles), [elementsVisibles]);
  const racineTransversale = trouverNoeudDossier(arbreDossiers, "Transversal");
  const dossierSelectionne = selection?.startsWith("dossier:")
    ? trouverNoeudDossier(arbreDossiers, selection.slice("dossier:".length))
    : null;

  function ouvrirElement(id: string, opts?: { remplacerHistorique?: boolean } | unknown) {
    const element = trouverElement(id, elements);
    if (!element) {
      const cleanId = id.replace(/^(exercice|document):/, "");
      if (id.startsWith("exercice:") || /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(cleanId)) {
        router.push(`/exercices/${cleanId}`);
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

  function basculerDossier(chemin: string) {
    const suivants = new Set(dossiersOuverts);
    if (suivants.has(chemin)) suivants.delete(chemin);
    else suivants.add(chemin);
    try {
      window.localStorage.setItem(cleDossiers, JSON.stringify([...suivants]));
      notifierDossiers(cleDossiers);
    } catch {
      // La navigation reste fonctionnelle si le stockage navigateur est indisponible.
    }
  }

  function ouvrirDossier(chemin: string) {
    setSelection(`dossier:${chemin}`);
    setCibleLien("");
    setSnapshotApercu(null);
    window.history.pushState({ dossier: chemin }, "", `/atelier?dossier=${encodeURIComponent(chemin)}`);
  }

  function rendreDossier(noeud: NoeudDossier<ElementAtelier>, profondeur = 0): ReactNode {
    const ferme = !recherche.trim() && !dossiersOuverts.has(noeud.chemin);
    const elementDomaine = noeud.elements.find((el) => el.type === "domaine");
    const autresElements = noeud.elements.filter((el) => el.type !== "domaine");
    const elementsDossier = elementDomaine
      ? [elementDomaine, ...autresElements]
      : autresElements;
    const enfants = noeud.enfants;
    const racineId =
      noeud.chemin === "Domaines"
        ? "domaines"
        : noeud.chemin === "Transversal"
        ? "transversal"
        : noeud.chemin === "Domaines archivés" || noeud.chemin === "Archivés"
        ? "domaines-archives"
        : null;

    return (
      <div key={noeud.chemin}>
        <button
          type="button"
          onClick={() => basculerDossier(noeud.chemin)}
          className="flex min-h-9 w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-[0.8125rem] font-semibold text-[var(--rail-texte-attenue)] transition-colors hover:bg-[var(--rail-2)] hover:text-[var(--rail-texte)] cursor-pointer"
          style={{ paddingLeft: `${0.5 + profondeur * 0.75}rem` }}
          aria-expanded={!ferme}
        >
          <IconeChevron
            className={cx(
              "size-3.5 shrink-0 text-[var(--rail-texte-discret)] transition-transform",
              !ferme && "rotate-90",
            )}
          />
          <IconeDossier className="size-4 shrink-0 text-[var(--rail-texte-discret)]" />
          <span className="truncate">{noeud.nom}</span>
          <span className="ml-auto text-xs font-normal text-[var(--rail-texte-discret)]">
            {compterElements(noeud)}
          </span>
        </button>
        {!ferme && (
          <div>
            {racineId && (
              <ul className="space-y-0.5" style={{ paddingLeft: `${1.25 + profondeur * 0.75}rem` }}>
                <li>
                  <button
                    type="button"
                    onClick={() => ouvrirElement(racineId)}
                    className={cx(
                      "flex min-h-9 w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-[0.8125rem] transition-colors cursor-pointer",
                      selection === racineId
                        ? "bg-[var(--rail-actif)] font-medium text-[var(--rail-actif-texte)]"
                        : "text-[var(--rail-texte-attenue)] hover:bg-[var(--rail-2)] hover:text-[var(--rail-texte)]",
                    )}
                  >
                    <IconeTableauBord className="size-4 shrink-0 text-[var(--rail-texte-discret)]" />
                    <span className="min-w-0 flex-1 truncate font-medium">Vue d’ensemble</span>
                  </button>
                </li>
              </ul>
            )}
            {elementsDossier.length > 0 && (
              <ul className="space-y-0.5" style={{ paddingLeft: `${1.25 + profondeur * 0.75}rem` }}>
                {elementsDossier.map((element) => {
                  const estVueEnsemble = element.type === "domaine";
                  const libelleAffichage = estVueEnsemble ? "Vue d’ensemble" : element.titre;
                  return (
                    <li key={element.id}>
                      <button
                        type="button"
                        onClick={() => ouvrirElement(element.id)}
                        className={cx(
                          "flex min-h-9 w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-[0.8125rem] transition-colors cursor-pointer",
                          element.id === selection
                            ? "bg-[var(--rail-actif)] font-medium text-[var(--rail-actif-texte)]"
                            : "text-[var(--rail-texte-attenue)] hover:bg-[var(--rail-2)] hover:text-[var(--rail-texte)]",
                        )}
                      >
                        <IconeDocument
                          type={element.type}
                          couleur={element.domaineId ? couleursDomaines[element.domaineId] : undefined}
                          className={cx(
                            "size-4",
                            !element.domaineId && "text-[var(--rail-texte-discret)]",
                            // Une projection est en lecture seule : l'atténuation
                            // remplace le `○` qui portait seul cette nuance.
                            element.source === "projection" && "opacity-70",
                          )}
                        />
                        <span className={cx("min-w-0 flex-1 truncate", estVueEnsemble && "font-medium")}>
                          {libelleAffichage}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {enfants.map((enfant) => rendreDossier(enfant, profondeur + 1))}
          </div>
        )}
      </div>
    );
  }

  function ouvrirSnapshot(snapshotId: string) {
    if (!selectionnee) return;
    setMessage(null);
    demarrerTransition(async () => {
      try {
        setSnapshotApercu(await lireSnapshotAction(selectionnee.id, snapshotId));
      } catch (erreur) {
        setMessage(erreur instanceof Error ? erreur.message : "Lecture du snapshot impossible");
      }
    });
  }

  const synchroniserContenu = useCallback((nouveauCorps?: string) => {
    if (!selectionnee) return;
    const corpsActuel = nouveauCorps ?? (editeurRef.current ? domVersMarkdown(editeurRef.current) : "");
    const { frontmatterBrut } = separerFrontMatterEtCorps(brouillon);
    const documentComplet = recomposerDocumentComplet(frontmatterBrut, corpsActuel);
    setBrouillons((anciens) => ({ ...anciens, [selectionnee.id]: documentComplet }));
  }, [brouillon, selectionnee]);

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
        await supprimerNoteSupportAction(selectionnee.id);
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
            ...documentDepuisAnalyse(analyse),
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
      {selectionnee && (
        <div className="flex items-center justify-end border-b border-bordure bg-surface px-3 py-2 2xl:hidden">
          <button
            type="button"
            onClick={() => setContexteOuvert(true)}
            className="rounded-lg border border-bordure-controle bg-surface-2 px-3 py-2 text-sm font-medium text-texte"
            aria-expanded={contexteOuvert}
          >
            Ouvrir le contexte
          </button>
        </div>
      )}
      {contexteOuvert && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/35 backdrop-blur-[1px] 2xl:hidden"
          onClick={() => setContexteOuvert(false)}
          aria-label="Fermer le panneau de contexte"
        />
      )}
      <div className={cx(
        "flex flex-1 min-h-0 flex-col lg:grid lg:h-full transition-all duration-300",
        sidebarOuverte
          ? selectionnee
            ? "lg:grid-cols-[20rem_minmax(0,1fr)] 2xl:grid-cols-[20rem_minmax(0,1fr)_23rem]"
            : "lg:grid-cols-[20rem_minmax(0,1fr)]"
          : selectionnee
            ? "lg:grid-cols-[1fr] 2xl:grid-cols-[minmax(0,1fr)_23rem]"
            : "lg:grid-cols-[1fr]",
      )}>
        <aside
          className={cx(
            "flex h-full min-h-0 flex-col border-b border-[var(--rail-bordure)] bg-[var(--rail)] text-[var(--rail-texte)] lg:border-b-0 lg:border-r transition-all duration-300",
            !sidebarOuverte && "hidden lg:hidden",
          )}
          aria-label="Explorateur documentaire"
        >
          <div className="flex h-[4.25rem] items-center gap-3 border-b border-[var(--rail-bordure)] px-6 shrink-0">
            <button
              type="button"
              onClick={() => setSidebarOuverte(false)}
              className="grid size-9 shrink-0 place-items-center rounded-lg border border-[var(--rail-bordure)] bg-[var(--rail-2)] text-[var(--rail-texte)] transition-all duration-200 hover:bg-primaire hover:border-primaire hover:text-white cursor-pointer shadow-sm"
              title="Masquer l’explorateur"
              aria-label="Masquer l’explorateur"
            >
              <svg className="size-5 shrink-0 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
            <div className="flex-1 min-w-0">
              <label className="sr-only" htmlFor="recherche-atelier">Rechercher dans l’Atelier</label>
              <input
                id="recherche-atelier"
                type="search"
                value={recherche}
                onChange={(event) => setRecherche(event.target.value)}
                placeholder="Rechercher une fiche…"
                className="w-full rounded-lg border border-[var(--rail-bordure)] bg-[var(--rail-2)] px-3 py-1.5 text-xs text-[var(--rail-texte)] outline-none transition-colors placeholder:text-[var(--rail-texte-discret)] focus:border-[var(--rail-actif)]"
              />
            </div>
          </div>

          {selectionnee && (
            <div className="border-b border-[var(--rail-bordure)] px-3 py-2 shrink-0">
              <button
                type="button"
                onClick={revenirGrapheGlobal}
                className="flex w-full items-center gap-2 rounded-lg bg-[var(--rail-2)] px-3 py-2 text-xs font-semibold text-[var(--rail-texte)] transition-colors hover:bg-[var(--rail-actif)] hover:text-[var(--rail-actif-texte)]"
              >
                <span>←</span>
                <span className="truncate">Revenir au graphe global</span>
              </button>
            </div>
          )}

          <nav className="min-h-0 flex-1 overflow-y-auto p-3" aria-label="Dossiers, documents et projections">
            {arbreDossiers.map((noeud) => rendreDossier(noeud))}
            {elements.length === 0 && <p className="px-2 py-4 text-xs text-[var(--rail-texte-discret)]">Ton espace est encore vide.</p>}
            {elements.length > 0 && elementsVisibles.length === 0 && <p className="px-2 py-4 text-xs leading-relaxed text-[var(--rail-texte-discret)]">Aucune fiche ne correspond à cette recherche.</p>}
          </nav>
        </aside>

        <main className="flex h-full min-w-0 flex-1 flex-col min-h-0 overflow-hidden bg-surface">
          {selection === "transversal" ? (
            <VueTransversale
              racine={racineTransversale}
              ouvrirDossier={ouvrirDossier}
              ouvrirElement={ouvrirElement}
              revenirGrapheGlobal={revenirGrapheGlobal}
              sidebarOuverte={sidebarOuverte}
              setSidebarOuverte={setSidebarOuverte}
            />
          ) : dossierSelectionne ? (
            <VueCategorieTransversale
              noeud={dossierSelectionne}
              arbreDossiers={arbreDossiers}
              elements={elements}
              ouvrirDossier={ouvrirDossier}
              ouvrirElement={ouvrirElement}
              revenirTransversal={() => {
                const parties = dossierSelectionne.chemin.split("/").map((p) => p.trim()).filter(Boolean);
                if (parties.length > 1) {
                  const parentChemin = parties.slice(0, -1).join("/");
                  if (parentChemin === "Transversal") ouvrirElement("transversal");
                  else if (parentChemin === "Domaines") ouvrirElement("domaines");
                  else if (parentChemin === "Domaines archivés" || parentChemin === "Archivés") ouvrirElement("domaines-archives");
                  else ouvrirDossier(parentChemin);
                } else {
                  ouvrirElement("transversal");
                }
              }}
              revenirGrapheGlobal={revenirGrapheGlobal}
              sidebarOuverte={sidebarOuverte}
              setSidebarOuverte={setSidebarOuverte}
            />
          ) : selection === "domaines" || selection === "domaines-archives" ? (
            <VueTousLesDomaines
              domaines={elements
                .filter((el) => el.type === "domaine" && el.vuePedagogique)
                .filter((el) => {
                  const vue = el.vuePedagogique as VueDomaineAtelier;
                  if (selection === "domaines-archives") return vue.domaine.archive;
                  return !vue.domaine.archive;
                })
                .map((el) => el.vuePedagogique as VueDomaineAtelier)}
              ouvrirElement={ouvrirElement}
              revenirGrapheGlobal={revenirGrapheGlobal}
              sidebarOuverte={sidebarOuverte}
              setSidebarOuverte={setSidebarOuverte}
              selection={selection}
            />
          ) : selectionnee?.vuePedagogique ? (
            <FichePedagogiqueAtelier
              vue={selectionnee.vuePedagogique}
              titre={selectionnee.titre}
              ouvrirElement={ouvrirElement}
              revenirGraphe={revenirGrapheGlobal}
              sidebarOuverte={sidebarOuverte}
              setSidebarOuverte={setSidebarOuverte}
              compteId={graphe.compteId}
              modeInitial={modeInitial}
              rectificationActive={rectificationActive}
              generation={generation}
            />
          ) : selectionnee ? (
            <>
              <div className="flex h-[4.25rem] items-center justify-between gap-3 border-b border-bordure/50 px-6 shrink-0 bg-surface">
                <nav aria-label="Fil d’Ariane" className="flex items-center gap-1.5 text-xs text-texte-discret min-w-0 flex-wrap sm:flex-nowrap">
                  {!sidebarOuverte && (
                    <BoutonOuvrirExplorateur onClick={() => setSidebarOuverte(true)} />
                  )}
                  <BoutonRetour onClick={revenirGrapheGlobal} libelle="Retour à l'Atelier" />
                  <button
                    type="button"
                    onClick={revenirGrapheGlobal}
                    className="font-medium text-texte-discret transition-colors hover:text-primaire hover:underline shrink-0"
                  >
                    Atelier
                  </button>
                  {(() => {
                    const parties = selectionnee.dossier.split("/").map((p) => p.trim()).filter(Boolean);
                    return parties.map((partie, index) => {
                      const cheminCumule = parties.slice(0, index + 1).join("/");
                      const domaineEl = elements.find(
                        (el) =>
                          el.type === "domaine" &&
                          ((el.vuePedagogique?.kind === "domaine" && el.vuePedagogique.nom === partie) || el.titre === partie),
                      );
                      const noeudDossier = trouverNoeudDossier(arbreDossiers, cheminCumule);

                      let action: (() => void) | null = null;
                      if (partie === "Domaines") {
                        action = () => ouvrirElement("domaines");
                      } else if (partie === "Transversal") {
                        action = () => ouvrirElement("transversal");
                      } else if (partie === "Domaines archivés" || partie === "Archivés") {
                        action = () => ouvrirElement("domaines-archives");
                      } else if (domaineEl) {
                        action = () => ouvrirElement(domaineEl.id);
                      } else if (noeudDossier) {
                        action = () => ouvrirDossier(cheminCumule);
                      }

                      return (
                        <span key={cheminCumule} className="flex items-center gap-1.5 shrink-0">
                          <span className="text-texte-discret/60">/</span>
                          {action ? (
                            <button
                              type="button"
                              onClick={action}
                              className="font-medium text-texte-discret transition-colors hover:text-primaire hover:underline"
                            >
                              {partie}
                            </button>
                          ) : (
                            <span className="text-texte-discret">{partie}</span>
                          )}
                        </span>
                      );
                    });
                  })()}
                  <span className="flex items-center gap-1.5 min-w-0">
                    <span className="text-texte-discret/60 shrink-0">/</span>
                    <span className="font-semibold text-texte truncate" title={selectionnee.titre}>
                      {selectionnee.titre}
                    </span>
                  </span>
                </nav>
              </div>

              {/* Barre d'en-tête du document avec actions épurées */}
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-bordure px-6 py-3.5 shrink-0 bg-surface">
                <div className="min-w-0 space-y-1">
                  {(selectionnee.lectureSeule || selectionnee.schemaCompatible === false) && (
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      {selectionnee.lectureSeule && (
                        <span className="rounded bg-surface-2 px-1.5 py-0.5 text-texte-attenue">
                          projection
                        </span>
                      )}
                      {selectionnee.schemaCompatible === false && (
                        <span className="rounded bg-alerte-faible px-1.5 py-0.5 font-medium text-alerte">
                          contrat inconnu
                        </span>
                      )}
                    </div>
                  )}
                  <h2 className="truncate font-serif text-2xl font-medium tracking-tight text-texte">
                    {selectionnee.titre}
                  </h2>
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
                      href={`/atelier?note=${encodeURIComponent(selectionnee.id)}`}
                      className="inline-flex items-center gap-1.5 rounded-md bg-primaire px-3 py-1.5 text-xs font-semibold text-texte-inverse shadow-sm hover:bg-primaire-survol transition-colors"
                    >
                      <span>Travailler cette fiche</span>
                      <IconeFleche className="size-3.5" />
                    </Link>
                  )}

                  {selectionnee.type === "exercice" && (
                    <Link
                      href={`/exercices/${selectionnee.id.replace(/^exercice:/, "")}`}
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
                    <div className="relative min-h-full rounded-lg border border-bordure bg-surface focus-within:border-primaire transition-colors overflow-hidden">
                      {/* Barre d'outils de formatage direct flottante superposée et masquée à moitié au repos */}
                      {!selectionnee.lectureSeule && (
                        <div className="group/toolbar absolute top-0 left-1/2 -translate-x-1/2 z-20 pt-0 px-3 transition-all duration-300">
                          <div
                            className={cx(
                              "flex items-center gap-1 rounded-full border bg-surface-2/95 backdrop-blur-md px-3 py-1 shadow-xs transition-all duration-300 -translate-y-1/2 group-hover/toolbar:translate-y-2 group-hover/toolbar:opacity-100 group-hover/toolbar:shadow-xl group-hover/toolbar:border-primaire/50 focus-within:translate-y-2 focus-within:opacity-100 focus-within:border-primaire/50 cursor-default",
                              (etatFormatage.bold || etatFormatage.italic || etatFormatage.h2 || etatFormatage.ul || etatFormatage.ol || etatFormatage.blockquote)
                                ? "opacity-90 border-primaire/60 shadow-xs ring-1 ring-primaire/20"
                                : "opacity-35 border-bordure/80",
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
                        editeurRef={editeurRef}
                      />
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex h-full min-h-0 flex-1 flex-col bg-surface">
              <div className="flex h-[4.25rem] items-center justify-between gap-3 border-b border-bordure px-6 shrink-0">
                <div className="flex items-center gap-3">
                  {!sidebarOuverte && (
                    <BoutonOuvrirExplorateur onClick={() => setSidebarOuverte(true)} />
                  )}
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-texte-discret leading-none">Mémoire documentaire</p>
                    <h2 className="mt-0.5 font-serif text-2xl font-medium tracking-tight leading-tight">Graphe global</h2>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-texte-discret hidden sm:inline">Documents, compétences, exercices et thèmes reliés</span>
                  <BarreVuesAtelier
                    vue="graphe"
                    onChanger={(v) => {
                      if (v === "graphe") revenirGrapheGlobal();
                      else ouvrirElement(v);
                    }}
                  />
                </div>
              </div>
              <div className="flex min-h-0 flex-1 flex-col p-4">
                <GrapheCompetences donnees={graphe.donnees} compteId={graphe.compteId} ouvrirElement={ouvrirElement} />
              </div>
            </div>
          )}
        </main>

        {selectionnee && (
          <aside
            key={contexteOuvert ? "ouvert" : "ferme"}
            className={cx(
              "min-h-0 overflow-y-auto border-l border-bordure bg-surface shadow-2xl coulissement-droite",
              contexteOuvert
                ? "fixed bottom-4 right-4 top-4 z-50 block w-[min(26rem,calc(100vw-2rem))] rounded-xl border"
                : "hidden",
              "2xl:static 2xl:z-auto 2xl:block 2xl:h-full 2xl:max-h-full 2xl:w-auto 2xl:rounded-none 2xl:border-y-0 2xl:border-r-0 2xl:shadow-none",
            )}
            aria-label="Contexte du document"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-bordure bg-surface px-4 py-3 2xl:hidden">
              <span className="text-sm font-semibold">Contexte</span>
              <button
                type="button"
                onClick={() => setContexteOuvert(false)}
                className="grid size-9 place-items-center rounded-lg border border-bordure text-lg text-texte-attenue"
                aria-label="Fermer le contexte"
              >
                ×
              </button>
            </div>
            {selectionnee.vuePedagogique ? (
              <PanneauPedagogiqueAtelier
                vue={selectionnee.vuePedagogique}
                ouvrirElement={ouvrirElement}
                compteId={graphe.compteId}
                generation={generation}
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
                      Relations
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
                          Ajouter un lien vers une fiche
                        </label>
                        <div className="flex gap-1.5">
                          <select
                            id="ajouter-lien-fiche"
                            value={cibleLien}
                            onChange={(event) => setCibleLien(event.target.value)}
                            className="min-w-0 flex-1 rounded-md border border-bordure bg-surface-2 px-2.5 py-1.5 text-xs text-texte outline-none focus:border-primaire"
                          >
                            <option value="">Choisir une fiche…</option>
                            {fichesLiables.map((fiche) => (
                              <option key={fiche.id} value={fiche.id}>
                                {fiche.titre}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={ajouterLien}
                            disabled={!cibleLien}
                            className="shrink-0 rounded-md border border-bordure bg-surface px-2.5 py-1.5 text-xs font-medium text-primaire hover:bg-primaire-faible disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
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