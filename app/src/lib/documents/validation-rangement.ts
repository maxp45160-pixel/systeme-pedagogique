import type { RangementRessourceDepot } from "./organisation-depot";
import { formatAutorise } from "./roles-note";

/** Frontière commune au rangement manuel, automatique et conversationnel. */
export function validerRangementActif(entree: RangementRessourceDepot, domaines: { id: string; archive?: boolean }[], competences: { code: string }[]) {
  if (!formatAutorise("support", entree.type)) throw new Error("Type de support invalide.");
  if (!entree.titre.trim() || entree.titre.length > 200 || /[\r\n]/.test(entree.titre)) throw new Error("Titre de ressource invalide.");
  if (new Set(entree.codes).size > 30) throw new Error("Trop de compétences liées à une ressource.");
  if (entree.domaineId && !domaines.some((d) => d.id === entree.domaineId && !d.archive)) throw new Error("Domaine de rangement inconnu.");
  if (entree.codes.some((c) => !competences.some((s) => s.code === c))) throw new Error("Compétence de rangement inconnue.");
}
