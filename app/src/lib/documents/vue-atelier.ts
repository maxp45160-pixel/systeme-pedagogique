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
import { retraitsParCode, type EtatRetrait } from "@/lib/domain/referentiel-compte";
import type { IndexDocumentaire } from "./index";

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
  nombreEvaluees: number;
  nombrePreuves: number;
  nombreExercices: number;
  derniereActivite: string | null;
}

export type VuePedagogiqueAtelier = VueCompetenceAtelier | VueDomaineAtelier;

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
): { domaines: VueDomaineAtelier[]; competences: VueCompetenceAtelier[] } {
  const domainesActifs = new Set(referentiel.actifs.map((skill) => skill.domaine));
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
    .filter((domaine) => domaine.archive || domainesActifs.has(domaine.id))
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
        retraits: Object.fromEntries(retraitsParCode(skills, preuvesReferentiel)),
        domainesExistants: referentiel.domaines
          .filter((item) => !item.archive)
          .map((item) => ({ id: item.id, nom: item.nom, prefixe: item.prefixe })),
        nombreEvaluees: items.filter((item) => item.niveau !== null).length,
        nombrePreuves: items.reduce((total, item) => total + item.nombrePreuves, 0),
        nombreExercices: exercicesDomaine.length,
        derniereActivite: derniereDate(items.map((item) => item.dernierePreuve)),
      };
    });

  return { domaines, competences };
}
