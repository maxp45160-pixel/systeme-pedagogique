import "server-only";
import { createHash } from "node:crypto";
import { getDocumentProxy } from "unpdf";
import { budgetRestantDepot, configurationDepotDisponible } from "./depot-budget";
import { commencerAnalyseDepot, lireDepotDocumentaire, lireSourceDepot, modifierAnalyseDepot } from "./depot-documents";
import { lireOcrDepot, restituerDepot } from "@/lib/tutor/depot-mistral";
import { prochainesTranchesDepot, validerElementsDepot, coutDepotMicroEuros } from "@/lib/documents/depot-validation";
import { MODELE_OCR_DEPOT, MODELE_RESTITUTION_DEPOT, MAX_SORTIE_RESTITUTION, type CouvertureDepot, type PageExtraiteDepot, type PreparationAnalyseDepot } from "@/lib/documents/depot";
import { MAX_FICHIERS_DEPOT, MAX_OCTETS_DEPOT } from "@/lib/documents/depot";

const hash = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");

async function preparer(documentId: string, maximum: number) {
  const depot = await lireDepotDocumentaire(documentId);
  if (depot.pieces.length > MAX_FICHIERS_DEPOT || depot.pieces.reduce((s,p)=>s+p.tailleOctets,0) > MAX_OCTETS_DEPOT) throw new Error("Un dépôt est limité à 100 fichiers et 100 Mio.");
  const fichiers: {pieceId:string;nom:string;totalPages:number;source:Awaited<ReturnType<typeof lireSourceDepot>>;empreinteSource:string}[] = [];
  // Séquentiel : au plus un PDF décompressé en mémoire à la fois.
  for (const piece of depot.pieces.toSorted((a,b)=>a.id.localeCompare(b.id))) {
    const source = await lireSourceDepot(documentId,piece.id);
    let totalPages = 1;
    if (source.mimeType === "application/pdf") {
      const pdf = await getDocumentProxy(source.octets.slice());
      try { totalPages = pdf.numPages; } finally { await pdf.cleanup(); }
    }
    if (!Number.isSafeInteger(totalPages) || totalPages<1 || totalPages>2000) throw new Error("Nombre de pages hors limites pour le pilote.");
    fichiers.push({ pieceId:piece.id,nom:piece.nom,totalPages,source,empreinteSource:hash(source.octets) });
  }
  const valide = (p: PageExtraiteDepot) => fichiers.some((f)=>f.pieceId===p.pieceId && f.empreinteSource===p.empreinteSource);
  const terminees = depot.analyses.filter((a)=>a.statut==="terminee").flatMap((a)=>a.pages).filter(valide);
  const { tranches, pagesRestantes } = prochainesTranchesDepot(fichiers,terminees,maximum);
  const empreinte = hash(JSON.stringify({ version:1,note:depot.note,sources:fichiers.map((f)=>[f.pieceId,f.empreinteSource]),tranches,ocr:MODELE_OCR_DEPOT,modele:MODELE_RESTITUTION_DEPOT }));
  const analyseExistante = depot.analyses.find((a)=>a.empreinte===empreinte) ?? null;
  const cache = depot.analyses.flatMap((a)=>a.pages).filter(valide);
  const aLire = tranches.reduce((n,t)=>n+t.pages.filter((p)=>!cache.some((c)=>c.pieceId===t.pieceId && c.page===p)).length,0);
  const budget = await budgetRestantDepot();
  const termine = !tranches.length && (depot.pieces.length>0 || depot.analyses.some((a)=>a.statut==="terminee" && a.empreinte===empreinte));
  const rien = !depot.note.trim() && !depot.pieces.length;
  const coutMaximumMicroEuros = coutDepotMicroEuros(aLire,100_000,MAX_SORTIE_RESTITUTION);
  const disponible = configurationDepotDisponible() && !termine && !rien && budget>=coutMaximumMicroEuros;
  const preparation: PreparationAnalyseDepot = { documentId,empreinte,tranches,noteIncluse:Boolean(depot.note),pagesRestantes,coutMaximumMicroEuros,
    budgetRestantMicroEuros:budget,analyseExistante,disponible,
    ...(!disponible ? { motifIndisponible: termine ? "Toutes les pages de ce dépôt ont un compte rendu." : rien ? "Ajoutez une note ou un fichier." : !configurationDepotDisponible() ? "Lecture IA non configurée ou tarifs à revérifier ; dépôt et travail manuel disponibles." : "Budget restant insuffisant pour cette tranche." } : {}),
  };
  return { depot,preparation,fichiers,cache };
}
export async function preparerAnalyseDepot(documentId: string, maximum = 20) { return (await preparer(documentId,maximum)).preparation; }

export async function analyserDepot(documentId: string, empreinte: string, maximum: number, reprise: boolean, signal?: AbortSignal) {
  signal = AbortSignal.any([AbortSignal.timeout(240_000), ...(signal ? [signal] : [])]);
  const { depot,preparation,fichiers,cache } = await preparer(documentId,maximum);
  if (empreinte!==preparation.empreinte) throw new Error("Le dépôt a changé. Relisez la nouvelle sélection avant l'analyse.");
  if (preparation.analyseExistante?.statut==="terminee") return depot;
  if (!preparation.disponible) throw new Error(preparation.motifIndisponible);
  const claim = await commencerAnalyseDepot(documentId,empreinte,reprise);
  if (!claim.nouvelle) return lireDepotDocumentaire(documentId);
  const { id } = claim.analyse;
  const { tentative } = claim;
  const pages: PageExtraiteDepot[] = [];
  const couvertures: CouvertureDepot[] = [];
  try {
    for (const tranche of preparation.tranches) {
      const fichier = fichiers.find((f)=>f.pieceId===tranche.pieceId)!;
      const deja = tranche.pages.flatMap((page)=>{ const p=cache.find((c)=>c.pieceId===tranche.pieceId && c.page===page); return p ? [p] : []; });
      const manquantes = tranche.pages.filter((p)=>!deja.some((c)=>c.page===p));
      const nouvelles = manquantes.length ? (await lireOcrDepot({ ...tranche,pages:manquantes },fichier.source,`${id}:${tentative}:${tranche.pieceId}`,signal)).map((p)=>({ ...p,empreinteSource:fichier.empreinteSource })) : [];
      const lues = [...deja,...nouvelles].toSorted((a,b)=>a.page-b.page);
      pages.push(...lues);
      couvertures.push({ pieceId:tranche.pieceId,nom:tranche.nom,totalPages:tranche.totalPages,pagesLues:lues.map((p)=>p.page) });
      await modifierAnalyseDepot(id,tentative,{pages,couvertures,note_source:depot.note});
      if (lues.length!==tranche.pages.length) throw new Error("Certaines pages n'ont pas été lues. Leur absence est conservée ; vous pouvez reprendre explicitement.");
    }
    await modifierAnalyseDepot(id,tentative,{pages,couvertures,note_source:depot.note});
    const brut = await restituerDepot(depot.note,pages,`${id}:${tentative}:restitution`,signal);
    const elements = validerElementsDepot(brut,documentId,depot.note,pages,id);
    await modifierAnalyseDepot(id,tentative,{statut:"terminee",restitution:{version:1,modele:MODELE_RESTITUTION_DEPOT,creeLe:new Date().toISOString(),elements,couvertures}});
  } catch (erreur) {
    const message = erreur instanceof Error ? erreur.message : "La lecture documentaire a échoué.";
    await modifierAnalyseDepot(id,tentative,{statut:signal?.aborted ? "interrompue" : "echec",erreur:message.slice(0,2000)});
  }
  return lireDepotDocumentaire(documentId);
}
