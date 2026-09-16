import { createElement, Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { DepotDocumentaire, PreparationAnalyseDepot } from "@/lib/documents/depot";
import type { ContexteOrganisationDepot } from "@/lib/documents/organisation-depot";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/lib/store/classement-ressources-actions", () => ({ lireClassementRessourcesAction: vi.fn(), confirmerClassementRessourcesAction: vi.fn() }));
vi.mock("@/lib/store/ressource-assistant-actions", () => ({ lireRessourceAssistantAction: vi.fn() }));
vi.mock("@/lib/store/brouillon-classement-actions", () => ({ enregistrerBrouillonClassementAction: vi.fn() }));
vi.mock("@/lib/store/delegation-classement-actions", () => ({ rattacherDomaineDelegueAction: vi.fn(), annulerRattachementDelegueAction: vi.fn() }));

import { ActionsRelectureRessources, FormulaireRelectureRessources, choixInitial } from "./modale-ressources";
import { EditeurClassementRessource } from "./choix-classement-ressource";
import { cheminDomaineClassement } from "@/lib/documents/classement-ressources";
import { lectureAProposer } from "./ressources-conversation";

const referentiel: ContexteOrganisationDepot = {
  compteId: "compte", domaines: [
    { id: "math", nom: "Mathématiques", prefixe: "MAT", description: "" },
    { id: "calc", nom: "Calcul", parentId: "math", prefixe: "CAL", description: "" },
  ], competences: [],
};
const depot: DepotDocumentaire = {
  id: "livret", version: 2, titre: "Livret de calcul", note: "", creeLe: "2026-09-15", modifieLe: "2026-09-15T12:00:00Z", type: "cours", competencesLiees: [], pieces: [], corrections: [],
  analyses: [{ id: "analyse", documentId: "livret", empreinte: "source", statut: "terminee", pages: [], couvertures: [], erreur: null, creeLe: "2026-09-15", modifieLe: "2026-09-15", restitution: {
    version: 2, modele: "modele-interne", creeLe: "2026-09-15", elements: [
      { id: "sujet", nature: "sujet", texte: "Le livret traite du calcul algébrique.", sources: [{ documentId: "livret", page: 1, citation: "Développer et factoriser" }] },
      { id: "reserve", nature: "incertitude", texte: "Le dernier chapitre reste à lire.", sources: [] },
    ], couvertures: [{ pieceId: "pdf", nom: "Livret.pdf", totalPages: 13, pagesLues: [1, 2, 2] }],
    organisation: { titreSuggere: "Livret de calcul", typeSuggere: "cours", domaine: { mode: "existant", id: "calc", justification: "Contenu de calcul", sources: [] }, competences: [], justification: "", sources: [] },
  } }],
};
function rendu(ressource = depot) { return renderToStaticMarkup(createElement(Fragment, null,
  createElement(FormulaireRelectureRessources, { depots: [ressource], referentiel, occupe: false, autres: 0, formulaireId: "relecture", onEtatActions: () => undefined }),
  createElement(ActionsRelectureRessources, { formulaireId: "relecture", etat: { disabled: false, enregistrement: false }, avecResultats: true, onFermer: () => undefined }),
)); }

describe("relecture documentaire dans l’assistant", () => {
  it("montre une synthèse, le chemin humain et une seule confirmation avec accès différé", () => {
    const html = rendu();
    expect(html).toContain("Le livret traite du calcul algébrique.");
    expect(html).toContain("Mathématiques › Calcul");
    expect(html).toContain("2 page(s) lue(s) sur 13");
    expect(html).toContain("Consulter les sources");
    expect(html).toContain("Développer et factoriser");
    expect(html).toContain("Appliquer ce choix");
    expect(html).toContain("Fermer");
    expect(html).not.toContain("Valider et voir mes priorités");
    expect(html).toContain("Où ranger ce document ?");
    expect(html).toContain("Suggestion de l’IA · à vérifier");
    expect(html).toContain("Pourquoi ce classement a été proposé");
    expect(html).not.toContain("modele-interne");
    expect(html).not.toContain("Terminer la revue");
    expect(html).not.toContain("<details");
    expect(html).toContain('id="relecture-sources-livret" hidden=""');
    expect(html).toContain('aria-controls="relecture-sources-livret"');
    expect(html.split('<section id="relecture-sources-livret"')[0]).toContain("Le dernier chapitre reste à lire.");
  });
  it("garde seulement le premier sujet dans l’aperçu et laisse le texte complet accessible", () => {
    const ressource = structuredClone(depot);
    ressource.analyses[0].restitution!.elements.push({ id: "suite", nature: "sujet", texte: "Un second sujet détaillé à consulter ensuite.", sources: [] });
    const html = rendu(ressource);
    const visibleAvantDetails = html.split('<section id="relecture-sources-livret"')[0];
    expect(visibleAvantDetails).toContain("line-clamp-3");
    expect(visibleAvantDetails).toContain('aria-expanded="false"');
    expect(visibleAvantDetails).toContain("Lire la synthèse complète");
    expect(visibleAvantDetails).not.toContain("Un second sujet détaillé");
    expect(html).toContain("Un second sujet détaillé");
  });
  it("montre les compétences à créer et leurs pages sans ouvrir les sources", () => {
    const ressource = structuredClone(depot);
    const retour = ressource.analyses[0].restitution!;
    if (retour.version === 2) retour.organisation.competences = [{ mode: "nouvelle", intitule: "Développer une expression", verbeAction: "appliquer", objet: "une expression", palier: "fondamentaux", importance: 1, domaine: { mode: "existant", id: "calc" }, justification: "", sources: [{ documentId: "livret", page: 2, citation: "Développer cette expression" }] }];
    const html = rendu(ressource);
    const visibleAvantDetails = html.split('<section id="relecture-sources-livret"')[0];
    expect(visibleAvantDetails).toContain("1 nouvelle compétence");
    expect(visibleAvantDetails).toContain("Créée après confirmation.");
    expect(visibleAvantDetails).toContain("Développer une expression");
    expect(visibleAvantDetails).toContain('type="checkbox"');
    expect(visibleAvantDetails).toContain("Page 2");
    expect(html).toContain("Développer une expression");
    expect(html).toContain("Développer cette expression");
  });
  it("préserve le classement enregistré au lieu de sélectionner une autre proposition IA", () => {
    const html = rendu({ ...depot, domaineId: "math", rangementRevuLe: "2026-09-14" });
    expect(html).toContain("Classement actuel conservé.");
    expect(html.split('<section id="relecture-sources-livret"')[0]).toContain("Mathématiques");
    expect(html.split('<section id="relecture-sources-livret"')[0]).not.toContain("Sous-domaine");
    expect(html).not.toContain("<select");
  });
  it("demande l’usage d’un nouveau domaine sans inventer un module académique", () => {
    const autre = structuredClone(depot);
    const retour = autre.analyses[0].restitution!;
    if (retour.version === 2) retour.organisation.domaine = { mode: "nouveau", nom: "Algèbre", description: "", justification: "", sources: [] };
    const html = renderToStaticMarkup(createElement(EditeurClassementRessource, { choix: choixInitial(autre, referentiel), domaines: referentiel.domaines, bloque: false, onChanger: () => undefined, onReduire: () => undefined }));
    expect(html).toContain("Quel type de matière ?");
    expect(html).toContain("Matière suivie dans la durée");
    expect(html).toContain("Cours d’une année");
    expect(html).not.toContain("Garder ce choix");
    expect(html).toContain("Organisation de documents");
    expect(html).toContain('checked=""');
    expect(html).not.toContain("<select");
  });
  it("permet de classer une restitution historique sans fausses compétences proposées", () => {
    const ancien = structuredClone(depot);
    ancien.version = 1;
    const retour = ancien.analyses[0].restitution!;
    ancien.analyses[0].restitution = { version: 1, modele: retour.modele, creeLe: retour.creeLe, elements: retour.elements, couvertures: retour.couvertures };
    expect(rendu(ancien)).toContain("Choisissez où ranger ce document.");
    expect(rendu(ancien)).not.toContain("à créer</span>");
  });
  it("conserve le consentement aux pages suivantes malgré une synthèse déjà terminée", () => {
    const ligne = { id: depot.id, selectionnee: false, ressource: { depot, domaine: undefined, competences: [], aPreciser: [], liensVerifies: true }, preparation: { disponible: true, tranches: [{ pieceId: "pdf", nom: "Livret.pdf", pages: [21, 22], totalPages: 22 }] } as PreparationAnalyseDepot };
    expect(lectureAProposer(ligne)).toBe(true);
    expect(lectureAProposer({ ...ligne, preparation: { ...ligne.preparation, disponible: false, tranches: [] } })).toBe(false);
  });
  it("affiche la parenté réelle sans préfixes techniques", () => {
    expect(cheminDomaineClassement("calc", referentiel.domaines)).toBe("Mathématiques › Calcul");
  });
  it("montre le rattachement délégué sans exiger de le reconfirmer", () => {
    const html = rendu({ ...depot, domaineId: "calc", rangementRevuLe: "2026-09-16", rangementAnalyseId: "analyse", rangementOrigine: "assistant", rangementStatut: "rangee" });
    expect(html).toContain("Rattachement effectué");
    expect(html).toContain("Rattaché par Twiny");
    expect(html).toContain("n’a créé ni associé aucune compétence");
    expect(html).not.toContain("Appliquer ce choix");
    expect(html).toContain("Modifier");
    expect(html).toContain("Retirer ce rattachement");
    expect(html).toContain('/atelier?document=livret');
  });
  it("rouvrir un rattachement retiré ne réadopte pas la proposition du domaine", () => {
    const ressource: DepotDocumentaire = { ...depot, domaineId: undefined, rangementRevuLe: "2026-09-16", rangementAnalyseId: "ancienne-analyse", rangementOrigine: "personne", rangementStatut: "a-trier" };
    expect(choixInitial(ressource, referentiel).destination).toBe("");
    expect(rendu(ressource)).toContain("Votre retrait est conservé");
    expect(rendu(ressource)).not.toContain("Rattachement effectué");
  });
  it("un nouveau sujet se contrôle sans usage académique ni compétence obligatoire", () => {
    const ressource = structuredClone(depot);
    if (ressource.analyses[0].restitution?.version === 2) ressource.analyses[0].restitution.organisation.domaine = { mode: "nouveau", nom: "Géologie", description: "Étude des roches", justification: "", sources: [] };
    const vide = { ...referentiel, domaines: [] };
    expect(choixInitial(ressource, vide)).toMatchObject({ destination: "nouveau", usage: "indetermine", codes: [], propositions: [] });
    const html = renderToStaticMarkup(createElement(FormulaireRelectureRessources, { depots: [ressource], referentiel: vide, occupe: false, autres: 0, formulaireId: "nouveau", onEtatActions: () => undefined }));
    expect(html).toContain("aucune compétence obligatoire");
    expect(html.match(/<button[^>]*>Appliquer ce choix<\/button>/)?.[0]).not.toContain('disabled=""');
  });
  it("distingue une création à vérifier d'un domaine effectivement créé et rattaché", () => {
    const ressource: DepotDocumentaire = { ...depot, creationDomaineDeleguee: { version: 1, cle: "a".repeat(64), compteId: "compte", documentId: depot.id, analyseId: "analyse", domaineId: "calcul", nom: "Calcul", statut: "reservee" } };
    const html = rendu(ressource);
    expect(html).toContain("reste à vérifier");
    expect(html).toContain("Reprendre le rangement sans relancer l’IA");
    expect(html).not.toContain("Twiny a créé ce domaine");
    expect(rendu({ ...ressource, domaineId: "calc", rangementOrigine: "assistant", rangementStatut: "rangee", rangementRevuLe: "2026-09-16", rangementAnalyseId: "analyse", creationDomaineDeleguee: { ...ressource.creationDomaineDeleguee!, statut: "cree" } })).toContain("Twiny a créé ce domaine");
  });
  it("garde les compétences proposées contrôlables après un rattachement de domaine seul", () => {
    const ressource = structuredClone(depot);
    Object.assign(ressource, { domaineId: "calc", rangementAnalyseId: "analyse", rangementRevuLe: "2026-09-16", rangementOrigine: "assistant", rangementStatut: "rangee" });
    const retour = ressource.analyses[0].restitution!;
    if (retour.version === 2) retour.organisation.competences = [{ mode: "nouvelle", intitule: "Développer une expression", verbeAction: "appliquer", objet: "une expression", palier: "fondamentaux", importance: 1, domaine: { mode: "existant", id: "calc" }, justification: "", sources: [] }];
    expect(choixInitial(ressource, referentiel).propositions).toEqual([]);
    expect(rendu(ressource)).toContain("sélectionnez celles que vous souhaitez associer");
    expect(rendu(ressource)).toContain("Développer une expression");
    expect(rendu(ressource)).not.toContain('checked=""');
  });
  it("une destination manquante ne désactive pas le choix d'un autre document", () => {
    const sansDomaine = structuredClone(depot);
    sansDomaine.id = "incertain";
    if (sansDomaine.analyses[0].restitution?.version === 2) sansDomaine.analyses[0].restitution.organisation.domaine = null;
    const html = renderToStaticMarkup(createElement(FormulaireRelectureRessources, { depots: [depot, sansDomaine], referentiel, occupe: false, autres: 0, formulaireId: "lot", onEtatActions: () => undefined }));
    const boutons = [...html.matchAll(/<button[^>]*>Appliquer ce choix<\/button>/g)].map((m) => m[0]);
    expect(boutons).toHaveLength(2);
    expect(boutons[0]).not.toContain('disabled=""');
    expect(boutons[1]).toContain('disabled=""');
  });
  it("retrouve le choix humain sauvegardé avant la suggestion IA sans inventer son usage", () => {
    const ressource: DepotDocumentaire = { ...depot, brouillonClassement: { analyseId: "analyse", domaine: { mode: "nouveau", nom: "Mathématiques" }, codes: [], propositions: [], modifieLe: "2026-09-15T13:00:00Z", origine: "personne" } };
    expect(choixInitial(ressource, referentiel)).toMatchObject({ destination: "nouveau", nom: "Mathématiques", usage: "indetermine" });
    const visible = rendu(ressource).split('<section id="relecture-sources-livret"')[0];
    expect(visible).toContain("Votre choix est conservé");
    expect(visible).toContain("aucune compétence obligatoire");
    expect(visible).not.toContain("Choisir le type de matière");
    expect(visible).not.toContain("Suggestion de l’IA");
  });
  it("respecte le retrait explicite du choix dans le brouillon", () => {
    const ressource: DepotDocumentaire = { ...depot, brouillonClassement: { analyseId: "analyse", domaine: null, codes: [], propositions: [], modifieLe: "2026-09-15T13:00:00Z", origine: "personne" } };
    expect(choixInitial(ressource, referentiel).destination).toBe("");
    expect(rendu(ressource)).toContain("Choisissez où ranger ce document.");
  });
  it("conserve le domaine humain après complément sans recycler les anciennes compétences", () => {
    const ressource: DepotDocumentaire = { ...depot, brouillonClassement: { analyseId: "ancienne-analyse", domaine: { mode: "nouveau", nom: "Mathématiques",usage:{type:"continu"} }, codes: ["ANCIEN-CODE"], propositions: [4,7], modifieLe: "2026-09-15T13:00:00Z", origine: "personne" } };
    expect(choixInitial(ressource, referentiel)).toMatchObject({destination:"nouveau",nom:"Mathématiques",usage:"continu",codes:[],propositions:[]});
    expect(rendu(ressource)).toContain("Votre choix de domaine est conservé. Les compétences de cette nouvelle analyse sont à relire.");
  });
});
