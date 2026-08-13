/**
 * Contrat pur des mutations du référentiel.
 *
 * Les composants et le tuteur ne décrivent jamais des requêtes SQL : ils
 * produisent une commande fermée, validée ici, que PostgreSQL applique ensuite
 * en une transaction. Le serveur revalide néanmoins la commande au commit.
 */

import type { OrigineReferentiel, Palier, Referentiel } from "./types";
import {
  normaliserImportance,
  normaliserPalier,
  normaliserPrefixe,
  slugifier,
  validerCompetence,
  validerDomaine,
  type CompetenceCandidate,
} from "./referentiel-compte";

export interface AjoutCompetenceCommande {
  intitule: string;
  palier: Palier;
  importance: number;
  prerequis: string[];
  ordre: number;
  origine: OrigineReferentiel;
}

export interface ModificationCompetenceCommande {
  code: string;
  intitule?: string;
  palier?: Palier;
  importance?: number;
  prerequis?: string[];
  ordre?: number;
}

export type CommandeReferentiel =
  | {
      type: "creer_domaine";
      domaine: { id: string; nom: string; prefixe: string; description: string; ordre: number; origine: OrigineReferentiel };
      competences: AjoutCompetenceCommande[];
    }
  | { type: "ajouter_competences"; domaineId: string; competences: AjoutCompetenceCommande[] }
  | {
      type: "reviser_domaine";
      domaineId: string;
      domaine?: { nom?: string; description?: string; ordre?: number };
      ajouts: AjoutCompetenceCommande[];
      modifications: ModificationCompetenceCommande[];
      retraits: string[];
    }
  | { type: "activer_competences"; domaineId: string; codes: string[]; active: boolean }
  | { type: "desarchiver_competence"; domaineId: string; code: string }
  | { type: "retirer_competences"; domaineId: string; codes: string[] }
  | { type: "archiver_domaine"; domaineId: string }
  | { type: "restaurer_domaine"; domaineId: string }
  | { type: "remplacer_competence"; domaineId: string; code: string; successeur: AjoutCompetenceCommande };

export interface EnveloppeCommandeReferentiel {
  requestId: string;
  expectedVersion: number | null;
  origine: OrigineReferentiel;
  motif: string;
  commande: CommandeReferentiel;
}

export interface ResultatCommandeReferentiel {
  domaineId: string;
  version: number | null;
  codes?: string[];
  ajoutees?: string[];
  modifiees?: string[];
  supprimees?: string[];
  archivees?: string[];
  successeur?: string;
  domaineSupprime?: boolean;
}

export interface ChangementReferentiel {
  id: string;
  requestId: string;
  domaineId: string;
  type: CommandeReferentiel["type"];
  versionAvant: number | null;
  versionApres: number | null;
  origine: OrigineReferentiel;
  motif: string;
  diff: Record<string, unknown>;
  creeLe: string;
}

type CompetenceBrute = {
  intitule: string;
  palier: string;
  importance: string | number;
  prerequis?: string[];
  ordre?: number;
};

function lever(erreurs: string[]): void {
  if (erreurs.length > 0) throw new Error([...new Set(erreurs)].join(" "));
}

function preparerAjouts(
  brutes: CompetenceBrute[],
  referentiel: Referentiel,
  domaineId: string,
  origine: OrigineReferentiel,
): AjoutCompetenceCommande[] {
  const vues = new Set<string>();
  const ajouts = brutes.filter((competence) => competence.intitule.trim()).map((competence, index) => {
    const candidate: CompetenceCandidate = {
      intitule: competence.intitule.trim(),
      palier: normaliserPalier(competence.palier),
      importance: normaliserImportance(competence.importance),
      prerequis: [...new Set(competence.prerequis ?? [])],
    };
    lever(validerCompetence(candidate, referentiel, domaineId));
    const cle = candidate.intitule.toLocaleLowerCase("fr-FR");
    if (vues.has(cle)) throw new Error(`« ${candidate.intitule} » apparaît deux fois dans la proposition.`);
    vues.add(cle);
    return { ...candidate, prerequis: candidate.prerequis ?? [], ordre: competence.ordre ?? index, origine };
  });
  if (ajouts.length === 0) throw new Error("Une commande d'ajout doit porter au moins une compétence.");
  return ajouts;
}

