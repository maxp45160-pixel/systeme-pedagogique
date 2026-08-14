import {
  LIBELLES_DIMENSIONS,
  type Confiance,
  type Domaine,
  type Dimension,
  type Exercise,
  type ExerciseAttempt,
  type NiveauCompetence,
  type Referentiel,
  type Skill,
  type SkillEvidence,
  type SkillState,
} from "@/lib/domain/types";
import type { Theme } from "@/lib/domain/theme";
import { retraitsParCode, type EtatRetrait } from "@/lib/domain/referentiel-compte";
import type { IndexDocumentaire } from "./index";
import type { ChangementReferentiel } from "@/lib/domain/gouvernance-referentiel";

export interface ExerciceLieAtelier {
  id: string;
  titre: string;
  type: string;
  difficulte: number;
  dureeMin: number;
  tentatives: number;
  derniereTentative: string | null;
}

export interface PreuveAtelier {
  id: string;
  date: string;
  type: string;
  resultat: "reussi" | "partiel" | "echec";
  contexte: string;
  autonomie: string;
  qualite: string;
  niveauPreuve: string;
}

export interface DocumentLieAtelier {
  id: string;
  titre: string;
  type: string;
}

export interface VueCompetenceAtelier {
  kind: "competence";
  code: string;
  domaineId: string;
  domaineNom: string;
  palier: string;
  niveau: NiveauCompetence | null;
  score: number | null;
  confiance: Confiance;
  robustesse: number | null;
  nombrePreuves: number;
  nombreContextes: number;
  dernierePreuve: string | null;
  prochaineEtape: string;
  dimensions: Array<{ id: Dimension; libelle: string; valeur: number }>;
  prerequis: string[];
  suivantes: string[];
  exercices: ExerciceLieAtelier[];
  preuves: PreuveAtelier[];
  documents: DocumentLieAtelier[];
}

export interface VueDomaineAtelier {
  kind: "domaine";
  id: string;
  nom: string;
  description: string;
  competences: Array<{
    code: string;
    titre: string;
    palier: string;
    niveau: NiveauCompetence | null;
    score: number | null;
    confiance: Confiance;
    nombrePreuves: number;
  }>;
  domaine: Domaine;
  skills: Skill[];
  retraits: Record<string, EtatRetrait>;
  domainesExistants: Array<{ id: string; nom: string; prefixe: string }>;
  changements: ChangementReferentiel[];
  nombreEvaluees: number;
  nombrePreuves: number;
  nombreExercices: number;
  derniereActivite: string | null;
}

export interface CompetenceThemeAtelier {
  code: string;
  titre: string;
  domaineId: string;
  domaineNom: string;
  palier: string;
  niveau: NiveauCompetence | null;
  score: number | null;
  confiance: Confiance;
  nombrePreuves: number;
  prochaineEtape?: string;
  exercicesDisponibles: number;
}

export interface DomaineThemeAtelier {
  id: string;
  nom: string;
  nombreCompetences: number;
  nombreEvaluees: number;
}

export interface VueThemeAtelier {
  kind: "theme";
  id: string;
  libelle: string;
  intention?: string;
  origine: "utilisateur" | "tuteur";
  creeLe: string;
  archive: boolean;
  competences: CompetenceThemeAtelier[];
  domaines: DomaineThemeAtelier[];
  exercices: ExerciceLieAtelier[];
  nombreEvaluees: number;
  nombrePreuves: number;
  nombreExercices: number;
  scoreMoyen: number | null;
  tauxCouverture: number;
  derniereActivite: string | null;
  prochaineActionRecommandee?: {
    code: string;
    titre: string;
    motif: string;
  } | null;
}

