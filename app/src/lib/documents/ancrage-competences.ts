import type { PageExtraiteDepot } from "./depot";
import { MAX_COMPETENCES_ORGANISATION_DEPOT } from "./depot";
import { listeDepot, objetDepot, texteDepot, validerOrganisationDepot, type ReferentielValidationDepot } from "./depot-validation";
import { sourcesRestitution, traduireSourcesRestitution } from "./sources-restitution";

/** Déclaration du fournisseur, pas jugement indépendant sur la justesse du geste. */
export const NATURES_ANCRAGE_COMPETENCE = ["consigne", "demonstration", "mention", "incertain"] as const;
export const MAX_ATTENDU_ANCRAGE = 160;
export const MAX_ELEMENTS_FOURNISSEUR_V2 = 7;

const normaliserCitation = (texte: string) => texte.normalize("NFC").replace(/\s+/gu, " ").trim().toLocaleLowerCase("fr-FR");
const racines = (texte: string) => texte.normalize("NFD").replace(/[\u0300-\u036f]/gu, "").toLocaleLowerCase("fr-FR").match(/[a-z]{4,}/gu)?.map((mot) => mot.slice(0, 4)) ?? [];
const MOTS_LIAISON = new Set(["avec", "dans", "pour", "sans", "plus", "sous", "entre", "selon", "comme", "leurs", "cette", "celui"]);

/** Garde de forme : une mention doit citer le geste formulé, pas seulement son thème. */
function mentionFormulee(c: Record<string, unknown>, attendu: string, citation: string | undefined, referentiel?: ReferentielValidationDepot): boolean {
  if (!citation || !normaliserCitation(citation).includes(normaliserCitation(attendu))) return false;
  const intitule = c.mode === "existante"
    ? referentiel?.competences.find((item) => item.code === c.code)?.intitule
    : `${String(c.verbeAction ?? "")} ${String(c.objet ?? "")} ${String(c.precision ?? "")}`;
  if (!intitule) return true; // Le contrôle de code est assuré par validerOrganisationDepot.
  const [action, ...objet] = racines(intitule);
  const racinesAppui = new Set(racines(attendu));
  const objetsSignificatifs = objet.filter((mot) => !MOTS_LIAISON.has(mot));
  return Boolean(action && racinesAppui.has(action) && (!objetsSignificatifs.length || objetsSignificatifs.some((mot) => racinesAppui.has(mot))));
}

/**
 * Seulement à l'entrée des nouvelles réponses fournisseur. Ne relit ni ne migre
 * les restitutions historiques. L'appui temporaire n'est pas persisté, mais
 * sa relation au support l'est pour ne pas assimiler une mention à un enseignement.
 */
export function filtrerAncragesCompetences(value: unknown, note: string, pages: PageExtraiteDepot[], referentiel?: ReferentielValidationDepot) {
  const retour = objetDepot(value);
  const organisation = objetDepot(retour.organisation);
  const elements = listeDepot(retour.elements);
  if (elements.length > MAX_ELEMENTS_FOURNISSEUR_V2) throw new Error("Trop d'éléments pour la nouvelle restitution.");
  const propositions = listeDepot(organisation.competences);
  if (propositions.length > MAX_COMPETENCES_ORGANISATION_DEPOT) throw new Error("Trop de compétences proposées.");
  // Les propositions écartées restent soumises aux mêmes règles : aucun code,
  // verbe, domaine ou doublon invalide ne devient une simple réserve. Le repère
  // temporaire n'est ni renvoyé ni enregistré ; l'identifiant réel vient du store.
  validerOrganisationDepot(traduireSourcesRestitution(value, note, pages), "validation-ancrage", note, pages, referentiel);
  const passages = sourcesRestitution(note, pages).references;
  const competences: Record<string, unknown>[] = [];
  const reserves: { nature: "incertitude"; texte: string; sources: { passageId: string }[] }[] = [];
  for (const proposition of propositions) {
    const c = objetDepot(proposition);
    const appui = objetDepot(c.ancrage);
    if (Object.keys(appui).some((cle) => !["nature", "passageId", "attendu"].includes(cle))) {
      throw new Error("Ancrage de compétence invalide.");
    }
    const nature = texteDepot(appui.nature, 30);
    if (!NATURES_ANCRAGE_COMPETENCE.some((valeur) => valeur === nature)) throw new Error("Nature d'ancrage inconnue.");
    const attendu = texteDepot(appui.attendu, MAX_ATTENDU_ANCRAGE);
    const passageId = texteDepot(appui.passageId, 100);
    const ids = listeDepot(c.sources).map((source) => objetDepot(source).passageId);
    if (!ids.includes(passageId)) throw new Error("L'appui principal doit appartenir aux sources de la compétence.");
    const mentionValide = nature !== "mention" || mentionFormulee(c, attendu, passages.get(passageId)?.citation, referentiel);
    if (nature !== "incertain" && mentionValide) {
      const conservee = { ...c };
      delete conservee.ancrage;
      conservee.relationSupport = nature === "mention" ? "mention"
        : nature === "consigne" ? "demandee" : "enseignee";
      competences.push(conservee);
      continue;
    }
    // Une abstention est visible et sourcée, jamais remplacée par une compétence inventée.
    const intitule = c.mode === "existante" ? texteDepot(c.code, 100)
      : `${texteDepot(c.verbeAction, 80)} ${texteDepot(c.objet, 160)}${c.precision ? ` (${texteDepot(c.precision, 80)})` : ""}`;
    const motif = nature === "mention" ? "geste non retrouvé explicitement dans l'appui cité" : "geste ou résultat incertain";
    const texte = texteDepot(`Proposition non retenue : ${intitule} — ${motif}. Attendu à vérifier : ${attendu}`, 700);
    // Regrouper sans couper de texte et sans perdre le repère d'aucune abstention.
    const precedente = reserves.at(-1);
    const dejaCitee = precedente?.sources.some((s) => s.passageId === passageId);
    if (precedente && (dejaCitee || precedente.sources.length < 3) && precedente.texte.length + 1 + texte.length <= 700) {
      precedente.texte += `\n${texte}`;
      if (!dejaCitee) precedente.sources.push({ passageId });
    } else reserves.push({ nature: "incertitude", texte, sources: [{ passageId }] });
  }
  if (elements.length + reserves.length > 8) {
    throw new Error("Trop de compétences incertaines pour une restitution complète. Aucune liste partielle n'a été retenue ; les transcriptions restent disponibles.");
  }
  return { ...retour, elements: [...elements, ...reserves], organisation: { ...organisation, competences } };
}
