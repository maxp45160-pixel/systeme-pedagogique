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
  type SkillObservation,
  type SkillState,
} from "@/lib/domain/types";
import type { Theme } from "@/lib/domain/theme";
import { retraitsParCode, type EtatRetrait } from "@/lib/domain/referentiel-compte";
import type { IndexDocumentaire } from "./index";
import {
  competencesConnexes,
  parcoursCompetence,
  type CompetenceConnexe,
  type EtapeParcours,
} from "@/lib/engine/parcours";
import type { ChangementReferentiel } from "@/lib/domain/gouvernance-referentiel";
import {
  construireEtatCompetence,
  type EtatCompetence,
  type RecommandationAdaptee,
} from "@/lib/engine/vues-twiny";
import type { Recommandation } from "@/lib/engine/recommend";

export interface ExerciceLieAtelier {
  id: string;
  titre: string;
  type: string;
  difficulte: number;
  dureeMin: number;
  tentatives: number;
  derniereTentative: string | null;
}

export interface ObservationAtelier {
  id: string;
  date: string;
  type: string;
  resultat: "reussi" | "partiel" | "echec";
  contexte: string;
  autonomie: string;
  qualite: string;
  niveauObservation: string;
  /**
   * Le document de production, quand il existe **vraiment**.
   *
   * `source.document.documentId` est la référence explicite exigée par le
   * §2 ; à défaut, `production.ts` écrit la preuve d'une tentative sous
   * `preuve-<idTentative>`, ce que `source.ref` permet de reconstituer. Dans
   * les deux cas la cible n'est retenue que si l'index la contient : une
   * Observation historique sans document reste affichée, simplement pas cliquable.
   */
  documentId: string | null;
}

export interface DocumentLieAtelier {
  id: string;
  titre: string;
  type: string;
}

/*
 * Il y a eu ici un `CandidatRelationAtelier` : une liste de compétences du
 * compte, classées par co-mobilisation observée puis par ordre des paliers, que
 * la fiche offrait à choisir. Elle imposait une saisie, et surtout elle ne
 * pouvait proposer que ce qui existait déjà — or un prérequis manquant est
 * précisément ce qui manque au référentiel. Le tuteur propose désormais des
 * compétences qui n'existent pas encore (`lib/tutor/relations-referentiel.ts`),
 * et la personne valide ligne à ligne.
 */

/**
 * Les types de documents qui ne sont pas des supports.
 *
 * Une fiche d'exercice et un document de preuve citent la compétence, donc
 * `index.entrants` les rend — mais ils portent une mesure, et la fiche les
 * nomme déjà ailleurs, avec cette mesure. « Ressources » ne garde que ce qu'on
 * lit pour travailler.
 */
const TYPES_NON_SUPPORT = new Set(["exercice", "preuve"]);

function estSupport(document: { id: string; type: string }): boolean {
  if (TYPES_NON_SUPPORT.has(document.type)) return false;
  /* Les preuves d'avant le champ `type` ne se reconnaissent qu'à leur identifiant. */
  return !document.id.startsWith("preuve-") && !document.id.startsWith("exercice:");
}

/**
 * La Preuve documentaire d'une Observation, si elle existe dans le corpus.
 *
 * Deux chemins, dans cet ordre : la référence explicite portée par la mesure,
 * puis la convention d'écriture de `production.ts` (`preuve-<idTentative>`, où
 * l'identifiant de tentative est `source.ref` d'une Observation d'exercice).
 * L'identifiant n'est renvoyé que si le document est réellement indexé — un id
 * calculé qui ne désigne rien serait une valeur fabriquée.
 */
