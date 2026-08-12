"use client";

import { useEffect, useMemo, useState, useTransition, type ChangeEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Markdown } from "@/components/ui/markdown";
import { cx } from "@/components/ui/primitives";
import { createNavigateurClient } from "@/lib/supabase/client";
import { analyserDocumentMarkdown, type LienMarkdown } from "@/lib/documents/markdown";
import { BUCKET_PIECES_JOINTES, MAX_PDF_OCTETS, MIME_PDF, nomPdfValide } from "@/lib/documents/pieces-jointes";
import type { ExerciseAttempt } from "@/lib/domain/types";
import type { DonneesGraphe } from "@/lib/domain/graphe";
import { GrapheCompetences } from "@/components/competences/graphe/graphe-competences";
import {
  definitionTypeDocument,
  natureSnapshot,
  type CategorieDocument,
} from "@/lib/documents/types-documents";
import {
  exporterDocumentsMarkdownAction,
  importerDocumentsAction,
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
import type { PieceJointeDocument, SnapshotDocument } from "@/lib/documents/types-documents";
import type { VuePedagogiqueAtelier } from "@/lib/documents/vue-atelier";
import { cleParCompte } from "@/lib/ui/stockage-session";
import { FichePedagogiqueAtelier, PanneauPedagogiqueAtelier } from "./fiche-pedagogique";
import type { CalibrageModale, CompetenceModale } from "@/components/exercices/proprietes-generation";

export interface ElementAtelier {
  id: string;
  titre: string;
  type: string;
  typeLibelle: string;
  categorie: CategorieDocument;
  dossier: string;
  /** Accès alternatifs vers la même fiche, sans dupliquer sa donnée. */
  dossiersSecondaires?: string[];
  contenuMd: string;
  contenuCharge: boolean;
  updatedAt?: string;
  schemaCompatible?: boolean;
  frontMatter: Record<string, string | number | boolean | null | string[]>;
  liens: LienMarkdown[];
  sortants: string[];
  entrants: string[];
  snapshots: Array<{ id: string; version: number; captureReason: string; capturedAt: string }>;
  tentatives: ExerciseAttempt[];
  source: "document" | "projection";
  lectureSeule: boolean;
  vuePedagogique?: VuePedagogiqueAtelier;
}

type ModeDocument = "editer" | "apercu";

interface NoeudDossier {
  nom: string;
  chemin: string;
  enfants: NoeudDossier[];
  elements: ElementAtelier[];
}

function documentDepuisAnalyse(document: ReturnType<typeof analyserDocumentMarkdown>): ElementAtelier {
  const definition = document.type ? definitionTypeDocument(document.type) : null;
  return {
    id: document.id,
    titre: document.titre,
    type: document.type ?? "document",
    typeLibelle: definition?.libelle ?? document.type ?? "Document",
    categorie: definition?.categorie ?? "connaissance",
    dossier: definition?.dossierParDefaut ?? "Documents",
    dossiersSecondaires: [
      `Transversal/${document.frontMatter.role === "operationnel" ? "Notes opérationnelles" : document.frontMatter.role === "support" ? "Notes de support" : definition?.categorie === "preuve" ? "Preuves" : "Documents"}`,
    ],
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

function construireArbreDossiers(elements: ElementAtelier[]): NoeudDossier[] {
  const racine = new Map<string, NoeudDossier>();
  for (const element of elements) {
    const chemins = [...new Set([element.dossier, ...(element.dossiersSecondaires ?? [])])];
    for (const dossier of chemins) {
      const parties = dossier.split("/").map((partie) => partie.trim()).filter(Boolean);
      const cheminParties = parties.length > 0 ? parties : ["Documents"];
      let niveau = racine;
      let parent: NoeudDossier | null = null;
      let chemin = "";
      for (const [index, partie] of cheminParties.entries()) {
        chemin = chemin ? `${chemin}/${partie}` : partie;
        let noeud = niveau.get(partie);
        if (!noeud) {
          noeud = { nom: partie, chemin, enfants: [], elements: [] };
          niveau.set(partie, noeud);
          parent?.enfants.push(noeud);
        }
        if (
          index === cheminParties.length - 1 &&
          !noeud.elements.some((item) => item.id === element.id)
        ) {
          noeud.elements.push(element);
        }
        parent = noeud;
        niveau = new Map(noeud.enfants.map((enfant) => [enfant.nom, enfant]));
      }
    }
  }
  const ordreRacines = new Map([["Domaines", 0], ["Transversal", 1]]);
  return [...racine.values()]
    .filter((noeud) => compterElements(noeud) > 0)
    .sort((a, b) =>
      (ordreRacines.get(a.nom) ?? 10) - (ordreRacines.get(b.nom) ?? 10) ||
      a.nom.localeCompare(b.nom, "fr"),
    );
}

export function EspaceDocumentaire({
  elements: elementsInitials,
  documentDemande,
  modeInitial,
  graphe,
  generation,
}: {
  elements: ElementAtelier[];
  documentDemande?: string;
  modeInitial?: "referentiel";
  graphe: { donnees: DonneesGraphe; compteId: string };
  generation: { competences: CompetenceModale[]; calibrages: Record<string, CalibrageModale> };
}) {
  const router = useRouter();
  const [elements, setElements] = useState(elementsInitials);
  const [selection, setSelection] = useState(
    documentDemande && elementsInitials.some((element) => element.id === documentDemande)
      ? documentDemande
      : null,
  );
  const [brouillons, setBrouillons] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<ModeDocument>("editer");
  const [snapshotApercu, setSnapshotApercu] = useState<SnapshotDocument | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [enCours, demarrerTransition] = useTransition();
  const [dossiersOuverts, setDossiersOuverts] = useState<Set<string>>(new Set());
  const [recherche, setRecherche] = useState("");
  const [contexteOuvert, setContexteOuvert] = useState(false);
  const [cibleLien, setCibleLien] = useState("");
  const [piecesJointesParDocument, setPiecesJointesParDocument] = useState<Record<string, PieceJointeDocument[]>>({});

  const selectionnee = elements.find((element) => element.id === selection) ?? null;
  const brouillon = selectionnee ? brouillons[selectionnee.id] ?? selectionnee.contenuMd : "";
  const liensCourants = selectionnee
    ? selectionnee.contenuCharge
      ? analyserDocumentMarkdown(selectionnee.id, brouillon).liens
      : selectionnee.liens
    : [];
  const fichesLiables = elements
    .filter((element) => element.source === "document" && element.id !== selectionnee?.id)
    .sort((a, b) => a.titre.localeCompare(b.titre, "fr"));
  const documentSupportId = selectionnee?.frontMatter.role === "support" ? selectionnee.id : null;

  useEffect(() => {
    let actif = true;
    const jeton = window.setTimeout(() => {
      if (!actif) return;
      try {
        const brut = window.localStorage.getItem(
          cleParCompte("atelier-dossiers-ouverts", graphe.compteId),
        );
        const chemins = brut ? JSON.parse(brut) : [];
        if (Array.isArray(chemins)) {
          setDossiersOuverts(new Set(chemins.filter((chemin): chemin is string => typeof chemin === "string")));
        }
      } catch {
        // Un état de navigation illisible revient au repli par défaut.
      }
    }, 0);
    return () => {
      actif = false;
      window.clearTimeout(jeton);
    };
  }, [graphe.compteId]);

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

  function trouverCible(cible: string): ElementAtelier | undefined {
    return elements.find((element) => element.id === cible || element.id === `exercice:${cible}`);
  }

  const arbreDossiers = useMemo(() => construireArbreDossiers(elementsVisibles), [elementsVisibles]);

  function ouvrirElement(id: string) {
    const element = elements.find((item) => item.id === id);
    if (!element) return;
    setSelection(id);
    setCibleLien("");
    setSnapshotApercu(null);
    setMode("editer");
    window.history.replaceState(null, "", `/atelier?document=${encodeURIComponent(id)}`);
    if (element.source === "projection" || element.contenuCharge) return;
    setMessage(null);
    demarrerTransition(async () => {
      try {
        const resultat = await lireDocumentAction(id);
        const analyse = analyserDocumentMarkdown(id, resultat.contenuMd);
        setElements((anciens) => anciens.map((ancien) => ancien.id === id
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
        setBrouillons((anciens) => ({ ...anciens, [id]: resultat.contenuMd }));
      } catch (erreur) {
        setMessage(erreur instanceof Error ? erreur.message : "Chargement impossible");
      }
    });
  }

  function basculerDossier(chemin: string) {
    setDossiersOuverts((anciens) => {
      const suivants = new Set(anciens);
      if (suivants.has(chemin)) suivants.delete(chemin);
      else suivants.add(chemin);
      try {
        window.localStorage.setItem(
          cleParCompte("atelier-dossiers-ouverts", graphe.compteId),
          JSON.stringify([...suivants]),
        );
      } catch {
        // La navigation reste fonctionnelle si le stockage navigateur est indisponible.
      }
      return suivants;
    });
  }

  function rendreDossier(noeud: NoeudDossier, profondeur = 0): ReactNode {
    const ferme = !recherche.trim() && !dossiersOuverts.has(noeud.chemin);
    const elementsDossier = [...noeud.elements].sort((a, b) => a.titre.localeCompare(b.titre, "fr"));
    const enfants = [...noeud.enfants].sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
    return (
      <div key={noeud.chemin}>
        <button
          type="button"
          onClick={() => basculerDossier(noeud.chemin)}
          className="flex min-h-9 w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-[0.8125rem] font-semibold text-[var(--rail-texte-attenue)] transition-colors hover:bg-[var(--rail-2)] hover:text-[var(--rail-texte)]"
          style={{ paddingLeft: `${0.5 + profondeur * 0.75}rem` }}
          aria-expanded={!ferme}
        >
          <span className="w-3 text-[var(--rail-texte-discret)]" aria-hidden>{ferme ? "›" : "⌄"}</span>
          <span className="text-[var(--rail-texte-discret)]" aria-hidden>◇</span>
          <span className="truncate">{noeud.nom}</span>
          <span className="ml-auto text-xs font-normal text-[var(--rail-texte-discret)]">
            {compterElements(noeud)}
          </span>
        </button>
        {!ferme && (
          <div>
            {elementsDossier.length > 0 && (
              <ul className="space-y-0.5" style={{ paddingLeft: `${1.25 + profondeur * 0.75}rem` }}>
                {elementsDossier.map((element) => (
                  <li key={element.id}>
                    <button
                      type="button"
                      onClick={() => ouvrirElement(element.id)}
                      className={cx(
                        "flex min-h-9 w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-[0.8125rem] transition-colors",
                        element.id === selection ? "bg-[var(--rail-actif)] font-medium text-[var(--rail-actif-texte)]" : "text-[var(--rail-texte-attenue)] hover:bg-[var(--rail-2)] hover:text-[var(--rail-texte)]",
                      )}
                    >
                      <span className="shrink-0 text-[var(--rail-texte-discret)]" aria-hidden>{element.type === "domaine" ? "▣" : element.source === "projection" ? "○" : "·"}</span>
                      <span className="min-w-0 flex-1 truncate">{element.titre}</span>
                    </button>
                  </li>
                ))}
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

  function ajouterLien() {
    if (!selectionnee || selectionnee.lectureSeule || !selectionnee.contenuCharge || selectionnee.schemaCompatible === false || !cibleLien) return;
    const cible = fichesLiables.find((element) => element.id === cibleLien);
    if (!cible) return;
    if (liensCourants.some((lien) => lien.cible === cible.id)) {
      setMessage(`La fiche « ${cible.titre} » est déjà liée.`);
      return;
    }

    const base = brouillon.trimEnd();
    setBrouillons((anciens) => ({
      ...anciens,
      [selectionnee.id]: `${base}${base ? "\n\n" : ""}[[${cible.id}]]\n`,
    }));
    setCibleLien("");
    setMode("editer");
    setMessage(`Lien vers « ${cible.titre} » ajouté. Enregistre la fiche pour le conserver.`);
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
    if (!selectionnee || selectionnee.frontMatter.role !== "support") return;
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

  function sauvegarder(capturerRevision = false) {
    if (!selectionnee || selectionnee.lectureSeule || !selectionnee.contenuCharge || selectionnee.schemaCompatible === false) return;
    setMessage(null);
    demarrerTransition(async () => {
      try {
        const resultat = await sauvegarderDocumentAction(
          selectionnee.id,
          brouillon,
          capturerRevision,
          selectionnee.updatedAt,
        );
        const analyse = analyserDocumentMarkdown(selectionnee.id, brouillon);
        setElements((anciens) => anciens.map((element) =>
          element.id === selectionnee.id
            ? {
              ...element,
              ...documentDepuisAnalyse(analyse),
              contenuCharge: true,
              ...(resultat?.updatedAt ? { updatedAt: resultat.updatedAt } : {}),
              snapshots: element.snapshots,
            }
            : element,
        ));
        setBrouillons((anciens) => ({ ...anciens, [selectionnee.id]: brouillon }));
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

  async function exporterMarkdown() {
    setMessage(null);
    demarrerTransition(async () => {
      try {
        const fichiers = await exporterDocumentsMarkdownAction();
        fichiers.forEach((fichier, index) => {
          window.setTimeout(() => {
            const lien = document.createElement("a");
            const url = URL.createObjectURL(
              new Blob([fichier.contenuMd], { type: "text/markdown;charset=utf-8" }),
            );
            lien.href = url;
            lien.download = fichier.nomFichier;
            lien.click();
            window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
          }, index * 75);
        });
        setMessage(`${fichiers.length} fichier(s) Markdown exporté(s)`);
      } catch (erreur) {
        setMessage(erreur instanceof Error ? erreur.message : "Export impossible");
      }
    });
  }

  function importerMarkdown(event: ChangeEvent<HTMLInputElement>) {
    const fichiers = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";
    if (fichiers.length === 0) return;
    setMessage(null);
    demarrerTransition(async () => {
      try {
        const resultat = await importerDocumentsAction(
          await Promise.all(
            fichiers.map(async (fichier) => ({
              nomFichier: fichier.name,
              contenuMd: await fichier.text(),
            })),
          ),
        );
        setMessage(`${resultat.importes} document(s) Markdown importé(s)`);
        router.refresh();
      } catch (erreur) {
        setMessage(erreur instanceof Error ? erreur.message : "Import impossible");
      }
    });
  }

  return (
    <section className="relative -mx-2 overflow-hidden rounded-xl border border-bordure bg-surface shadow-[var(--ombre-levee)] lg:-mx-6">
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
      {contexteOuvert && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/35 backdrop-blur-[1px] 2xl:hidden"
          onClick={() => setContexteOuvert(false)}
          aria-label="Fermer le panneau de contexte"
        />
      )}
      <div className="flex min-h-[calc(100vh-8rem)] flex-col lg:grid lg:grid-cols-[20rem_minmax(0,1fr)] 2xl:grid-cols-[20rem_minmax(0,1fr)_23rem]">
        <aside className="flex min-h-0 flex-col border-b border-[var(--rail-bordure)] bg-[var(--rail)] text-[var(--rail-texte)] lg:max-h-[calc(100vh-8rem)] lg:border-b-0 lg:border-r" aria-label="Explorateur documentaire">
          <div className="flex items-center justify-between border-b border-[var(--rail-bordure)] px-4 py-4">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--rail-texte)]">Atelier</h2>
              <p className="mt-1 text-xs text-[var(--rail-texte-discret)]">
                {recherche.trim() ? `${elementsVisibles.length} sur ${elements.length}` : `${elements.length}`} éléments
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={exporterMarkdown}
                disabled={enCours}
                className="rounded-md border border-[var(--rail-bordure)] px-2.5 py-2 text-xs font-medium text-[var(--rail-texte-attenue)] transition-colors hover:bg-[var(--rail-2)] hover:text-[var(--rail-texte)] disabled:opacity-50"
              >
                Exporter .md
              </button>
              <label className="cursor-pointer rounded-md border border-[var(--rail-bordure)] px-2.5 py-2 text-xs font-medium text-[var(--rail-texte-attenue)] transition-colors hover:bg-[var(--rail-2)] hover:text-[var(--rail-texte)]">
                Importer
                <input
                  type="file"
                  accept=".md,text/markdown"
                  multiple
                  onChange={importerMarkdown}
                  className="sr-only"
                  disabled={enCours}
                />
              </label>
            </div>
          </div>

          <div className="border-b border-[var(--rail-bordure)] px-4 py-3">
            <label className="sr-only" htmlFor="recherche-atelier">Rechercher dans l’Atelier</label>
            <input
              id="recherche-atelier"
              type="search"
              value={recherche}
              onChange={(event) => setRecherche(event.target.value)}
              placeholder="Rechercher une fiche…"
              className="w-full rounded-lg border border-[var(--rail-bordure)] bg-[var(--rail-2)] px-3 py-2.5 text-sm text-[var(--rail-texte)] outline-none transition-colors placeholder:text-[var(--rail-texte-discret)] focus:border-[var(--rail-actif)]"
            />
          </div>

          <nav className="min-h-0 flex-1 overflow-y-auto p-3" aria-label="Dossiers, documents et projections">
            {arbreDossiers.map((noeud) => rendreDossier(noeud))}
            {elements.length === 0 && <p className="px-2 py-4 text-xs text-[var(--rail-texte-discret)]">Ton espace est encore vide.</p>}
            {elements.length > 0 && elementsVisibles.length === 0 && <p className="px-2 py-4 text-xs leading-relaxed text-[var(--rail-texte-discret)]">Aucune fiche ne correspond à cette recherche.</p>}
          </nav>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col bg-surface">
          {selectionnee?.vuePedagogique ? (
            <FichePedagogiqueAtelier
              vue={selectionnee.vuePedagogique}
              titre={selectionnee.titre}
              ouvrirElement={ouvrirElement}
              compteId={graphe.compteId}
              modeInitial={modeInitial}
            />
          ) : selectionnee ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-bordure px-6 py-5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs text-texte-discret">
                    <span>{selectionnee.typeLibelle}</span>
                    {selectionnee.lectureSeule && <span className="rounded bg-surface-2 px-1.5 py-0.5">projection</span>}
                    {selectionnee.schemaCompatible === false && <span className="rounded bg-alerte-faible px-1.5 py-0.5 text-alerte">contrat inconnu</span>}
                  </div>
                  <h2 className="mt-1 truncate font-serif text-2xl font-medium tracking-tight">{selectionnee.titre}</h2>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {selectionnee.frontMatter.role === "support" && (
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
                  <div className="flex items-center gap-1 rounded-md border border-bordure p-0.5">
                    {(["editer", "apercu"] as ModeDocument[]).map((option) => (
                      <button key={option} type="button" onClick={() => setMode(option)} className={cx("rounded px-2.5 py-1 text-xs font-medium", mode === option ? "bg-primaire-faible text-primaire" : "text-texte-discret hover:text-texte")}>
                        {option === "editer" ? "Modifier" : "Aperçu"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="min-h-0 flex-1 p-6">
                {!selectionnee.contenuCharge && selectionnee.source === "document" ? (
                  <div className="flex min-h-[28rem] items-center justify-center rounded-md border border-bordure bg-surface-2 p-5 text-sm text-texte-discret" aria-live="polite">
                    Chargement de la fiche…
                  </div>
                ) : snapshotApercu ? (
                  <div className="prose-exo min-h-[28rem] rounded-md border border-bordure bg-surface-2 p-5">
                    <div className="mb-4 flex items-center justify-between gap-3 border-b border-bordure pb-3 text-xs text-texte-discret">
                      <span>Version v{snapshotApercu.version} · {natureSnapshot(snapshotApercu.captureReason) === "preuve" ? "preuve" : "révision"} · {snapshotApercu.capturedAt.slice(0, 10)}</span>
                      <button type="button" onClick={() => setSnapshotApercu(null)} className="font-medium text-primaire hover:underline">Fermer</button>
                    </div>
                    <Markdown contenu={analyserDocumentMarkdown(selectionnee.id, snapshotApercu.contenuMd).corps} />
                  </div>
                ) : mode === "editer" ? (
                  <textarea
                    value={brouillon}
                    onChange={(event) => setBrouillons((anciens) => ({ ...anciens, [selectionnee.id]: event.target.value }))}
                    readOnly={selectionnee.lectureSeule || selectionnee.schemaCompatible === false}
                    className={cx(
                      "h-full min-h-[34rem] w-full resize-none rounded-xl border border-bordure bg-surface-2 p-6 font-mono text-sm leading-7 text-texte outline-none transition-colors focus:border-primaire/50",
                      (selectionnee.lectureSeule || selectionnee.schemaCompatible === false) && "cursor-not-allowed opacity-75",
                    )}
                    aria-label={selectionnee.lectureSeule || selectionnee.schemaCompatible === false ? "Document Markdown en lecture seule" : "Contenu Markdown du document"}
                    aria-readonly={selectionnee.lectureSeule || selectionnee.schemaCompatible === false}
                    spellCheck={false}
                  />
                ) : (
                  <div className="prose-exo min-h-[28rem] rounded-md border border-bordure bg-surface-2 p-5">
                    <Markdown contenu={analyserDocumentMarkdown(selectionnee.id, brouillon).corps} />
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-bordure px-4 py-2.5 text-xs">
                <span className="text-texte-discret" aria-live="polite">{message ?? (selectionnee.lectureSeule ? "Projection en lecture seule" : selectionnee.schemaCompatible === false ? "Contrat Markdown inconnu · lecture seule" : "Markdown comme source de vérité")}</span>
                {!selectionnee.lectureSeule && selectionnee.contenuCharge && selectionnee.schemaCompatible !== false && !snapshotApercu && (
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => sauvegarder(false)} disabled={enCours} className="rounded-md border border-bordure px-3 py-1.5 font-medium text-primaire transition-colors hover:bg-primaire-faible disabled:cursor-not-allowed disabled:opacity-50">
                      {enCours ? "Enregistrement…" : "Enregistrer"}
                    </button>
                    <button type="button" onClick={() => sauvegarder(true)} disabled={enCours} className="rounded-md bg-primaire px-3 py-1.5 font-medium text-primaire-contraste disabled:cursor-not-allowed disabled:opacity-50">
                      Figer une version
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col bg-surface">
              <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-bordure px-6 py-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-texte-discret">Mémoire documentaire</p>
                  <h2 className="mt-1 font-serif text-2xl font-medium tracking-tight">Graphe global</h2>
                </div>
                <span className="text-sm text-texte-discret">Documents, compétences, exercices et thèmes reliés</span>
              </div>
              <div className="min-h-0 flex-1 p-4">
                <GrapheCompetences donnees={graphe.donnees} compteId={graphe.compteId} />
              </div>
            </div>
          )}
        </main>

        <aside
          className={cx(
            "overflow-y-auto border-l border-bordure bg-surface shadow-2xl",
            contexteOuvert
              ? "fixed bottom-4 right-4 top-4 z-50 block w-[min(26rem,calc(100vw-2rem))] rounded-xl border"
              : "hidden",
            "2xl:static 2xl:z-auto 2xl:block 2xl:max-h-[calc(100vh-8rem)] 2xl:w-auto 2xl:rounded-none 2xl:border-y-0 2xl:border-r-0 2xl:shadow-none",
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
          {selectionnee?.vuePedagogique ? (
            <PanneauPedagogiqueAtelier
              vue={selectionnee.vuePedagogique}
              ouvrirElement={ouvrirElement}
              compteId={graphe.compteId}
              generation={generation}
            />
          ) : selectionnee ? (
            <div className="space-y-5 p-4">
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-texte-attenue">Contexte</h2>
                <dl className="mt-3 space-y-2 text-xs">
                  <div className="flex justify-between gap-3"><dt className="text-texte-discret">Type</dt><dd className="text-right font-medium">{selectionnee.typeLibelle}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-texte-discret">Catégorie</dt><dd className="text-right font-medium">{selectionnee.categorie}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-texte-discret">Identifiant</dt><dd className="max-w-[9rem] truncate text-right font-mono text-[0.6875rem]">{selectionnee.id}</dd></div>
                  {selectionnee.snapshots.length > 0 && <div className="flex justify-between gap-3"><dt className="text-texte-discret">Versions gelées</dt><dd className="text-right font-medium">{selectionnee.snapshots.length}</dd></div>}
                </dl>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-texte-attenue">Relations</h3>
                <div className="mt-2 space-y-2 text-xs">
                  {liensCourants.length > 0 ? liensCourants.map((lien, index) => {
                    const cible = trouverCible(lien.cible);
                    return cible ? (
                      <button key={`${lien.cible}-${index}`} type="button" onClick={() => ouvrirElement(cible.id)} className="block text-left text-primaire hover:underline">→ {cible.titre}</button>
                    ) : (
                      <span key={`${lien.cible}-${index}`} className="block text-texte-discret">→ {lien.libelle ?? lien.cible} <span className="text-[0.625rem]">(à résoudre)</span></span>
                    );
                  }) : <p className="text-texte-discret">Aucun lien déclaré.</p>}
                  {selectionnee.entrants.length > 0 && <p className="pt-1 text-texte-discret">Référencé par {selectionnee.entrants.length} document{selectionnee.entrants.length > 1 ? "s" : ""}.</p>}
                  {!selectionnee.lectureSeule && selectionnee.contenuCharge && selectionnee.schemaCompatible !== false && fichesLiables.length > 0 && (
                    <div className="border-t border-bordure pt-3">
                      <label className="block text-[0.6875rem] font-medium text-texte-attenue" htmlFor="ajouter-lien-fiche">
                        Ajouter un lien vers une fiche
                      </label>
                      <div className="mt-1.5 flex gap-1.5">
                        <select
                          id="ajouter-lien-fiche"
                          value={cibleLien}
                          onChange={(event) => setCibleLien(event.target.value)}
                          className="min-w-0 flex-1 rounded-md border border-bordure-controle bg-surface px-2 py-1.5 text-xs"
                        >
                          <option value="">Choisir une fiche…</option>
                          {fichesLiables.map((fiche) => <option key={fiche.id} value={fiche.id}>{fiche.titre}</option>)}
                        </select>
                        <button
                          type="button"
                          onClick={ajouterLien}
                          disabled={!cibleLien}
                          className="shrink-0 rounded-md border border-bordure px-2 py-1.5 text-xs font-medium text-primaire hover:bg-primaire-faible disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Ajouter
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {selectionnee.frontMatter.role === "support" && (
                <div className="border-t border-bordure pt-4">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="text-xs font-semibold text-texte-attenue">Pièces jointes</h3>
                    <span className="text-[0.6875rem] text-texte-discret">{piecesJointes?.length ?? "…"}</span>
                  </div>
                  {piecesJointes === undefined ? (
                    <p className="mt-2 text-xs text-texte-discret">Chargement des PDF…</p>
                  ) : piecesJointes.length > 0 ? (
                    <ul className="mt-2 space-y-1.5">
                      {piecesJointes.map((piece) => (
                        <li key={piece.id} className="flex items-center gap-2 rounded-md border border-bordure bg-surface px-2.5 py-2 text-xs">
                          {piece.url ? (
                            <a href={piece.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-primaire hover:underline" title={piece.nom}>
                              {piece.nom}
                            </a>
                          ) : <span className="min-w-0 flex-1 truncate">{piece.nom}</span>}
                          <span className="shrink-0 text-[0.625rem] text-texte-discret">{Math.max(1, Math.round(piece.tailleOctets / 1024))} Ko</span>
                          {!selectionnee.lectureSeule && (
                            <button type="button" onClick={() => supprimerPieceJointe(piece)} disabled={enCours} className="shrink-0 text-texte-discret hover:text-danger disabled:opacity-50" aria-label={`Supprimer ${piece.nom}`}>
                              ×
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : <p className="mt-2 text-xs leading-relaxed text-texte-discret">Aucun PDF attaché.</p>}
                  {!selectionnee.lectureSeule && selectionnee.schemaCompatible !== false && (
                    <label className="mt-3 inline-flex cursor-pointer rounded-md border border-bordure px-2.5 py-1.5 text-xs font-medium text-primaire hover:bg-primaire-faible has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50">
                      Joindre un PDF
                      <input type="file" accept=".pdf,application/pdf" className="sr-only" onChange={televerserPdf} disabled={enCours} />
                    </label>
                  )}
                  <p className="mt-2 text-[0.6875rem] text-texte-discret">PDF uniquement · 10 Mo maximum.</p>
                </div>
              )}

              {selectionnee.source === "projection" && selectionnee.type === "exercice" && (
                <div className="border-t border-bordure pt-4">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="text-xs font-semibold text-texte-attenue">Tentatives associées</h3>
                    <span className="text-[0.6875rem] text-texte-discret">{selectionnee.tentatives.length}</span>
                  </div>
                  {selectionnee.tentatives.length === 0 ? (
                    <p className="mt-2 text-xs leading-relaxed text-texte-discret">Aucune tentative enregistrée pour cet exercice.</p>
                  ) : (
                    <ul className="mt-2 space-y-2">
                      {selectionnee.tentatives.map((tentative) => (
                        <li key={tentative.id} className="rounded-md border border-bordure bg-surface px-2.5 py-2 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium">{tentative.resultat === "reussi" ? "Réussi" : tentative.resultat === "echec" ? "Échec" : "Partiel"}</span>
                            <span className="text-[0.6875rem] text-texte-discret">{new Date(tentative.fin ?? tentative.debut).toLocaleDateString("fr-FR")}</span>
                          </div>
                          <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[0.6875rem] text-texte-discret">
                            <span>{tentative.statut === "terminee" ? "Terminée" : tentative.statut === "abandonnee" ? "Abandonnée" : "En cours"}</span>
                            {tentative.dureeMin !== undefined && <span>{tentative.dureeMin} min</span>}
                            <span>{tentative.indicesUtilises} indice{tentative.indicesUtilises > 1 ? "s" : ""}</span>
                          </div>
                          {tentative.reponse.trim() && (
                            <p className="mt-1.5 line-clamp-2 text-[0.6875rem] leading-relaxed text-texte-attenue">
                              {tentative.reponse.trim().replace(/\s+/g, " ")}
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <div className="border-t border-bordure pt-4">
                <h3 className="text-xs font-semibold text-texte-attenue">Vue pédagogique</h3>
                <p className="mt-2 text-xs leading-relaxed text-texte-discret">Les compétences et exercices existants apparaissent ici en projection. Les liens Markdown alimentent aussi le graphe central.</p>
                <button type="button" onClick={() => setSelection(null)} className="mt-3 inline-flex text-xs font-medium text-primaire hover:underline">Revenir au graphe central →</button>
              </div>
              {selectionnee.snapshots.length > 0 && (
                <div className="border-t border-bordure pt-4">
                    <h3 className="text-xs font-semibold text-texte-attenue">Historique du document</h3>
                    <p className="mt-2 text-xs leading-relaxed text-texte-discret">Les preuves et les révisions éditoriales sont conservées séparément. Une correction ultérieure ne réécrit jamais une version déjà figée.</p>
                  <div className="mt-2 space-y-1">
                    {selectionnee.snapshots.map((snapshot) => (
                      <button
                        key={snapshot.id}
                        type="button"
                        onClick={() => ouvrirSnapshot(snapshot.id)}
                        className="block w-full rounded px-1.5 py-1 text-left font-mono text-[0.625rem] text-primaire hover:bg-primaire-faible"
                      >
                        v{snapshot.version} · {natureSnapshot(snapshot.captureReason) === "preuve" ? "preuve" : "révision"} · {snapshot.capturedAt.slice(0, 10)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="p-4 text-xs text-texte-discret">Le contexte du document sélectionné apparaîtra ici.</p>
          )}
        </aside>
      </div>
    </section>
  );
}

function compterElements(noeud: NoeudDossier): number {
  return noeud.elements.length + noeud.enfants.reduce((total, enfant) => total + compterElements(enfant), 0);
}
