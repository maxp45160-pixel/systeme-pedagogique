import { describe,expect,it } from "vitest";
import type { DepotDocumentaire,RestitutionDepotV2 } from "./depot";
import { appliquerRangementDepot,branchesProposeesDepot,rangementProposeDepot,type ContexteOrganisationDepot } from "./organisation-depot";

const source={documentId:"doc",citation:"Analyser un argument philosophique"};
function restitution(): RestitutionDepotV2 {
  return {version:2,modele:"test",creeLe:"2026-09-09T09:00:00Z",couvertures:[],elements:[],organisation:{
    titreSuggere:"Philosophie — arguments",typeSuggere:"cours",
    domaine:{mode:"nouveau",nom:"Philosophie",description:"Étude raisonnée des idées.",justification:"Le thème est explicite.",sources:[source]},
    competences:[{mode:"nouvelle",intitule:"analyser un argument philosophique",verbeAction:"analyser",objet:"un argument philosophique",palier:"fondamentaux",importance:0.7,domaine:{mode:"nouveau",nom:"Philosophie"},justification:"Le geste est explicite.",sources:[source]}],
    justification:"Le passage est un cours.",sources:[source],
  }};
}
function depot(id: string,titre: string,analyseId: string): DepotDocumentaire {
  return {id,version:2,titre,type:"reference",note:"Analyser un argument philosophique",creeLe:"2026-09-09T08:00:00Z",modifieLe:"2026-09-09T08:00:00Z",competencesLiees:[],pieces:[],corrections:[],analyses:[{id:analyseId,documentId:id,empreinte:"empreinte",statut:"terminee",erreur:null,creeLe:"2026-09-09T09:00:00Z",modifieLe:"2026-09-09T09:00:00Z",pages:[],couvertures:[],restitution:restitution()}]};
}
const contexte:ContexteOrganisationDepot={compteId:"compte",domaines:[{id:"philo",nom:"Philosophie",prefixe:"PHI",description:""}],competences:[{code:"PHI-01",intitule:"analyser un argument philosophique",domaine:"philo",domaineNom:"Philosophie"}]};

describe("organisation humaine des ressources",()=>{
  it("agrège et déduplique les branches du jour",()=>{
    const vide={...contexte,domaines:[],competences:[]};
    const branches=branchesProposeesDepot([depot("a","Cours A","analyse-a"),depot("b","Cours B","analyse-b")],vide);
    expect(branches).toHaveLength(1);
    expect(branches[0].competences).toHaveLength(1);
    expect(branches[0].ressources).toEqual(["Cours A","Cours B"]);
  });

  it("réutilise l'homonyme créé et conserve les liens déjà acceptés",()=>{
    const ressource={...depot("doc","Cours","analyse-2"),competencesLiees:["HIST-02"]};
    const proposition=rangementProposeDepot(ressource,{...contexte,competences:[...contexte.competences,{code:"HIST-02",intitule:"Comparer deux sources historiques",domaine:"hist",domaineNom:"Histoire"}]});
    expect(proposition?.domaineId).toBe("philo");
    expect(proposition?.codes).toEqual(["HIST-02","PHI-01"]);
  });

  it("une nouvelle analyse ne ressuscite pas une ancienne proposition refusée",()=>{
    const ressource=depot("doc","Cours","analyse-1");
    const recente:RestitutionDepotV2={...restitution(),creeLe:"2026-09-09T10:00:00Z",organisation:{...restitution().organisation,competences:[]}};
    ressource.analyses.push({id:"analyse-2",documentId:"doc",empreinte:"empreinte-2",statut:"terminee",erreur:null,creeLe:recente.creeLe,modifieLe:recente.creeLe,pages:[],couvertures:[],restitution:recente});
    expect(rangementProposeDepot(ressource,contexte)?.codes).toEqual([]);
  });

  it("ne remplace que la section de liens gérée",()=>{
    const md="---\ntitle: Ancien\ntype: reference\nrole: support\n---\n\n# Ancien\n\n## Notes\n\n[[LIBRE-99]]\n";
    const range=appliquerRangementDepot(md,{titre:"Nouveau",type:"cours",domaineId:"philo",codes:["PHI-01"],analyseId:"analyse-2"},"2026-09-09T10:00:00Z","empreinte");
    expect(range).toContain("[[LIBRE-99]]");
    expect(range).toContain("## Compétences liées");
    expect(range).toContain("- [[PHI-01]]");
    expect(range).toContain("rangement_analyse_id: analyse-2");
    expect(range).toContain("rangement_statut: rangee");
  });

  it("un maintien à trier garde les liens précédemment acceptés",()=>{
    const md="---\ntitle: Cours\ntype: cours\nrole: support\n---\n\n# Cours\n\n## Compétences liées\n\n- [[PHI-01]]\n";
    const range=appliquerRangementDepot(md,{titre:"Cours",type:"cours",codes:["PHI-01"],analyseId:"analyse-3",aTrier:true},"2026-09-09T11:00:00Z","empreinte");
    expect(range).toContain("rangement_statut: a-trier");
    expect(range).toContain("- [[PHI-01]]");
  });
});
