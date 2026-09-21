import "server-only";
import { CONTRAT_SOURCES_RESTITUTION, CONTRATS_SOURCES_PRECEDENTS } from "@/lib/documents/sources-restitution";
import { VERSION_SCHEMA_RESTITUTION_DEPOT } from "@/lib/tutor/schema-restitution-depot";
import { budgetQwen } from "./qwen-budget";
import { lireOcrQwen, restituerQwen } from "@/lib/tutor/depot-qwen";
import { QWEN_MODELE, coutQwen } from "@/lib/tutor/qwen-config";
import { configVersEnv, type ConfigTuteurClient } from "@/lib/tutor/cle-client";
import { createHash } from "node:crypto";
import { getDocumentProxy } from "unpdf";
import { budgetRestantDepot, configurationDepotDisponible } from "./depot-budget";
import { commencerAnalyseDepot, lireDepotDocumentaire, lireSourceDepot, modifierAnalyseDepot } from "./depot-documents";
import { lireOcrDepot, restituerDepot } from "@/lib/tutor/depot-mistral";
import { prochainesTranchesDepot, validerElementsDepot, coutDepotMicroEuros, validerOrganisationDepot } from "@/lib/documents/depot-validation";
import { MODELE_OCR_DEPOT, MODELE_RESTITUTION_DEPOT, limiteSortieRestitution, type CouvertureDepot, type PageExtraiteDepot, type PreparationAnalyseDepot, type ReferentielDepotPourModele } from "@/lib/documents/depot";
import { MAX_FICHIERS_DEPOT, MAX_OCTETS_DEPOT, VERSION_QUALITE_RESTITUTION } from "@/lib/documents/depot";
import { lireReferentiel } from "./referentiel";
import { MIME_EPUB } from "@/lib/documents/pieces-jointes";
import { extraireSectionsEpub, VERSION_EXTRACTION_EPUB, MAX_TEXTE_SECTION_EPUB, type SectionExtraiteEpub } from "@/lib/documents/extraction-epub";
import type { SectionDepot } from "@/lib/documents/depot";

const hash = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");

