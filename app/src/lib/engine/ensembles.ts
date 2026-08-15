/**
 * Les ensembles que le travail dessine.
 *
 * ## Ce qu'on cherche, et ce qu'on refuse de trouver
 *
 * Un `Theme` est l'« ensemble » du produit : un regroupement nommé de
 * compétences, traversant les domaines. Deux existent en base pour 143
 * compétences — non parce que le concept est mauvais, mais parce que créer un
 * thème est un geste d'organisation, et que personne n'ouvre l'application pour
 * organiser.
 *
 * L'idée est donc de les **proposer** depuis ce que le travail a déjà relié.
 * Encore faut-il que le lien ne soit pas circulaire : une séance que la
 * personne a composée en choisissant cinq compétences ne *révèle* pas que ces
 * cinq compétences vont ensemble — elle le répète. Proposer un ensemble sur
 * cette base reviendrait à lui rendre sa propre déclaration en la présentant
 * comme une découverte.
 *
 * D'où la règle centrale : **une paire ne compte que si elle a été observée
 * dans au moins deux sources distinctes.** Deux séances différentes, deux
 * exercices différents, ou une séance et un exercice. Une seule source, aussi
 * riche soit-elle, ne propose rien.
 *
 * ## État du signal au 15/08/2026
 *
 * Sur le compte le plus actif : 8 séances sur 48 portent plus d'une compétence,
 * 2 exercices sur 24 en visent plus d'une. La seule paire atteignant deux
 * sources est `DEV-03`/`DEV-04`. Ce module rendra donc presque toujours une
 * liste vide aujourd'hui — c'est le résultat correct, pas une panne. Il rend
 * aussi de quoi le **dire** (`sourcesExaminees`), pour qu'un écran vide puisse
 * expliquer pourquoi il l'est.
 *
 * Rien n'est stocké : tout se recalcule depuis le journal (P1).
 */

import type {
  DomaineId,
  Exercise,
  LearningSession,
  Referentiel,
  SkillEvidence,
} from "@/lib/domain/types";
import type { Theme } from "@/lib/domain/theme";

/** Nombre de sources distinctes exigé pour retenir une paire. */
export const SOURCES_MINIMUM = 2;
/** En deçà, un « ensemble » n'est qu'une paire — le thème n'apporte rien. */
export const CODES_MINIMUM = 2;

export interface PaireObservee {
  codes: [string, string];
  /** Identifiants des travaux qui ont mis les deux en jeu. */
  sources: string[];
}

export interface EnsemblePropose {
  /** Les compétences du groupe, triées. */
  codes: string[];
  /** Les domaines qu'il traverse — ce qui fait l'intérêt d'un ensemble. */
  domaines: DomaineId[];
  /** Les travaux qui l'ont dessiné, dédoublonnés. */
  sources: string[];
  /** Phrase citant ce qui fonde la proposition (P3). */
  motif: string;
}

export interface EntreesEnsembles {
  sessions: readonly LearningSession[];
  exercices: readonly Exercise[];
  preuves: readonly SkillEvidence[];
  themes: readonly Theme[];
  referentiel: Referentiel;
  sourcesMinimum?: number;
}

export interface ResultatEnsembles {
  propositions: EnsemblePropose[];
  /** Nombre de travaux ayant mis au moins deux compétences en jeu. */
  sourcesExaminees: number;
  /** Paires vues une seule fois : le signal existe, il est trop mince. */
  pairesTropMinces: number;
}

/**
 * Les paires de compétences mises en jeu par un même travail.
 *
 * Trois sources, toutes déjà en base et sans consommateur jusqu'ici : les
 * compétences d'une séance, celles d'un exercice, et les `competencesCombinees`
 * d'une preuve. Chacune porte son identifiant, ce qui permet de compter des
 * sources **distinctes** plutôt que des occurrences — deux tentatives du même
 * exercice ne font pas deux observations.
 */
