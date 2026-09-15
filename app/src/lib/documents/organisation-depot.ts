import type { DepotDocumentaire, PropositionOrganisationRessource } from "./depot";
import { SECTION_COMPETENCES_RESSOURCE } from "./depot";
import { definirChampsFrontMatter, listeMarkdown, renommerDocument } from "./markdown";
import { mettreAJourSections } from "./sections-markdown";

export interface DomaineOrganisationDepot {
  id: string;
  nom: string;
  prefixe: string;
  description: string;
}

export interface CompetenceOrganisationDepot {
  code: string;
  intitule: string;
  domaine: string;
  domaineNom: string;
}

export interface ContexteOrganisationDepot {
  compteId: string;
  domaines: DomaineOrganisationDepot[];
  competences: CompetenceOrganisationDepot[];
}

export interface BrancheProposeeDepot {
  cle: string;
  domaineId?: string;
  domaine: string;
  prefixe: string;
  description: string;
  justification: string;
  competences: Array<{ intitule: string; palier: string; importance: string }>;
  ressources: string[];
}

export interface RangementRessourceDepot {
  titre: string;
  type: string;
  domaineId?: string;
  codes: string[];
  analyseId: string;
  aTrier?: boolean;
}

const comparable = (value: string) => value.trim().replace(/\s+/g, " ").toLocaleLowerCase("fr-FR");
const uneLigne = (value: string, maximum: number) => value.replace(/[\r\n]+/g, " ").trim().slice(0, maximum);

export function analysesOrganisationDepot(depot: DepotDocumentaire) {
  return depot.analyses.flatMap((analyse) => analyse.restitution?.version === 2 ? [{ analyse, organisation: analyse.restitution.organisation }] : []);
}

export function derniereOrganisationDepot(depot: DepotDocumentaire): { analyseId: string; creeLe: string; organisation: PropositionOrganisationRessource } | null {
  const derniere = analysesOrganisationDepot(depot).toSorted((a,b) => Date.parse(b.analyse.creeLe) - Date.parse(a.analyse.creeLe))[0];
  return derniere ? { analyseId:derniere.analyse.id,creeLe:derniere.analyse.creeLe,organisation:derniere.organisation } : null;
}

/** Les branches servent uniquement à la relecture humaine ; elles n'écrivent rien. */
export function branchesProposeesDepot(depots: readonly DepotDocumentaire[], contexte: ContexteOrganisationDepot): BrancheProposeeDepot[] {
  const branches = new Map<string, BrancheProposeeDepot>();
  for (const depot of depots) {
    for (const { organisation } of analysesOrganisationDepot(depot)) {
      for (const competence of organisation.competences) {
        if (competence.mode !== "nouvelle") continue;
        if (contexte.competences.some((existante) => comparable(existante.intitule) === comparable(competence.intitule))) continue;
        const domaineCible = competence.domaine;
        const domaineExistant = domaineCible.mode === "existant"
          ? contexte.domaines.find((domaine) => domaine.id === domaineCible.id)
          : undefined;
        const domainePrincipal = organisation.domaine;
        const domainePropose = domaineCible.mode === "nouveau" && domainePrincipal?.mode === "nouveau"
          && comparable(domainePrincipal.nom) === comparable(domaineCible.nom)
          ? domainePrincipal
          : undefined;
        const nom = domaineExistant?.nom ?? domainePropose?.nom;
        if (!nom) continue;
        const cle = domaineExistant ? `existant:${domaineExistant.id}` : `nouveau:${comparable(nom)}`;
        const branche = branches.get(cle) ?? {
          cle,
          ...(domaineExistant ? { domaineId:domaineExistant.id } : {}),
          domaine:nom,
          prefixe:domaineExistant?.prefixe ?? "",
          description:domaineExistant?.description ?? domainePropose?.description ?? "",
          justification:competence.justification,
          competences:[],
          ressources:[],
        };
        if (!branche.competences.some((item) => comparable(item.intitule) === comparable(competence.intitule))) {
          branche.competences.push({ intitule:competence.intitule,palier:competence.palier,importance:String(competence.importance) });
        }
        if (!branche.ressources.includes(depot.titre)) branche.ressources.push(depot.titre);
        branches.set(cle, branche);
      }
    }
  }
  return [...branches.values()].sort((a,b) => a.domaine.localeCompare(b.domaine,"fr"));
}

/** Préremplit le rangement sans retirer les liens déjà validés. */
export function rangementProposeDepot(depot: DepotDocumentaire, contexte: ContexteOrganisationDepot): RangementRessourceDepot | null {
  const derniere = derniereOrganisationDepot(depot);
  if (!derniere) return null;
  if (depot.rangementAnalyseId === derniere.analyseId) {
    return {
      titre:depot.titre,
      type:depot.type,
      ...(depot.domaineId ? { domaineId:depot.domaineId } : {}),
      codes:depot.competencesLiees,
      analyseId:derniere.analyseId,
      ...(depot.rangementStatut === "a-trier" ? { aTrier:true } : {}),
    };
  }
  const { organisation } = derniere;
  const domainePrincipal = organisation.domaine;
  const domaineId = domainePrincipal?.mode === "existant"
    ? domainePrincipal.id
    : domainePrincipal?.mode === "nouveau"
      ? contexte.domaines.find((domaine) => comparable(domaine.nom) === comparable(domainePrincipal.nom))?.id
      : depot.domaineId;
  const proposes = organisation.competences.flatMap((competence) => {
    if (competence.mode === "existante") return [competence.code];
    return contexte.competences.filter((existante) => comparable(existante.intitule) === comparable(competence.intitule)).map((existante) => existante.code);
  });
  return {
    titre:organisation.titreSuggere || depot.titre,
    type:organisation.typeSuggere || depot.type,
    ...(domaineId ? { domaineId } : {}),
    codes:[...new Set([...depot.competencesLiees,...proposes])].filter((code) => contexte.competences.some((competence) => competence.code === code)).sort(),
    analyseId:derniere.analyseId,
  };
}

export function appliquerRangementDepot(contenuMd: string, entree: RangementRessourceDepot, revuLe: string, empreinte: string): string {
  const titre = uneLigne(entree.titre, 200);
  let suivant = renommerDocument(contenuMd, titre);
  suivant = definirChampsFrontMatter(suivant, {
    title:titre,
    type:entree.type,
    role:"support",
    domaine:entree.domaineId ?? "",
    rangement_revu_le:revuLe,
    rangement_analyse_id:entree.analyseId,
    rangement_empreinte:empreinte,
    rangement_statut:entree.aTrier ? "a-trier" : "rangee",
  });
  return mettreAJourSections(suivant,[SECTION_COMPETENCES_RESSOURCE],{
    [SECTION_COMPETENCES_RESSOURCE]:listeMarkdown([...new Set(entree.codes)].sort()).join("\n"),
  });
}
