import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DepotDocumentaire, PageExtraiteDepot } from "@/lib/documents/depot";
const m=vi.hoisted(()=>({lire:vi.fn(),source:vi.fn(),claim:vi.fn(),modifier:vi.fn(),budget:vi.fn(),configuration:vi.fn(),ocr:vi.fn(),restituer:vi.fn(),pdf:vi.fn(),referentiel:vi.fn()}));
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
  m.claim.mockResolvedValue({analyse:{id:"a"},tentative:"t",nouvelle:true});
  m.source.mockResolvedValue({octets,mimeType:"application/pdf",nom:"Notes.pdf"});
  m.pdf.mockResolvedValue({numPages:2,cleanup:vi.fn()});
  m.ocr.mockResolvedValue([page,{...page,page:2}]);
  m.restituer.mockResolvedValue({elements:[{nature:"sujet",texte:"Question sur le cours",sources:[{citation:"Question sur le cours"}]}]});
  m.referentiel.mockResolvedValue({domaines:[{id:"physique",nom:"Physique",description:"Sciences",archive:false}],actifs:[{code:"PHY-01",intitule:"Analyser une situation physique",domaine:"physique"}]});
});
function ajouterPdf(){depot.pieces=[{id:"p",nom:"Notes.pdf",mimeType:"application/pdf",tailleOctets:3} as DepotDocumentaire["pieces"][number]];}
function lectureTerminee() {
  ajouterPdf(); depot.version=2;
  depot.analyses=[{id:"ancienne",empreinte:"ancienne-empreinte",statut:"terminee",pages:[page,{...page,page:2}],restitution:{version:2}} as DepotDocumentaire["analyses"][number]];
}
describe("orchestration documentaire persistante",()=>{
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
