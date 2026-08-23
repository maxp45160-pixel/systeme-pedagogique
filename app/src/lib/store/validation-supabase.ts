/**
 * Validation de la frontière Supabase → domaine/moteur.
 *
 * PostgreSQL garantit la forme de ses colonnes scalaires, pas celle du JSONB,
 * et le client Supabase reste typé à partir d'un schéma susceptible de dériver.
 * Toute valeur franchit donc ces gardes avant d'être remise au domaine. Une
 * valeur invalide lève : aucun zéro, tableau vide ou libellé de remplacement
 * n'est fabriqué pour permettre au moteur de continuer.
 */

import {
  RESULTATS_TENTATIVE,
  type Domaine,
  type Exercise,
  type ExerciseAttempt,
  type LearningSession,
  type RefusRecommandation,
  type Skill,
  type SkillObservation,
  type User,
} from "@/lib/domain/types";
import type { Engagement } from "@/lib/domain/engagement";
import {
  PARAMETRE_PAR_NOM,
  type AjustementInscrit,
} from "@/lib/engine/reglages";

type Objet = Record<string, unknown>;

export class DonneeSupabaseInvalide extends Error {
  constructor(chemin: string, attendu: string) {
    super(`Supabase (${chemin}) : donnée invalide — ${attendu}.`);
    this.name = "DonneeSupabaseInvalide";
  }
}

function refuser(chemin: string, attendu: string): never {
  throw new DonneeSupabaseInvalide(chemin, attendu);
}

function objet(valeur: unknown, chemin: string): Objet {
  if (!valeur || typeof valeur !== "object" || Array.isArray(valeur)) {
    refuser(chemin, "objet attendu");
  }
  return valeur as Objet;
}

function texte(valeur: unknown, chemin: string, vide = false): string {
  if (typeof valeur !== "string" || (!vide && valeur.trim().length === 0)) {
    refuser(chemin, vide ? "texte attendu" : "texte non vide attendu");
  }
  return valeur;
}

function date(valeur: unknown, chemin: string): string {
  const resultat = texte(valeur, chemin);
  if (!Number.isFinite(Date.parse(resultat))) refuser(chemin, "date ISO attendue");
  return resultat;
}

function nombre(
  valeur: unknown,
  chemin: string,
  options: { min?: number; max?: number; entier?: boolean } = {},
): number {
  if (typeof valeur !== "number" || !Number.isFinite(valeur)) {
    refuser(chemin, "nombre fini attendu");
  }
  if (options.entier && !Number.isInteger(valeur)) refuser(chemin, "entier attendu");
  if (options.min !== undefined && valeur < options.min) {
    refuser(chemin, `nombre supérieur ou égal à ${options.min} attendu`);
  }
  if (options.max !== undefined && valeur > options.max) {
    refuser(chemin, `nombre inférieur ou égal à ${options.max} attendu`);
  }
  return valeur;
}

function booleen(valeur: unknown, chemin: string): boolean {
  if (typeof valeur !== "boolean") refuser(chemin, "booléen attendu");
  return valeur;
}

function enumeration<const T extends readonly string[]>(
  valeur: unknown,
  valeurs: T,
  chemin: string,
): T[number] {
  if (typeof valeur !== "string" || !valeurs.includes(valeur)) {
    refuser(chemin, `une des valeurs ${valeurs.join(", ")} attendue`);
  }
  return valeur as T[number];
}

function tableau(valeur: unknown, chemin: string): unknown[] {
  if (!Array.isArray(valeur)) refuser(chemin, "tableau attendu");
  return valeur;
}

/** Une requête SELECT réussie rapporte toujours un tableau, y compris vide. */
export function validerLignesSupabase(
  valeur: unknown,
  chemin: string,
): Record<string, unknown>[] {
  return tableau(valeur, chemin).map((ligne, index) =>
    objet(ligne, `${chemin}[${index}]`));
}

function textes(valeur: unknown, chemin: string): string[] {
  return tableau(valeur, chemin).map((item, index) => texte(item, `${chemin}[${index}]`));
}

