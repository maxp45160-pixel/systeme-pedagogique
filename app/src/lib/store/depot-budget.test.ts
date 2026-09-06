import {beforeEach,describe,expect,it,vi} from "vitest";
const m=vi.hoisted(()=>({compte:vi.fn(),ligne:vi.fn()}));
vi.mock("./db",()=>({dorsaleCompte:m.compte}));
import {estPiloteDepot,comptePiloteDepot} from "./depot-budget";
beforeEach(()=>{
  vi.resetAllMocks();
  const query={select:()=>query,eq:()=>query,maybeSingle:m.ligne};
  m.compte.mockResolvedValue({userId:"courant",supabase:{from:()=>query}});
});
describe("activation par compte",()=>{
  it.each([
    [{role:"admin",suspendu_le:null,depot_pilote:true},true],
    [{role:"admin",suspendu_le:null,depot_pilote:false},false],
    [{role:"membre",suspendu_le:null,depot_pilote:true},false],
    [{role:"admin",suspendu_le:"2026-09-06",depot_pilote:true},false],
    [null,false],
  ])("requiert un administrateur actif explicitement activé : %j",async(data,attendu)=>{
    m.ligne.mockResolvedValue({data,error:null});expect(await estPiloteDepot()).toBe(attendu);
    if(!attendu)await expect(comptePiloteDepot()).rejects.toThrow("pilote activé");
  });
  it("échoue fermé si l'activation ne peut pas être lue",async()=>{
    m.ligne.mockResolvedValue({data:null,error:{message:"indisponible"}});
    expect(await estPiloteDepot()).toBe(false);
  });
});
