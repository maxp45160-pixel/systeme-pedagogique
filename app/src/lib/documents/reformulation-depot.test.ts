import {describe,expect,it} from "vitest";
import {corpsReformulationDepot,relireCorpsReformulationDepot} from "./reformulation-depot";
describe("production humaine de reformulation",()=>{
  it("conserve exactement les caractères et les titres saisis, même ambigus",()=>{
    const compris="\nUne équation : α + β = 2\n\n## Ce qui reste flou\nMes propres titres.";
    const flou="Pourquoi ?\n  ";
    expect(relireCorpsReformulationDepot(`---\nid: doc\n---\n${corpsReformulationDepot(compris,flou)}`)).toEqual({compris,flou});
  });
  it("une édition manuelle ne se fait pas écraser par une ancienne copie du formulaire",()=>{
    const original=corpsReformulationDepot("Version initiale","Question");
    expect(()=>relireCorpsReformulationDepot(original.replace("Version initiale","Correction manuelle"))).toThrow("modifiée ailleurs");
  });
});