function optionnel<T>(
  source: Objet,
  cle: string,
  chemin: string,
  lire: (valeur: unknown, chemin: string) => T,
): T | undefined {
  if (!(cle in source) || source[cle] === undefined) return undefined;
  return lire(source[cle], `${chemin}.${cle}`);
}

const DIMENSIONS = [
  "comprehension",
  "application",
  "transfert",
  "integration",
  "justification",
] as const;

function dimensions(valeur: unknown, chemin: string): Record<string, number> {
  const source = objet(valeur, chemin);
  for (const [cle, score] of Object.entries(source)) {
    enumeration(cle, DIMENSIONS, `${chemin}.${cle}`);
    nombre(score, `${chemin}.${cle}`, { min: 0, max: 1 });
  }
  return source as Record<string, number>;
}

function validerSource(valeur: unknown, chemin: string): SkillObservation["source"] {
  const source = objet(valeur, chemin);
  enumeration(
    source.kind,
    ["exercice", "projet", "session", "tuteur", "manuel"] as const,
    `${chemin}.kind`,
  );
  texte(source.ref, `${chemin}.ref`);

  if (source.document !== undefined) {
    const document = objet(source.document, `${chemin}.document`);
    texte(document.documentId, `${chemin}.document.documentId`);
    texte(document.snapshotId, `${chemin}.document.snapshotId`);
  }
  if (source.trace !== undefined) {
    const trace = objet(source.trace, `${chemin}.trace`);
    enumeration(trace.kind, ["tentative"] as const, `${chemin}.trace.kind`);
    texte(trace.ref, `${chemin}.trace.ref`);
  }
  return source as unknown as SkillObservation["source"];
}

export function validerObservation(valeur: unknown, chemin = "observations"): SkillObservation {
  const observation = objet(valeur, chemin);
  texte(observation.id, `${chemin}.id`);
  texte(observation.skillCode, `${chemin}.skillCode`);
  date(observation.date, `${chemin}.date`);
  enumeration(
    observation.type,
    [
      "exercice",
      "explication",
      "code",
      "calcul",
      "projet",
      "correction-erreur",
      "transfert",
      "etude-de-cas",
    ] as const,
    `${chemin}.type`,
  );
  enumeration(observation.niveauObservation, ["A", "B"] as const, `${chemin}.niveauObservation`);
  enumeration(observation.autonomie, ["A0", "A1", "A2", "A3", "A4"] as const, `${chemin}.autonomie`);
  enumeration(observation.qualite, ["faible", "moyenne", "forte"] as const, `${chemin}.qualite`);
  enumeration(observation.resultat, RESULTATS_TENTATIVE, `${chemin}.resultat`);
  texte(observation.contexte, `${chemin}.contexte`);
  dimensions(observation.dimensions, `${chemin}.dimensions`);
  optionnel(observation, "competencesCombinees", chemin, textes);
  validerSource(observation.source, `${chemin}.source`);
  optionnel(observation, "commentaire", chemin, (v, c) => texte(v, c, true));
  return observation as unknown as SkillObservation;
}

export function validerExercice(valeur: unknown, chemin = "exercises"): Exercise {
  const exercice = objet(valeur, chemin);
  texte(exercice.id, `${chemin}.id`);
  texte(exercice.titre, `${chemin}.titre`);
  texte(exercice.domaine, `${chemin}.domaine`);
  enumeration(
    exercice.type,
    ["rappel", "application", "calcul", "probleme", "etude-de-cas", "programmation", "simulation", "projet"] as const,
    `${chemin}.type`,
  );
  nombre(exercice.difficulte, `${chemin}.difficulte`, { min: 1, max: 5, entier: true });
  textes(exercice.competences, `${chemin}.competences`);
  nombre(exercice.dureeEstimeeMin, `${chemin}.dureeEstimeeMin`, { min: 0, entier: true });
  texte(exercice.enonce, `${chemin}.enonce`, true);
  if (exercice.donnees !== undefined) {
    tableau(exercice.donnees, `${chemin}.donnees`).forEach((item, index) => {
      const donnee = objet(item, `${chemin}.donnees[${index}]`);
      texte(donnee.libelle, `${chemin}.donnees[${index}].libelle`);
      texte(donnee.valeur, `${chemin}.donnees[${index}].valeur`, true);
    });
  }
  textes(exercice.indices, `${chemin}.indices`);
  texte(exercice.correction, `${chemin}.correction`, true);
  tableau(exercice.criteres, `${chemin}.criteres`).forEach((item, index) => {
    const critere = objet(item, `${chemin}.criteres[${index}]`);
    enumeration(critere.dimension, DIMENSIONS, `${chemin}.criteres[${index}].dimension`);
    texte(critere.libelle, `${chemin}.criteres[${index}].libelle`);
  });
  optionnel(exercice, "diagnostic", chemin, booleen);
  enumeration(exercice.origine, ["seed", "tuteur", "manuel"] as const, `${chemin}.origine`);
  optionnel(exercice, "archive", chemin, booleen);
  optionnel(exercice, "modifieLe", chemin, date);
  optionnel(exercice, "intention", chemin, (v, c) =>
    enumeration(v, ["decouverte", "consolidation", "transfert", "revision"] as const, c));
  return exercice as unknown as Exercise;
}

