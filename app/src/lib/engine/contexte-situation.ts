/**
 * La famille de situation d'une preuve — ADR-083.
 *
 * ## Le défaut que ce module corrige
 *
 * `lib/store/actions.ts` écrit `contexte: exercice.titre`. Mesuré en base le
 * 18/08/2026 : **42 valeurs distinctes pour 52 preuves**. Or `skill-state.ts`
 * fait porter deux règles fortes sur ce champ — le niveau 4 « transfert »
 * exige deux contextes distincts, et la confiance monte à deux puis trois.
 * Un titre d'exercice étant presque unique, ces portes s'ouvraient seules :
 * **17 des 19 compétences à plusieurs preuves** franchissaient celle du
 * transfert. Avec la famille dérivée ci-dessous, il en reste **12**.
 *
 * Cinq compétences perdent ainsi une revendication qui n'avait pas été gagnée.
 * C'est l'effet recherché : le moteur dit moins, et plus juste.
 *
 * ## Ce qui fait une famille
 *
 * Le couple `domaine / type d'exercice` de l'exercice source. Deux problèmes
 * de logistique sont la même situation ; un problème de logistique et une
 * étude de cas de logistique, non. C'est la granularité que les données
 * portent réellement — ni plus fine (ce serait inventer), ni plus grossière
 * (le domaine seul confondrait calcul et étude de cas).
 *
 * ## Rien n'est stocké
 *
 * Aucune colonne, aucune migration (P1). La famille se recalcule à chaque
 * lecture depuis `evidence.source.ref`, exactement comme le niveau.
 */

import type {
  Exercise,
  FamilleSituation,
  SkillEvidence,
} from "@/lib/domain/types";

/**
 * Les exercices résolvables, par identifiant.
 *
 * `Pick` plutôt qu'`Exercise` entier : ce module n'a besoin que de deux
 * champs, et l'appelant peut ainsi lui passer une projection légère.
 */
export type CatalogueSituation = Map<string, Pick<Exercise, "domaine" | "type">>;

/** Préfixe des clés dérivées — jamais mélangées avec les libellés repliés. */
const PREFIXE_DERIVEE = "exercice:";
const PREFIXE_REPLI = "libre:";

/**
 * Construit le catalogue de résolution.
 *
 * **Le premier gagne.** L'appelant passe les exercices du compte AVANT ceux
 * livrés avec le logiciel : c'est l'ordre qu'applique déjà `chargerContexte`
 * (`EXERCICES_DIAGNOSTIC.filter((e) => !idsStockes.has(e.id))`), et un
 * diagnostic recopié en base doit l'emporter sur sa version d'origine.
 *
 * ⚠️ Le catalogue se construit sur les exercices **bruts**, jamais sur la
 * liste filtrée par le périmètre — même raison que `tableDureesEstimees`
 * (ADR-071). Une preuve peut venir d'un exercice archivé, sorti du périmètre,
 * ou jamais stocké : 24 des 45 preuves d'exercice du compte réel pointent vers
 * un diagnostic qui ne vit que dans `lib/seed/exercises.ts`. Les résoudre
 * contre la seule table les enverrait toutes au repli.
 */
export function construireCatalogueSituation(
  exercices: readonly Pick<Exercise, "id" | "domaine" | "type">[],
): CatalogueSituation {
  const catalogue: CatalogueSituation = new Map();
  for (const { id, domaine, type } of exercices) {
    if (!catalogue.has(id)) catalogue.set(id, { domaine, type });
  }
  return catalogue;
}

/** La clé de repli, quand aucun exercice ne répond de la preuve. */
function cleRepli(contexte: string): string {
  return `${PREFIXE_REPLI}${contexte.trim().toLocaleLowerCase("fr-FR")}`;
}

/**
 * La famille d'une preuve.
 *
 * La résolution se fait sur `source.ref` **sans regarder `source.kind`** : une
 * preuve manuelle dont la référence est un fichier de synthèse n'est de toute
 * façon pas au catalogue, et un `kind` mal renseigné ne doit pas empêcher une
 * résolution qui, elle, est vérifiable.
 */
export function familleSituation(
  preuve: SkillEvidence,
  catalogue: CatalogueSituation,
): FamilleSituation {
  const exercice = catalogue.get(preuve.source.ref);
  if (exercice) {
    return {
      cle: `${PREFIXE_DERIVEE}${exercice.domaine}/${exercice.type}`,
      libelle: `${exercice.domaine} · ${exercice.type}`,
      derivee: true,
    };
  }
  return { cle: cleRepli(preuve.contexte), libelle: preuve.contexte, derivee: false };
}

/**
 * Attache sa famille à chaque preuve, en copie.
 *
 * Appelé **une seule fois**, dans `chargerContexte`. Les preuves ainsi
 * enrichies traversent ensuite tout le moteur : `computeSkillState`,
 * `impact.ts` et `parcours.ts` lisent la famille sans avoir à connaître le
 * catalogue — le moteur ne va jamais chercher ses données lui-même.
 *
 * La copie est délibérée : rien de ce qui est ajouté ici ne doit pouvoir
 * remonter vers une écriture. Aucun chemin ne réécrit une preuve lue
 * (ADR-070), et `familleSituation` n'a pas de colonne.
 */
export function attacherFamilles(
  preuves: readonly SkillEvidence[],
  catalogue: CatalogueSituation,
): SkillEvidence[] {
  return preuves.map((preuve) => ({
    ...preuve,
    familleSituation: familleSituation(preuve, catalogue),
  }));
}

/**
 * Ce que le moteur compte comme « un contexte ».
 *
 * Le repli sur `contexte` n'est pas un défaut à masquer : c'est le
 * comportement d'avant ADR-083, conservé pour les preuves qu'aucun exercice ne
 * peut expliquer. `familleIndeterminee` permet de le dire à l'utilisateur
 * plutôt que de le laisser gonfler un niveau en silence.
 */
export function cleContexte(preuve: SkillEvidence): string {
  return preuve.familleSituation?.cle ?? cleRepli(preuve.contexte);
}

/** Vrai quand la famille est un repli — donc quasiment un identifiant. */
export function familleIndeterminee(preuve: SkillEvidence): boolean {
  return preuve.familleSituation?.derivee !== true;
}

/** Le libellé à afficher pour une famille. Jamais utilisé pour comparer. */
export function libelleContexte(preuve: SkillEvidence): string {
  return preuve.familleSituation?.libelle ?? preuve.contexte;
}
