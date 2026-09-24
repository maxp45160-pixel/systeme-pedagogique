import { createHash } from "node:crypto";
import { strToU8, zipSync } from "fflate";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DepotDocumentaire, PageExtraiteDepot } from "@/lib/documents/depot";
import { MODELE_OCR_DEPOT, MODELE_RESTITUTION_DEPOT } from "@/lib/documents/depot";
import { CONTRAT_SOURCES_RESTITUTION } from "@/lib/documents/sources-restitution";
import { coutQwen, QWEN_MODELE } from "@/lib/tutor/qwen-config";
import { VERSION_SCHEMA_RESTITUTION_DEPOT } from "@/lib/tutor/schema-restitution-depot";
const m=vi.hoisted(()=>({lire:vi.fn(),source:vi.fn(),claim:vi.fn(),modifier:vi.fn(),budget:vi.fn(),configuration:vi.fn(),ocr:vi.fn(),restituer:vi.fn(),pdf:vi.fn(),referentiel:vi.fn(),budgetQwen:vi.fn(),ocrQwen:vi.fn(),restituerQwen:vi.fn()}));
vi.mock("./qwen-budget",()=>({budgetQwen:m.budgetQwen}));
vi.mock("@/lib/tutor/depot-qwen",()=>({lireOcrQwen:m.ocrQwen,restituerQwen:m.restituerQwen}));
vi.mock("./depot-budget",()=>({budgetRestantDepot:m.budget,configurationDepotDisponible:m.configuration}));
vi.mock("./depot-documents",()=>({lireDepotDocumentaire:m.lire,lireSourceDepot:m.source,commencerAnalyseDepot:m.claim,modifierAnalyseDepot:m.modifier}));
vi.mock("@/lib/tutor/depot-mistral",()=>({lireOcrDepot:m.ocr,restituerDepot:m.restituer}));
vi.mock("./referentiel",()=>({lireReferentiel:m.referentiel}));
vi.mock("unpdf",()=>({getDocumentProxy:m.pdf}));
import { analyserDepot, preparerAnalyseDepot } from "./depot-analyse";
let depot: DepotDocumentaire;
const octets=new Uint8Array([1,2,3]);
const empreinteSource=createHash("sha256").update(octets).digest("hex");
const page: PageExtraiteDepot={pieceId:"p",page:1,texte:"Notes de physique",incertain:false,empreinteSource};
beforeEach(()=>{
  vi.resetAllMocks();
  depot={id:"d",version:1,titre:"Notes",note:"Question sur le cours",creeLe:"2026-09-06",modifieLe:"2026-09-06",type:"note",competencesLiees:[],pieces:[],analyses:[],corrections:[]};
  m.lire.mockImplementation(async()=>depot);
  m.budget.mockResolvedValue(5_000_000);m.configuration.mockReturnValue(true);
  m.budgetQwen.mockResolvedValue({restant:5_000_000});
  m.claim.mockResolvedValue({analyse:{id:"a"},tentative:"t",nouvelle:true});
  m.source.mockResolvedValue({octets,mimeType:"application/pdf",nom:"Notes.pdf"});
  m.pdf.mockResolvedValue({numPages:2,cleanup:vi.fn()});
  m.ocr.mockResolvedValue([page,{...page,page:2}]);
  m.restituer.mockResolvedValue({elements:[{nature:"sujet",texte:"Question sur le cours",sources:[{citation:"Question sur le cours"}]}]});
  m.referentiel.mockResolvedValue({domaines:[{id:"physique",nom:"Physique",description:"Sciences",archive:false}],actifs:[{code:"PHY-01",intitule:"Analyser une situation physique",domaine:"physique"}]});
});
function ajouterPdf(){depot.pieces=[{id:"p",nom:"Notes.pdf",mimeType:"application/pdf",tailleOctets:3} as DepotDocumentaire["pieces"][number]];}
function ajouterEpub(contenus: string[] = ["<p>Texte EPUB</p>"]) {
  const archive = zipSync(Object.fromEntries(Object.entries({
    mimetype:"application/epub+zip",
    "META-INF/container.xml":'<container><rootfiles><rootfile full-path="livre.opf" media-type="application/oebps-package+xml"/></rootfiles></container>',
    "livre.opf":`<package><manifest>${contenus.map((_, i) => `<item id="s${i}" href="s${i}.xhtml" media-type="application/xhtml+xml"/>`).join("")}</manifest><spine>${contenus.map((_, i) => `<itemref idref="s${i}"/>`).join("")}</spine></package>`,
    ...Object.fromEntries(contenus.map((texte, i) => [`s${i}.xhtml`, `<html><head><title>Section ${i}</title></head><body>${texte}</body></html>`])),
  }).map(([nom, texte]) => [nom, strToU8(texte)])));
  depot.pieces = [{ id:"p", nom:"Livre.epub", mimeType:"application/epub+zip", tailleOctets:archive.length } as DepotDocumentaire["pieces"][number]];
  m.source.mockResolvedValue({octets:archive, mimeType:"application/epub+zip", nom:"Livre.epub"});
  return archive;
}
function lectureTerminee() {
  ajouterPdf(); depot.version=2;
  depot.analyses=[{id:"ancienne",empreinte:"ancienne-empreinte",statut:"terminee",pages:[page,{...page,page:2}],restitution:{version:2}} as DepotDocumentaire["analyses"][number]];
}
function lectureV2AvecSuite() {
  lectureTerminee();
  depot.analyses[0].creeLe = "2026-09-19T00:00:00Z";
  m.pdf.mockResolvedValue({numPages:3,cleanup:vi.fn()});
  m.ocr.mockResolvedValue([{...page,page:3}]);
  m.restituer.mockResolvedValue({elements:[],organisation:{titreSuggere:"Notes",typeSuggere:"note",domaine:null,competences:[],justification:"Note",sources:[{citation:depot.note}]}});
}
describe("orchestration documentaire persistante",()=>{
  it.each([
    {},
    {rangementAnalyseId:"ancienne",rangementOrigine:"assistant"},
    {rangementAnalyseId:"autre-analyse",rangementOrigine:"personne"},
    {rangementAnalyseId:"ancienne",rangementOrigine:"personne",brouillonClassement:{analyseId:"ancienne",domaine:null,codes:[],propositions:[],modifieLe:"2026-09-19",origine:"personne"}},
  ] as Partial<DepotDocumentaire>[])("refuse la suite sans confirmation humaine courante et sans effets : %j", async (classement) => {
    lectureV2AvecSuite(); Object.assign(depot,classement);
    const avant = JSON.stringify(depot);
    const preparation = await preparerAnalyseDepot("d");
    expect(preparation.tranches[0].pages).toEqual([3]);
    await expect(analyserDepot("d",preparation.empreinte,20,false)).rejects.toThrow(/Confirmez d’abord/);
    expect(m.claim).not.toHaveBeenCalled(); expect(m.ocr).not.toHaveBeenCalled(); expect(m.restituer).not.toHaveBeenCalled(); expect(m.modifier).not.toHaveBeenCalled();
    expect(JSON.stringify(depot)).toBe(avant);
  });
  it("la confirmation de la dernière réussite permet de lire la tranche suivante", async () => {
    lectureV2AvecSuite(); depot.rangementAnalyseId="ancienne"; depot.rangementOrigine="personne";
    const p=await preparerAnalyseDepot("d");
    await analyserDepot("d",p.empreinte,20,false);
    expect(m.claim).toHaveBeenCalledTimes(1);
    expect(m.ocr.mock.calls[0][0].pages).toEqual([3]);
    expect(m.restituer).toHaveBeenCalledTimes(1);
    expect(m.modifier).toHaveBeenLastCalledWith("a","t",expect.objectContaining({statut:"terminee"}));
  });
  it("vérifie la réussite la plus récente même si le tableau est dans un autre ordre", async () => {
    lectureV2AvecSuite();
    depot.analyses.push({...depot.analyses[0],id:"plus-recente",creeLe:"2026-09-19T01:00:00Z"});
    depot.rangementAnalyseId="ancienne"; depot.rangementOrigine="personne";
    const p=await preparerAnalyseDepot("d");
    await expect(analyserDepot("d",p.empreinte,20,false)).rejects.toThrow(/Confirmez d’abord/);
    expect(m.claim).not.toHaveBeenCalled();
    depot.rangementAnalyseId="plus-recente";
    await analyserDepot("d",p.empreinte,20,false);
    expect(m.claim).toHaveBeenCalledTimes(1);
  });
  it("le paramètre reprise seul ne contourne pas la confirmation", async () => {
    lectureV2AvecSuite(); const p=await preparerAnalyseDepot("d");
    await expect(analyserDepot("d",p.empreinte,20,true)).rejects.toThrow(/Confirmez d’abord/);
    expect(m.claim).not.toHaveBeenCalled(); expect(m.ocr).not.toHaveBeenCalled(); expect(m.restituer).not.toHaveBeenCalled();
  });
  it.each(["echec","interrompue"] as const)("conserve le réessai explicite d'une tranche %s de même empreinte", async (statut) => {
    lectureV2AvecSuite(); const p=await preparerAnalyseDepot("d");
    depot.analyses.push({...depot.analyses[0],id:"reprise",empreinte:p.empreinte,statut,pages:[{...page,page:3}],restitution:null,creeLe:"2026-09-19T01:00:00Z"});
    await analyserDepot("d",p.empreinte,20,true);
    expect(m.claim).toHaveBeenCalledWith("d",p.empreinte,true);
    expect(m.ocr).not.toHaveBeenCalled(); expect(m.restituer).toHaveBeenCalledTimes(1);
  });
  it("Qwen restitue l'EPUB sans conversion d'image ni coût OCR", async () => {
    const horloge = vi.spyOn(Date,"now").mockReturnValue(Date.parse("2026-09-19T00:00:00Z"));
    try {
      ajouterEpub(); m.restituerQwen.mockResolvedValue({elements:[]});
      const preparation = await preparerAnalyseDepot("d",20,true);
      expect(preparation.coutMaximumMicroDollars).toBe(coutQwen(100000,2500));
      await analyserDepot("d",preparation.empreinte,20,false,undefined,{fournisseur:"qwen",cle:"cle-test-locale"});
      expect(m.ocrQwen).not.toHaveBeenCalled(); expect(m.ocr).not.toHaveBeenCalled(); expect(m.pdf).not.toHaveBeenCalled();
      expect(m.restituerQwen).toHaveBeenCalledTimes(1);
    } finally { horloge.mockRestore(); }
  });
  it("prépare les sections EPUB localement avec coût OCR nul et sans effet payant", async () => {
    ajouterEpub(["<p>Texte.</p><img src='dessin.png'/>"]);
    const preparation = await preparerAnalyseDepot("d");
    expect(preparation.tranches[0]).toMatchObject({unite:"section", pages:[1], sections:[{ chemin:"s0.xhtml", titre:"Section 0", limites:expect.any(Array) }]});
    expect(preparation.coutMaximumMicroEuros).toBe(337500);
    expect(m.ocr).not.toHaveBeenCalled(); expect(m.restituer).not.toHaveBeenCalled(); expect(m.claim).not.toHaveBeenCalled(); expect(m.pdf).not.toHaveBeenCalled();
    await analyserDepot("d", preparation.empreinte, 20, false);
    expect(m.ocr).not.toHaveBeenCalled(); expect(m.restituer).toHaveBeenCalledTimes(1);
    expect(m.restituer.mock.calls[0][1][0]).toMatchObject({page:1, texte:"Texte.", incertain:true, section:{chemin:"s0.xhtml"}});
    expect(m.modifier).toHaveBeenCalledWith("a", "t", expect.objectContaining({ couvertures:[expect.objectContaining({unite:"section", pagesLues:[1]})] }));
  });
  it("poursuit les sections restantes sans relire celles déjà traitées", async () => {
    ajouterEpub(Array.from({length:22}, (_, i) => `<p>Contenu ${i}</p>`));
    const premiere = await preparerAnalyseDepot("d");
    expect(premiere.pagesRestantes).toBe(2);
    await analyserDepot("d", premiere.empreinte, 20, false);
    const pagesLues = m.modifier.mock.calls.find((c) => c[2].pages?.length === 20)![2].pages;
    depot.analyses = [{ id:"terminee", empreinte:premiere.empreinte, statut:"terminee", pages:pagesLues } as DepotDocumentaire["analyses"][number]];
    const suite = await preparerAnalyseDepot("d");
    expect(suite.disponible).toBe(true); expect(suite.tranches[0].pages).toEqual([21,22]); expect(suite.pagesRestantes).toBe(0);
    expect(suite.tranches[0].sections?.map((s) => s.chemin)).toEqual(["s20.xhtml", "s21.xhtml"]);
    expect(m.ocr).not.toHaveBeenCalled();
  });
  it("borne le texte cumulé des sections et annonce celles non traitées", async () => {
    ajouterEpub([`<p>${"a".repeat(30000)}</p>`, `<p>${"b".repeat(30000)}</p>`]);
    const p = await preparerAnalyseDepot("d");
    expect(p.tranches[0].pages).toEqual([1]); expect(p.pagesRestantes).toBe(1);
    expect(m.claim).not.toHaveBeenCalled();
  });
  it("lit une longue section EPUB en tranches bornées, sans perte ni OCR, avec des sources distinctes", async () => {
    const texte = "é".repeat(60_001);
    ajouterEpub([`<p>${texte}</p>`]);
    m.restituer.mockImplementation(async (_note: string, pages: PageExtraiteDepot[]) => ({
      elements: pages.map((p) => ({ nature:"sujet", texte:"Extrait", sources:[{ pieceId:p.pieceId, page:p.page, section:p.section, citation:p.texte.slice(0, 80) }] })),
    }));
    const lues: PageExtraiteDepot[] = [];
    const titres = new Set<string>();
    for (let i = 0; i < 3; i++) {
      const preparation = await preparerAnalyseDepot("d");
      expect(preparation.disponible).toBe(true);
      expect(preparation.tranches[0]).toMatchObject({ unite:"section", totalPages:3, pages:[i + 1] });
      expect(preparation.pagesRestantes).toBe(2 - i);
      m.modifier.mockClear();
      await analyserDepot("d", preparation.empreinte, 20, false);
      const sauvegarde = m.modifier.mock.calls.find((c) => c[2].pages?.length)![2];
      const pages = sauvegarde.pages as PageExtraiteDepot[];
      expect(pages.reduce((n, p) => n + Buffer.byteLength(p.texte, "utf8"), 0)).toBeLessThanOrEqual(50_000);
      expect(pages[0].section?.chemin).toBe("s0.xhtml");
      titres.add(pages[0].section!.titre);
      expect(m.modifier).toHaveBeenLastCalledWith("a", "t", expect.objectContaining({ statut:"terminee" }));
      depot.analyses.push({id:`lecture-${i}`, empreinte:preparation.empreinte, statut:"terminee", pages} as DepotDocumentaire["analyses"][number]);
      lues.push(...pages);
    }
    expect(lues.map((p) => p.texte).join("")).toBe(texte);
    expect(titres.size).toBe(3);
    const fin = await preparerAnalyseDepot("d");
    expect(fin.disponible).toBe(false); expect(fin.pagesRestantes).toBe(0);
    expect(m.ocr).not.toHaveBeenCalled(); expect(m.restituer).toHaveBeenCalledTimes(3);
  });
  it("un EPUB graphique conserve ses limites mais ne déclenche aucune restitution vide", async () => {
    ajouterEpub(["<img src='page.png'/>"]); depot.note="";
    const p=await preparerAnalyseDepot("d");
    expect(p.disponible).toBe(false); expect(p.motifIndisponible).toMatch(/aucun texte/);
    expect(p.tranches).toEqual([]);
    expect(p.sectionsNonAnalysees?.[0].sections[0].limites).toHaveLength(2);
    await expect(analyserDepot("d",p.empreinte,20,false)).rejects.toThrow(/aucun texte/);
    expect(m.claim).not.toHaveBeenCalled(); expect(m.ocr).not.toHaveBeenCalled(); expect(m.restituer).not.toHaveBeenCalled();
  });
  it("une formule non prise en charge seule ne rend pas son marqueur d'omission facturable", async () => {
    ajouterEpub(["<math><maction><mi>x</mi></maction></math>"]); depot.note="";
    const preparation = await preparerAnalyseDepot("d");
    expect(preparation.disponible).toBe(false);
    expect(preparation.tranches).toEqual([]);
    expect(preparation.sectionsNonAnalysees?.[0].sections[0].chemin).toBe("s0.xhtml");
    await expect(analyserDepot("d", preparation.empreinte, 20, false)).rejects.toThrow(/aucun texte/);
    expect(m.claim).not.toHaveBeenCalled(); expect(m.ocr).not.toHaveBeenCalled(); expect(m.restituer).not.toHaveBeenCalled();
  });
  it("vingt sections graphiques ne bloquent pas le texte suivant et ne deviennent jamais lues", async () => {
    ajouterEpub([...Array.from({length:20}, () => "<img src='dessin.png'/>"), "<p>Le texte est ici.</p>"]);
    depot.note=""; m.restituer.mockResolvedValue({elements:[]});
    const preparation = await preparerAnalyseDepot("d");
    expect(preparation.disponible).toBe(true);
    expect(preparation.tranches[0]).toMatchObject({totalPages:21,pages:[21],sections:[{chemin:"s20.xhtml"}]});
    expect(preparation.sectionsNonAnalysees?.[0].sections).toHaveLength(20);
    expect(preparation.pagesRestantes).toBe(0);
    await analyserDepot("d",preparation.empreinte,20,false);
    const sauvegarde = m.modifier.mock.calls.find((c) => c[2].pages?.length)![2];
    expect(sauvegarde.pages.map((p:PageExtraiteDepot) => p.page)).toEqual([21]);
    expect(sauvegarde.couvertures).toEqual([{pieceId:"p",nom:"Livre.epub",totalPages:21,pagesLues:[21],unite:"section"}]);
    expect(m.ocr).not.toHaveBeenCalled();
    depot.analyses=[{id:"terminee",empreinte:preparation.empreinte,statut:"terminee",pages:sauvegarde.pages} as DepotDocumentaire["analyses"][number]];
    const fin = await preparerAnalyseDepot("d");
    expect(fin.disponible).toBe(false); expect(fin.tranches).toEqual([]); expect(fin.pagesRestantes).toBe(0);
    expect(fin.sectionsNonAnalysees?.[0].sections).toHaveLength(20);
    expect(fin.motifIndisponible).toMatch(/restent non analysées/);
    expect(fin.motifIndisponible).not.toMatch(/Tous les extraits/);
    expect((await preparerAnalyseDepot("d")).sectionsNonAnalysees).toEqual(fin.sectionsNonAnalysees);
    expect(m.claim).toHaveBeenCalledTimes(1); expect(m.restituer).toHaveBeenCalledTimes(1);
  });
  it("une note jointe reste analysable sans prétendre lire l'EPUB graphique", async () => {
    ajouterEpub(["<img src='dessin.png'/>"]);
    const p=await preparerAnalyseDepot("d");
    expect(p.disponible).toBe(true); expect(p.tranches).toEqual([]); expect(p.sectionsNonAnalysees).toHaveLength(1);
    await analyserDepot("d",p.empreinte,20,false);
    expect(m.restituer.mock.calls[0][1]).toEqual([]); expect(m.ocr).not.toHaveBeenCalled();
    expect(m.modifier).toHaveBeenLastCalledWith("a","t",expect.objectContaining({statut:"terminee"}));
  });
  it("une modification d'EPUB invalide le devis avant réservation", async () => {
    ajouterEpub(); const p=await preparerAnalyseDepot("d");
    ajouterEpub(["<p>Texte modifié</p>"]);
    await expect(analyserDepot("d",p.empreinte,20,false)).rejects.toThrow(/changé/);
    expect(m.claim).not.toHaveBeenCalled();
  });
  it("ne considère pas comme lue une ancienne transcription EPUB qui omettait la formule", async () => {
    const archive = ajouterEpub(["<p>Formule : <math><msup><mi>x</mi><mn>2</mn></msup></math></p>"]);
    depot.analyses = [{id:"ancienne", empreinte:"ancien-lecteur", statut:"terminee", pages:[{
      pieceId:"p", page:1, texte:"Formule :", incertain:true,
      empreinteSource:createHash("sha256").update(archive).digest("hex"),
      section:{chemin:"s0.xhtml",titre:"Section 0",limites:["Illustrations, formules graphiques et médias non analysés : vérifiez l’original."]},
    }]} as DepotDocumentaire["analyses"][number]];
    const preparation = await preparerAnalyseDepot("d");
    expect(preparation.disponible).toBe(true);
    expect(preparation.tranches[0].pages).toEqual([1]);
    expect(m.claim).not.toHaveBeenCalled(); expect(m.restituer).not.toHaveBeenCalled();
    await analyserDepot("d", preparation.empreinte, 20, false);
    expect(m.restituer.mock.calls[0][1][0].texte).toContain("{x}^{2}");
    expect(m.ocr).not.toHaveBeenCalled();
  });
  function empreinteV2Precedente() {
    return createHash("sha256").update(JSON.stringify({ version:2,sortieMax:8192,note:depot.note,sources:[],tranches:[],ocr:MODELE_OCR_DEPOT,modele:MODELE_RESTITUTION_DEPOT,references:CONTRAT_SOURCES_RESTITUTION,schema:VERSION_SCHEMA_RESTITUTION_DEPOT })).digest("hex");
  }
  function empreinteAvantAncrage(qwen: boolean, qualite = "propositions-transfert-geste-v3") {
    return createHash("sha256").update(JSON.stringify({ version:2, sortieMax:8192, note:depot.note, sources:[], tranches:[], ocr:qwen ? QWEN_MODELE : MODELE_OCR_DEPOT, modele:qwen ? QWEN_MODELE : MODELE_RESTITUTION_DEPOT, references:CONTRAT_SOURCES_RESTITUTION, ...(!qwen ? {schema:"restitution-json-schema-v2"} : {}), qualite })).digest("hex");
  }
  it.each([false, true])("le contrat d'ancrage invalide le devis v3 non exécuté, fournisseur Qwen=%s", async (qwen) => {
    depot.version = 2;
    const ancien = empreinteAvantAncrage(qwen);
    const config = qwen ? {fournisseur:"qwen" as const,cle:"test-factice"} : undefined;
    expect((await preparerAnalyseDepot("d",20,qwen)).empreinte).not.toBe(ancien);
    await expect(analyserDepot("d",ancien,20,false,undefined,config)).rejects.toThrow("changé");
    expect(m.claim).not.toHaveBeenCalled(); expect(m.restituer).not.toHaveBeenCalled(); expect(m.restituerQwen).not.toHaveBeenCalled();
  });
  it.each([[false, "propositions-hierarchie-v2"], [true, "propositions-hierarchie-v2"], [false, "propositions-transfert-geste-v3"], [true, "propositions-transfert-geste-v3"]] as const)("conserve sans mutation la réussite et son absence d'ancrage, Qwen=%s qualité=%s", async (qwen, qualite) => {
    depot.version = 2;
    depot.analyses = [{id:"avant-ancrage",empreinte:empreinteAvantAncrage(qwen, qualite),statut:"terminee",pages:[],restitution:{version:2,organisation:{competences:[]}}} as unknown as DepotDocumentaire["analyses"][number]];
    const avant = JSON.stringify(depot);
    const preparation = await preparerAnalyseDepot("d",20,qwen);
    expect(preparation.analyseExistante?.id).toBe("avant-ancrage");
    expect(preparation.disponible).toBe(false);
    expect(await analyserDepot("d",preparation.empreinte,20,false,undefined,qwen ? {fournisseur:"qwen",cle:"test-factice"} : undefined)).toEqual(depot);
    expect(JSON.stringify(depot)).toBe(avant);
    expect(m.claim).not.toHaveBeenCalled(); expect(m.restituer).not.toHaveBeenCalled(); expect(m.restituerQwen).not.toHaveBeenCalled();
  });
  it.each(["echec", "interrompue", "en-cours"] as const)("un ancien appel v3 %s ne devient pas une réussite", async (statut) => {
    depot.version = 2;
    depot.analyses = [{id:"avant-ancrage",empreinte:empreinteAvantAncrage(false),statut,pages:[],restitution:null} as unknown as DepotDocumentaire["analyses"][number]];
    expect((await preparerAnalyseDepot("d")).analyseExistante).toBeNull();
    expect(m.claim).not.toHaveBeenCalled();
  });
  it("refuse le devis V2 précédent avant tout effet lorsque les règles communes changent", async () => {
    depot.version = 2;
    await expect(analyserDepot("d", empreinteV2Precedente(), 20, false)).rejects.toThrow("changé");
    expect(m.claim).not.toHaveBeenCalled(); expect(m.restituer).not.toHaveBeenCalled();
  });
  it("conserve une réussite V2 précédente sans relancer l’analyse après changement des règles", async () => {
    depot.version = 2;
    depot.analyses = [{ id: "terminee-v2", documentId:"d", empreinte:empreinteV2Precedente(), statut:"terminee", pages:[], couvertures:[], erreur:null, creeLe:"2026-09-18", modifieLe:"2026-09-18", restitution: { version:2, modele:MODELE_RESTITUTION_DEPOT, creeLe:"2026-09-18", couvertures:[], elements:[], organisation:{titreSuggere:"Notes",typeSuggere:"note",domaine:null,competences:[],justification:"Note",sources:[]} } }];
    const preparation = await preparerAnalyseDepot("d");
    expect(preparation.analyseExistante?.id).toBe("terminee-v2");
    expect(preparation.disponible).toBe(false);
    expect(await analyserDepot("d", preparation.empreinte, 20, false)).toEqual(depot);
    expect(m.claim).not.toHaveBeenCalled(); expect(m.restituer).not.toHaveBeenCalled();
  });
  function empreinteHistoriqueNote(references?: string) {
    return createHash("sha256").update(JSON.stringify({version:1,sortieMax:2500,note:depot.note,sources:[],tranches:[],ocr:MODELE_OCR_DEPOT,modele:MODELE_RESTITUTION_DEPOT,...(references ? {references} : {})})).digest("hex");
  }
  it.each(["echec","en-cours","interrompue"] as const)("ne convertit pas un état historique %s en réussite",async(statut)=>{
    for (const references of [undefined,"sources-identifiees-v1","passages-extraits-v1"]) {
      depot.analyses=[{id:"ancienne",documentId:"d",empreinte:empreinteHistoriqueNote(references),statut,pages:[],couvertures:[],erreur:null,creeLe:"2026-09-18",modifieLe:"2026-09-18",restitution:null}];
      const preparation=await preparerAnalyseDepot("d");
      expect(preparation.analyseExistante).toBeNull();expect(preparation.disponible).toBe(true);
    }
    expect(m.claim).not.toHaveBeenCalled();expect(m.restituer).not.toHaveBeenCalled();
  });
  it.each([undefined,"sources-identifiees-v1","passages-extraits-v1"])("invalide un devis ancien avant réservation et envoi : %s",async(references)=>{
    const ancienne=empreinteHistoriqueNote(references);
    expect((await preparerAnalyseDepot("d")).empreinte).not.toBe(ancienne);
    await expect(analyserDepot("d",ancienne,20,false)).rejects.toThrow("changé");
    expect(m.claim).not.toHaveBeenCalled();expect(m.restituer).not.toHaveBeenCalled();expect(m.ocr).not.toHaveBeenCalled();
  });
  it.each([undefined,"sources-identifiees-v1","passages-extraits-v1"])("garde une restitution de note terminée sous un ancien contrat : %s",async(references)=>{
    depot.analyses=[{id:"ancienne",documentId:"d",empreinte:empreinteHistoriqueNote(references),statut:"terminee",pages:[],couvertures:[],erreur:null,creeLe:"2026-09-18",modifieLe:"2026-09-18",restitution:{version:1,modele:MODELE_RESTITUTION_DEPOT,creeLe:"2026-09-18",couvertures:[],elements:[{id:"e",nature:"sujet",texte:"Cours",sources:[{documentId:"d",citation:"cours"}]}]}}];
    const avant=JSON.stringify(depot);
    const preparation=await preparerAnalyseDepot("d");
    expect(preparation.disponible).toBe(false);expect(preparation.analyseExistante?.id).toBe("ancienne");
    expect(await analyserDepot("d",preparation.empreinte,20,false)).toEqual(depot);
    expect(JSON.stringify(depot)).toBe(avant);expect(m.claim).not.toHaveBeenCalled();expect(m.restituer).not.toHaveBeenCalled();
  });
  it("conserve un diagnostic lisible lorsqu’une interruption ne porte aucun message", async () => {
    m.restituer.mockRejectedValue(new Error(""));
    const preparation = await preparerAnalyseDepot("d");
    await analyserDepot("d", preparation.empreinte, 20, false);
    expect(m.modifier).toHaveBeenCalledWith("a", "t", expect.objectContaining({ erreur: "La lecture documentaire a été interrompue sans message d’erreur." }));
  });
  it("prépare le complément sur les pages conservées sans appel payant, OCR ni écriture",async()=>{
    lectureTerminee();
    expect((await preparerAnalyseDepot("d")).disponible).toBe(false);
    const p=await preparerAnalyseDepot("d",20,false,"ancienne");
    expect(p.disponible).toBe(true);expect(p.syntheseDe).toBe("ancienne");
    expect(p.tranches[0].pages).toEqual([1,2]);expect(p.pagesRestantes).toBe(0);
    expect(p.coutMaximumMicroEuros).toBe(422880);
    expect(m.ocr).not.toHaveBeenCalled();expect(m.restituer).not.toHaveBeenCalled();expect(m.claim).not.toHaveBeenCalled();
  });
  it("une reprise explicite de treize transcriptions conservées ne refait aucun OCR",async()=>{
    lectureTerminee();
    const transcriptions=Array.from({length:13},(_,i)=>({...page,page:i+1}));
    depot.analyses[0].pages=transcriptions;
    m.pdf.mockResolvedValue({numPages:13,cleanup:vi.fn()});
    m.restituer.mockResolvedValue({elements:[],organisation:{titreSuggere:"Notes",typeSuggere:"note",domaine:null,competences:[],justification:"Note personnelle",sources:[{citation:depot.note}]}});
    const p=await preparerAnalyseDepot("d",20,false,"ancienne");
    await analyserDepot("d",p.empreinte,20,true,undefined,undefined,"ancienne");
    expect(m.ocr).not.toHaveBeenCalled();expect(m.restituer).toHaveBeenCalledTimes(1);
    expect(m.restituer.mock.calls[0][1]).toEqual(transcriptions);
    expect(m.modifier).toHaveBeenLastCalledWith("a","t",expect.objectContaining({statut:"terminee"}));
  });
  it("le complément réutilise les transcriptions et laisse le classement intact",async()=>{
    lectureTerminee();
    const avant=JSON.stringify(depot);
    const p=await preparerAnalyseDepot("d",20,false,"ancienne");
    await analyserDepot("d",p.empreinte,20,false,undefined,undefined,"ancienne");
    expect(m.ocr).not.toHaveBeenCalled();expect(m.restituer.mock.calls[0][1]).toEqual([page,{...page,page:2}]);
    expect(m.claim).toHaveBeenCalledWith("d",p.empreinte,false);
    expect(JSON.stringify(depot)).toBe(avant);
  });
  it("le reçu du complément empêche une nouvelle facturation au rejeu",async()=>{
    lectureTerminee();
    const p=await preparerAnalyseDepot("d",20,false,"ancienne");
    depot.analyses.push({...depot.analyses[0],id:"nouvelle",empreinte:p.empreinte});
    expect((await preparerAnalyseDepot("d",20,false,"ancienne")).disponible).toBe(false);
    await analyserDepot("d",p.empreinte,20,false,undefined,undefined,"ancienne");
    expect(m.claim).not.toHaveBeenCalled();expect(m.restituer).not.toHaveBeenCalled();
  });
  it("refuse le complément si la source a changé, est absente ou dépasse la sélection",async()=>{
    lectureTerminee();
    await expect(preparerAnalyseDepot("d",20,false,"inconnue")).rejects.toThrow("disponible");
    await expect(preparerAnalyseDepot("d",1,false,"ancienne")).rejects.toThrow("limite");
    depot.analyses[0].pages[0]={...page,empreinteSource:"autre"};
    await expect(preparerAnalyseDepot("d",20,false,"ancienne")).rejects.toThrow("correspondent");
    expect(m.claim).not.toHaveBeenCalled();expect(m.ocr).not.toHaveBeenCalled();
  });
  it("le consentement initial ne peut pas autoriser un complément",async()=>{
    lectureTerminee(); const normal=await preparerAnalyseDepot("d");
    await expect(analyserDepot("d",normal.empreinte,20,false,undefined,undefined,"ancienne")).rejects.toThrow("changé");
    expect(m.claim).not.toHaveBeenCalled();
  });
  it("accepte un dossier de plus de dix fichiers sans élargir la tranche ni appeler l'IA",async()=>{
    ajouterPdf();
    depot.pieces=Array.from({length:25},(_,i)=>({...depot.pieces[0],id:`p${i}`}));
    const p=await preparerAnalyseDepot("d");
    expect(p.tranches.reduce((s,t)=>s+t.pages.length,0)).toBe(20);
    expect(p.pagesRestantes).toBe(30);
    expect(m.ocr).not.toHaveBeenCalled();expect(m.restituer).not.toHaveBeenCalled();
  });
  it("refuse un dossier dépassant la borne avant de charger les originaux",async()=>{
    ajouterPdf();depot.pieces[0].tailleOctets=101*1024*1024;
    await expect(preparerAnalyseDepot("d")).rejects.toThrow("100 Mio");
    expect(m.source).not.toHaveBeenCalled();
  });
  it("prépare un consentement sans exposer les octets ni appeler l'IA",async()=>{
    ajouterPdf();const p=await preparerAnalyseDepot("d");
    expect(p.tranches).toEqual([{pieceId:"p",nom:"Notes.pdf",totalPages:2,pages:[1,2]}]);
    expect(JSON.stringify(p)).not.toContain('"octets"');
    expect(m.ocr).not.toHaveBeenCalled();expect(m.restituer).not.toHaveBeenCalled();expect(m.claim).not.toHaveBeenCalled();
  });
  it("un double lancement perdant ne fait aucun appel payant",async()=>{
    m.claim.mockResolvedValue({nouvelle:false});const p=await preparerAnalyseDepot("d");
    await analyserDepot("d",p.empreinte,20,false);
    expect(m.ocr).not.toHaveBeenCalled();expect(m.restituer).not.toHaveBeenCalled();
  });
  it("un dépôt modifié impose une nouvelle sélection avant envoi",async()=>{
    const p=await preparerAnalyseDepot("d");depot.note="Un autre texte";
    await expect(analyserDepot("d",p.empreinte,20,false)).rejects.toThrow("changé");
    expect(m.claim).not.toHaveBeenCalled();
  });
  it("une page omise reste signalée et ne produit pas de restitution globale",async()=>{
    ajouterPdf();m.ocr.mockResolvedValue([page]);const p=await preparerAnalyseDepot("d");
    await analyserDepot("d",p.empreinte,20,false);
    expect(m.modifier).toHaveBeenCalledWith("a","t",expect.objectContaining({pages:[page],couvertures:[{pieceId:"p",nom:"Notes.pdf",totalPages:2,pagesLues:[1]}]}));
    expect(m.modifier).toHaveBeenLastCalledWith("a","t",expect.objectContaining({statut:"echec"}));
    expect(m.restituer).not.toHaveBeenCalled();expect(depot.pieces).toHaveLength(1);
  });
  it("une reprise utilise le cache inchangé, et seule la page manquante est facturable",async()=>{
    ajouterPdf();depot.analyses=[{statut:"echec",pages:[page]} as DepotDocumentaire["analyses"][number]];
    m.ocr.mockResolvedValue([{...page,page:2}]);const p=await preparerAnalyseDepot("d");
    await analyserDepot("d",p.empreinte,20,true);
    expect(m.ocr.mock.calls[0][0].pages).toEqual([2]);expect(m.claim).toHaveBeenCalledWith("d",p.empreinte,true);
    expect(m.restituer.mock.calls[0][1]).toHaveLength(2);
  });
  it("un cache d'une autre version n'est jamais réutilisé",async()=>{
    ajouterPdf();depot.analyses=[{statut:"terminee",pages:[{...page,empreinteSource:"ancienne"}]} as DepotDocumentaire["analyses"][number]];
    const p=await preparerAnalyseDepot("d");await analyserDepot("d",p.empreinte,20,false);
    expect(m.ocr.mock.calls[0][0].pages).toEqual([1,2]);
  });
  it("budget épuisé ou configuration absente laissent le dépôt consultable",async()=>{
    m.budget.mockResolvedValue(0);const p=await preparerAnalyseDepot("d");expect(p.disponible).toBe(false);
    await expect(analyserDepot("d",p.empreinte,20,false)).rejects.toThrow("Budget");
    expect(m.claim).not.toHaveBeenCalled();expect(depot.note).toBe("Question sur le cours");
  });
  it("une citation inexistante est rejetée après l'appel sans publier de compte rendu",async()=>{
    m.restituer.mockResolvedValue({elements:[{nature:"annotation",texte:"Contrôle demain",sources:[{citation:"Contrôle demain"}]}]});
    const p=await preparerAnalyseDepot("d");await analyserDepot("d",p.empreinte,20,false);
    expect(m.modifier).toHaveBeenLastCalledWith("a","t",expect.objectContaining({statut:"echec"}));
    expect(m.modifier.mock.calls.some(c=>c[2].restitution)).toBe(false);
  });
  it("une ressource V2 transmet l'enum actif puis persiste une proposition validée sans code nouveau",async()=>{
    depot={...depot,version:2,note:"Analyser une situation physique"};
    const preuve={citation:"Analyser une situation physique"};
    m.restituer.mockResolvedValue({elements:[{nature:"sujet",texte:"Situation physique",sources:[preuve]}],organisation:{
      titreSuggere:"Note de physique",typeSuggere:"note",
      domaine:{mode:"existant",id:"physique",justification:"Le domaine est explicite.",sources:[preuve]},
      competences:[{mode:"existante",code:"PHY-01",justification:"Le geste est explicite.",sources:[preuve]}],
      justification:"Il s'agit d'une note.",sources:[preuve],
    }});
    const p=await preparerAnalyseDepot("d");
    await analyserDepot("d",p.empreinte,20,false);
    expect(m.restituer.mock.calls[0][3]).toEqual({domaines:[{id:"physique",nom:"Physique",description:"Sciences"}],competences:[{code:"PHY-01",intitule:"Analyser une situation physique",domaine:"physique"}]});
    expect(m.modifier).toHaveBeenCalledWith("a","t",expect.objectContaining({statut:"terminee",restitution:expect.objectContaining({version:2,organisation:expect.objectContaining({typeSuggere:"note"})})}));
  });
});