function validerVerdict(valeur: unknown, chemin: string): void {
  const verdict = objet(valeur, chemin);
  texte(verdict.resultat, `${chemin}.resultat`);
  const appreciations = objet(verdict.appreciations, `${chemin}.appreciations`);
  for (const [index, score] of Object.entries(appreciations)) {
    if (!/^\d+$/.test(index)) refuser(`${chemin}.appreciations.${index}`, "index numérique attendu");
    nombre(score, `${chemin}.appreciations.${index}`);
  }
  const justifications = objet(verdict.justifications, `${chemin}.justifications`);
  for (const [index, justification] of Object.entries(justifications)) {
    if (!/^\d+$/.test(index)) refuser(`${chemin}.justifications.${index}`, "index numérique attendu");
    texte(justification, `${chemin}.justifications.${index}`, true);
  }
  const bilan = objet(verdict.bilan, `${chemin}.bilan`);
  texte(bilan.pointsForts, `${chemin}.bilan.pointsForts`, true);
  texte(bilan.pointsBloquants, `${chemin}.bilan.pointsBloquants`, true);
  textes(bilan.aRetravailler, `${chemin}.bilan.aRetravailler`);
  date(verdict.date, `${chemin}.date`);
}

export function validerTentative(valeur: unknown, chemin = "attempts"): ExerciseAttempt {
  const tentative = objet(valeur, chemin);
  texte(tentative.id, `${chemin}.id`);
  texte(tentative.exerciseId, `${chemin}.exerciseId`);
  date(tentative.debut, `${chemin}.debut`);
  optionnel(tentative, "fin", chemin, date);
  optionnel(tentative, "dureeMin", chemin, (v, c) => nombre(v, c, { min: 0, entier: true }));
  nombre(tentative.indicesUtilises, `${chemin}.indicesUtilises`, { min: 0, entier: true });
  texte(tentative.reponse, `${chemin}.reponse`, true);
  dimensions(tentative.evaluation, `${chemin}.evaluation`);
  enumeration(tentative.resultat, RESULTATS_TENTATIVE, `${chemin}.resultat`);
  enumeration(tentative.statut, ["en-cours", "terminee", "abandonnee"] as const, `${chemin}.statut`);
  optionnel(tentative, "notes", chemin, (v, c) => texte(v, c, true));
  if (tentative.verdictTuteur !== undefined) validerVerdict(tentative.verdictTuteur, `${chemin}.verdictTuteur`);
  return tentative as unknown as ExerciseAttempt;
}

function validerBesoin(valeur: unknown, chemin: string): void {
  const besoin = objet(valeur, chemin);
  optionnel(besoin, "intention", chemin, (v, c) => texte(v, c, true));
  textes(besoin.codesVises, `${chemin}.codesVises`);
  nombre(besoin.tempsDisponibleMin, `${chemin}.tempsDisponibleMin`, { min: 0, entier: true });
  date(besoin.declareLe, `${chemin}.declareLe`);
}

