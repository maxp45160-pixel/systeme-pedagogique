"use server";
import { createHash } from "node:crypto";
import { getDocumentProxy } from "unpdf";
import { revalidatePath } from "next/cache";
import { ajouter, lireParId, dorsaleCompte } from "./db";
import { creerDocument, modifierDocument } from "./documents";
import { comptePiloteDepot } from "./depot-budget";
import { lireDepotDocumentaire, lireSourceDepot } from "./depot-documents";
import { parseInterventionsSeance } from "@/lib/domain/intervention-seance";
import { statutSeance } from "@/lib/domain/seance";
import type { SourceDepot } from "@/lib/documents/depot";
import type { LearningSession } from "@/lib/domain/types";
import { entierDepot } from "@/lib/documents/depot-validation";
import { corpsReformulationDepot, relireCorpsReformulationDepot } from "@/lib/documents/reformulation-depot";
import { renduPourIntervention } from "@/lib/domain/intervention-rendus";

const empreinte = (texte: string) => createHash("sha256").update(texte).digest("hex").slice(0,32);

export async function demarrerLectureDepot(documentId: string, source: SourceDepot, cle: string): Promise<string> {
  const compte = await comptePiloteDepot();
  const depot = await lireDepotDocumentaire(documentId);
  if (!/^[0-9a-f-]{36}$/i.test(cle) || source.documentId!==documentId || typeof source.citation!=="string" || source.citation.length>2000) throw new Error("Source de travail invalide.");
  if (source.pieceId) {
    entierDepot(source.page);
    const fichier = await lireSourceDepot(documentId,source.pieceId);
    let total = 1;
    if (fichier.mimeType === "application/pdf") {
      const pdf = await getDocumentProxy(fichier.octets);
      try { total=pdf.numPages; } finally { await pdf.cleanup(); }
    }
    if (source.page!>total) throw new Error("La page demandée n'existe pas.");
  } else if (source.page!==undefined || !depot.note.trim()) throw new Error("La note source est absente.");
  const id = `ses-depot-${empreinte(`${compte.userId}:${documentId}:${cle}`)}`;
  const ref = {kind:"document" as const,ref:documentId,...(source.pieceId ? {pieceId:source.pieceId,page:source.page} : {})};
  const interventions = parseInterventionsSeance([
    {id:`${id}-lire`,type:"read",label:"Lire le passage choisi",source:ref,expectedEffect:"preparation"},
    {id:`${id}-reformuler`,type:"explain",label:"Reformuler et noter ce qui reste flou",source:ref,expectedEffect:"preparation"},
  ]);
  const existante = await lireParId("sessions",id,compte);
  if (existante) {
    if (JSON.stringify(existante.interventions?.map(i=>i.source))!==JSON.stringify(interventions.map(i=>i.source))) throw new Error("Cette séance a une autre source.");
    return id;
  }
  const seance: LearningSession = {id,date:new Date().toISOString(),domaines:[],skillCodes:[],activites:[],interventions,genereAutomatiquement:false,statut:"en-cours"};
  try { await ajouter("sessions",seance,compte); }
  catch (e) {
    const concurrente = await lireParId("sessions",id,compte);
    if (!concurrente || JSON.stringify(concurrente.interventions?.map(i=>i.source))!==JSON.stringify(interventions.map(i=>i.source))) throw e;
  }
  revalidatePath("/seances");
  revalidatePath("/app");
  return id;
}

async function contexteReformulation(sessionId: string, interventionId: string) {
  const compte = await dorsaleCompte();
  const session = await lireParId("sessions",sessionId,compte);
  const intervention = session?.interventions?.find((i)=>i.id===interventionId);
  if (!session || !intervention || renduPourIntervention(intervention).kind!=="reformulation") throw new Error("Reformulation inaccessible.");
  const id = `reformulation-${empreinte(`${sessionId}:${interventionId}`)}`;
  return {compte,session,intervention,id};
}
export async function lireReformulationDepot(sessionId: string, interventionId: string) {
  const {id,compte,session,intervention} = await contexteReformulation(sessionId,interventionId);
  const {data,error} = await compte.supabase.from("documents").select("contenu_md,updated_at").eq("user_id",compte.userId).eq("id",id).maybeSingle();
  if (error) throw new Error("La reformulation ne peut pas être relue.");
  let compris = "", flou = "";
  if (data) {
    const contenu = relireCorpsReformulationDepot(String(data.contenu_md));
    compris=contenu.compris;flou=contenu.flou;
  }
  return {compris,flou,version:data ? String(data.updated_at) : null,lectureSeule:statutSeance(session)!=="en-cours" || Boolean(intervention.statut)};
}
export async function sauvegarderReformulationDepot(sessionId: string, interventionId: string, compris: string, flou: string, version: string | null) {
  const {compte,session,intervention,id} = await contexteReformulation(sessionId,interventionId);
  if (statutSeance(session)!=="en-cours" || intervention.statut) throw new Error("Cette intervention est déjà close.");
  if (typeof compris!=="string" || typeof flou!=="string" || compris.length>12000 || flou.length>4000) throw new Error("Production trop longue.");
  if (!compris.trim() && !flou.trim()) throw new Error("Écrivez ce que vous avez compris ou ce qui reste flou.");
  const contenu = `---\nid: ${id}\ntype: redaction\ntitle: Reformulation d'un passage\nrole: operationnel\nsource_session: ${JSON.stringify(sessionId)}\nsource_intervention: ${JSON.stringify(interventionId)}\n---\n${corpsReformulationDepot(compris,flou)}`;
  let updatedAt: string;
  if (version) updatedAt = (await modifierDocument(id,contenu,false,version)).updatedAt;
  else {
    const {data,error} = await compte.supabase.from("documents").select("id").eq("user_id",compte.userId).eq("id",id).maybeSingle();
    if (error || data) throw new Error("Une autre version existe. Rechargez avant de remplacer votre texte.");
    await creerDocument(id,contenu,compte);
    const {data:sauve,error:lectureErreur} = await compte.supabase.from("documents").select("contenu_md,updated_at").eq("user_id",compte.userId).eq("id",id).maybeSingle();
    if (lectureErreur || !sauve || sauve.contenu_md!==contenu) throw new Error("Une autre version existe. Votre texte reste à l'écran ; rechargez avant de remplacer la production.");
    updatedAt = String(sauve.updated_at);
  }
  revalidatePath("/seances");
  return {version:updatedAt};
}
