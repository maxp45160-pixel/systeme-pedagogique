"use client";

/**
 * Les repères d'un document du corpus — des NOTES, pas des mesures.
 *
 * « Chapitre 1 … fait », « à relire avant l'examen » : la personne se laisse
 * des mots dans la marge de ses ressources. Trois frontières que ce module ne
 * franchit jamais :
 *
 *   1. un repère n'entre dans aucun calcul — ni niveau, ni score, ni
 *      recommandation ; c'est une déclaration, pas une observation ;
 *   2. aucune mécanique de complétion ne s'en déduit — pas de barre, pas de
 *      pourcentage, pas de « 3/5 fait ». Cocher « Chapitre 1 … fait » ne dit
 *      RIEN du niveau réel : le seul fait est qu'un mot a été écrit ;
 *   3. rien n'est inventé à la lecture : ce qui ne se valide pas comme repère
 *      est écarté, jamais réparé.
 *
 * Le stockage est local au navigateur et isolé par compte ET par document
 * (`cleParCompte`, garde-fou post-ADR-029). Ce sont des annotations de
 * travail personnel ; leur persistance côté serveur demanderait une décision
 * qui n'a pas été prise.
 */

import { cleParCompte } from "@/lib/ui/stockage-session";

export interface RepereCorpus {
  /** Identifiant technique, généré côté client. */
  id: string;
  /** Texte libre saisi par la personne. */
  texte: string;
  /** Date ISO de la saisie — quand le mot a été écrit, rien d'autre. */
  creeLe: string;
}

/** Un repère plus long n'est plus une note en marge. */
export const LONGUEUR_REPERE_MAX = 500;

/**
 * Valide un texte de repère : non vide après rognage, borné. Rend `null` pour
 * tout le reste — on refuse plutôt que de tronquer ou d'inventer.
 */
export function texteValide(texte: unknown): string | null {
  if (typeof texte !== "string") return null;
  const rogne = texte.trim();
  if (rogne.length === 0 || rogne.length > LONGUEUR_REPERE_MAX) return null;
  return rogne;
}

export function creerRepere(id: string, texte: unknown, creeLe: string): RepereCorpus | null {
  const contenu = texteValide(texte);
  return contenu === null ? null : { id, texte: contenu, creeLe };
}

/** Les repères se lisent du plus récent au plus ancien : la saisie va en tête. */
export function insererRepere(
  reperes: readonly RepereCorpus[],
  repere: RepereCorpus,
): RepereCorpus[] {
  return [repere, ...reperes];
}

export function retirerRepere(reperes: readonly RepereCorpus[], id: string): RepereCorpus[] {
  return reperes.filter((repere) => repere.id !== id);
}

function estRepere(valeur: unknown): valeur is RepereCorpus {
  if (typeof valeur !== "object" || valeur === null) return false;
  const candidat = valeur as Record<string, unknown>;
  return (
    typeof candidat.id === "string" &&
    candidat.id.length > 0 &&
    texteValide(candidat.texte) !== null &&
    typeof candidat.creeLe === "string" &&
    !Number.isNaN(new Date(candidat.creeLe).getTime())
  );
}

/** Une liste stockée est assainie à la lecture : un objet invalide est écarté, jamais réparé. */
export function reperesValides(valeur: unknown): RepereCorpus[] {
  if (!Array.isArray(valeur)) return [];
  return valeur.filter(estRepere);
}

function cle(compteId: string, documentId: string): string {
  return cleParCompte(`reperes-corpus:${documentId}`, compteId);
}

export function lireReperes(compteId: string, documentId: string): RepereCorpus[] {
  try {
    const brut = window.localStorage.getItem(cle(compteId, documentId));
    if (!brut) return [];
    return reperesValides(JSON.parse(brut));
  } catch {
    return [];
  }
}

export function enregistrerReperes(
  compteId: string,
  documentId: string,
  reperes: readonly RepereCorpus[],
): void {
  try {
    window.localStorage.setItem(cle(compteId, documentId), JSON.stringify(reperes));
  } catch {
    /* quota atteint ou navigation privée — voir stockage-session */
  }
}
