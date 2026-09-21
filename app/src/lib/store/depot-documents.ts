import "server-only";
import { lireCreationDomaineDeleguee } from "@/lib/documents/creation-domaine-deleguee";
import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { lireDocument, creerDocument } from "./documents";
import { lirePiecesJointes } from "./document-attachments";
import { dorsaleCompte } from "./db";
import { comptePiloteDepot } from "./depot-budget";
import { BUCKET_PIECES_JOINTES, estMimePieceJointe, MAX_PIECE_OCTETS } from "@/lib/documents/pieces-jointes";
import { estDepotDocumentaire, MAX_NOTE_DEPOT, SECTION_COMPETENCES_RESSOURCE, VERSION_DEPOT, VERSION_RESSOURCE_DEPOT, type AnalyseDepot, type CouvertureDepot, type DepotDocumentaire, type PageExtraiteDepot, type RestitutionDepot, type ResumeDepotDocumentaire } from "@/lib/documents/depot";
import { objetDepot, texteDepot, validerCouverturesDepot, validerPagesDepot, validerElementsDepot, validerOrganisationDepot } from "@/lib/documents/depot-validation";
import { extraireLiensMarkdown } from "@/lib/documents/markdown";
import { lireValeursSections, sansSections } from "@/lib/documents/sections-markdown";
import { lireBrouillonClassement } from "@/lib/documents/brouillon-classement";
import { lireConfirmationClassement } from "@/lib/documents/confirmation-classement";
import { lireContexteRessource } from "@/lib/documents/contexte-ressource";

export function noteDuDepot(markdown: string): string {
  return markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "").replace(/^\s*# [^\n]*\n\n?/, "");
}
function analyseDepuisLigne(value: unknown): AnalyseDepot {
  const a = objetDepot(value);
  const id = texteDepot(a.id, 100);
  const documentId = texteDepot(a.document_id, 120);
  if (!["en-cours", "terminee", "interrompue", "echec"].includes(String(a.statut))) throw new Error("Statut documentaire invalide.");
  const pages = validerPagesDepot(a.pages);
  const couvertures = validerCouverturesDepot(a.couvertures);
  let restitution: RestitutionDepot | null = null;
  if (a.restitution !== null) {
    const r = objetDepot(a.restitution);
    const commun = { modele: texteDepot(r.modele, 100), creeLe: texteDepot(r.creeLe, 40),
      elements: validerElementsDepot(r, documentId, typeof a.note_source === "string" ? a.note_source : "", pages, id), couvertures: validerCouverturesDepot(r.couvertures) };
    if (r.version === 1) restitution = { version: 1, ...commun };
    else if (r.version === 2) restitution = { version: 2, ...commun,
      // Les anciennes propositions restent lisibles ; les nouveaux doublons sont refusés à l'analyse.
      organisation: validerOrganisationDepot(r, documentId, typeof a.note_source === "string" ? a.note_source : "", pages, undefined, { autoriserDoublonsHistoriques: true }) };
    else throw new Error("Version de restitution inconnue.");
  }
  return { id, documentId, empreinte: texteDepot(a.empreinte, 64), statut: a.statut as AnalyseDepot["statut"], pages, couvertures, restitution,
    erreur: a.erreur === null || a.erreur === "" ? null : texteDepot(a.erreur, 2000), creeLe: texteDepot(a.created_at, 50), modifieLe: texteDepot(a.updated_at, 50) };
}
export interface NouvelleRessourceDepot {
  nature: "note" | "fichier";
  titre: string;
  note: string;
  cheminRelatif?: string;
}

const surUneLigne = (value: string, maximum: number) => value.replace(/[\r\n]+/g, " ").trim().slice(0, maximum);

