import type { DepotDocumentaire } from "./depot";
import { derniereOrganisationDepot, type ContexteOrganisationDepot, type RangementRessourceDepot } from "./organisation-depot";

const comparable = (texte: string) => texte.trim().replace(/\s+/g, " ").toLocaleLowerCase("fr-FR");

/** Rattache uniquement ce que le référentiel vivant permet de résoudre sans choix arbitraire. */
export function organiserDepuisReferentiel(depot: DepotDocumentaire, contexte: ContexteOrganisationDepot): {
  rangement: RangementRessourceDepot | null;
  aPreciser: string[];
} {
  const derniere = derniereOrganisationDepot(depot);
  if (depot.version !== 2 || !derniere || !depot.analyses.some((a) => a.id === derniere.analyseId && a.statut === "terminee")) return { rangement: null, aPreciser: ["La ressource n'a pas encore d'analyse exploitable."] };
  // Une réanalyse ne remplace jamais un choix déjà appliqué ou corrigé.
  const dejaRange = Boolean(depot.rangementRevuLe);
  if (dejaRange && (depot.rangementOrigine !== "assistant" || depot.rangementStatut !== "a-trier" || depot.rangementAnalyseId !== derniere.analyseId)) return { rangement: null, aPreciser: [] };
  const aPreciser: string[] = [];
  const trouverDomaine = (d: { mode: "existant"; id: string } | { mode: "nouveau"; nom: string }) => {
    const trouves = contexte.domaines.filter((existant) => d.mode === "existant" ? existant.id === d.id : comparable(existant.nom) === comparable(d.nom));
    if (trouves.length === 1) return trouves[0].id;
    aPreciser.push(d.mode === "nouveau" ? `Le domaine « ${d.nom} » reste à préciser dans le référentiel.` : "Le domaine proposé n'est plus disponible.");
    return undefined;
  };
  const { organisation, analyseId } = derniere;
  const domaineId = depot.domaineId ?? (organisation.domaine ? trouverDomaine(organisation.domaine) : undefined);
  const codes = new Set(depot.competencesLiees);
  for (const proposition of organisation.competences) {
    if (proposition.mode === "existante") {
      if (contexte.competences.some((c) => c.code === proposition.code)) codes.add(proposition.code);
      else aPreciser.push(`La compétence ${proposition.code} n'est plus disponible.`);
      continue;
    }
    const domaine = trouverDomaine(proposition.domaine);
    const homonymes = contexte.competences.filter((c) => comparable(c.intitule) === comparable(proposition.intitule));
    if (domaine && homonymes.length === 1 && (homonymes[0].domaine === domaine || codes.has(homonymes[0].code))) codes.add(homonymes[0].code);
    else aPreciser.push(`La compétence « ${proposition.intitule} » reste à préciser ; aucun code n'a été créé.`);
  }
  return {
    rangement: dejaRange ? null : { titre: organisation.titreSuggere, type: organisation.typeSuggere, domaineId, codes: [...codes].sort(), analyseId, aTrier: aPreciser.length > 0 },
    aPreciser: [...new Set(aPreciser)],
  };
}