export interface VueExerciceProjectionAtelier {
  kind: "exercice";
  id: string;
  titre: string;
  enonce: string;
  domaineId: string;
  domaineNom: string;
  difficulte: number;
  dureeEstimeeMin: number;
  typeExercice: string;
  competences: Array<{
    code: string;
    titre: string;
    palier: string;
    niveau: NiveauCompetence | null;
    score: number | null;
  }>;
  tentatives: ExerciseAttempt[];
  nombreTentatives: number;
  meilleurResultat: "reussi" | "partiel" | "echec" | null;
  derniereTentative: string | null;
}

export type VuePedagogiqueAtelier =
  | VueCompetenceAtelier
  | VueDomaineAtelier
  | VueThemeAtelier
  | VueExerciceProjectionAtelier;

function derniereDate(valeurs: Array<string | null>): string | null {
  const dates = valeurs.filter((valeur): valeur is string => Boolean(valeur));
  return dates.sort((a, b) => b.localeCompare(a))[0] ?? null;
}

function compterTentatives(
  exercice: Exercise,
  tentatives: ExerciseAttempt[],
): ExerciceLieAtelier {
  const associees = tentatives.filter((tentative) => tentative.exerciseId === exercice.id);
  return {
    id: exercice.id,
    titre: exercice.titre,
    type: exercice.type,
    difficulte: exercice.difficulte,
    dureeMin: exercice.dureeEstimeeMin,
    tentatives: associees.length,
    derniereTentative: derniereDate(associees.map((tentative) => tentative.fin ?? tentative.debut)),
  };
}