/** Une réception V2 conserve une ressource autonome ; aucun lot n'est persisté. */
export async function creerRessourceDocumentaire(entree: NouvelleRessourceDepot, cle: string): Promise<string> {
  if (!/^[0-9a-f-]{36}$/i.test(cle) || !["note", "fichier"].includes(entree.nature)) throw new Error("Ressource invalide.");
  if (typeof entree.note !== "string" || entree.note.length > MAX_NOTE_DEPOT) throw new Error("Note trop longue.");
  if (entree.nature === "note" && !entree.note.trim()) throw new Error("La note est vide.");
  if (entree.nature === "fichier" && entree.note) throw new Error("Un fichier et une note restent deux ressources distinctes.");
  const titre = surUneLigne(entree.titre, 200);
  if (!titre) throw new Error("Titre de ressource absent.");
  const cheminRelatif = entree.cheminRelatif ? surUneLigne(entree.cheminRelatif, 500) : "";
  const compte = await comptePiloteDepot();
  const id = `depot-${createHash("sha256").update(`${compte.userId}:${cle}`).digest("hex").slice(0,32)}`;
  const type = entree.nature === "note" ? "note" : "reference";
  const markdown = [
    "---",
    `id: ${id}`,
    `type: ${type}`,
    `title: ${titre}`,
    "role: support",
    `depot_version: ${VERSION_RESSOURCE_DEPOT}`,
    ...(cheminRelatif ? [`source_relative_path: ${cheminRelatif}`] : []),
    "---",
    `# ${titre}`,
    "",
    entree.note,
  ].join("\n");
  const { data, error } = await compte.supabase.from("documents").select("id,contenu_md").eq("user_id", compte.userId).eq("id", id).maybeSingle();
  if (error) throw new Error("La ressource ne peut pas être vérifiée.");
  if (data) {
    if (String(data.contenu_md) !== markdown) throw new Error("Cette réception désigne déjà une autre ressource.");
    return id;
  }
  try {
    await creerDocument(id, markdown, compte);
  } catch (e) {
    const { data: concurrent } = await compte.supabase.from("documents").select("contenu_md").eq("user_id", compte.userId).eq("id", id).maybeSingle();
    if (!concurrent || String(concurrent.contenu_md) !== markdown) throw e;
  }
  revalidatePath("/app");
  return id;
}
export async function lireDepotDocumentaire(id: string): Promise<DepotDocumentaire> {
  const { supabase, userId } = await comptePiloteDepot();
  const document = await lireDocument(id);
  if (!estDepotDocumentaire(document.frontmatter ?? {})) throw new Error("Dépôt introuvable.");
  // Les liens ajoutés par le rangement ne sont ni une nouvelle note ni une source de l'IA.
  const markdownSource = document.frontmatter?.rangement_analyse_id && Number(document.frontmatter.depot_version) === VERSION_RESSOURCE_DEPOT
    ? sansSections(document.contenuMd, [SECTION_COMPETENCES_RESSOURCE]) : document.contenuMd;
  const note = noteDuDepot(markdownSource);
  const [pieces, analyses, corrections] = await Promise.all([
    lirePiecesJointes(id,false),
    supabase.from("document_depot_analyses").select("*").eq("user_id",userId).eq("document_id",id).order("created_at"),
    supabase.from("document_depot_corrections").select("*").eq("user_id",userId).eq("document_id",id).order("created_at"),
  ]);
  if (analyses.error || corrections.error) throw new Error("La lecture du dépôt est indisponible. Les originaux sont conservés dans Mes cours.");
  const frontmatter = document.frontmatter ?? {};
  const version = Number(frontmatter.depot_version) === VERSION_RESSOURCE_DEPOT ? VERSION_RESSOURCE_DEPOT : VERSION_DEPOT;
  const champ = (nom: string) => typeof frontmatter[nom] === "string" && frontmatter[nom].trim() ? frontmatter[nom].trim() : undefined;
  const sectionCompetences = lireValeursSections(document.contenuMd, [SECTION_COMPETENCES_RESSOURCE])[SECTION_COMPETENCES_RESSOURCE] ?? "";
  const brouillonClassement = lireBrouillonClassement(frontmatter.classement_brouillon);
  const confirmation = lireConfirmationClassement(frontmatter.classement_confirmation);
  return { id, version, titre: document.titre ?? "Dépôt", note, creeLe: document.createdAt ?? "", modifieLe: document.updatedAt ?? "", type: document.type ?? "note",
    contextePersonnel: lireContexteRessource(frontmatter),
    ...(champ("domaine") ? { domaineId: champ("domaine") } : {}),
    ...(champ("source_relative_path") ? { sourceRelativePath: champ("source_relative_path") } : {}),
    ...(champ("referentiel_revu_le") ? { referentielRevuLe: champ("referentiel_revu_le") } : {}),
    ...(champ("referentiel_analyse_id") ? { referentielAnalyseId: champ("referentiel_analyse_id") } : {}),
    ...(champ("rangement_revu_le") ? { rangementRevuLe: champ("rangement_revu_le") } : {}),
    ...(champ("rangement_analyse_id") ? { rangementAnalyseId: champ("rangement_analyse_id") } : {}),
    ...(champ("rangement_statut") === "rangee" || champ("rangement_statut") === "a-trier" ? { rangementStatut: champ("rangement_statut") as "rangee"|"a-trier" } : {}),
    ...(champ("rangement_origine") === "assistant" || champ("rangement_origine") === "personne" ? { rangementOrigine: champ("rangement_origine") as "assistant" | "personne" } : {}),
    ...(brouillonClassement ? { brouillonClassement } : {}),
    ...(confirmation?.terminee && confirmation.corrections?.length ? { correctionsClassement: { analyseId: confirmation.analyseId, corrections: confirmation.corrections } } : {}),
    creationDomaineDeleguee: lireCreationDomaineDeleguee(frontmatter.classement_creation_deleguee),
    competencesLiees: extraireLiensMarkdown(sectionCompetences).map(({ cible }) => cible), pieces,
    analyses: (analyses.data ?? []).map(analyseDepuisLigne),
    corrections: (corrections.data ?? []).map((c) => ({ id: texteDepot(c.id,100), elementId: c.element_id === null ? null : texteDepot(c.element_id,120), texte: texteDepot(c.texte), creeLe: texteDepot(c.created_at,50) })),
  };
}
export async function lireDepotsDocumentaires(): Promise<ResumeDepotDocumentaire[]> {
  const { supabase, userId } = await comptePiloteDepot();
  const { data, error } = await supabase.from("documents").select("id,titre,type,frontmatter,created_at").eq("user_id",userId)
    .in("frontmatter->>depot_version",["1","2"]).order("created_at",{ascending:false}).limit(50);
  if (error) throw new Error("Les dépôts récents ne sont pas disponibles.");
  const lignes = (data ?? []) as Array<Record<string, unknown>>;
  const ids = lignes.map((r) => texteDepot(r.id,120));
  const analyses = ids.length ? await supabase.from("document_depot_analyses").select("document_id,statut,created_at").eq("user_id",userId).in("document_id",ids).order("created_at",{ascending:false}) : { data: [], error: null };
  if (analyses.error) throw new Error("L'état des analyses n'est pas disponible.");
  const derniere = new Map<string, AnalyseDepot["statut"]>();
  for (const analyse of (analyses.data ?? []) as Array<Record<string, unknown>>) {
    const documentId = texteDepot(analyse.document_id,120);
    if (!derniere.has(documentId) && ["en-cours","terminee","interrompue","echec"].includes(String(analyse.statut))) derniere.set(documentId, analyse.statut as AnalyseDepot["statut"]);
  }
  return lignes.map((r) => {
    const frontmatter = objetDepot(r.frontmatter);
    const id = texteDepot(r.id,120);
    const version = Number(frontmatter.depot_version) === VERSION_RESSOURCE_DEPOT ? VERSION_RESSOURCE_DEPOT : VERSION_DEPOT;
    const facultatif = (nom:string) => typeof frontmatter[nom] === "string" && frontmatter[nom].trim() ? frontmatter[nom].trim() : undefined;
    return { id, version, titre: texteDepot(r.titre,200), type: texteDepot(r.type,80), creeLe: texteDepot(r.created_at,50),
      ...(derniere.get(id) ? { analyseStatut: derniere.get(id) } : {}),
      ...(facultatif("referentiel_revu_le") ? { referentielRevuLe: facultatif("referentiel_revu_le") } : {}),
      ...(facultatif("rangement_revu_le") ? { rangementRevuLe: facultatif("rangement_revu_le") } : {}),
      ...(facultatif("rangement_statut") === "rangee" || facultatif("rangement_statut") === "a-trier" ? { rangementStatut: facultatif("rangement_statut") as "rangee"|"a-trier" } : {}),
    };
  });
}
export async function ajouterCorrectionDepot(documentId: string, elementId: string | null, texte: string, cle: string): Promise<void> {
  texteDepot(texte);
  if (!/^[0-9a-f-]{36}$/i.test(cle)) throw new Error("Identifiant de correction invalide.");
  const depot = await lireDepotDocumentaire(documentId);
  if (elementId !== null && !depot.analyses.some((a) => a.restitution?.elements.some((e) => e.id === elementId))) throw new Error("L'élément à corriger n'existe pas dans ce dépôt.");
  const existante = depot.corrections.find((c) => c.id === cle);
  if (existante) {
    if (existante.texte !== texte || existante.elementId !== elementId) throw new Error("Cette correction a déjà été enregistrée différemment.");
    return;
  }
  const { supabase, userId } = await comptePiloteDepot();
  const { error } = await supabase.from("document_depot_corrections").insert({ id:cle,user_id:userId,document_id:documentId,element_id:elementId,texte });
  if (error) {
    const {data:concurrent} = await supabase.from("document_depot_corrections").select("document_id,element_id,texte").eq("user_id",userId).eq("id",cle).maybeSingle();
    if (!concurrent || concurrent.document_id!==documentId || concurrent.element_id!==elementId || concurrent.texte!==texte) throw new Error("La correction n'a pas été enregistrée. Son identifiant existe peut-être pour un autre texte.");
  }
  revalidatePath("/app");
}
export async function lireSourceDepot(documentId: string, pieceId: string) {
  const { supabase, userId } = await dorsaleCompte();
  const { data, error } = await supabase.from("document_attachments").select("storage_path,mime_type,file_name,size_bytes")
    .eq("user_id",userId).eq("document_id",documentId).eq("id",pieceId).maybeSingle();
  if (error || !data || !estMimePieceJointe(data.mime_type) || !String(data.storage_path).startsWith(`${userId}/${documentId}/`)) throw new Error("Fichier source introuvable.");
  const fichier = await supabase.storage.from(BUCKET_PIECES_JOINTES).download(String(data.storage_path));
  if (fichier.error || !fichier.data || fichier.data.size !== Number(data.size_bytes) || fichier.data.size > MAX_PIECE_OCTETS) throw new Error("Le fichier source ne peut pas être lu.");
  return { octets: new Uint8Array(await fichier.data.arrayBuffer()), mimeType: data.mime_type, nom: String(data.file_name) };
}
export async function commencerAnalyseDepot(documentId: string, empreinte: string, reprise: boolean) {
  await lireDepotDocumentaire(documentId);
  const { supabase } = await comptePiloteDepot();
  const { data, error } = await supabase.rpc("depot_demarrer_compte", { p_document_id:documentId,p_empreinte:empreinte,p_reprise:reprise });
  if (error) throw new Error("L'analyse ne peut pas être démarrée.");
  const r = objetDepot(data);
  const ligne = objetDepot(r.analyse);
  return { analyse: analyseDepuisLigne(ligne), tentative: texteDepot(ligne.tentative,100), nouvelle: r.nouvelle === true };
}
export async function modifierAnalyseDepot(id: string, tentative: string, valeurs: { pages?: PageExtraiteDepot[]; couvertures?: CouvertureDepot[]; restitution?: RestitutionDepot; statut?: AnalyseDepot["statut"]; erreur?: string; note_source?: string }) {
  const { supabase } = await comptePiloteDepot();
  const { data, error } = await supabase.rpc("depot_modifier_analyse_compte", { p_id:id,p_tentative:tentative,p_valeurs:valeurs });
  if (error || data !== true) throw new Error("L'analyse a été interrompue ou reprise ailleurs.");
}
