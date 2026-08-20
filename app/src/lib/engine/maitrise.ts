/**
 * « Que devient une compétence maîtrisée ? »
 *
 * ADR-035 a posé cette question pour les **exercices** et y a répondu. Personne
 * ne l'avait posée pour les **compétences** : une compétence de niveau 5
 * restait dans la file de recommandation indéfiniment, avec un intervalle de
 * révision seize fois plus long mais aucune sortie. Le produit savait dire
 * « tu progresses » et ne savait pas dire « tu sais ».
 *
 * Ce module dérive un prédicat, et rien d'autre. **Aucune colonne, aucun
 * stockage** (P1) : la maîtrise se recalcule à chaque lecture, comme le niveau
 * dont elle dépend. Une observation contradictoire écrite demain la retire d'elle-même.
 *
 * ## Pourquoi le seuil est 4 et non 5
 *
 * Le niveau 5 de `niveauSoutenu` exige `competencesCombinees.length >= 1`, que
 * `terminerExercice` n'écrit que pour un exercice visant **plusieurs**
 * compétences. Mesuré le 07/08/2026 : **les 47 observations du compte l'ont à
 * `null`** — 2 exercices multi-compétences existent, aucune tentative terminée
 * ne porte sur eux. Poser la maîtrise à 5, ce serait bâtir une fonctionnalité
 * qui ne se déclencherait jamais : l'erreur exacte des six entités mortes
 * supprimées le 28/07.
 *
 * Le niveau 4 est, lui, la définition protocolaire du transfert : deux
 * réussites autonomes A3+ avec `transfert ≥ 0,6` sur **deux contextes
 * distincts**. C'est une définition défendable de « elle sait faire ». Et
 * `DEB-01` et `RO-01` y sont aujourd'hui — le prédicat se déclenche sur des
 * données réelles, ce qui est la condition d'existence de la fonctionnalité.
 *
 * ## Pourquoi il n'introduit aucun seuil numérique
 *
 * C'est son argument le plus fort au regard de CLAUDE.md §8. Il se compose de
 * trois faits **déjà dérivés** par `computeSkillState` :
 *
 * ```
 * maitrisee ⟺ niveau !== null ∧ niveau >= NIVEAU_MAITRISE ∧ confiance ∈ {moyenne, forte}
 * ```
 *
 * La clause de confiance absorbe gratuitement, sans qu'on l'écrive :
 *
 * - une **observation contradictoire** fait chuter l'échelon (`skill-state.ts`) ⇒
 *   pas maîtrisée. C'est P4 lu correctement : une faiblesse ne disparaît pas
 *   sans démonstration ;
 * - une **dernière observation de plus de 120 jours** fait chuter l'échelon ⇒ la
 *   péremption est gratuite ;
 * - un **contexte unique** ne peut donner ni le niveau 4 ni une confiance
 *   ≥ moyenne ;
 * - une **régression confirmée** a déjà abaissé le niveau en amont.
 *
 * ## Ce que ce module ne fait pas
 *
 * Il ne touche pas `recommend.ts`. L'arbitrage de l'utilisateur — successeur,
 * élargissement ou retrait — **est** le mécanisme qui sort la compétence de la
 * file ; y ajouter un facteur de score préempterait cet arbitrage, sur zéro
 * donnée. Et `estDue` la tient déjà silencieuse 8 à 16 fois plus longtemps
 * (`spaced.ts`).
 *
 * 🔬 Déclencheur pour rouvrir : si une compétence maîtrisée reste en tête de la
 * file une semaine après son arbitrage, un facteur négatif devient justifié.
 */

import type { Explication, SkillState } from "@/lib/domain/types";
import { NIVEAUX } from "@/lib/domain/types";

/**
 * Le plancher de maîtrise. **Un plancher, pas une égalité** : le niveau 5 est
 * maîtrisé aussi.
 */
export const NIVEAU_MAITRISE = 4;

export interface Maitrise {
  code: string;
  maitrisee: boolean;
  /** Ce qui la fonde ou l'empêche — chaque valeur citée telle qu'observée (P3). */
  explication: Explication;
  /** Ce qui manque, en une phrase. `null` quand la compétence est maîtrisée. */
  manque: string | null;
}