export function construireVuesAtelier(
  referentiel: Referentiel,
  etats: SkillState[],
  exercices: Exercise[],
  tentatives: ExerciseAttempt[],
  index: IndexDocumentaire,
  preuvesReferentiel: SkillEvidence[] = [],
  changementsReferentiel: ChangementReferentiel[] = [],
  codesAvecDependances: ReadonlySet<string> = new Set(),
  themes: Theme[] = [],
): {
  domaines: VueDomaineAtelier[];
  competences: VueCompetenceAtelier[];
  themes: VueThemeAtelier[];
  exercices: VueExerciceProjectionAtelier[];
} {
  const domainesVivants = new Set(referentiel.skills.filter((skill) => !skill.archive).map((skill) => skill.domaine));
  const competences: VueCompetenceAtelier[] = etats.map((etat) => {
    const domaine = referentiel.domainesParId.get(etat.skill.domaine);
    const exercicesLies = exercices
      .filter((exercice) => !exercice.archive && exercice.competences.includes(etat.skill.code))
      .map((exercice) => compterTentatives(exercice, tentatives));
    const documents = (index.entrants.get(etat.skill.code) ?? [])
      .map((id) => index.parId.get(id))
      .filter((document) => Boolean(document))
      .map((document) => ({
        id: document!.id,
        titre: document!.titre,
        type: document!.type ?? "document",
      }));

    return {
      kind: "competence",
      code: etat.skill.code,
      domaineId: etat.skill.domaine,
      domaineNom: domaine?.nom ?? etat.skill.domaine,
      palier: etat.skill.palier,
      niveau: etat.niveau,
      score: etat.score,
      confiance: etat.confiance,
      robustesse: etat.robustesse,
      nombrePreuves: etat.preuves.length,
      nombreContextes: etat.contextesTestes.length,
      dernierePreuve: etat.dernierePreuve,
      prochaineEtape: etat.prochaineEtape,
      dimensions: Object.entries(etat.dimensions).map(([id, valeur]) => ({
        id: id as Dimension,
        libelle: LIBELLES_DIMENSIONS[id as Dimension],
        valeur,
      })),
      prerequis: etat.skill.prerequis,
      suivantes: referentiel.actifs
        .filter((skill) => skill.prerequis.includes(etat.skill.code))
        .map((skill) => skill.code),
      exercices: exercicesLies,
      preuves: [...etat.preuves].reverse().map((preuve) => ({
        id: preuve.id,
        date: preuve.date,
        type: preuve.type,
        resultat: preuve.resultat,
        contexte: preuve.contexte,
        autonomie: preuve.autonomie,
        qualite: preuve.qualite,
        niveauPreuve: preuve.niveauPreuve,
      })),
      documents,
    };
  });

  const domaines: VueDomaineAtelier[] = referentiel.domaines
    .filter((domaine) => domaine.archive || domainesVivants.has(domaine.id))
    .map((domaine) => {
      const items = competences.filter((competence) => competence.domaineId === domaine.id);
      const skills = referentiel.skills.filter((skill) => skill.domaine === domaine.id);
      const skillsAffichees = domaine.archive
        ? skills.filter((skill) => !skill.archive)
        : skills.filter((skill) => referentiel.codesActifs.has(skill.code));
      const codes = new Set(skillsAffichees.map((skill) => skill.code));
      const exercicesDomaine = exercices.filter(
        (exercice) => !exercice.archive && exercice.competences.some((code) => codes.has(code)),
      );
      return {
        kind: "domaine",
        id: domaine.id,
        nom: domaine.nom,
        description: domaine.description,
        competences: skillsAffichees.map((skill) => {
          const item = competences.find((competence) => competence.code === skill.code);
          return {
            code: skill.code,
            titre: skill.intitule,
            palier: skill.palier,
            niveau: item?.niveau ?? null,
            score: item?.score ?? null,
            confiance: item?.confiance ?? "nulle",
            nombrePreuves: item?.nombrePreuves ?? 0,
          };
        }),
        domaine,
        skills,
        retraits: Object.fromEntries(retraitsParCode(skills, preuvesReferentiel, codesAvecDependances)),
        domainesExistants: referentiel.domaines
          .filter((item) => !item.archive)
          .map((item) => ({ id: item.id, nom: item.nom, prefixe: item.prefixe })),
        changements: changementsReferentiel.filter((changement) => changement.domaineId === domaine.id),
        nombreEvaluees: items.filter((item) => item.niveau !== null).length,
        nombrePreuves: items.reduce((total, item) => total + item.nombrePreuves, 0),
        nombreExercices: exercicesDomaine.length,
        derniereActivite: derniereDate(items.map((item) => item.dernierePreuve)),
      };
    });

  const competencesParCode = new Map(competences.map((c) => [c.code, c]));
  const tentativesParExercice = new Map<string, ExerciseAttempt[]>();
  for (const t of tentatives) {
    const list = tentativesParExercice.get(t.exerciseId) ?? [];
    list.push(t);
    tentativesParExercice.set(t.exerciseId, list);
  }

  const vuesThemes: VueThemeAtelier[] = themes
    .filter((t) => !t.archive)
    .map((theme) => {
      const skillsDuTheme: CompetenceThemeAtelier[] = theme.codes.flatMap((code) => {
        const comp = competencesParCode.get(code);
        const skill = referentiel.parCode.get(code);
        if (!skill) return [];
        const domaine = referentiel.domainesParId.get(skill.domaine);
        const exs = exercices.filter((e) => !e.archive && e.competences.includes(code));
        return [{
          code: skill.code,
          titre: skill.intitule,
          domaineId: skill.domaine,
          domaineNom: domaine?.nom ?? skill.domaine,
          palier: skill.palier,
          niveau: comp?.niveau ?? null,
          score: comp?.score ?? null,
          confiance: comp?.confiance ?? "nulle",
          nombrePreuves: comp?.nombrePreuves ?? 0,
          prochaineEtape: comp?.prochaineEtape,
          exercicesDisponibles: exs.length,
        }];
      });

      const domainesMap = new Map<string, { id: string; nom: string; count: number; evaluees: number }>();
      for (const comp of skillsDuTheme) {
        const d = domainesMap.get(comp.domaineId) ?? {
          id: comp.domaineId,
          nom: comp.domaineNom,
          count: 0,
          evaluees: 0,
        };
        d.count++;
        if (comp.niveau !== null) d.evaluees++;
        domainesMap.set(comp.domaineId, d);
      }

      const codesDuThemeSet = new Set(skillsDuTheme.map((c) => c.code));
      const exercicesDuTheme = exercices
        .filter((e) => !e.archive && e.competences.some((c) => codesDuThemeSet.has(c)))
        .map((e) => compterTentatives(e, tentatives));

      const evaluees = skillsDuTheme.filter((c) => c.niveau !== null);
      const nombrePreuves = skillsDuTheme.reduce((acc, c) => acc + c.nombrePreuves, 0);
      const scores = evaluees.map((c) => c.score).filter((s): s is number => s !== null);
      const scoreMoyen = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
      const tauxCouverture = skillsDuTheme.length > 0 ? evaluees.length / skillsDuTheme.length : 0;

      const nonEvaluees = skillsDuTheme.filter((c) => c.niveau === null);
      const prioritaires = nonEvaluees.length > 0 ? nonEvaluees : [...skillsDuTheme].sort((a, b) => (a.score ?? 0) - (b.score ?? 0));
      const cibleRecommandee = prioritaires[0];

      const derniereActivite = derniereDate([
        ...skillsDuTheme.map((c) => {
          const comp = competencesParCode.get(c.code);
          return comp?.dernierePreuve ?? null;
        }),
        ...exercicesDuTheme.map((e) => e.derniereTentative),
      ]);

      return {
        kind: "theme",
        id: theme.id,
        libelle: theme.libelle,
        intention: theme.intention,
        origine: theme.origine,
        creeLe: theme.creeLe,
        archive: theme.archive,
        competences: skillsDuTheme,
        domaines: Array.from(domainesMap.values()).map((d) => ({
          id: d.id,
          nom: d.nom,
          nombreCompetences: d.count,
          nombreEvaluees: d.evaluees,
        })),
        exercices: exercicesDuTheme,
        nombreEvaluees: evaluees.length,
        nombrePreuves,
        nombreExercices: exercicesDuTheme.length,
        scoreMoyen,
        tauxCouverture,
        derniereActivite,
        prochaineActionRecommandee: cibleRecommandee
          ? {
              code: cibleRecommandee.code,
              titre: cibleRecommandee.titre,
              motif: cibleRecommandee.niveau === null ? "Produire une première observation" : "Consolider la compétence",
            }
          : null,
      };
    });

  const vuesExercices: VueExerciceProjectionAtelier[] = exercices.map((ex) => {
    const domaine = referentiel.domainesParId.get(ex.domaine);
    const skillsDeLExercice = ex.competences.map((code) => {
      const skill = referentiel.parCode.get(code);
      const comp = competencesParCode.get(code);
      return {
        code,
        titre: skill?.intitule ?? code,
        palier: skill?.palier ?? "fondamentaux",
        niveau: comp?.niveau ?? null,
        score: comp?.score ?? null,
      };
    });
    const associees = tentativesParExercice.get(ex.id) ?? [];
    const reussies = associees.some((t) => t.resultat === "reussi");
    const partielles = associees.some((t) => t.resultat === "partiel");
    const meilleurResultat = reussies ? "reussi" : partielles ? "partiel" : associees.length > 0 ? "echec" : null;
    const derniereTentative = derniereDate(associees.map((t) => t.fin ?? t.debut));

    return {
      kind: "exercice",
      id: ex.id,
      titre: ex.titre,
      enonce: ex.enonce,
      domaineId: ex.domaine,
      domaineNom: domaine?.nom ?? ex.domaine,
      difficulte: ex.difficulte,
      dureeEstimeeMin: ex.dureeEstimeeMin,
      typeExercice: ex.type,
      competences: skillsDeLExercice,
      tentatives: associees,
      nombreTentatives: associees.length,
      meilleurResultat,
      derniereTentative,
    };
  });

  return { domaines, competences, themes: vuesThemes, exercices: vuesExercices };
}