function validerBlueprint(valeur: unknown, chemin: string): void {
  const blueprint = objet(valeur, chemin);
  nombre(blueprint.dureeCibleMin, `${chemin}.dureeCibleMin`, { min: 0, entier: true });
  nombre(blueprint.nombreExercices, `${chemin}.nombreExercices`, { min: 0, entier: true });
  const portee = objet(blueprint.portee, `${chemin}.portee`);
  const type = enumeration(portee.type, ["mono", "transverse"] as const, `${chemin}.portee.type`);
  if (type === "mono") texte(portee.domaine, `${chemin}.portee.domaine`);
  if (type === "transverse") textes(portee.domaines, `${chemin}.portee.domaines`);
  tableau(blueprint.cibles, `${chemin}.cibles`).forEach((item, index) => {
    const cible = objet(item, `${chemin}.cibles[${index}]`);
    texte(cible.code, `${chemin}.cibles[${index}].code`);
    nombre(cible.difficulte, `${chemin}.cibles[${index}].difficulte`, { min: 1, max: 5, entier: true });
    texte(cible.raison, `${chemin}.cibles[${index}].raison`);
  });
}

export function validerSeance(valeur: unknown, chemin = "sessions"): LearningSession {
  const seance = objet(valeur, chemin);
  texte(seance.id, `${chemin}.id`);
  date(seance.date, `${chemin}.date`);
  optionnel(seance, "dureeMin", chemin, (v, c) => nombre(v, c, { min: 0, entier: true }));
  textes(seance.domaines, `${chemin}.domaines`);
  textes(seance.skillCodes, `${chemin}.skillCodes`);
  tableau(seance.activites, `${chemin}.activites`).forEach((item, index) => {
    const activite = objet(item, `${chemin}.activites[${index}]`);
    texte(activite.type, `${chemin}.activites[${index}].type`);
    texte(activite.ref, `${chemin}.activites[${index}].ref`);
    texte(activite.libelle, `${chemin}.activites[${index}].libelle`);
  });
  for (const cle of ["resultat", "difficulte", "apprentissagePrincipal", "prochaineAction", "notePersonnelle"] as const) {
    optionnel(seance, cle, chemin, (v, c) => texte(v, c, true));
  }
  booleen(seance.genereAutomatiquement, `${chemin}.genereAutomatiquement`);
  optionnel(seance, "statut", chemin, (v, c) =>
    enumeration(v, ["planifiee", "en-cours", "terminee", "abandonnee"] as const, c));
  optionnel(seance, "planifieePour", chemin, date);
  optionnel(seance, "renonceeLe", chemin, date);
  if (seance.besoinDeclare !== undefined) validerBesoin(seance.besoinDeclare, `${chemin}.besoinDeclare`);
  if (seance.blueprint !== undefined) validerBlueprint(seance.blueprint, `${chemin}.blueprint`);
  optionnel(seance, "modeEpreuve", chemin, booleen);
  return seance as unknown as LearningSession;
}

export function validerRefus(valeur: unknown, chemin = "refusRecommandations"): RefusRecommandation {
  const refus = objet(valeur, chemin);
  texte(refus.id, `${chemin}.id`);
  optionnel(refus, "code", chemin, texte);
  optionnel(refus, "exerciceId", chemin, texte);
  date(refus.date, `${chemin}.date`);
  return refus as unknown as RefusRecommandation;
}

/**
 * Ligne `engagements` traduite en entité du domaine.
 *
 * La base garantit déjà le format de `echeance_le` (CHECK regex) et la
 * cohérence de la clôture ; on le revérifie ici comme partout : une donnée
 * venue de Supabase se valide avant d'entrer dans le moteur, y compris quand
 * une contrainte est censée l'avoir fait.
 */
