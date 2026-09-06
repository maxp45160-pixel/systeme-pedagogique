import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DepotDocumentaire, PageExtraiteDepot } from "@/lib/documents/depot";
const m=vi.hoisted(()=>({lire:vi.fn(),source:vi.fn(),claim:vi.fn(),modifier:vi.fn(),budget:vi.fn(),configuration:vi.fn(),ocr:vi.fn(),restituer:vi.fn(),pdf:vi.fn()}));
vi.mock("./depot-budget",()=>({budgetRestantDepot:m.budget,configurationDepotDisponible:m.configuration}));
vi.mock("./depot-documents",()=>({lireDepotDocumentaire:m.lire,lireSourceDepot:m.source,commencerAnalyseDepot:m.claim,modifierAnalyseDepot:m.modifier}));
vi.mock("@/lib/tutor/depot-mistral",()=>({lireOcrDepot:m.ocr,restituerDepot:m.restituer}));
vi.mock("unpdf",()=>({getDocumentProxy:m.pdf}));
import { analyserDepot, preparerAnalyseDepot } from "./depot-analyse";
let depot: DepotDocumentaire;
const octets=new Uint8Array([1,2,3]);
const empreinteSource=createHash("sha256").update(octets).digest("hex");
const page: PageExtraiteDepot={pieceId:"p",page:1,texte:"Notes de physique",incertain:false,empreinteSource};
beforeEach(()=>{
  vi.resetAllMocks();
  depot={id:"d",titre:"Notes",note:"Question sur le cours",creeLe:"2026-09-06",pieces:[],analyses:[],corrections:[]};
  m.lire.mockImplementation(async()=>depot);
  m.budget.mockResolvedValue(5_000_000);m.configuration.mockReturnValue(true);
  m.claim.mockResolvedValue({analyse:{id:"a"},tentative:"t",nouvelle:true});
  m.source.mockResolvedValue({octets,mimeType:"application/pdf",nom:"Notes.pdf"});
  m.pdf.mockResolvedValue({numPages:2,cleanup:vi.fn()});
  m.ocr.mockResolvedValue([page,{...page,page:2}]);
  m.restituer.mockResolvedValue({elements:[{nature:"sujet",texte:"Question sur le cours",sources:[{citation:"Question sur le cours"}]}]});
});
function ajouterPdf(){depot.pieces=[{id:"p",nom:"Notes.pdf",mimeType:"application/pdf",tailleOctets:3} as DepotDocumentaire["pieces"][number]];}
describe("orchestration documentaire persistante",()=>{
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
});
