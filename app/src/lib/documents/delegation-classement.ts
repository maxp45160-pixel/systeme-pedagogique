import { analysePourClassement } from "./classement-ressources";
import type { DepotDocumentaire } from "./depot";
import type { ContexteOrganisationDepot } from "./organisation-depot";
import { slugifier } from "@/lib/domain/referentiel-compte";

export type DecisionDelegationClassement =
  | { statut: "eligible"; domaineId: string }
  | { statut: "a-creer"; nom: string; description: string }
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
  const creation = depot.creationDomaineDeleguee;
  const creationCorrespond = creation && creation.compteId === contexte.compteId && creation.documentId === depot.id
    && creation.analyseId === analyseId && domaine?.mode === "nouveau"
    && creation.nom === domaine.nom.trim() && creation.domaineId === slugifier(domaine.nom);
  if (creation && !creationCorrespond) return { statut: "preserve", raison: "La création réservée appartient à un autre classement. Contrôlez la ressource." };
  if (depot.version === 2 && depot.rangementOrigine === "assistant"
    && depot.rangementAnalyseId === analyseId && depot.rangementStatut === "rangee"
    && depot.rangementRevuLe && ((domaine?.mode === "existant" && depot.domaineId === domaine.id)
      || (creationCorrespond && creation.statut === "cree" && depot.domaineId === creation.domaineId))) {
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
  if (!propose) {
    return { statut: "a-controler", raison: "Le choix ou la création d'un domaine demande votre contrôle." };
  }
  if (propose.mode === "existant" && !contexte.domaines.some((d) => d.id === propose.id)) {
    return { statut: "a-controler", raison: "Le domaine proposé est absent ou archivé." };
  }
  if (!propose.justification.trim() || !propose.sources.length
    || propose.sources.some((source) => source.documentId !== depot.id || !source.citation.trim())) {
    return { statut: "a-controler", raison: "Le rattachement doit être justifié par des sources de cette ressource." };
  }
  if (propose.mode === "nouveau") {
    // La proposition de parent est relue avant de créer un sous-domaine :
    // ne pas perdre cette hiérarchie en créant silencieusement une racine.
    if (propose.parentId) return { statut: "a-controler", raison: "Un sous-domaine est proposé. Vérifiez son emplacement avant sa création." };
    const nom = propose.nom.trim();
    if (nom.length < 3 || nom.length > 80 || /[\r\n]/.test(nom) || !slugifier(nom)) {
      return { statut: "a-controler", raison: "Le nom du domaine proposé demande votre contrôle." };
    }
    const comparable = (s: string) => s.trim().replace(/\s+/g, " ").toLocaleLowerCase("fr-FR");
    if (contexte.domaines.some((d) => (d.id === slugifier(nom) || comparable(d.nom) === comparable(nom))
      && !(creationCorrespond && d.id === creation.domaineId))) {
      return { statut: "a-controler", raison: "Un domaine de ce nom ou de cet identifiant existe déjà. Contrôlez le rangement." };
    }
    return { statut: "a-creer", nom, description: propose.description };
  }
  return { statut: "eligible", domaineId: propose.id };
}
