import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LearningSession } from "@/lib/domain/types";
const m=vi.hoisted(()=>({compte:vi.fn(),lire:vi.fn(),ajouter:vi.fn(),depot:vi.fn(),source:vi.fn(),creer:vi.fn(),modifier:vi.fn()}));
vi.mock("./db",()=>({dorsaleCompte:m.compte,lireParId:m.lire,ajouter:m.ajouter}));
vi.mock("./depot-budget",()=>({comptePiloteDepot:m.compte}));
vi.mock("./depot-documents",()=>({lireDepotDocumentaire:m.depot,lireSourceDepot:m.source}));
vi.mock("./documents",()=>({creerDocument:m.creer,modifierDocument:m.modifier}));
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
import {demarrerLectureDepot,lireReformulationDepot,sauvegarderReformulationDepot} from "./depot-seance-actions";
const cle="00000000-0000-4000-8000-000000000001";
let session:LearningSession|null;
let docs:Map<string,{contenu_md:string;updated_at:string}>;
beforeEach(()=>{
  vi.resetAllMocks();session=null;docs=new Map();
  m.compte.mockResolvedValue({userId:"compte",supabase:{from:()=>{
    let id="";
    const query={select:()=>query,eq:(key:string,value:string)=>{if(key==="id")id=value;return query;},maybeSingle:async()=>({data:docs.get(id)??null,error:null})};
    return query;
  }}});
  m.depot.mockResolvedValue({note:"Une pensée",pieces:[]});
  m.lire.mockImplementation(async()=>session);
  m.ajouter.mockImplementation(async(_table:string,s:LearningSession)=>{session=s;});
  m.creer.mockImplementation(async(id:string,contenu:string)=>{docs.set(id,{contenu_md:contenu,updated_at:"version-1"});});
  m.modifier.mockImplementation(async(id:string,contenu:string,_revision:boolean,version:string)=>{
    if(docs.get(id)?.updated_at!==version)throw new Error("Document modifié ailleurs");
    docs.set(id,{contenu_md:contenu,updated_at:"version-2"});return {updatedAt:"version-2"};
  });
});
async function commencer(){
  const id=await demarrerLectureDepot("depot-note",{documentId:"depot-note",citation:"Une pensée"},cle);
  return {id,intervention:session!.interventions![1].id};
}
describe("séance documentaire et production humaine",()=>{
  it("un double clic crée une seule séance sans domaine, compétence ni mesure",async()=>{
    const {id}=await commencer();
    expect(await demarrerLectureDepot("depot-note",{documentId:"depot-note",citation:"Une pensée"},cle)).toBe(id);
    expect(m.ajouter).toHaveBeenCalledTimes(1);
    expect(session).toMatchObject({domaines:[],skillCodes:[],activites:[],statut:"en-cours"});
    expect(session!.interventions!.map(i=>[i.type,i.expectedEffect,i.proofContract])).toEqual([["read","preparation",undefined],["explain","preparation",undefined]]);
    expect(m.ajouter.mock.calls.every(c=>c[0]==="sessions")).toBe(true);
  });
  it("retrouve le texte après fin et interdit une nouvelle écriture sur la séance close",async()=>{
    const {id,intervention}=await commencer();
    expect(await sauvegarderReformulationDepot(id,intervention,"Avec mes mots","Une question",null)).toEqual({version:"version-1"});
    session!.statut="terminee";
    expect(await lireReformulationDepot(id,intervention)).toMatchObject({compris:"Avec mes mots",flou:"Une question",lectureSeule:true});
    await expect(sauvegarderReformulationDepot(id,intervention,"Autre","","version-1")).rejects.toThrow("close");
    expect(m.modifier).not.toHaveBeenCalled();
  });
  it("sauvegarde aussi une incompréhension seule, sans inventer de compréhension",async()=>{
    const {id,intervention}=await commencer();
    await sauvegarderReformulationDepot(id,intervention,"  ","Je ne comprends pas encore",null);
    expect(await lireReformulationDepot(id,intervention)).toMatchObject({compris:"  ",flou:"Je ne comprends pas encore"});
  });
  it("refuse l'écrasement d'une production concurrente",async()=>{
    const {id,intervention}=await commencer();
    await sauvegarderReformulationDepot(id,intervention,"Version initiale","",null);
    const document=[...docs.values()][0];document.updated_at="autre-version";
    await expect(sauvegarderReformulationDepot(id,intervention,"Remplacement","","version-1")).rejects.toThrow("ailleurs");
    expect((await lireReformulationDepot(id,intervention)).compris).toBe("Version initiale");
  });
  it("ne détourne pas une intervention Feynman ciblée vers la production libre",async()=>{
    const {id,intervention}=await commencer();session!.interventions![1].targetSkillCodes=["PHY-01"];
    await expect(lireReformulationDepot(id,intervention)).rejects.toThrow("inaccessible");
  });
});
