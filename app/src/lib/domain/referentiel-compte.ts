/**
 * Validation et normalisation du référentiel d'un compte (ADR-026).
 *
 * Module **pur** : aucune entrée/sortie, aucun accès base. Il porte la moitié
 * mécanique de la charte de rédaction d'une compétence
 * (`data/00_instructions/00_SYSTEME_PROTOCOLE_REFERENTIEL.txt`) — celle qu'une
 * machine peut trancher : format du préfixe, unicité, bornes, résolution des
 * prérequis.
 *
 * La moitié sémantique — « est-ce un savoir-faire observable, mesurable par les
 * cinq dimensions ? » — n'est PAS vérifiée ici et ne peut pas l'être. Elle
 * revient à l'utilisateur au moment de la validation, ce qui est exactement la
 * répartition posée par P5 : le tuteur propose, la personne décide.
 *
 * L'attribution des codes vit également ici, et non côté tuteur. Un code est la
 * clé étrangère des preuves : le laisser inventer par un modèle ouvrirait la
 * porte aux collisions et aux doublons silencieux.
 */

import { ORDRE_PALIERS } from "./types";
import type { Domaine, DomaineId, OrigineReferentiel, Palier, Referentiel, Skill } from "./types";

/* ------------------------------------------------------------------ */
/* Assemblage                                                          */
/* ------------------------------------------------------------------ */

/**
 * Ordre d'affichage et de diagnostic : palier croissant, puis rang déclaré,
 * puis code.
 *
 * Il remplace la constante `ORDRE_DIAGNOSTIC` — une liste de onze codes en dur,
 * seule trace d'un plan d'évaluation supprimé le 27/07/2026. Un référentiel
 * construit par l'utilisateur ne peut pas porter de liste écrite d'avance :
 * l'ordre se **dérive** de ce que la compétence déclare d'elle-même.
 */
export function comparerSkills(a: Skill, b: Skill): number {
  const palier = ORDRE_PALIERS.indexOf(a.palier) - ORDRE_PALIERS.indexOf(b.palier);
  if (palier !== 0) return palier;
  if (a.ordre !== b.ordre) return a.ordre - b.ordre;
  return a.code.localeCompare(b.code);
}

function comparerDomaines(a: Domaine, b: Domaine): number {
  if (a.ordre !== b.ordre) return a.ordre - b.ordre;
  return a.nom.localeCompare(b.nom);
}

/**
 * Assemble les vues dérivées à partir des deux collections brutes.
 *
 * Les quatre vues sont recalculées à chaque lecture et jamais stockées (P1).
 */
export function assemblerReferentiel(domaines: Domaine[], skills: Skill[]): Referentiel {
  const tries = [...skills].sort(comparerSkills);
  // Le périmètre de travail : ni archivée, ni désactivée. Les deux drapeaux
  // sont distincts — désactiver est réversible d'un clic, archiver acte qu'une
  // compétence porte des preuves et ne peut plus être supprimée (ADR-027).
  const actifs = tries.filter((s) => s.active && !s.archive);

  return {
    domaines: [...domaines].sort(comparerDomaines),
    skills: tries,
    actifs,
    // Toutes les compétences, archivées comprises : `historique.ts` doit
    // pouvoir résoudre l'intitulé d'une preuve ancienne dont la compétence a
    // été retirée du périmètre.
    parCode: new Map(tries.map((s) => [s.code, s])),
    codesActifs: new Set(actifs.map((s) => s.code)),
    domainesParId: new Map(domaines.map((d) => [d.id, d])),
  };
}

/**
 * Référentiel d'un compte qui n'en a pas encore.
 *
 * Ce n'est pas un cas dégradé : c'est l'état normal d'un compte neuf depuis
 * ADR-026. L'interface doit le distinguer d'un référentiel sans preuve — le
 * premier envoie construire, le second envoie mesurer.
 */
export const REFERENTIEL_VIDE: Referentiel = assemblerReferentiel([], []);

/**
 * Libellé lisible d'un domaine, ou son identifiant à défaut.
 *
 * Remplace la fonction homonyme de `lib/domain/referentiel.ts`, qui lisait une
 * table globale. Elle prend désormais le référentiel du compte : deux comptes
 * peuvent employer le même identifiant pour des domaines différents, et rien ne
 * garantit qu'un domaine existe encore quand une preuve ancienne le mentionne.
 */
export function libelleDomaine(referentiel: Referentiel, id: DomaineId): string {
  return referentiel.domainesParId.get(id)?.nom ?? id;
}

export const INTITULE_MIN = 10;
export const INTITULE_MAX = 200;

const PREFIXE_VALIDE = /^[A-Z]{2,5}$/;
const PALIERS: Palier[] = ["fondamentaux", "intermediaire", "avance"];

