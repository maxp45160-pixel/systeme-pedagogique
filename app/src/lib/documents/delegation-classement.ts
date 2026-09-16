import { analysePourClassement } from "./classement-ressources";
import type { DepotDocumentaire } from "./depot";
import type { ContexteOrganisationDepot } from "./organisation-depot";

export type DecisionDelegationClassement =
  | { statut: "eligible"; domaineId: string }
  | { statut: "rattache" | "preserve" | "a-controler"; raison: string };

/** La délégation porte uniquement sur le domaine explicitement identifié.
 * Les compétences de l'analyse restent des propositions à contrôler. */
export function evaluerDelegationClassement(
  depot: DepotDocumentaire,
  analyseId: string,
  contexte: ContexteOrganisationDepot,
  frontmatter: Record<string, unknown> = {},
): DecisionDelegationClassement {
  const present = (cle: string) => frontmatter[cle] !== undefined && frontmatter[cle] !== null && frontmatter[cle] !== "";
  if (depot.corrections.length || depot.brouillonClassement || depot.competencesLiees.length
    || depot.referentielRevuLe || depot.referentielAnalyseId
    || depot.rangementOrigine === "personne"
    || ["classement_brouillon", "classement_confirmation", "referentiel_revu_le", "referentiel_analyse_id", "rangement_empreinte"].some(present)) {
    return { statut: "preserve", raison: "Un choix ou une correction existe déjà : son contrôle vous appartient." };
  }
  // Le reçu de la première délégation permet le rejeu après une réponse perdue.
  // Il ne permet jamais de rétablir un domaine que la personne a ensuite changé.
  const proposition = depot.analyses.find((a) => a.id === analyseId)?.restitution;
  const domaine = proposition?.version === 2 ? proposition.organisation.domaine : null;
  if (depot.version === 2 && depot.rangementOrigine === "assistant"
    && depot.rangementAnalyseId === analyseId && depot.rangementStatut === "rangee"
    && depot.rangementRevuLe && domaine?.mode === "existant" && depot.domaineId === domaine.id) {
    return { statut: "rattache", raison: "Ce rattachement délégué est déjà enregistré." };
  }
  if (depot.domaineId || depot.rangementOrigine || depot.rangementAnalyseId || depot.rangementRevuLe || depot.rangementStatut
    || ["domaine", "rangement_origine", "rangement_analyse_id", "rangement_revu_le", "rangement_statut"].some(present)) {
    return { statut: "preserve", raison: "Cette ressource possède déjà un rangement à préserver." };
  }
  if (depot.version !== 2 || depot.analyses.length !== 1) {
    return { statut: "a-controler", raison: "La délégation est limitée à la première analyse d'une nouvelle ressource." };
  }
  let analyse;
  try { analyse = analysePourClassement(depot, analyseId); }
  catch { return { statut: "a-controler", raison: "L'analyse a changé ou n'est pas terminée." }; }
  if (analyse.restitution?.version !== 2) {
    return { statut: "a-controler", raison: "Cette analyse ne propose pas d'organisation de ressource." };
  }
  if (analyse.pages.some((page) => page.incertain) || analyse.restitution.elements.some((element) => element.nature === "incertitude")) {
    return { statut: "a-controler", raison: "L'analyse signale une incertitude à vérifier avant le rattachement." };
  }
  const propose = analyse.restitution.organisation.domaine;
  if (propose?.mode !== "existant") {
    return { statut: "a-controler", raison: "Le choix ou la création d'un domaine demande votre contrôle." };
  }
  if (!contexte.domaines.some((d) => d.id === propose.id)) {
    return { statut: "a-controler", raison: "Le domaine proposé est absent ou archivé." };
  }
  if (!propose.justification.trim() || !propose.sources.length
    || propose.sources.some((source) => source.documentId !== depot.id || !source.citation.trim())) {
    return { statut: "a-controler", raison: "Le rattachement doit être justifié par des sources de cette ressource." };
  }
  return { statut: "eligible", domaineId: propose.id };
}