export function pairesObservees(entrees: {
  sessions: readonly LearningSession[];
  exercices: readonly Exercise[];
  preuves: readonly SkillEvidence[];
  codesRetenus: ReadonlySet<string>;
}): PaireObservee[] {
  const paires = new Map<string, Set<string>>();

  const enregistrer = (codes: readonly string[], source: string) => {
    const propres = [...new Set(codes)].filter((code) => entrees.codesRetenus.has(code)).sort();
    if (propres.length < 2) return;
    for (let i = 0; i < propres.length; i++) {
      for (let j = i + 1; j < propres.length; j++) {
        const cle = `${propres[i]}|${propres[j]}`;
        const sources = paires.get(cle) ?? new Set<string>();
        sources.add(source);
        paires.set(cle, sources);
      }
    }
  };

  for (const session of entrees.sessions) enregistrer(session.skillCodes, `seance:${session.id}`);
  for (const exercice of entrees.exercices) {
    if (exercice.archive) continue;
    enregistrer(exercice.competences, `exercice:${exercice.id}`);
  }
  for (const preuve of entrees.preuves) {
    const combinees = preuve.competencesCombinees ?? [];
    if (combinees.length === 0) continue;
    /*
     * La source d'une preuve est son travail d'origine, pas la preuve.
     *
     * Un exercice à trois compétences écrit trois preuves qui se citent
     * mutuellement : les compter séparément ferait passer un seul travail pour
     * trois observations concordantes.
     */
    enregistrer([preuve.skillCode, ...combinees], `${preuve.source.kind}:${preuve.source.ref}`);
  }

  return [...paires.entries()].map(([cle, sources]) => {
    const [a, b] = cle.split("|");
    return { codes: [a, b] as [string, string], sources: [...sources] };
  });
}

/**
 * Regroupe les paires retenues en composantes connexes.
 *
 * Deux paires qui partagent une compétence décrivent le même territoire :
 * `{A,B}` et `{B,C}` donnent `{A,B,C}`. C'est la lecture la plus simple qui
 * respecte l'observation — aucun regroupement par ressemblance de vocabulaire,
 * aucune distance calculée. Le lien vient du travail, ou il ne vient pas.
 */
function composantes(paires: readonly PaireObservee[]): Array<{ codes: Set<string>; sources: Set<string> }> {
  const groupes: Array<{ codes: Set<string>; sources: Set<string> }> = [];

  for (const paire of paires) {
    const touches = groupes.filter(
      (groupe) => groupe.codes.has(paire.codes[0]) || groupe.codes.has(paire.codes[1]),
    );

    if (touches.length === 0) {
      groupes.push({ codes: new Set(paire.codes), sources: new Set(paire.sources) });
      continue;
    }

    // Fusionne les groupes que cette paire relie, puis y verse la paire.
    const fusion = touches[0];
    for (const autre of touches.slice(1)) {
      for (const code of autre.codes) fusion.codes.add(code);
      for (const source of autre.sources) fusion.sources.add(source);
      groupes.splice(groupes.indexOf(autre), 1);
    }
    for (const code of paire.codes) fusion.codes.add(code);
    for (const source of paire.sources) fusion.sources.add(source);
  }

  return groupes;
}

/** Un groupe est-il déjà couvert par un thème existant ? */
function dejaCouvert(codes: ReadonlySet<string>, themes: readonly Theme[]): boolean {
  return themes.some((theme) => {
    if (theme.archive) return false;
    const membres = new Set(theme.codes);
    return [...codes].every((code) => membres.has(code));
  });
}

export function ensemblesProposes(entrees: EntreesEnsembles): ResultatEnsembles {
  const seuil = entrees.sourcesMinimum ?? SOURCES_MINIMUM;
  const codesRetenus = entrees.referentiel.codesActifs;

  const paires = pairesObservees({
    sessions: entrees.sessions,
    exercices: entrees.exercices,
    preuves: entrees.preuves,
    codesRetenus,
  });

  const retenues = paires.filter((paire) => paire.sources.length >= seuil);
  const sourcesExaminees = new Set(paires.flatMap((paire) => paire.sources)).size;
  const pairesTropMinces = paires.length - retenues.length;

  const propositions = composantes(retenues)
    .filter((groupe) => groupe.codes.size >= CODES_MINIMUM && !dejaCouvert(groupe.codes, entrees.themes))
    .map((groupe) => {
      const codes = [...groupe.codes].sort();
      const domaines = [
        ...new Set(
          codes.flatMap((code) => {
            const skill = entrees.referentiel.parCode.get(code);
            return skill ? [skill.domaine] : [];
          }),
        ),
      ];
      const sources = [...groupe.sources].sort();
      return {
        codes,
        domaines,
        sources,
        motif: `${codes.length} compétences mises en jeu ensemble dans ${sources.length} travaux distincts`
          + (domaines.length > 1 ? `, à travers ${domaines.length} domaines.` : "."),
      };
    })
    // Le plus étayé d'abord : c'est le nombre de sources qui fait la solidité.
    .sort((a, b) => b.sources.length - a.sources.length || a.codes.length - b.codes.length);

  return { propositions, sourcesExaminees, pairesTropMinces };
}