/* ------------------------------------------------------------------ */
/* Normalisation                                                       */
/* ------------------------------------------------------------------ */

/** « Philosophie morale » → « philosophie-morale ». */
export function slugifier(nom: string): string {
  return nom
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Préfixe de repli quand le tuteur n'en propose pas d'exploitable : les
 * premières lettres du nom, sans accent. Jamais silencieux — l'écran de
 * validation le montre et l'utilisateur peut le corriger.
 */
export function prefixeParDefaut(nom: string): string {
  const lettres = slugifier(nom).replace(/[^a-z]/g, "").toUpperCase();
  return lettres.slice(0, 3).padEnd(2, "X").slice(0, 5);
}

export function normaliserPrefixe(brut: string, nomDomaine: string): string {
  const candidat = brut
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z]/g, "")
    .toUpperCase()
    .slice(0, 5);
  return PREFIXE_VALIDE.test(candidat) ? candidat : prefixeParDefaut(nomDomaine);
}

export function normaliserPalier(brut: string): Palier {
  const nu = slugifier(brut);
  return PALIERS.find((p) => p === nu) ?? "fondamentaux";
}

/**
 * Importance dans [0, 1]. Une valeur illisible retombe sur 0.5 plutôt que sur
 * 0 : une importance nulle retirerait la compétence du calcul de recommandation
 * sans que personne ne l'ait décidé.
 */
export function normaliserImportance(brut: string | number): number {
  const n = typeof brut === "number" ? brut : Number.parseFloat(brut.replace(",", "."));
  if (!Number.isFinite(n)) return 0.5;
  return Math.min(1, Math.max(0, n));
}

/* ------------------------------------------------------------------ */
/* Attribution des codes                                               */
/* ------------------------------------------------------------------ */

/**
 * Prochain code libre pour un préfixe, ex. « PHI-03 ».
 *
 * Reprend toujours après le plus grand numéro **déjà attribué**, jamais dans un
 * trou laissé par une suppression : réattribuer « PHI-02 » à une autre
 * compétence ferait pointer les preuves de l'ancienne sur la nouvelle.
 */
export function prochainCode(prefixe: string, codesExistants: Iterable<string>): string {
  const motif = new RegExp(`^${prefixe}-(\\d+)$`);
  let max = 0;
  for (const code of codesExistants) {
    const m = code.match(motif);
    if (m) max = Math.max(max, Number.parseInt(m[1], 10));
  }
  const suivant = max + 1;
  return `${prefixe}-${String(suivant).padStart(2, "0")}`;
}