export function validerEngagement(valeur: unknown, chemin = "engagements"): Engagement {
  const engagement = objet(valeur, chemin);
  texte(engagement.id, `${chemin}.id`);
  enumeration(engagement.type, ["examen", "rendu"] as const, `${chemin}.type`);
  texte(engagement.libelle, `${chemin}.libelle`);
  const echeance = texte(engagement.echeanceLe, `${chemin}.echeanceLe`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(echeance)) {
    refuser(`${chemin}.echeanceLe`, "date ISO YYYY-MM-DD attendue");
  }
  textes(engagement.codes, `${chemin}.codes`);
  optionnel(engagement, "clotureLe", chemin, (v, c) => texte(v, c));
  optionnel(engagement, "clotureType", chemin, (v, c) =>
    enumeration(v, ["passe", "reporte"] as const, c));
  /*
   * La contrainte de cohérence côté base dit que les deux champs vont ensemble
   * ou pas du tout. La relire ici évite qu'un engagement « à moitié clos » —
   * impossible à produire par les chemins d'écriture, mais pas par une main
   * sur les données — soit lu comme ouvert ou clos selon quel champ l'appelant
   * regarde (`estOuvert` exige les deux absents).
   */
  if (
    (engagement.clotureLe === undefined) !== (engagement.clotureType === undefined)
  ) {
    refuser(`${chemin}.clotureLe`, "clôture complète attendue : instant et type vont ensemble");
  }
  return engagement as unknown as Engagement;
}

export function validerDomaine(valeur: unknown, chemin = "domaines"): Domaine {
  const domaine = objet(valeur, chemin);
  texte(domaine.id, `${chemin}.id`);
  texte(domaine.nom, `${chemin}.nom`);
  texte(domaine.prefixe, `${chemin}.prefixe`);
  texte(domaine.description, `${chemin}.description`, true);
  nombre(domaine.ordre, `${chemin}.ordre`, { entier: true });
  nombre(domaine.version, `${chemin}.version`, { min: 1, entier: true });
  booleen(domaine.archive, `${chemin}.archive`);
  enumeration(domaine.origine, ["utilisateur", "tuteur", "migration", "manuel"] as const, `${chemin}.origine`);

  /*
   * Le parent (ADR-107). L'existence du domaine visé n'est PAS vérifiée ici :
   * les domaines se valident un par un, sans voir la collection. Un parent
   * absent se lit à la racine (`indexerEnfants`) plutôt que de rendre tout le
   * référentiel illisible.
   */
  optionnel(domaine, "parentId", chemin, texte);

  /*
   * Rattachement à la carte des savoirs : les quatre champs vont ensemble ou
   * pas du tout. La contrainte `domaines_carte_complete` le garantit côté
   * base ; on le revérifie ici parce qu'une donnée venue de Supabase se valide
   * avant d'entrer dans le moteur, y compris quand une contrainte est censée
   * l'avoir déjà fait.
   *
   * L'existence du nœud dans la carte courante n'est PAS vérifiée ici : la
   * carte évolue en dépôt, et un nœud retiré rendrait tout le référentiel
   * illisible au chargement. Un rattachement vers un nœud disparu reste un
   * fait daté ; `rattachementDomaine()` le signale obsolète à l'affichage.
   */
  optionnel(domaine, "carteNoeud", chemin, texte);
  optionnel(domaine, "carteVersion", chemin, texte);
  optionnel(domaine, "carteValideLe", chemin, date);
  if (domaine.carteOrigine !== undefined) {
    enumeration(domaine.carteOrigine, ["tuteur", "manuel"] as const, `${chemin}.carteOrigine`);
  }
  const presents = [
    domaine.carteNoeud,
    domaine.carteVersion,
    domaine.carteOrigine,
    domaine.carteValideLe,
  ].filter((valeur) => valeur !== undefined).length;
  if (presents !== 0 && presents !== 4) {
    refuser(
      `${chemin}.carteNoeud`,
      "rattachement de carte incomplet : nœud, version, origine et date vont ensemble",
    );
  }

  return domaine as unknown as Domaine;
}

