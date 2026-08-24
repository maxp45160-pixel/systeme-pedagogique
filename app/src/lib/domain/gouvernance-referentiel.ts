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
  competenceHomonyme,
  validerCompetence,
  validerDomaine,
  type CompetenceCandidate,
} from "./referentiel-compte";

/**
 * Une compétence proposée que le référentiel porte déjà.
 *
 * Ce n'est pas une erreur : la proposition est légitime, c'est le savoir-faire
 * qui existe. On ne crée pas un second code — cela dédoublerait ses observations.
 */
export interface CompetenceDejaAuReferentiel {
  intitule: string;
  code: string;
  domaineId: string;
  domaineNom: string;
  archive: boolean;
  /**
   * Vraie quand la compétence n'est pas déjà taguée sur ce domaine : demander
   * ce savoir-faire ici, c'est demander qu'il y serve, et le tag suit
   * (ADR-107). Fausse quand elle y sert déjà : il n'y a rien à faire.
   */
  aRattacher: boolean;
}

/**
 * Ce que produit une préparation.
 *
 * `commande` est `null` quand il n'y a rien à écrire — toutes les compétences
 * proposées existaient déjà, et seul le rattachement reste à faire. Écrire une
 * commande vide ferait une révision sans objet dans le journal.
 */
export interface PropositionReferentiel {
  commande: CommandeReferentiel | null;
  dejaAuReferentiel: CompetenceDejaAuReferentiel[];
}

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
  /*
   * Mettre de côté, sans jamais supprimer.
   *
   * Distincte de `retirer_competences`, dont l'heuristique SQL supprime la
   * ligne quand rien ne dépend de la compétence : c'est ce qu'il faut pour
   * effacer une erreur de saisie, et exactement ce qu'il ne faut pas pour une
   * mise de côté — une compétence dormante n'a par définition ni observation,
   * ni exercice, ni relation, elle était donc détruite alors que l'écran
   * promettait de pouvoir la reprendre (24/08/2026).
   */
  | { type: "archiver_competence"; domaineId: string; code: string }
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

/**
 * Ce que le journal `referentiel_changes` peut porter.
 *
 * Les commandes hors `appliquer_commande_referentiel` y écrivent aussi : le
 * tag (ADR-107) et le déplacement d'un domaine sont des mutations gouvernées,
 * avec leur propre fonction transactionnelle, et le journal les enregistre au
 * même titre. `rattacher_competences` / `detacher_competences` sont les noms
 * qu'ADR-081 écrivait ; ils restent lisibles dans l'historique des comptes
 * migrés, et ne sont plus produits.
 */
export type TypeChangementReferentiel =
  | CommandeReferentiel["type"]
  | "taguer_competences"
  | "detaguer_competences"
  | "deplacer_domaine"
  | "rattacher_competences"
  | "detacher_competences";

export interface ChangementReferentiel {
  id: string;
  requestId: string;
  domaineId: string;
  type: TypeChangementReferentiel;
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
): { ajouts: AjoutCompetenceCommande[]; dejaAuReferentiel: CompetenceDejaAuReferentiel[] } {
  const vues = new Set<string>();
  const dejaAuReferentiel: CompetenceDejaAuReferentiel[] = [];
  const ajouts: AjoutCompetenceCommande[] = [];

  for (const [index, competence] of brutes.filter(({ intitule }) => intitule.trim()).entries()) {
    const candidate: CompetenceCandidate = {
      intitule: competence.intitule.trim(),
      palier: normaliserPalier(competence.palier),
      importance: normaliserImportance(competence.importance),
      prerequis: [...new Set(competence.prerequis ?? [])],
    };
    const cle = candidate.intitule.toLocaleLowerCase("fr-FR");
    if (vues.has(cle)) throw new Error(`« ${candidate.intitule} » apparaît deux fois dans la proposition.`);
    vues.add(cle);

    /*
     * Le savoir-faire existe déjà : on ne lui fabrique pas un second code, qui
     * dédoublerait ses observations. Le contrôle passe **avant** la validation —
     * une compétence qu'on ne crée pas n'a pas à voir son palier ni son
     * importance validés.
     *
     * Demander ce savoir-faire dans ce domaine, c'est demander qu'il y serve :
     * le tag suit, sans autre geste (ADR-107).
     */
    const existante = competenceHomonyme(candidate.intitule, referentiel);
    if (existante) {
      dejaAuReferentiel.push({
        intitule: candidate.intitule,
        code: existante.code,
        domaineId: existante.domaine,
        domaineNom: referentiel.domainesParId.get(existante.domaine)?.nom ?? existante.domaine,
        archive: existante.archive,
        aRattacher: !(existante.tagsDomaine ?? []).includes(domaineId),
      });
      continue;
    }

    lever(validerCompetence(candidate, referentiel, domaineId));
    ajouts.push({ ...candidate, prerequis: candidate.prerequis ?? [], ordre: competence.ordre ?? index, origine });
  }

  if (ajouts.length === 0 && dejaAuReferentiel.length === 0) {
    throw new Error("Une commande d'ajout doit porter au moins une compétence.");
  }
  return { ajouts, dejaAuReferentiel };
}