export function preparerCreationDomaine(
  entree: { domaine: string; prefixe: string; description: string; competences: CompetenceBrute[]; origine: OrigineReferentiel },
  referentiel: Referentiel,
): CommandeReferentiel {
  const nom = entree.domaine.trim();
  const existant = referentiel.domaines.find((domaine) => domaine.nom.toLocaleLowerCase("fr-FR") === nom.toLocaleLowerCase("fr-FR"))
    ?? referentiel.domainesParId.get(slugifier(nom));
  if (existant) return {
    type: "ajouter_competences",
    domaineId: existant.id,
    competences: preparerAjouts(entree.competences, referentiel, existant.id, entree.origine),
  };
  const prefixe = normaliserPrefixe(entree.prefixe, nom);
  lever(validerDomaine({ nom, prefixe, description: entree.description }, referentiel));
  const domaineId = slugifier(nom);
  return {
    type: "creer_domaine",
    domaine: { id: domaineId, nom, prefixe, description: entree.description.trim(), ordre: referentiel.domaines.length, origine: entree.origine },
    competences: preparerAjouts(entree.competences, referentiel, domaineId, entree.origine),
  };
}

export function preparerRevisionDomaine(
  entree: {
    domaineId: string;
    domaine?: { nom?: string; description?: string; ordre?: number };
    ajouts: CompetenceBrute[];
    modifications: Array<{ code: string; intitule?: string; palier?: string; importance?: string | number; prerequis?: string[]; ordre?: number }>;
    retraits: string[];
  },
  referentiel: Referentiel,
  origine: OrigineReferentiel,
): CommandeReferentiel {
  const domaine = referentiel.domainesParId.get(entree.domaineId);
  if (!domaine) throw new Error(`Domaine inconnu : ${entree.domaineId}`);
  const retraits = [...new Set(entree.retraits)];
  for (const code of [...entree.modifications.map(({ code }) => code), ...retraits]) {
    if (referentiel.parCode.get(code)?.domaine !== domaine.id) throw new Error(`${code} n'appartient pas au domaine ${domaine.nom}.`);
  }
  const modifications = entree.modifications.map((modification) => {
    const actuelle = referentiel.parCode.get(modification.code)!;
    const candidate: CompetenceCandidate = {
      intitule: modification.intitule?.trim() || actuelle.intitule,
      palier: modification.palier ? normaliserPalier(modification.palier) : actuelle.palier,
      importance: modification.importance === undefined ? actuelle.importance : normaliserImportance(modification.importance),
      prerequis: modification.prerequis ?? actuelle.prerequis,
    };
    lever(validerCompetence(candidate, referentiel, domaine.id, actuelle.code));
    return {
      code: actuelle.code,
      ...(modification.intitule !== undefined ? { intitule: candidate.intitule } : {}),
      ...(modification.palier !== undefined ? { palier: candidate.palier } : {}),
      ...(modification.importance !== undefined ? { importance: candidate.importance } : {}),
      ...(modification.prerequis !== undefined ? { prerequis: candidate.prerequis } : {}),
      ...(modification.ordre !== undefined ? { ordre: modification.ordre } : {}),
    };
  });
  for (const ajout of entree.ajouts) {
    const pendant = (ajout.prerequis ?? []).find((code) => retraits.includes(code));
    if (pendant) throw new Error(`« ${ajout.intitule} » dépend de ${pendant}, retirée dans la même révision.`);
  }
  const nom = entree.domaine?.nom?.trim();
  if (nom) lever(validerDomaine({ nom, prefixe: domaine.prefixe, description: entree.domaine?.description ?? domaine.description }, referentiel, domaine.id));
  return {
    type: "reviser_domaine",
    domaineId: domaine.id,
    domaine: entree.domaine ? {
      ...(nom ? { nom } : {}),
      ...(entree.domaine.description !== undefined ? { description: entree.domaine.description.trim() } : {}),
      ...(entree.domaine.ordre !== undefined ? { ordre: entree.domaine.ordre } : {}),
    } : undefined,
    ajouts: entree.ajouts.length ? preparerAjouts(entree.ajouts, referentiel, domaine.id, origine) : [],
    modifications,
    retraits,
  };
}

export function nouvelIdCommande(): string {
  return globalThis.crypto.randomUUID();
}