/**
 * Le prédicat nu.
 *
 * Aucun `now` en paramètre : tout ce dont il a besoin est déjà dérivé dans
 * `SkillState`, y compris la péremption (via `confiance`). Ajouter une horloge
 * ici en ferait un second endroit où le temps se lit, donc un second endroit
 * où il peut diverger.
 */
export function estMaitrisee(etat: SkillState): boolean {
  if (etat.niveau === null) return false;
  if (etat.niveau < NIVEAU_MAITRISE) return false;
  return etat.confiance === "moyenne" || etat.confiance === "forte";
}

/**
 * Le prédicat, avec de quoi l'expliquer.
 *
 * L'explication ne cite que des valeurs mesurées — niveau, confiance, nombre
 * de contextes, nombre d'observations. Elle n'introduit aucun chiffre propre :
 * c'est P3 (aucune valeur sans source) appliqué à un dérivé de dérivés.
 */
export function evaluerMaitrise(etat: SkillState): Maitrise {
  const maitrisee = estMaitrisee(etat);
  const facteurs: Explication["facteurs"] = [];

  facteurs.push({
    libelle: "Niveau atteint",
    valeur:
      etat.niveau === null
        ? "aucune observation directe — rien n'est conclu"
        : `${etat.niveau} — ${NIVEAUX[etat.niveau].nom} (seuil de maîtrise : ${NIVEAU_MAITRISE})`,
  });

  facteurs.push({
    libelle: "Confiance",
    valeur: `${etat.confiance} — ${etat.explication.nombreObservations} observation(s) sur ${etat.contextesTestes.length} contexte(s)`,
  });

  if (etat.contradictions.length > 0) {
    facteurs.push({
      libelle: "Observations contradictoires",
      valeur: `${etat.contradictions.length} — elles abaissent la confiance, pas le niveau (P4)`,
    });
  }

  if (etat.joursDepuisDerniereObservation !== null) {
    facteurs.push({
      libelle: "Dernière observation",
      valeur: `il y a ${etat.joursDepuisDerniereObservation} jour(s)`,
    });
  }

  return {
    code: etat.skill.code,
    maitrisee,
    manque: maitrisee ? null : ceQuiManque(etat),
    explication: {
      resume: maitrisee
        ? `Maîtrisée : niveau ${etat.niveau} tenu sur ${etat.contextesTestes.length} contextes, avec une confiance ${etat.confiance}.`
        : `Pas encore maîtrisée. ${ceQuiManque(etat)}`,
      facteurs,
      nombreObservations: etat.explication.nombreObservations,
      reserves: etat.explication.reserves,
    },
  };
}

/**
 * Ce qui manque, nommé — jamais « niveau insuffisant » tout court.
 *
 * L'ordre des tests suit celui du prédicat : on annonce le premier obstacle
 * réel, pas une liste. Un écran qui dirait « il manque le niveau ET la
 * confiance » sur une compétence sans aucune observation serait exact et inutile.
 */
function ceQuiManque(etat: SkillState): string {
  if (etat.niveau === null) {
    return "Aucune observation directe : l'absence de mesure n'est pas une maîtrise.";
  }
  if (etat.niveau < NIVEAU_MAITRISE) {
    return `Niveau ${etat.niveau} — il faut atteindre ${NIVEAU_MAITRISE} (${NIVEAUX[NIVEAU_MAITRISE].nom}), c'est-à-dire réussir en autonomie dans deux contextes distincts.`;
  }
  if (etat.contradictions.length > 0) {
    return `Le niveau ${etat.niveau} est atteint, mais ${etat.contradictions.length} observation(s) contradictoire(s) maintiennent la confiance à « faible ».`;
  }
  if (etat.joursDepuisDerniereObservation !== null && etat.joursDepuisDerniereObservation > 120) {
    return `Le niveau ${etat.niveau} est atteint, mais la dernière observation date de ${etat.joursDepuisDerniereObservation} jours : la confiance est retombée.`;
  }
  return `Le niveau ${etat.niveau} est atteint, mais la confiance reste « ${etat.confiance} » — il faut plus d'observations, ou plus de contextes distincts.`;
}

/** La maîtrise de chaque état, indexée par code. Une passe, aucun tri. */
export function evaluerMaitrises(etats: SkillState[]): Map<string, Maitrise> {
  return new Map(etats.map((e) => [e.skill.code, evaluerMaitrise(e)]));
}