export function preparerCreationDomaine(
  entree: { domaine: string; prefixe: string; description: string; competences: CompetenceBrute[]; origine: OrigineReferentiel },
  referentiel: Referentiel,
): PropositionReferentiel {
  const nom = entree.domaine.trim();
  const existant = referentiel.domaines.find((domaine) => domaine.nom.toLocaleLowerCase("fr-FR") === nom.toLocaleLowerCase("fr-FR"))
    ?? referentiel.domainesParId.get(slugifier(nom));
  if (existant) {
    const { ajouts, dejaAuReferentiel } = preparerAjouts(entree.competences, referentiel, existant.id, entree.origine);
    return {
      // Rien de neuf à écrire : il ne reste que des rattachements.
      commande: ajouts.length
        ? { type: "ajouter_competences", domaineId: existant.id, competences: ajouts }
        : null,
      dejaAuReferentiel,
    };
  }
  const prefixe = normaliserPrefixe(entree.prefixe, nom);
  lever(validerDomaine({ nom, prefixe, description: entree.description }, referentiel));
  const domaineId = slugifier(nom);
  const { ajouts, dejaAuReferentiel } = preparerAjouts(entree.competences, referentiel, domaineId, entree.origine);
  /*
   * Un domaine naît avec au moins une compétence à lui — la commande
   * transactionnelle l'exige, et un domaine qui n'emprunterait que des
   * compétences d'ailleurs n'aurait pas de quoi former son propre code.
   */
  if (ajouts.length === 0) {
    const liste = dejaAuReferentiel.map(({ code, domaineNom }) => `${code} (${domaineNom})`).join(", ");
    throw new Error(
      `« ${nom} » ne peut pas naître sans compétence à lui : toutes celles proposées existent déjà — ${liste}. Ajoute-lui au moins une compétence propre ; les autres se rattacheront ensuite.`,
    );
  }
  return {
    commande: {
      type: "creer_domaine",
      domaine: { id: domaineId, nom, prefixe, description: entree.description.trim(), ordre: referentiel.domaines.length, origine: entree.origine },
      competences: ajouts,
    },
    dejaAuReferentiel,
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
): PropositionReferentiel {
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
  const { ajouts, dejaAuReferentiel } = entree.ajouts.length
    ? preparerAjouts(entree.ajouts, referentiel, domaine.id, origine)
    : { ajouts: [], dejaAuReferentiel: [] };
  return {
    commande: {
      type: "reviser_domaine",
      domaineId: domaine.id,
      domaine: entree.domaine ? {
        ...(nom ? { nom } : {}),
        ...(entree.domaine.description !== undefined ? { description: entree.domaine.description.trim() } : {}),
        ...(entree.domaine.ordre !== undefined ? { ordre: entree.domaine.ordre } : {}),
      } : undefined,
      ajouts,
      modifications,
      retraits,
    },
    dejaAuReferentiel,
  };
}

export function nouvelIdCommande(): string {
  return globalThis.crypto.randomUUID();
}