async function preparer(documentId: string, maximum: number, qwen = false, syntheseDe?: string) {
  const lu = await lireDepotDocumentaire(documentId);
  const depot = { ...lu, note: lu.note.trimEnd() };
  if (depot.pieces.length > MAX_FICHIERS_DEPOT || depot.pieces.reduce((s,p)=>s+p.tailleOctets,0) > MAX_OCTETS_DEPOT) throw new Error("Un dépôt est limité à 100 fichiers et 100 Mio.");
  if (depot.version === 2 && depot.pieces.length > 1) throw new Error("Une ressource V2 ne peut porter qu'un fichier.");
  const fichiers: {pieceId:string;nom:string;totalPages:number;source:Awaited<ReturnType<typeof lireSourceDepot>>;empreinteSource:string;unite?:"section";sections?:SectionDepot[];extraits?:SectionExtraiteEpub[];pagesDisponibles?:number[]}[] = [];
  // Séquentiel : au plus un PDF décompressé en mémoire à la fois.
  for (const piece of depot.pieces.toSorted((a,b)=>a.id.localeCompare(b.id))) {
    const source = await lireSourceDepot(documentId,piece.id);
    let totalPages = 1;
    const extraits = source.mimeType === MIME_EPUB ? extraireSectionsEpub(source.octets) : undefined;
    if (extraits) totalPages = extraits.length;
    if (source.mimeType === "application/pdf") {
      const pdf = await getDocumentProxy(source.octets.slice());
      try { totalPages = pdf.numPages; } finally { await pdf.cleanup(); }
    }
    if (!Number.isSafeInteger(totalPages) || totalPages<1 || totalPages>2000) throw new Error("Nombre de pages hors limites pour le pilote.");
    fichiers.push({ pieceId:piece.id,nom:piece.nom,totalPages,source,empreinteSource:hash(source.octets), ...(extraits ? { extraits, unite:"section", sections:extraits.map((e) => e.section), pagesDisponibles:extraits.flatMap((e, i) => e.texte.trim() ? [i + 1] : []) } : {}) });
  }
  const sectionsNonAnalysees = fichiers.flatMap((f) => {
    const sections = f.extraits?.filter((e) => !e.texte.trim()).map((e) => e.section) ?? [];
    return sections.length ? [{pieceId:f.pieceId,nom:f.nom,sections}] : [];
  });
  const valide = (p: PageExtraiteDepot) => fichiers.some((f)=>f.pieceId===p.pieceId && f.empreinteSource===p.empreinteSource && (!f.extraits || (p.texte === f.extraits[p.page - 1]?.texte && p.incertain === f.extraits[p.page - 1]?.incertain && JSON.stringify(p.section) === JSON.stringify(f.extraits[p.page - 1]?.section))));
  const terminees = depot.analyses.filter((a)=>a.statut==="terminee").flatMap((a)=>a.pages).filter(valide);
  const base = syntheseDe ? depot.analyses.find((a) => a.id === syntheseDe && a.statut === "terminee" && a.restitution?.version === 2) : undefined;
  if (syntheseDe && (!base || depot.version !== 2)) throw new Error("La lecture à compléter n'est plus disponible.");
  if (base && (!base.pages.length || base.pages.some((p) => !valide(p)))) throw new Error("Les transcriptions ne correspondent plus au fichier. Préparez une nouvelle lecture.");
  const normale = prochainesTranchesDepot(fichiers,terminees,maximum);
  // Une section n'a pas la taille d'une page : le devis borne aussi le texte EPUB.
  let octetsTexte = 0;
  for (const tranche of normale.tranches) {
    const f = fichiers.find((f) => f.pieceId === tranche.pieceId)!;
    if (!f.extraits) continue;
    const retenues: number[] = [];
    for (const p of tranche.pages) {
      const taille = Buffer.byteLength(f.extraits[p - 1].texte, "utf8");
      if (octetsTexte + taille > MAX_TEXTE_SECTION_EPUB) { normale.pagesRestantes++; continue; }
      octetsTexte += taille; retenues.push(p);
    }
    tranche.pages = retenues;
    tranche.sections = retenues.map((p) => f.extraits![p - 1].section);
  }
  normale.tranches = normale.tranches.filter((t) => t.pages.length);
  const tranches = base ? fichiers.flatMap((f) => {
    const pages = [...new Set(base.pages.filter((p) => p.pieceId === f.pieceId && (!f.pagesDisponibles || f.pagesDisponibles.includes(p.page))).map((p) => p.page))].sort((a,b) => a-b);
    if (pages.some((p) => !Number.isSafeInteger(p) || p < 1 || p > f.totalPages)) throw new Error("Transcription hors des pages du fichier.");
    return pages.length ? [{pieceId:f.pieceId,nom:f.nom,totalPages:f.totalPages,pages,...(f.unite ? { unite:f.unite, sections:pages.map((p) => f.sections![p - 1]) } : {})}] : [];
  }) : normale.tranches;
  const nombrePages = tranches.reduce((n,t) => n+t.pages.length,0);
  if (base && nombrePages > Math.min(maximum,20)) throw new Error("Cette reprise dépasse la limite de 20 pages.");
  const pagesRestantes = base ? fichiers.reduce((n,f) => n+(f.pagesDisponibles?.length ?? f.totalPages),0)-nombrePages : normale.pagesRestantes;
  const tailleEpub = tranches.reduce((s, t) => s + t.pages.reduce((n, p) => n + Buffer.byteLength(fichiers.find((f) => f.pieceId === t.pieceId)?.extraits?.[p - 1]?.texte ?? "", "utf8"), 0), 0);
  if (tailleEpub > MAX_TEXTE_SECTION_EPUB) throw new Error("Cette reprise dépasse la limite de texte EPUB. Choisissez une lecture plus courte.");
  const contrat = { version:depot.version,sortieMax:limiteSortieRestitution(depot.version),note:depot.note,sources:fichiers.map((f)=>[f.pieceId,f.empreinteSource]),tranches,ocr:qwen ? QWEN_MODELE : MODELE_OCR_DEPOT,modele:qwen ? QWEN_MODELE : MODELE_RESTITUTION_DEPOT, ...(fichiers.some((f) => f.extraits) ? { extractionEpub:VERSION_EXTRACTION_EPUB } : {}), ...(syntheseDe ? {syntheseDe,consigne:"competences-par-chapitre-v1"} : {}) };
  const contratPrecedent = { ...contrat, references: CONTRAT_SOURCES_RESTITUTION, ...(!qwen ? { schema: VERSION_SCHEMA_RESTITUTION_DEPOT } : {}) };
  const empreinte = hash(JSON.stringify({ ...contratPrecedent, ...(depot.version === 2 ? { qualite: VERSION_QUALITE_RESTITUTION } : {}) }));
  // Une réussite historique reste une réussite ; seule une demande non terminée change de contrat.
  const empreintesHistoriques = [hash(JSON.stringify(contratPrecedent)), hash(JSON.stringify(contrat)), ...[...CONTRATS_SOURCES_PRECEDENTS, CONTRAT_SOURCES_RESTITUTION].map((references) => hash(JSON.stringify({ ...contrat, references })))];
  const analyseExistante = depot.analyses.find((a)=>a.empreinte===empreinte) ?? depot.analyses.find((a)=>a.statut==="terminee" && empreintesHistoriques.includes(a.empreinte)) ?? null;
  const cache = base ? base.pages : depot.analyses.flatMap((a)=>a.pages).filter(valide);
  const aLire = tranches.filter((t) => t.unite !== "section").reduce((n,t)=>n+t.pages.filter((p)=>!cache.some((c)=>c.pieceId===t.pieceId && c.page===p)).length,0);
  const budget = qwen ? (await budgetQwen()).restant : await budgetRestantDepot();
  const configure = qwen ? Date.now() < Date.parse("2026-10-15T00:00:00Z") : configurationDepotDisponible();
  const epubsSansTexte = fichiers.length > 0 && fichiers.every((f) => f.extraits?.every((e) => !e.texte.trim()));
  const termine = analyseExistante?.statut === "terminee" || (!tranches.length && ((depot.pieces.length>0 && (!epubsSansTexte || !depot.note.trim())) || depot.analyses.some((a)=>a.statut==="terminee" && a.empreinte===empreinte)));
  const rien = !depot.note.trim() && !depot.pieces.length;
  const sansTexteEpub = !depot.note.trim() && epubsSansTexte;
  const coutMaximumMicroEuros = qwen ? aLire * coutQwen(20000,8192) + coutQwen(100000,limiteSortieRestitution(depot.version)) : coutDepotMicroEuros(aLire,100_000,limiteSortieRestitution(depot.version));
  const disponible = configure && !termine && !rien && !sansTexteEpub && budget>=coutMaximumMicroEuros;
  const motifTermine = pagesRestantes > 0 ? "Cette lecture a un compte rendu. D’autres extraits restent à lire."
    : sectionsNonAnalysees.length ? "Le texte extractible a un compte rendu. Les sections sans texte signalées restent non analysées ; consultez l’original ou exportez-les en PDF ou image."
    : "Tous les extraits de ce dépôt ont un compte rendu.";
  const preparation: PreparationAnalyseDepot = { documentId,empreinte,tranches,noteIncluse:Boolean(depot.note),pagesRestantes,coutMaximumMicroEuros,
    ...(sectionsNonAnalysees.length ? { sectionsNonAnalysees } : {}),
    budgetRestantMicroEuros:qwen ? 0 : budget,analyseExistante,disponible,...(syntheseDe ? {syntheseDe} : {}),
    ...(qwen ? { fournisseur: "qwen" as const, coutMaximumMicroDollars: coutMaximumMicroEuros, budgetRestantMicroDollars: budget, coutMaximumMicroEuros: 0 } : {}),
    ...(!disponible ? { motifIndisponible: sansTexteEpub ? "Ces sections EPUB ne contiennent aucun texte extractible. Les illustrations ne sont pas analysées ; exportez-les en PDF ou image pour une lecture séparée." : termine ? motifTermine : rien ? "Ajoutez une note ou un fichier." : !configure ? "Lecture IA non configurée ou tarifs à revérifier ; dépôt et travail manuel disponibles." : "Budget restant insuffisant pour cette tranche." } : {}),
  };
  return { depot,preparation,fichiers,cache };
}
export async function preparerAnalyseDepot(documentId: string, maximum = 20, qwen = false, syntheseDe?: string) { return (await preparer(documentId,maximum,qwen,syntheseDe)).preparation; }

