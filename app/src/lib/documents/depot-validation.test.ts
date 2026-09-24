import { describe, expect, it } from "vitest";
import { coutDepotMicroEuros, prochainesTranchesDepot, validerCouverturesDepot, validerElementsDepot, validerOrganisationDepot, validerSourceDepot } from "./depot-validation";
import { pagesDepuisOcr } from "@/lib/tutor/depot-mistral";
import { parseInterventionSeance, interventionPeutProduireObservation } from "@/lib/domain/intervention-seance";
import { renduPourIntervention } from "@/lib/domain/intervention-rendus";

const pages = [{pieceId:"pdf-a",page:2,texte:"Exercice 3 à reprendre. Date : vendredi ?",incertain:true}];
const source = {pieceId:"pdf-a",page:2,citation:"Exercice 3 à reprendre."};
describe("dépôt documentaire — sources et couverture",()=>{
  it("refuse un sommaire recomposé et accepte ses cellules citées séparément", () => {
    const sommaire = [{ pieceId: "livret", page: 1, texte: "| Fractions | 1 |\n| --- | --- |\n| Puissances | 2 |", incertain: false }];
    expect(() => validerSourceDepot({ pieceId: "livret", page: 1, citation: "Fractions | Puissances" }, "doc", "", sommaire)).toThrow("citation n'existe pas");
    for (const citation of ["Fractions", "Puissances"]) {
      expect(validerSourceDepot({ pieceId: "livret", page: 1, citation }, "doc", "", sommaire).citation).toBe(citation);
    }
  });
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

  it("refuse les doublons nouveaux malgré casse, blancs et Unicode, sans modifier la réponse",()=>{
    const nouvelle={mode:"nouvelle",verbeAction:"analyser",objet:"une idée",palier:"fondamentaux",importance:0.5,domaine:{mode:"existant",id:"philo"},justification:"Geste proposé",sources:[preuve]};
    const reponse={organisation:{...base,competences:[nouvelle,{...nouvelle,objet:" UNE  IDE\u0301E "}]}};
    const avant=structuredClone(reponse);
    expect(()=>validerOrganisationDepot(reponse,"doc",preuve.citation,[],referentiel)).toThrow("plusieurs fois");
    expect(reponse).toEqual(avant);
  });

  it("garde deux gestes distincts sur le même objet même s'ils citent le même passage",()=>{
    const nouvelle={mode:"nouvelle",verbeAction:"analyser",objet:"une idée",palier:"fondamentaux",importance:0.5,domaine:{mode:"existant",id:"philo"},justification:"Geste proposé",sources:[preuve]};
    const resultat=validerOrganisationDepot({organisation:{...base,competences:[nouvelle,{...nouvelle,verbeAction:"expliquer"}]}},"doc",preuve.citation,[],referentiel);
    expect(resultat.competences.map(c=>c.mode === "nouvelle" && c.intitule)).toEqual(["Analyser une idée","Expliquer une idée"]);
  });

  it("relit les anciens doublons uniquement sur demande explicite, en conservant les indices et les sources",()=>{
    const reponse={organisation:{...base,competences:[base.competences[0],base.competences[0]]}};
    expect(()=>validerOrganisationDepot(reponse,"doc",preuve.citation,[])).toThrow("plusieurs fois");
    const resultat=validerOrganisationDepot(reponse,"doc",preuve.citation,[],undefined,{autoriserDoublonsHistoriques:true});
    expect(resultat.competences).toHaveLength(2);
    expect(resultat.competences[0]).toEqual(resultat.competences[1]);
    const falsifie={organisation:{...reponse.organisation,competences:[{...base.competences[0],sources:[{...preuve,citation:"Citation absente"}]}]}};
    expect(()=>validerOrganisationDepot(falsifie,"doc",preuve.citation,[],undefined,{autoriserDoublonsHistoriques:true})).toThrow("citation");
  });

  it("accepte un domaine d'organisation sourcé sans fabriquer de compétence",()=>{
    const note="Documents de contexte en géologie";
    const sources=[{pieceId:null,page:null,citation:note}];
    const domaine={mode:"nouveau",nom:"Géologie",description:"Contexte documentaire",justification:"Le sujet est déclaré.",sources};
    const proposition={organisation:{...base,domaine,competences:[],sources}};
    expect(validerOrganisationDepot(proposition,"doc",note,[],referentiel)).toMatchObject({domaine:{...domaine,sources:[{documentId:"doc",citation:note}]},competences:[]});
    expect(()=>validerOrganisationDepot({organisation:{...proposition.organisation,domaine:{...domaine,sources:[{...sources[0],citation:"source absente"}]}}},"doc",note,[],referentiel)).toThrow("citation");
  });
  it("refuse encore une compétence qui invente un autre domaine nouveau",()=>{
    const domaine={mode:"nouveau",nom:"Argumentation",description:"Discussion",justification:"Sujet explicite",sources:[preuve]};
    const competence={mode:"nouvelle",verbeAction:"analyser",objet:"un argument",palier:"fondamentaux",importance:0.5,domaine:{mode:"nouveau",nom:"Autre domaine"},justification:"Geste demandé",sources:[preuve]};
    expect(()=>validerOrganisationDepot({organisation:{...base,domaine,competences:[competence]}},"doc",preuve.citation,[],referentiel)).toThrow("nouveau domaine principal");
  });
  it("accepte uniquement les identifiants et codes fournis par le serveur",()=>{
    const resultat=validerOrganisationDepot({organisation:base},"doc","Analyser un argument philosophique",[],referentiel);
    expect(resultat.competences[0]).toMatchObject({mode:"existante",code:"PHI-01"});
    expect(()=>validerOrganisationDepot({organisation:{...base,domaine:{...base.domaine,id:"inconnu"}}},"doc","Analyser un argument philosophique",[],referentiel)).toThrow("référentiel actif");
    expect(()=>validerOrganisationDepot({organisation:{...base,competences:[{...base.competences[0],code:"IA-99"}]}},"doc","Analyser un argument philosophique",[],referentiel)).toThrow("référentiel actif");
  });
  it("conserve une relation qualifiée sans modifier les sorties historiques",()=>{
    const historique=validerOrganisationDepot({organisation:base},"doc",preuve.citation,[],referentiel);
    expect(historique.competences[0]).not.toHaveProperty("relationSupport");
    for(const relationSupport of ["mention","enseignee","demandee"] as const) {
      const proposition={organisation:{...base,competences:[{...base.competences[0],relationSupport}]}};
      expect(validerOrganisationDepot(proposition,"doc",preuve.citation,[],referentiel).competences[0]).toMatchObject({relationSupport});
    }
    const invalide={organisation:{...base,competences:[{...base.competences[0],relationSupport:"maitrisee"}]}};
    expect(()=>validerOrganisationDepot(invalide,"doc",preuve.citation,[],referentiel)).toThrow(/Relation de compétence/);
  });
  it("accepte jusqu'à trente propositions et contrôle encore la source et le code de la dernière",()=>{
    const gestes=["Additionner des fractions","Multiplier des fractions","Comparer des fractions","Simplifier une fraction","Développer un produit","Factoriser une expression","Réduire une expression","Résoudre une équation","Résoudre une inéquation","Résoudre un système","Calculer une puissance","Simplifier une racine","Convertir une unité","Calculer un pourcentage","Calculer une proportion","Dériver un polynôme","Intégrer un polynôme","Calculer une limite","Étudier une fonction","Tracer une courbe","Calculer une moyenne","Calculer une médiane","Calculer une variance","Calculer une probabilité","Dénombrer des arrangements","Calculer un déterminant","Multiplier des matrices","Calculer une norme","Calculer un produit scalaire","Décomposer un vecteur"];
    const competences=gestes.map((intitule,i)=>({code:`MAT-${i+1}`,intitule}));
    const propositions=competences.map((c)=>({mode:"existante",code:c.code,justification:"Geste explicitement demandé.",sources:[{pieceId:null,page:null,citation:c.intitule}]}));
    const note=[preuve.citation,...gestes].join("\n");
    const ref={...referentiel,competences};
    for(const nombre of [7,30]) expect(validerOrganisationDepot({organisation:{...base,competences:propositions.slice(0,nombre)}},"doc",note,[],ref).competences).toHaveLength(nombre);
    expect(()=>validerOrganisationDepot({organisation:{...base,competences:[...propositions,propositions[0]]}},"doc",note,[],ref)).toThrow("Trop de compétences");
    expect(()=>validerOrganisationDepot({organisation:{...base,competences:[...propositions.slice(0,29),{...propositions[29],code:"IA-99"}]}},"doc",note,[],ref)).toThrow("référentiel actif");
    expect(()=>validerOrganisationDepot({organisation:{...base,competences:[...propositions.slice(0,29),{...propositions[29],sources:[{...preuve,citation:"Geste absent"}]}]}},"doc",note,[],ref)).toThrow("citation");
  });
  it("distingue un fichier absent d'une page non lue",()=>{
    expect(()=>validerSourceDepot({...source,pieceId:"pdf-b"},"doc","",pages)).toThrow("fichier cité ne fait pas partie");
    expect(()=>validerSourceDepot({...source,page:1},"doc","",pages)).toThrow("page 1 citée ne fait pas partie");
  });
  it("signale une citation sur une autre page sans corriger son repère ni l'accepter",()=>{
    const lues=[...pages,{pieceId:"pdf-a",page:3,texte:"Autre exercice.",incertain:false}];
    expect(()=>validerSourceDepot({...source,page:3},"doc","",lues)).toThrow("présente sur les pages 2 du même fichier");
    expect(()=>validerSourceDepot({...source,page:3},"doc","",lues)).toThrow("repère proposé est refusé");
  });
  it("ne cherche pas une justification dans un autre fichier",()=>{
    const lues=[{pieceId:"pdf-a",page:2,texte:"Autre exercice.",incertain:false},{...pages[0],pieceId:"pdf-b"}];
    expect(()=>validerSourceDepot(source,"doc","",lues)).toThrow('Citation proposée, non validée : "Exercice 3 à reprendre."');
    expect(()=>validerSourceDepot(source,"doc","",lues)).not.toThrow("présente sur les pages");
  });
  it("accepte les seuls écarts de blancs et d'encodage Unicode, pas les changements de formule",()=>{
    const lues=[{pieceId:"pdf-a",page:2,texte:"Égalité :\n x + 1 = 2",incertain:false}];
    expect(validerSourceDepot({...source,citation:"E\u0301galité : x + 1 = 2"},"doc","",lues).page).toBe(2);
    expect(()=>validerSourceDepot({...source,citation:"Égalité : x - 1 = 2"},"doc","",lues)).toThrow("Citation proposée, non validée");
  });
  it("cite la page PDF même quand son numéro imprimé est différent",()=>{
    const lues=[
      {pieceId:"livret",page:6,texte:"Fiche n°5\nRacines carrées\n5",incertain:false},
      {pieceId:"livret",page:7,texte:"Fiche n°6\nRésoudre les équations suivantes.\n6",incertain:false},
    ];
    const citation={pieceId:"livret",page:7,citation:"Résoudre les équations suivantes."};
    expect(validerSourceDepot(citation,"doc","",lues).page).toBe(7);
    expect(()=>validerSourceDepot({...citation,page:6},"doc","",lues)).toThrow("présente sur les pages 7");
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
