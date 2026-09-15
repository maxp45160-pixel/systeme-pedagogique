import { describe, expect, it } from "vitest";
import { coutDepotMicroEuros, prochainesTranchesDepot, validerCouverturesDepot, validerElementsDepot, validerOrganisationDepot, validerSourceDepot } from "./depot-validation";
import { pagesDepuisOcr } from "@/lib/tutor/depot-mistral";
import { parseInterventionSeance, interventionPeutProduireObservation } from "@/lib/domain/intervention-seance";
import { renduPourIntervention } from "@/lib/domain/intervention-rendus";

const pages = [{pieceId:"pdf-a",page:2,texte:"Exercice 3 à reprendre. Date : vendredi ?",incertain:true}];
const source = {pieceId:"pdf-a",page:2,citation:"Exercice 3 à reprendre."};
describe("dépôt documentaire — sources et couverture",()=>{
  it("refuse une citation inventée ou empruntée à une autre page",()=>{
    expect(validerSourceDepot(source,"doc","",pages).documentId).toBe("doc");
    expect(()=>validerSourceDepot({...source,page:1},"doc","",pages)).toThrow();
    expect(()=>validerSourceDepot({...source,citation:"Contrôle le 12 septembre"},"doc","",pages)).toThrow();
    expect(()=>validerSourceDepot({...source,documentId:"autre-compte"},"doc","",pages)).toThrow();
  });
  it("ne transforme pas une sortie sans source en compte rendu",()=>{
    expect(()=>validerElementsDepot({elements:[{nature:"sujet",texte:"Tout est compris",sources:[]}]},"doc","",pages,"a")).toThrow();
    expect(()=>validerElementsDepot({elements:[{nature:"priorite",texte:"À faire",sources:[source]}]},"doc","",pages,"a")).toThrow();
  });
  it("permet une pensée libre sourcée sans créer de fichier",()=>{
    expect(validerSourceDepot({pieceId:null,page:null,citation:"apprendre Rust"},"doc","Un jour apprendre Rust",[])).toEqual({documentId:"doc",citation:"apprendre Rust"});
  });
  it("borne la tranche et déclare les pages restant hors lecture",()=>{
    const result=prochainesTranchesDepot([{pieceId:"pdf-a",nom:"Notes",totalPages:25}],pages);
    expect(result.tranches[0].pages).toHaveLength(20);
    expect(result.tranches[0].pages).not.toContain(2);
    expect(result.pagesRestantes).toBe(4);
    expect(()=>prochainesTranchesDepot([],[],21)).toThrow();
    expect(()=>validerCouverturesDepot([{pieceId:"a",nom:"a",totalPages:2,pagesLues:[3]}])).toThrow();
  });
  it("ne remplace pas une page OCR absente par une page vide fabriquée",()=>{
    const tranche={pieceId:"a",nom:"a",totalPages:2,pages:[1,2]};
    expect(pagesDepuisOcr({pages:[{index:0,markdown:"Notes"}]},tranche)).toHaveLength(1);
    expect(()=>pagesDepuisOcr({pages:[{index:2,markdown:"Autre"}]},tranche)).toThrow();
    expect(()=>pagesDepuisOcr({pages:[{index:0,markdown:"a"},{index:0,markdown:"b"}]},tranche)).toThrow();
  });
  it("borne le coût en micro-euros, sans arrondir une absence en zéro",()=>{
    expect(coutDepotMicroEuros(20,100000,2500)).toBe(497500);
    expect(()=>coutDepotMicroEuros(-1)).toThrow();
    expect(()=>coutDepotMicroEuros(21)).toThrow();
    expect(()=>coutDepotMicroEuros(0,NaN)).toThrow();
  });
});
describe("travail documentaire sans classement",()=>{
  it("conserve le repère et rend la reformulation sans chemin de preuve",()=>{
    const i=parseInterventionSeance({id:"i",type:"explain",label:"Reformuler",source:{kind:"document",ref:"d",pieceId:"p",page:2},expectedEffect:"preparation"});
    expect(i.source.page).toBe(2);
    expect(renduPourIntervention(i).kind).toBe("reformulation");
    expect(interventionPeutProduireObservation(i,"completed")).toBe(false);
    expect(renduPourIntervention({...i,targetSkillCodes:["ABC-01"]}).kind).toBe("feynman");
  });
  it("refuse un repère incomplet ou une page zéro",()=>{
    const i={id:"i",type:"read",label:"Lire",expectedEffect:"preparation"};
    expect(()=>parseInterventionSeance({...i,source:{kind:"document",ref:"d",pieceId:"p",page:0}})).toThrow();
    expect(()=>parseInterventionSeance({...i,source:{kind:"exercise",ref:"d",pieceId:"p",page:2}})).toThrow();
  });
});

describe("organisation V2 strictement proposée",()=>{
  const preuve={pieceId:null,page:null,citation:"Analyser un argument philosophique"};
  const base={
    titreSuggere:"Cours de philosophie",
    typeSuggere:"cours",
    domaine:{mode:"existant",id:"philo",justification:"Le passage traite de philosophie.",sources:[preuve]},
    competences:[{mode:"existante",code:"PHI-01",justification:"La compétence est explicite.",sources:[preuve]}],
    justification:"Le contenu est un cours structuré.",
    sources:[preuve],
  };
  const referentiel={domaines:[{id:"philo",nom:"Philosophie"}],competences:[{code:"PHI-01",intitule:"Analyser un argument philosophique"}]};

  it("accepte uniquement les identifiants et codes fournis par le serveur",()=>{
    const resultat=validerOrganisationDepot({organisation:base},"doc","Analyser un argument philosophique",[],referentiel);
    expect(resultat.competences[0]).toMatchObject({mode:"existante",code:"PHI-01"});
    expect(()=>validerOrganisationDepot({organisation:{...base,domaine:{...base.domaine,id:"inconnu"}}},"doc","Analyser un argument philosophique",[],referentiel)).toThrow("référentiel actif");
    expect(()=>validerOrganisationDepot({organisation:{...base,competences:[{...base.competences[0],code:"IA-99"}]}},"doc","Analyser un argument philosophique",[],referentiel)).toThrow("référentiel actif");
  });

  it("construit l'intitulé d'une compétence nouvelle sans accepter de code modèle",()=>{
    const nouvelle={mode:"nouvelle",verbeAction:"analyser",objet:"un argument philosophique nouveau",palier:"fondamentaux",importance:0.7,domaine:{mode:"existant",id:"philo"},justification:"Le geste est demandé.",sources:[preuve]};
    const resultat=validerOrganisationDepot({organisation:{...base,competences:[nouvelle]}},"doc","Analyser un argument philosophique",[],referentiel);
    expect(resultat.competences[0]).toMatchObject({mode:"nouvelle",intitule:"Analyser un argument philosophique nouveau"});
    expect(resultat.competences[0]).not.toHaveProperty("code");
    expect(()=>validerOrganisationDepot({organisation:{...base,competences:[{...nouvelle,code:"MOD-01"}]}},"doc","Analyser un argument philosophique",[],referentiel)).toThrow("aucun code");
  });

  it("refuse une proposition ou une justification sans citation réelle",()=>{
    expect(()=>validerOrganisationDepot({organisation:{...base,sources:[{...preuve,citation:"citation inventée"}]}},"doc","Analyser un argument philosophique",[],referentiel)).toThrow("citation");
  });
});
