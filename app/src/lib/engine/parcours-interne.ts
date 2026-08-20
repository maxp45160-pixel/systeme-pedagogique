import type { Recommandation } from "./recommend";

/**
 * Parcours dérivé à la lecture depuis les objectifs textuels du profil.
 *
 * Il n'est ni persisté ni exposé à l'interface : il sert uniquement à ordonner
 * les compétences déjà recommandables. Une absence de correspondance lexicale
 * ne fabrique pas de cible ; elle conserve le classement pédagogique existant.
 */
export interface ParcoursInterne {
  codes: string[];
}

const MOTS_VIDES = new Set([
  "avec", "dans", "des", "pour", "sur", "une", "les", "mes", "mon", "ma",
  "et", "en", "de", "du", "au", "aux", "faire", "pouvoir", "objectif",
  "moyen", "long", "terme", "atteindre", "développer", "gagner", "niveau",
]);

function mots(texte: string): Set<string> {
  return new Set(
    texte
      .toLocaleLowerCase("fr-FR")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .split(/[^a-z0-9]+/)
      .map((mot) => mot.trim())
      .filter((mot) => mot.length >= 3 && !MOTS_VIDES.has(mot)),
  );
}

function pertinence(recommandation: Recommandation, objectifs: Set<string>): number {
  const skill = recommandation.etat.skill;
  const tokens = mots(`${skill.intitule} ${skill.domaine}`);
  let score = 0;
  for (const token of tokens) {
    if (objectifs.has(token)) score += token.length >= 5 ? 2 : 1;
  }
  return score;
}

export function construireParcoursInterne(entrees: {
  objectifMoyenTerme?: string | null;
  objectifLongTerme?: string | null;
  recommandations: readonly Recommandation[];
}): ParcoursInterne {
  const objectifs = mots(
    [entrees.objectifMoyenTerme, entrees.objectifLongTerme]
      .filter((texte): texte is string => Boolean(texte?.trim()))
      .join(" "),
  );
  const rangInitial = new Map(
    entrees.recommandations.map((recommandation, index) => [recommandation.etat.skill.code, index]),
  );

  return {
    codes: entrees.recommandations
      .slice()
      .sort((a, b) =>
        pertinence(b, objectifs) - pertinence(a, objectifs)
        || (rangInitial.get(a.etat.skill.code) ?? 0) - (rangInitial.get(b.etat.skill.code) ?? 0),
      )
      .map((recommandation) => recommandation.etat.skill.code),
  };
}

/** Applique le parcours interne sans modifier les scores ni les explications. */
export function ordonnerSelonParcoursInterne<T extends Recommandation>(
  recommandations: readonly T[],
  parcours: ParcoursInterne,
): T[] {
  const rang = new Map(parcours.codes.map((code, index) => [code, index]));
  return recommandations
    .slice()
    .sort((a, b) => (rang.get(a.etat.skill.code) ?? Number.MAX_SAFE_INTEGER)
      - (rang.get(b.etat.skill.code) ?? Number.MAX_SAFE_INTEGER));
}
