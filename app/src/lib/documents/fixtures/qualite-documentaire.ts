import type { CompetenceProposeeDepot, PageExtraiteDepot, PropositionOrganisationRessource, ReferentielDepotPourModele, SourceDepot } from "../depot";

/** Corpus écrit à la main, entièrement SYNTHÉTIQUE. Aucune sortie de fournisseur.
 * Les verdicts sémantiques sont des attentes de recette, pas des décisions humaines
 * ni une preuve que le modèle sait les respecter. Les pages simulent l'après-OCR.
 */
export interface CasQualiteDocumentaire {
  id: string;
  matiere: string;
  support: "note" | "page-pdf" | "transcription-image";
  note: string;
  pages: PageExtraiteDepot[];
  referentiel: ReferentielDepotPourModele;
  reponse: { organisation: PropositionOrganisationRessource };
  controleTechnique: "accepte" | "refuse";
  motifRefus?: string;
  jugementSemantique: "recevable" | "a-corriger";
  critere: string;
}

const referentiel: ReferentielDepotPourModele = {
  domaines: [
    { id: "math", nom: "Mathématiques", description: "Calcul" },
    { id: "philo", nom: "Philosophie", description: "Argumentation" },
    { id: "histoire", nom: "Histoire", description: "Documents historiques" },
    { id: "info", nom: "Informatique", description: "Programmation" },
    { id: "bio", nom: "Biologie", description: "Cellules" },
    { id: "logistique", nom: "Logistique", description: "Flux industriels" },
  ],
  competences: [{ code: "PHI-01", intitule: "Analyser un argument", domaine: "philo" }],
};

function ressource(id: string, matiere: string, texte: string, support: CasQualiteDocumentaire["support"], domaine: string | null, typeSuggere = "cours"): CasQualiteDocumentaire {
  const sources: SourceDepot[] = [{ documentId: id, ...(support !== "note" ? { pieceId: id, page: 7 } : {}), citation: texte }];
  return {
    id, matiere, support, referentiel,
    note: support === "note" ? texte : "",
    pages: support === "note" ? [] : [{ pieceId: id, page: 7, texte, incertain: false }],
    reponse: { organisation: {
      titreSuggere: matiere, typeSuggere,
      domaine: domaine ? { mode: "existant", id: domaine, sources, justification: "Le passage indique le sujet." } : null,
      competences: [], sources, justification: "Le passage indique le contenu de la ressource.",
    } },
    controleTechnique: "accepte", jugementSemantique: "recevable", critere: "Le geste et le domaine sont étayés par le passage.",
  };
}

function nouvelle(cas: CasQualiteDocumentaire, verbeAction: Extract<CompetenceProposeeDepot, { mode: "nouvelle" }>["verbeAction"], objet: string): CompetenceProposeeDepot {
  const domaine = cas.reponse.organisation.domaine;
  if (!domaine || domaine.mode !== "existant") throw new Error("Fixture : domaine existant requis.");
  return {
    mode: "nouvelle", verbeAction, objet,
    intitule: `${verbeAction[0].toUpperCase()}${verbeAction.slice(1)} ${objet}`,
    palier: "fondamentaux", importance: 0.5, domaine: { mode: "existant", id: domaine.id },
    sources: cas.reponse.organisation.sources, justification: "Le passage présente ce geste.",
  };
}

const ats = ressource("ats-regression-synthetique", "Mathématiques", "Fiche 6 — Résoudre l'équation 2x + 3 = 9. Ce calcul servira en logistique.", "page-pdf", "math");
ats.reponse.organisation.competences = [nouvelle(ats, "résoudre", "une équation affine")];
ats.critere = "La matière enseignée prime sur son utilité en logistique ; page PDF 7, fiche imprimée 6.";

const philosophie = ressource("philo-argument", "Philosophie", "Analysez l'argument : tous les êtres humains sont mortels, Socrate est humain, donc Socrate est mortel.", "page-pdf", "philo");
philosophie.reponse.organisation.competences = [{ mode: "existante", code: "PHI-01", sources: philosophie.reponse.organisation.sources, justification: "La consigne demande une analyse d'argument." }];

const histoire = ressource("histoire-comparaison", "Histoire", "Comparez les dates des deux affiches : la première est datée de 1914, la seconde de 1918.", "transcription-image", "histoire", "reference");
histoire.reponse.organisation.competences = [nouvelle(histoire, "comparer", "les dates de deux affiches")];

