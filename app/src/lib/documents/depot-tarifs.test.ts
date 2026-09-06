import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";
import {coutDepotMicroEuros} from "./depot-validation";
import {BUDGET_DEPOT_MICRO_EUROS} from "./depot";

describe("contrat de coût SQL / application",()=>{
  it("garde les mêmes tarifs, borne mensuelle et limites d'entrée dans les deux couches",()=>{
    const sql=readFileSync(new URL("../../../supabase/migrations/20260906094254_depot_documentaire_pilote.sql",import.meta.url),"utf8");
    const tarifs=sql.match(/montant := p_pages::bigint\*(\d+) \+ p_entree_octets::bigint\*(\d+) \+ p_sortie_max::bigint\*(\d+)/);
    expect(tarifs).not.toBeNull();
    const [page,entree,sortie]=tarifs!.slice(1).map(Number);
    for(const [p,e,s] of [[1,0,0],[20,0,0],[0,100000,2500],[0,1350,800]]) {
      expect(coutDepotMicroEuros(p,e,s)).toBe(p*page+e*entree+s*sortie);
    }
    expect(sql).toContain(`utilise+montant>${BUDGET_DEPOT_MICRO_EUROS}`);
    expect(sql).toContain("p_pages NOT BETWEEN 0 AND 20");
    expect(sql).toContain("p_entree_octets NOT BETWEEN 0 AND 100000");
    expect(sql).toContain("p_sortie_max NOT BETWEEN 0 AND 2500");
  });
});
