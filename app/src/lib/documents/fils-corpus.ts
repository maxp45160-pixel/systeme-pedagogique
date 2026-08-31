/**
 * Le fil des ressources d'un domaine — ce qu'on lit pour travailler, dans
 * l'ordre où le travail a eu lieu.
 *
 * Deux règles, et aucune invention :
 *
 *   - le rattachement est un FAIT DÉCLARÉ : une ressource sert un domaine par
 *     les compétences qu'elle cite (`rangerDocument`), ou parce que son
 *     front-matter la déclare pour lui. Rien n'est deviné au titre ;
 *   - l'ordre vient du JOURNAL : la dernière activité d'une ressource est la
 *     date de sa dernière observation portant sa preuve documentaire
 *     (`source.document.documentId`). Une ressource jamais mobilisée n'a pas
 *     de date — elle reste en fin de fil, sans date fabriquée (P2).
 *
 * Ce module ne stocke rien : tout se recalcule à chaque lecture depuis les
 * données déjà présentes (ADR-001).
 */

import type { SkillObservation } from "@/lib/domain/types";
import { rangerDocument } from "./rangement-atelier";

export interface DocumentCorpus {
  id: string;
  titre: string;
  type: string | null;
  /** Domaine déclaré dans le front-matter, s'il correspond à un domaine connu. */
  domaineConnu?: string;
  /** `support`, `operationnel`, ou absent pour une production du système. */
  role?: unknown;
  /** Codes de compétence effectivement cités par la fiche. */
  competencesCitees: string[];
}

export interface FilRessource {
  documentId: string;
  titre: string;
  type: string | null;
  /**
   * Date ISO de la dernière observation dont ce document est la preuve,
   * `null` si le journal n'en cite aucune.
   */
  derniereActivite: string | null;
}

/**
 * La dernière activité documentaire, DÉRIVÉE du journal — jamais stockée.
 *
 * Seule la référence explicite `source.document.documentId` compte : c'est la
 * seule que §2 garantit. Une observation sans document ne fait pas avancer
 * une ressource, et une référence qui ne désigne aucun document connu
 * disparaît naturellement au filtrage.
 */
export function activiteDocumentaire(
  observations: readonly SkillObservation[],
): Map<string, string> {
  const derniere = new Map<string, string>();
  for (const observation of observations) {
    const documentId = observation.source.document?.documentId;
    if (!documentId) continue;
    const connue = derniere.get(documentId);
    if (!connue || observation.date > connue) derniere.set(documentId, observation.date);
  }
  return derniere;
}

export interface EntreesFilRessources {
  domaineId: string;
  /** Codes des compétences du périmètre du domaine (porteur + rattachées). */
  codesCompetences: ReadonlySet<string>;
  documents: readonly DocumentCorpus[];
  observations: readonly SkillObservation[];
}

/**
 * Le fil des ressources du domaine, du plus récemment travaillé au plus ancien.
 *
 * Les preuves sortent d'elles-mêmes : `rangerDocument` les met hors corpus,
 * et « Ressources » ne garde que ce qu'on lit pour travailler. Une ressource
 * jamais mobilisée reste listée, après celles qui ont vécu — présente, sans
 * fausse fraîcheur ni zéro déguisé.
 */
export function filRessourcesDomaine(entrees: EntreesFilRessources): FilRessource[] {
  const activite = activiteDocumentaire(entrees.observations);

  const ressources = entrees.documents.filter((document) => {
    /*
     * Le module déclaré dans le front-matter est un rattachement explicite.
     * Un cours peut précéder ses compétences : il doit donc rester visible
     * dans son module même quand il ne cite encore aucun code.
     */
    if (document.domaineConnu === entrees.domaineId) return true;
    const rangement = rangerDocument({
      estPreuve: false,
      domaineConnu: document.domaineConnu,
      role: document.role,
      competencesCitees: document.competencesCitees,
    });
    if (rangement.zone === "domaine") return rangement.domaineId === entrees.domaineId;
    if (rangement.zone === "ressource") {
      return rangement.rattachements.some((code) => entrees.codesCompetences.has(code));
    }
    return false;
  });

  return ressources
    .map((document) => ({
      documentId: document.id,
      titre: document.titre,
      type: document.type,
      derniereActivite: activite.get(document.id) ?? null,
    }))
    .sort((a, b) => {
      // Les datées d'abord, de la plus récente à la plus ancienne ; les autres
      // gardent leur ordre d'entrée — aucune date n'est fabriquée pour elles.
      if (a.derniereActivite !== null && b.derniereActivite !== null) {
        return b.derniereActivite.localeCompare(a.derniereActivite);
      }
      if (a.derniereActivite !== null) return -1;
      if (b.derniereActivite !== null) return 1;
      return 0;
    });
}