function documentPreuveDeLObservation(observation: SkillObservation, index: IndexDocumentaire): string | null {
  const explicite = observation.source.document?.documentId;
  const candidat = explicite ?? (observation.source.kind === "exercice" ? `preuve-${observation.source.ref}` : null);
  if (!candidat) return null;
  return index.parId.has(candidat) ? candidat : null;
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
  nombreObservations: number;
  nombreContextes: number;
  derniereObservation: string | null;
  prochaineEtape: string;
  dimensions: Array<{ id: Dimension; libelle: string; valeur: number }>;
  prerequis: string[];
  suivantes: string[];
  /**
   * Le voisinage complet : déclaré (prérequis, suivantes) **et** observé
   * (co-mobilisé). `prerequis` et `suivantes` restent au-dessus : plusieurs
   * écrans les lisent encore séparément.
   */
  connexes: CompetenceConnexe[];
  /** L'histoire de la compétence, du plus récent au plus ancien, avec les niveaux. */
  parcours: EtapeParcours[];
  /** Observations qui s'opposent à la tendance dominante (§5 du protocole). */
  contradictions: number;
  /** Réserves du moteur sur cette mesure — déjà rédigées par `computeSkillState`. */
  reserves: string[];
  /** Les ensembles auxquels cette compétence appartient déjà. */
  ensembles: Array<{ id: string; libelle: string; nombreCompetences: number }>;
  /** Les ensembles actifs où elle pourrait entrer — pour l'y ajouter en un clic. */
  ensemblesDisponibles: Array<{ id: string; libelle: string; codes: string[] }>;
  exercices: ExerciceLieAtelier[];
  observations: ObservationAtelier[];
  /**
   * Les supports seulement.
   *
   * `index.entrants` rend tout ce qui cite le code, fiches d'exercice et
   * documents de preuve compris : ils réapparaissaient sous « Documents liés »
   * alors que `exercices` et `observations` les nomment déjà, chacun avec ses
   * mesures. Une ressource associée est un support — note, cours, fiche de
   * travail — pas une trace de production.
   */
  documents: DocumentLieAtelier[];
  /**
   * Les domaines vivants du compte, pour nommer la destination d'une relation.
   *
   * Une relation proposée par le tuteur dit dans quel domaine sa compétence doit
   * vivre — un identifiant. L'écran doit pouvoir écrire « Créer dans
   * Mathématiques » plutôt que « Créer dans maths-appliquees », sans quoi la
   * personne valide une création dont elle ne lit pas la destination.
   */
  domainesExistants: Array<{ id: string; nom: string }>;
  /** Lecture du lot 5, dérivée à la demande et conservée séparée des faits. */
  etatLot5: EtatCompetence;
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
    nombreObservations: number;
    /**
     * Vraie quand la compétence sert ce domaine sans en être portée
     * (ADR-081). Son code vient d'ailleurs, et elle ne s'y retire pas : elle
     * s'en détache.
     */
    rattachee?: boolean;
    /** Nom du domaine porteur, pour une rattachée. */
    porteurNom?: string;
  }>;
  domaine: Domaine;
  skills: Skill[];
  retraits: Record<string, EtatRetrait>;
  domainesExistants: Array<{ id: string; nom: string; prefixe: string }>;
  changements: ChangementReferentiel[];
  nombreEvaluees: number;
  nombreObservations: number;
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
  nombreObservations: number;
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
  nombreObservations: number;
  nombreExercices: number;
  scoreMoyen: number | null;
  tauxCouverture: number;
  derniereActivite: string | null;
  prochaineActionRecommandee?: {
    code: string;
    titre: string;
    motif: string;
    reserves: string[];
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
  observationsReferentiel: SkillObservation[] = [],
  changementsReferentiel: ChangementReferentiel[] = [],
  codesAvecDependances: ReadonlySet<string> = new Set(),
  themes: Theme[] = [],
  etatsCompetences: readonly EtatCompetence[] = [],
  recommandations: readonly Recommandation[] = [],
): {
  domaines: VueDomaineAtelier[];
  competences: VueCompetenceAtelier[];
  themes: VueThemeAtelier[];
  exercices: VueExerciceProjectionAtelier[];
} {
  const domainesVivants = new Set(referentiel.skills.filter((skill) => !skill.archive).map((skill) => skill.domaine));
  /*
   * Calculée une fois, partagée par référence : la même liste sur soixante-dix
   * fiches, pas soixante-dix copies. Un domaine archivé n'accueille rien, donc
   * il n'est pas une destination proposable.
   */
  const domainesVivantsLisibles = referentiel.domaines
    .filter((domaine) => !domaine.archive)
    .map((domaine) => ({ id: domaine.id, nom: domaine.nom }));
  const etatsCompetencesParCode = new Map(
    etatsCompetences.map((etat) => [etat.code, etat]),
  );
  const recommandationsAdaptees = recommandations.filter(
    (recommandation): recommandation is RecommandationAdaptee =>
      "prioriteLot5" in recommandation && "reservesLot5" in recommandation,
  );
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
      }))
      .filter((document) => estSupport(document));

    const connexes = competencesConnexes({
      skill: etat.skill,
      actifs: referentiel.actifs,
      skillsParCode: referentiel.parCode,
      exercices,
      observations: observationsReferentiel,
    });
    const suivantes = referentiel.actifs
      .filter((skill) => skill.prerequis.includes(etat.skill.code))
      .map((skill) => skill.code);

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
      nombreObservations: etat.observations.length,
      nombreContextes: etat.contextesTestes.length,
      derniereObservation: etat.derniereObservation,
      prochaineEtape: etat.prochaineEtape,
      dimensions: Object.entries(etat.dimensions).map(([id, valeur]) => ({
        id: id as Dimension,
        libelle: LIBELLES_DIMENSIONS[id as Dimension],
        valeur,
      })),
      prerequis: etat.skill.prerequis,
      suivantes,
      connexes,
      /*
       * Le parcours rejoue l'historique : deux `computeSkillState` par étape.
       * Borné à 8 — au-delà, une frise ne se lit plus, et le coût serait payé
       * pour chaque compétence de l'Atelier à chaque rendu.
       */
      parcours: parcoursCompetence(etat.skill, observationsReferentiel, undefined, 8),
      contradictions: etat.contradictions.length,
      reserves: etat.explication.reserves,
      /*
       * L'appartenance est dérivée du thème, pas stockée sur la compétence.
       * C'est ce qui permet à une même compétence d'appartenir à plusieurs
       * ensembles sans que rien ne l'arbitre — le §6 du cahier des charges.
       */
      ensembles: themes
        .filter((theme) => !theme.archive && theme.codes.includes(etat.skill.code))
        .map((theme) => ({
          id: theme.id,
          libelle: theme.libelle,
          nombreCompetences: theme.codes.length,
        })),
      ensemblesDisponibles: themes
        .filter((theme) => !theme.archive && !theme.codes.includes(etat.skill.code))
        .map((theme) => ({ id: theme.id, libelle: theme.libelle, codes: theme.codes })),
      exercices: exercicesLies,
      observations: [...etat.observations].reverse().map((observation) => ({
        id: observation.id,
        date: observation.date,
        type: observation.type,
        resultat: observation.resultat,
        contexte: observation.contexte,
        autonomie: observation.autonomie,
        qualite: observation.qualite,
        niveauObservation: observation.niveauObservation,
        documentId: documentPreuveDeLObservation(observation, index),
      })),
      documents,
      domainesExistants: domainesVivantsLisibles,
      etatLot5: etatsCompetencesParCode.get(etat.skill.code) ?? construireEtatCompetence(etat),
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
      /*
       * Les compétences rattachées (ADR-081) : portées ailleurs, elles servent
       * ce domaine et doivent s'y voir. Un domaine archivé ne les montre pas —
       * il ne sert plus rien.
       */
      const rattachees = domaine.archive
        ? []
        : referentiel.skills.filter(
            (skill) =>
              skill.domaine !== domaine.id &&
              (skill.domainesSecondaires ?? []).includes(domaine.id) &&
              referentiel.codesActifs.has(skill.code),
          );
      const codes = new Set(skillsAffichees.map((skill) => skill.code));
      const exercicesDomaine = exercices.filter(
        (exercice) => !exercice.archive && exercice.competences.some((code) => codes.has(code)),
      );
      return {
        kind: "domaine",
        id: domaine.id,
        nom: domaine.nom,
        description: domaine.description,
        competences: [...skillsAffichees, ...rattachees].map((skill) => {
          const item = competences.find((competence) => competence.code === skill.code);
          const rattachee = skill.domaine !== domaine.id;
          return {
            code: skill.code,
            titre: skill.intitule,
            palier: skill.palier,
            niveau: item?.niveau ?? null,
            score: item?.score ?? null,
            confiance: item?.confiance ?? "nulle",
            nombreObservations: item?.nombreObservations ?? 0,
            ...(rattachee
              ? { rattachee: true, porteurNom: referentiel.domainesParId.get(skill.domaine)?.nom ?? skill.domaine }
              : {}),
          };
        }),
        domaine,
        skills,
        retraits: Object.fromEntries(retraitsParCode(skills, observationsReferentiel, codesAvecDependances)),
        domainesExistants: referentiel.domaines
          .filter((item) => !item.archive)
          .map((item) => ({ id: item.id, nom: item.nom, prefixe: item.prefixe })),
        changements: changementsReferentiel.filter((changement) => changement.domaineId === domaine.id),
        nombreEvaluees: items.filter((item) => item.niveau !== null).length,
        nombreObservations: items.reduce((total, item) => total + item.nombreObservations, 0),
        nombreExercices: exercicesDomaine.length,
        derniereActivite: derniereDate(items.map((item) => item.derniereObservation)),
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
          nombreObservations: comp?.nombreObservations ?? 0,
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
      const nombreObservations = skillsDuTheme.reduce((acc, c) => acc + c.nombreObservations, 0);
      const scores = evaluees.map((c) => c.score).filter((s): s is number => s !== null);
      const scoreMoyen = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
      const tauxCouverture = skillsDuTheme.length > 0 ? evaluees.length / skillsDuTheme.length : 0;

      const cibleRecommandee = recommandationsAdaptees.find((recommandation) =>
        codesDuThemeSet.has(recommandation.etat.skill.code),
      );

      const derniereActivite = derniereDate([
        ...skillsDuTheme.map((c) => {
          const comp = competencesParCode.get(c.code);
          return comp?.derniereObservation ?? null;
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
        nombreObservations,
        nombreExercices: exercicesDuTheme.length,
        scoreMoyen,
        tauxCouverture,
        derniereActivite,
        prochaineActionRecommandee: cibleRecommandee
          ? {
              code: cibleRecommandee.etat.skill.code,
              titre: cibleRecommandee.etat.skill.intitule,
              motif: cibleRecommandee.prioriteLot5.explication,
              reserves: cibleRecommandee.reservesLot5,
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
