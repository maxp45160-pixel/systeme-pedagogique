/**
 * Correction proposée par le tuteur → bilan pré-rempli.
 *
 * Calque exact de `conversion-exercice.ts`, et pour la même règle :
 *
 * > **Une valeur illisible fait échouer la conversion. Elle n'est jamais
 * > remplacée par un défaut.**
 *
 * Ici la règle mord plus fort qu'ailleurs, parce que le défaut évident serait
 * `0`. Or `0` n'est pas une valeur neutre sur cette échelle : c'est la mesure
 * « non démontré ». Rabattre une valeur illisible sur `0` écrirait un jugement
 * négatif que personne n'a porté, et rien à l'écran ne le distinguerait d'un
 * vrai. C'est P2, et c'est le motif exact d'ADR-034.
 *
 * Deux règles propres à ce module :
 *
 * 1. **Couverture exhaustive obligatoire.** Un critère non couvert fait
 *    échouer la conversion entière. Un formulaire à moitié rempli ressemble à
 *    un formulaire rempli — c'est le « demi-exercice accepté » d'ADR-031
 *    transposé au bilan. Et un bilan à moitié rempli qu'on valide écrit une
 *    observation dont les dimensions manquent.
 * 2. **Le tuteur numérote à partir de 1, le formulaire indexe à partir de 0.**
 *    La bascule vit ici, une seule fois, testée. Éparpillée dans un composant,
 *    elle serait hors de portée de Vitest (ADR-039).
 *
 * Module **pur** : aucune entrée/sortie. Il ne juge pas la correction, il la
 * rend exploitable ou refuse de la rendre.
 */

import { APPRECIATIONS, RESULTATS, type ResultatBilan, type ValeurAppreciation } from "@/lib/domain/bilan";
import type { PropositionCorrection } from "./outils";
import type { Conversion } from "./conversion";

export interface CorrectionEnregistrable {
  resultat: ResultatBilan;
  /** Index **base 0**, comme `exercice.criteres` — la bascule est déjà faite. */
  appreciations: Record<number, ValeurAppreciation>;
  /** Le motif du tuteur, affiché sous chaque critère. Même indexation. */
  justifications: Record<number, string>;
  /**
   * Le retour rédigé (ADR-046) — traversé sans transformation.
   *
   * `validerCorrection` a déjà borné les trois champs ; il n'y a rien à
   * convertir, contrairement aux appréciations qui changent d'échelle et
   * d'indexation. Le champ traverse pour que l'appelant n'ait pas à connaître
   * deux objets là où il en manipule un.
   */
  bilan: BilanRedige;
}

export interface BilanRedige {
  pointsForts: string;
  pointsBloquants: string;
  /** Les seuls éléments qui reviendront dans le contexte du chat. */
  aRetravailler: string[];
}

/** `"partiel"` → `"partiel"`. Toute autre valeur rend `null` — on ne devine pas. */
export function versResultat(brut: string): ResultatBilan | null {
  const candidat = brut.trim().toLowerCase();
  return RESULTATS.find((r) => r.valeur === candidat)?.valeur ?? null;
}

/**
 * `"0.5"` → `0.5`. Trois positions, et rien entre elles.
 *
 * La virgule décimale est acceptée : un modèle qui répond en français écrit
 * « 0,5 », et refuser cette forme rejetterait une valeur parfaitement lisible.
 * En revanche `0.75` est refusé — l'échelle n'a que trois positions, et
 * l'arrondir choisirait à la place du tuteur *et* de l'utilisateur.
 */
export function versAppreciation(brut: string): ValeurAppreciation | null {
  const n = Number.parseFloat(brut.trim().replace(",", "."));
  if (!Number.isFinite(n)) return null;
  return APPRECIATIONS.find((a) => a.valeur === n)?.valeur ?? null;
}

/**
 * Convertit une correction proposée en bilan pré-remplissable, ou dit pourquoi
 * elle ne l'est pas.
 *
 * Toutes les erreurs sont collectées, pas seulement la première : même contrat
 * que `convertirProposition`. L'appelant n'affiche pas ces messages à
 * l'utilisateur — il retombe sur le formulaire nu — mais ils doivent rester
 * lisibles en journal, sinon un échec de conversion devient un silence.
 */
export function convertirCorrection(
  p: PropositionCorrection,
  nombreDeCriteres: number,
): Conversion<CorrectionEnregistrable> {
  const erreurs: string[] = [];

  if (!p || typeof p !== "object") {
    return { ok: false, erreurs: ["Proposition de correction vide ou non structurée."] };
  }

  const resultat = versResultat(typeof p.resultat === "string" ? p.resultat : "");
  if (resultat === null) {
    erreurs.push(
      `Résultat illisible : « ${p.resultat} ». Attendu réussi, partiel ou échec — aucune valeur n'est déduite à sa place.`,
    );
  }

  const appreciations: Record<number, ValeurAppreciation> = {};
  const justifications: Record<number, string> = {};

  const appreciationsBrutes = Array.isArray(p.appreciations) ? p.appreciations : [];
  for (const a of appreciationsBrutes) {
    if (!a || typeof a !== "object") continue;
    const critereTexte = typeof a.critere === "string" || typeof a.critere === "number" ? String(a.critere).trim() : "";
    const numero = Number.parseInt(critereTexte, 10);
    if (!Number.isInteger(numero) || numero < 1 || numero > nombreDeCriteres) {
      erreurs.push(
        `Numéro de critère hors liste : « ${a.critere} ». L'exercice en compte ${nombreDeCriteres}.`,
      );
      continue;
    }

    const index = numero - 1;
    if (index in appreciations) {
      // Deux verdicts sur le même critère : lequel serait le bon ? En garder
      // un serait choisir au hasard.
      erreurs.push(`Le critère ${numero} est apprécié deux fois.`);
      continue;
    }

    const valeur = versAppreciation(
      typeof a.valeur === "string" || typeof a.valeur === "number"
        ? String(a.valeur)
        : "",
    );
    if (valeur === null) {
      erreurs.push(
        `Appréciation illisible sur le critère ${numero} : « ${a.valeur} ». L'échelle n'a que trois positions, et aucune n'est déduite à sa place.`,
      );
      continue;
    }

    appreciations[index] = valeur;
    justifications[index] = typeof a.justification === "string" ? a.justification.trim() : "";
  }

  // La couverture exhaustive : un critère oublié laisserait un formulaire à
  // moitié rempli qui ressemble à un formulaire rempli.
  const manquants: number[] = [];
  for (let i = 0; i < nombreDeCriteres; i += 1) {
    if (!(i in appreciations)) manquants.push(i + 1);
  }
  if (manquants.length > 0) {
    erreurs.push(
      `Critère(s) non couvert(s) : ${manquants.join(", ")}. Une correction partielle ne se distingue pas d'une correction complète une fois affichée.`,
    );
  }

  if (erreurs.length > 0) return { ok: false, erreurs };

  const bilanBrut = p.bilan && typeof p.bilan === "object" ? p.bilan : { pointsForts: "", pointsBloquants: "", aRetravailler: [] };
  const bilan: BilanRedige = {
    pointsForts: typeof bilanBrut.pointsForts === "string" ? bilanBrut.pointsForts : "",
    pointsBloquants: typeof bilanBrut.pointsBloquants === "string" ? bilanBrut.pointsBloquants : "",
    aRetravailler: Array.isArray(bilanBrut.aRetravailler)
      ? bilanBrut.aRetravailler.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean)
      : [],
  };

  return {
    ok: true,
    valeur: {
      resultat: resultat as ResultatBilan,
      appreciations,
      justifications,
      bilan,
    },
  };
}