export function validerCompetence(valeur: unknown, chemin = "competences"): Skill {
  const competence = objet(valeur, chemin);
  texte(competence.code, `${chemin}.code`);
  texte(competence.domaine, `${chemin}.domaine`);
  texte(competence.intitule, `${chemin}.intitule`);
  enumeration(competence.palier, ["fondamentaux", "intermediaire", "avance"] as const, `${chemin}.palier`);
  textes(competence.prerequis, `${chemin}.prerequis`);
  nombre(competence.importance, `${chemin}.importance`, { min: 0, max: 1 });
  nombre(competence.ordre, `${chemin}.ordre`, { entier: true });
  booleen(competence.active, `${chemin}.active`);
  booleen(competence.archive, `${chemin}.archive`);
  optionnel(competence, "remplacePar", chemin, texte);
  enumeration(competence.origine, ["utilisateur", "tuteur", "migration", "manuel"] as const, `${chemin}.origine`);
  return competence as unknown as Skill;
}

export interface RattachementDomaine {
  code: string;
  domaine: string;
}

export function validerRattachement(
  valeur: unknown,
  chemin = "competenceDomaines",
): RattachementDomaine {
  const rattachement = objet(valeur, chemin);
  texte(rattachement.code, `${chemin}.code`);
  texte(rattachement.domaine, `${chemin}.domaine`);
  return rattachement as unknown as RattachementDomaine;
}

export function validerAjustement(valeur: unknown, chemin = "moteurReglages"): AjustementInscrit {
  const ajustement = objet(valeur, chemin);
  texte(ajustement.id, `${chemin}.id`);
  date(ajustement.appliqueLe, `${chemin}.appliqueLe`);
  const nom = enumeration(
    ajustement.parametre,
    ["fractionTropFacile", "signauxConcordants", "amplitudeRobustesse", "bonusActionnable"] as const,
    `${chemin}.parametre`,
  );
  const parametre = PARAMETRE_PAR_NOM.get(nom);
  if (!parametre) refuser(`${chemin}.parametre`, "paramètre moteur enregistré attendu");
  const borne = { min: parametre.min, max: parametre.max, entier: parametre.entier };
  nombre(ajustement.valeurAvant, `${chemin}.valeurAvant`, borne);
  nombre(ajustement.valeurApres, `${chemin}.valeurApres`, borne);
  texte(ajustement.metrique, `${chemin}.metrique`);
  nombre(ajustement.n, `${chemin}.n`, { min: 0, entier: true });
  nombre(ajustement.valeurMetrique, `${chemin}.valeurMetrique`);
  texte(ajustement.motif, `${chemin}.motif`);
  return ajustement as unknown as AjustementInscrit;
}

export function validerUser(valeur: unknown, chemin = "profile"): User {
  const user = objet(valeur, chemin);
  texte(user.id, `${chemin}.id`);
  texte(user.prenom, `${chemin}.prenom`);
  optionnel(user, "avatarUrl", chemin, texte);
  texte(user.formation, `${chemin}.formation`);
  texte(user.objectifMoyenTerme, `${chemin}.objectifMoyenTerme`);
  texte(user.objectifLongTerme, `${chemin}.objectifLongTerme`);
  date(user.debutSuivi, `${chemin}.debutSuivi`);
  optionnel(user, "preferencesPedagogiques", chemin, textes);
  return user as unknown as User;
}

export type NomCollectionValidee =
  | "observations"
  | "exercises"
  | "attempts"
  | "sessions"
  | "refusRecommandations"
  | "engagements";

type EntiteValidee = {
  observations: SkillObservation;
  exercises: Exercise;
  attempts: ExerciseAttempt;
  sessions: LearningSession;
  refusRecommandations: RefusRecommandation;
  engagements: Engagement;
};

export function validerEntiteSupabase<K extends NomCollectionValidee>(
  nom: K,
  valeur: unknown,
  index?: number,
): EntiteValidee[K] {
  const chemin = `${nom}${index === undefined ? "" : `[${index}]`}`;
  switch (nom) {
    case "observations": return validerObservation(valeur, chemin) as EntiteValidee[K];
    case "exercises": return validerExercice(valeur, chemin) as EntiteValidee[K];
    case "attempts": return validerTentative(valeur, chemin) as EntiteValidee[K];
    case "sessions": return validerSeance(valeur, chemin) as EntiteValidee[K];
    case "refusRecommandations": return validerRefus(valeur, chemin) as EntiteValidee[K];
    case "engagements": return validerEngagement(valeur, chemin) as EntiteValidee[K];
  }
}