export async function analyserDepot(documentId: string, empreinte: string, maximum: number, reprise: boolean, signal?: AbortSignal, config?: ConfigTuteurClient, syntheseDe?: string) {
  if (config && (config.fournisseur !== "qwen" || !configVersEnv(config).ok)) throw new Error("Configuration documentaire Qwen invalide.");
  signal = AbortSignal.any([AbortSignal.timeout(240_000), ...(signal ? [signal] : [])]);
  const { depot,preparation,fichiers,cache } = await preparer(documentId,maximum,Boolean(config),syntheseDe);
  if (empreinte!==preparation.empreinte) throw new Error("Le dépôt a changé. Relisez la nouvelle sélection avant l'analyse.");
  if (preparation.analyseExistante?.statut==="terminee") return depot;
  if (!preparation.disponible) throw new Error(preparation.motifIndisponible);
  const precedente = depot.analyses.filter((a) => a.statut === "terminee" && a.restitution?.version === 2).toSorted((a, b) => b.creeLe.localeCompare(a.creeLe))[0];
  const reessai = reprise && (preparation.analyseExistante?.statut === "echec" || preparation.analyseExistante?.statut === "interrompue");
  // La tranche suivante ne doit pas remplacer des propositions encore à confirmer.
  // Une simple valeur reprise=true ne suffit pas : le reçu doit désigner l'échec repris.
  if (depot.version === 2 && precedente && !syntheseDe && !reessai && preparation.tranches.some((t) => t.pages.length)
    && (depot.rangementAnalyseId !== precedente.id || depot.rangementOrigine !== "personne" || depot.brouillonClassement)) {
    throw new Error("Confirmez d’abord les choix de classement de la lecture actuelle avant de lire la suite. Vos corrections restent conservées.");
  }
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
      const nouvelles = fichier.extraits ? manquantes.map((p) => ({ pieceId:tranche.pieceId, page:p, ...fichier.extraits![p - 1], empreinteSource:fichier.empreinteSource })) : manquantes.length ? (await (config ? lireOcrQwen({ ...tranche,pages:manquantes },fichier.source,config,signal,async (partielles) => {
        const conservees = [...deja,...partielles.map((p) => ({ ...p,empreinteSource:fichier.empreinteSource }))].toSorted((a,b) => a.page-b.page);
        await modifierAnalyseDepot(id,tentative,{ pages:[...pages,...conservees], couvertures:[...couvertures,{ pieceId:tranche.pieceId,nom:tranche.nom,totalPages:tranche.totalPages,pagesLues:conservees.map((p) => p.page) }],note_source:depot.note });
      }) : lireOcrDepot({ ...tranche,pages:manquantes },fichier.source,`${id}:${tentative}:${tranche.pieceId}`,signal))).map((p)=>({ ...p,empreinteSource:fichier.empreinteSource })) : [];
      const lues = [...deja,...nouvelles].toSorted((a,b)=>a.page-b.page);
      pages.push(...lues);
      couvertures.push({ pieceId:tranche.pieceId,nom:tranche.nom,totalPages:tranche.totalPages,pagesLues:lues.map((p)=>p.page), ...(tranche.unite ? { unite:tranche.unite } : {}) });
      await modifierAnalyseDepot(id,tentative,{pages,couvertures,note_source:depot.note});
      if (lues.length!==tranche.pages.length) throw new Error("Certaines pages n'ont pas été lues. Leur absence est conservée ; vous pouvez reprendre explicitement.");
    }
    await modifierAnalyseDepot(id,tentative,{pages,couvertures,note_source:depot.note});
    let referentielModele: ReferentielDepotPourModele | undefined;
    let referentielValidation: Awaited<ReturnType<typeof lireReferentiel>> | undefined;
    if (depot.version === 2) {
      referentielValidation = await lireReferentiel();
      referentielModele = {
        domaines: referentielValidation.domaines.filter((domaine) => !domaine.archive).map((domaine) => ({ id:domaine.id,nom:domaine.nom,description:domaine.description,parentId:domaine.parentId })),
        competences: referentielValidation.actifs.map((competence) => ({ code:competence.code,intitule:competence.intitule,domaine:competence.domaine })),
      };
    }
    const brut = config ? await restituerQwen(depot.note,pages,config,referentielModele,signal) : await restituerDepot(depot.note,pages,`${id}:${tentative}:restitution`,referentielModele,signal);
    const elements = validerElementsDepot(brut,documentId,depot.note,pages,id);
    const commun = { modele:config ? QWEN_MODELE : MODELE_RESTITUTION_DEPOT,creeLe:new Date().toISOString(),elements,couvertures };
    const restitution = depot.version === 2
      ? { version:2 as const,...commun,organisation:validerOrganisationDepot(brut,documentId,depot.note,pages,{
          domaines:referentielValidation!.domaines.filter((domaine)=>!domaine.archive).map(({id,nom})=>({id,nom})),
          competences:referentielValidation!.actifs.map(({code,intitule})=>({code,intitule})),
        }) }
      : { version:1 as const,...commun };
    await modifierAnalyseDepot(id,tentative,{statut:"terminee",restitution});
  } catch (erreur) {
    const message = erreur instanceof Error && erreur.message.trim() ? erreur.message : "La lecture documentaire a été interrompue sans message d’erreur.";
    await modifierAnalyseDepot(id,tentative,{statut:signal?.aborted ? "interrompue" : "echec",erreur:message.slice(0,2000)});
  }
  return lireDepotDocumentaire(documentId);
}