const code = ressource("informatique-test", "Informatique", "Testez la fonction maximum(a, b) sur deux nombres égaux puis sur deux nombres distincts.", "note", "info", "note");
code.reponse.organisation.competences = [nouvelle(code, "tester", "une fonction maximum")];

const pensee = ressource("pensee-geologie", "Géologie", "J'aimerais garder cette idée pour plus tard : pourquoi certaines roches brillent-elles ?", "note", null, "reflexion");
pensee.reponse.organisation.domaine = { mode: "nouveau", nom: "Géologie", description: "Notes sur les roches", justification: "La question concerne les roches.", sources: pensee.reponse.organisation.sources };
pensee.critere = "Conserver la question et son domaine sans fabriquer de compétence ni d'obligation.";

const ambigu = ressource("note-ambigue", "Sujet indéterminé", "Revoir les échanges et leurs effets. Je ne sais plus à quel cours cela appartient.", "note", null, "note");
ambigu.critere = "Laisser le domaine indéterminé et les compétences vides ; signaler l'incertitude dans la synthèse.";

const mauvaisDomaine = structuredClone(ats);
mauvaisDomaine.id = "domaine-utilisateur-indu";
mauvaisDomaine.reponse.organisation.domaine = { ...ats.reponse.organisation.domaine!, mode: "existant", id: "logistique" };
mauvaisDomaine.jugementSemantique = "a-corriger";
mauvaisDomaine.critere = "Un domaine actif et une citation exacte ne prouvent pas la pertinence du domaine choisi.";

const gesteIndu = ressource("biologie-geste-invente", "Biologie", "Sur le schéma de cellule fourni, identifiez le noyau.", "transcription-image", "bio");
gesteIndu.reponse.organisation.competences = [nouvelle(gesteIndu, "modéliser", "la division cellulaire")];
gesteIndu.jugementSemantique = "a-corriger";
gesteIndu.critere = "Une citation exacte n'étaye ni la modélisation ni la division cellulaire ; identifier le noyau est le seul geste explicite.";

const recouvrement = ressource("recouvrement-semantique", "Mathématiques", "Pour u = (3, 4), calculez sa norme avec la formule donnée.", "page-pdf", "math");
recouvrement.reponse.organisation.competences = [nouvelle(recouvrement, "calculer", "la norme d'un vecteur"), nouvelle(recouvrement, "appliquer", "les propriétés des vecteurs")];
recouvrement.jugementSemantique = "a-corriger";
recouvrement.critere = "Écarter la proposition générale : aucun geste distinct du calcul de norme n'est demandé.";

const doublonNouveau = ressource("doublon-normalise", "Mathématiques", "Calculez la norme des vecteurs u puis v.", "note", "math", "note");
doublonNouveau.reponse.organisation.competences = [nouvelle(doublonNouveau, "calculer", "une norme vectorielle"), nouvelle(doublonNouveau, "calculer", "UNE  NORME VECTORIELLE")];
doublonNouveau.controleTechnique = "refuse";
doublonNouveau.motifRefus = "plusieurs fois";
doublonNouveau.jugementSemantique = "a-corriger";
doublonNouveau.critere = "Refuser le doublon normalisé ; ne pas retirer silencieusement un indice de proposition.";

const doublonExistant = structuredClone(philosophie);
doublonExistant.id = "doublon-code";
doublonExistant.reponse.organisation.competences.push(structuredClone(doublonExistant.reponse.organisation.competences[0]));
doublonExistant.controleTechnique = "refuse";
doublonExistant.motifRefus = "plusieurs fois";
doublonExistant.jugementSemantique = "a-corriger";
doublonExistant.critere = "Refuser deux occurrences du même code même si chacune possède une source.";

const citationInventee = structuredClone(histoire);
citationInventee.id = "citation-inventee";
citationInventee.reponse.organisation.competences[0].sources = [{ pieceId: histoire.id, page: 7, citation: "Comparez les affiches de 1939 et 1945.", documentId: histoire.id }];
citationInventee.controleTechnique = "refuse";
citationInventee.motifRefus = "citation n'existe pas";
citationInventee.jugementSemantique = "a-corriger";
citationInventee.critere = "Refuser une source absente de la page désignée.";

// Les variantes gardent le même document source ; l'id nomme le scénario.
export const CORPUS_QUALITE_DOCUMENTAIRE: readonly CasQualiteDocumentaire[] = [
  ats, philosophie, histoire, code, pensee, ambigu, mauvaisDomaine, gesteIndu,
  recouvrement, doublonNouveau, doublonExistant, citationInventee,
];