/** Attribue `n` codes consécutifs, sans relire la base entre chaque. */
export function attribuerCodes(
  prefixe: string,
  codesExistants: Iterable<string>,
  combien: number,
): string[] {
  const pris = new Set(codesExistants);
  const codes: string[] = [];
  for (let i = 0; i < combien; i += 1) {
    const code = prochainCode(prefixe, pris);
    pris.add(code);
    codes.push(code);
  }
  return codes;
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

export interface DomaineCandidat {
  nom: string;
  prefixe: string;
  description: string;
}

export interface CompetenceCandidate {
  intitule: string;
  palier: Palier;
  importance: number;
  prerequis?: string[];
}

/**
 * Erreurs bloquantes d'un domaine proposé. Une liste vide vaut « recevable ».
 * `referentiel` sert à vérifier l'unicité, `idIgnore` à ne pas se heurter
 * soi-même lors d'une modification.
 */
export function validerDomaine(
  candidat: DomaineCandidat,
  referentiel: Referentiel,
  idIgnore?: string,
): string[] {
  const erreurs: string[] = [];
  const nom = candidat.nom.trim();

  if (nom.length < 3) {
    erreurs.push("Le nom du domaine doit faire au moins 3 caractères.");
  }
  if (!PREFIXE_VALIDE.test(candidat.prefixe)) {
    erreurs.push(`Le préfixe « ${candidat.prefixe} » doit être 2 à 5 lettres majuscules.`);
  }

  const id = slugifier(nom);
  const nomNu = nom.toLowerCase();
  for (const d of referentiel.domaines) {
    if (d.id === idIgnore) continue;
    // Trois collisions distinctes, et il faut les trois. L'identifiant seul ne
    // suffit pas : ceux du référentiel migré viennent de l'ancien module compilé
    // et ne dérivent pas de leur nom (« developpement » pour « Développement
    // logiciel »). Sans le contrôle sur le nom, deux domaines pouvaient
    // coexister avec le même libellé affiché — indiscernables à l'écran.
    if (d.id === id || d.nom.toLowerCase() === nomNu) {
      erreurs.push(`Le domaine « ${d.nom} » existe déjà.`);
    }
    if (d.prefixe === candidat.prefixe) {
      erreurs.push(
        `Le préfixe « ${candidat.prefixe} » est déjà pris par « ${d.nom} » — il engendre les codes, il doit rester unique.`,
      );
    }
  }

  return erreurs;
}

export function validerCompetence(
  candidat: CompetenceCandidate,
  referentiel: Referentiel,
  domaineId: string,
  codeIgnore?: string,
): string[] {
  const erreurs: string[] = [];
  const intitule = candidat.intitule.trim();

  if (intitule.length < INTITULE_MIN) {
    erreurs.push(
      `L'intitulé doit faire au moins ${INTITULE_MIN} caractères et décrire un savoir-faire observable.`,
    );
  }
  if (intitule.length > INTITULE_MAX) {
    erreurs.push(`L'intitulé dépasse ${INTITULE_MAX} caractères — la compétence est sans doute à découper.`);
  }
  if (!PALIERS.includes(candidat.palier)) {
    erreurs.push(`Palier inconnu : « ${candidat.palier} ».`);
  }
  if (!Number.isFinite(candidat.importance) || candidat.importance < 0 || candidat.importance > 1) {
    erreurs.push("L'importance doit être comprise entre 0 et 1.");
  }

  // Doublon d'intitulé dans le même domaine : deux compétences identiques
  // dédoubleraient les preuves d'un même savoir-faire et fausseraient la
  // couverture.
  const nu = intitule.toLowerCase();
  for (const s of referentiel.skills) {
    if (s.code === codeIgnore) continue;
    if (s.domaine === domaineId && s.intitule.trim().toLowerCase() === nu) {
      erreurs.push(`« ${s.code} » porte déjà cet intitulé dans ce domaine.`);
    }
  }

  for (const p of candidat.prerequis ?? []) {
    if (p === codeIgnore) {
      erreurs.push("Une compétence ne peut pas être son propre prérequis.");
    } else if (!referentiel.parCode.has(p)) {
      erreurs.push(`Prérequis inconnu : « ${p} ».`);
    }
  }

  return erreurs;
}

/* ------------------------------------------------------------------ */
/* Retrait — la règle d'ADR-027                                        */
/* ------------------------------------------------------------------ */

export type ModeRetrait = "suppression" | "archivage";

/**
 * Quel retrait s'applique à une compétence, **dérivé** du nombre de preuves.
 *
 * Ce n'est pas un choix offert à l'utilisateur : une preuve ne disparaît pas
 * (P4, anti-hallucination §6). Sans preuve, la ligne s'efface franchement ;
 * dès la première, seul l'archivage reste — la compétence sort du périmètre,
 * son intitulé reste résoluble et l'historique reste lisible.
 */
export function modeRetrait(nombreDePreuves: number): ModeRetrait {
  return nombreDePreuves === 0 ? "suppression" : "archivage";
}

/**
 * Un domaine ne s'efface que si aucune de ses compétences ne porte de preuve.
 * Sinon il est archivé avec elles.
 */
export function modeRetraitDomaine(
  domaineId: string,
  referentiel: Referentiel,
  preuvesParCode: Map<string, number>,
): ModeRetrait {
  const membres = referentiel.skills.filter((s) => s.domaine === domaineId);
  const porteUnePreuve = membres.some((s) => (preuvesParCode.get(s.code) ?? 0) > 0);
  return porteUnePreuve ? "archivage" : "suppression";
}

/* ------------------------------------------------------------------ */
/* Construction                                                        */
/* ------------------------------------------------------------------ */

export function construireDomaine(
  candidat: DomaineCandidat,
  origine: OrigineReferentiel,
  ordre: number,
): Domaine {
  return {
    id: slugifier(candidat.nom),
    nom: candidat.nom.trim(),
    prefixe: candidat.prefixe,
    description: candidat.description.trim(),
    ordre,
    archive: false,
    origine,
  };
}

export function construireCompetences(
  candidates: CompetenceCandidate[],
  domaine: Domaine,
  referentiel: Referentiel,
  origine: OrigineReferentiel,
): Skill[] {
  const codes = attribuerCodes(domaine.prefixe, referentiel.parCode.keys(), candidates.length);
  const depart = referentiel.skills.filter((s) => s.domaine === domaine.id).length;

  return candidates.map((c, i) => ({
    code: codes[i],
    domaine: domaine.id,
    intitule: c.intitule.trim(),
    palier: c.palier,
    prerequis: c.prerequis ?? [],
    importance: c.importance,
    ordre: depart + i,
    active: true,
    archive: false,
    origine,
  }));
}
