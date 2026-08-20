/**
 * Vues personnelles du lot 5.
 *
 * Ce module ne lit et n'écrit rien. Il compose les faits validés des lots
 * précédents avec les états déjà calculés par le moteur. Les Observations,
 * objectifs, parcours et sélections restent des entrées distinctes : aucun
 * de ces faits n'est transformé en mesure implicite.
 */

import type {
  Confiance,
  Domaine,
  Explication,
  SkillObservation,
  SkillState,
} from "@/lib/domain/types";
import type {
  CarteGlobale,
  ElementGlobal,
  RelationGlobale,
  SelectionCarteGlobale,
} from "@/lib/domain/carte-globale";
import type {
  CibleObjectif,
  Objectif,
  Parcours,
} from "@/lib/domain/objectifs";
import { evaluerMaitrise, type Maitrise } from "./maitrise";
import type { Recommandation } from "./recommend";

/** Borne validée humainement pour le lot 5. */
export const LIMITE_ESPACE_ACTIF = 15;

/**
 * L'état d'une connaissance ne peut actuellement porter aucune conclusion :
 * le contrat persistant des Observations cible uniquement une compétence
 * locale. Une sélection globale, un document ou une proximité ne sont pas des
 * mesures et ne créent donc pas de niveau de connaissance.
 */
export interface EtatConnaissance {
  elementId: string;
  conclusion: null;
  confiance: Extract<Confiance, "nulle">;
  derniereObservation: null;
  statut: "non-mesure";
  explication: Explication;
}

export function construireEtatConnaissance(element: ElementGlobal): EtatConnaissance {
  if (element.type !== "connaissance") {
    throw new Error(`L'élément global ${element.id} n'est pas une connaissance.`);
  }
  return {
    elementId: element.id,
    conclusion: null,
    confiance: "nulle",
    derniereObservation: null,
    statut: "non-mesure",
    explication: {
      resume: "Aucune Observation ne cible directement cette connaissance.",
      facteurs: [],
      nombreObservations: 0,
      reserves: [
        "Une sélection, un document ou une compétence voisine ne vaut pas mesure de connaissance.",
      ],
    },
  };
}

/** Distinction explicite entre performance ponctuelle et état consolidé. */
export interface EtatCompetence {
  code: string;
  observationPonctuelle: SkillObservation | null;
  etatConsolide: SkillState;
  maitrise: Maitrise;
}

export function construireEtatCompetence(etat: SkillState): EtatCompetence {
  const observationPonctuelle = etat.observations.reduce<SkillObservation | null>(
    (derniere, observation) =>
      derniere === null || observation.date > derniere.date ? observation : derniere,
    null,
  );
  return {
    code: etat.skill.code,
    observationPonctuelle,
    etatConsolide: etat,
    maitrise: evaluerMaitrise(etat),
  };
}

/**
 * Composition en mémoire de l'overlay privé. Les tableaux de faits restent
 * identifiables ; la carte n'est ni une copie persistée ni une nouvelle
 * autorité.
 */
export interface CarteIndividuelle {
  elementsGlobaux: ElementGlobal[];
  relationsGlobales: RelationGlobale[];
  selectionsGlobales: SelectionCarteGlobale[];
  domainesLocaux: Domaine[];
  competencesLocales: EtatCompetence[];
  etatsConnaissance: Map<string, EtatConnaissance>;
  objectifs: Objectif[];
  parcours: Parcours[];
  reserves: string[];
}

export interface EntreesCarteIndividuelle {
  carteGlobale: CarteGlobale;
  selectionsGlobales: readonly SelectionCarteGlobale[];
  domainesLocaux: readonly Domaine[];
  etatsLocaux: readonly SkillState[];
  objectifs: readonly Objectif[];
  parcours: readonly Parcours[];
}

function ajouterReferenceGlobale(
  cible: CibleObjectif,
  elements: Set<string>,
  relations: Set<string>,
): void {
  if (cible.type === "element-global") elements.add(cible.elementId);
  if (cible.type === "relation-globale") relations.add(cible.relationId);
}

export function construireCarteIndividuelle(
  entrees: EntreesCarteIndividuelle,
): CarteIndividuelle {
  const idsElements = new Set(entrees.selectionsGlobales.map((selection) => selection.elementId));
  const idsRelations = new Set<string>();
  for (const objectif of entrees.objectifs) {
    ajouterReferenceGlobale(objectif.cible, idsElements, idsRelations);
  }
  for (const chemin of entrees.parcours) {
    ajouterReferenceGlobale(chemin.cible, idsElements, idsRelations);
  }

  const relationsParId = new Map(entrees.carteGlobale.relations.map((relation) => [relation.id, relation]));
  const reserves: string[] = [];
  for (const relationId of idsRelations) {
    const relation = relationsParId.get(relationId);
    if (!relation) {
      reserves.push(`Relation globale ${relationId} introuvable ou retirée.`);
      continue;
    }
    idsElements.add(relation.sourceId);
    idsElements.add(relation.cibleId);
  }

  const elementsParId = new Map(entrees.carteGlobale.elements.map((element) => [element.id, element]));
  for (const elementId of idsElements) {
    if (!elementsParId.has(elementId)) {
      reserves.push(`Élément global ${elementId} introuvable ou retiré.`);
    }
  }
  const elementsGlobaux = entrees.carteGlobale.elements.filter((element) => idsElements.has(element.id));
  const relationsGlobales = entrees.carteGlobale.relations.filter(
    (relation) =>
      idsRelations.has(relation.id)
      || (idsElements.has(relation.sourceId) && idsElements.has(relation.cibleId)),
  );

  const etatsConnaissance = new Map(
    elementsGlobaux
      .filter((element) => element.type === "connaissance")
      .map((element) => [element.id, construireEtatConnaissance(element)]),
  );
  if (elementsGlobaux.some((element) => element.type === "competence")) {
    reserves.push(
      "Une compétence globale ne reçoit aucun état sans rapprochement local explicite.",
    );
  }

  return {
    elementsGlobaux,
    relationsGlobales,
    selectionsGlobales: [...entrees.selectionsGlobales],
    domainesLocaux: [...entrees.domainesLocaux],
    competencesLocales: entrees.etatsLocaux.map(construireEtatCompetence),
    etatsConnaissance,
    objectifs: [...entrees.objectifs],
    parcours: [...entrees.parcours],
    reserves,
  };
}

export type OrigineEspaceActif =
  | "parcours"
  | "objectif"
  | "selection-globale"
  | "referentiel-local";

export interface ElementEspaceActif {
  cle: string;
  type: "element-global" | "competence-locale";
  id: string;
  libelle: string;
  origine: OrigineEspaceActif;
  referenceOrigine?: string;
  actionnable: boolean;
  codeCompetence?: string;
}

export interface EspaceActif {
  limite: number;
  elements: ElementEspaceActif[];
  relationsGlobales: RelationGlobale[];
  codesCompetences: string[];
  reserves: string[];
}

export interface EntreesEspaceActif {
  carte: CarteIndividuelle;
  recommandations: readonly Recommandation[];
  limite?: number;
}

function comparerObjectifs(a: Objectif, b: Objectif): number {
  return (
    b.priorite - a.priorite
    || (a.echeanceLe ?? "9999-12-31").localeCompare(b.echeanceLe ?? "9999-12-31")
    || a.creeLe.localeCompare(b.creeLe)
    || a.id.localeCompare(b.id)
  );
}

export function construireEspaceActif(entrees: EntreesEspaceActif): EspaceActif {
  const limite = entrees.limite ?? LIMITE_ESPACE_ACTIF;
  if (!Number.isInteger(limite) || limite < 1) {
    throw new Error("La limite de l'espace actif doit être un entier positif.");
  }

  const elements: ElementEspaceActif[] = [];
  const cles = new Set<string>();
  const reserves: string[] = [];
  let tronques = 0;

  const ajouter = (element: ElementEspaceActif) => {
    if (cles.has(element.cle)) return;
    if (elements.length >= limite) {
      tronques += 1;
      return;
    }
    cles.add(element.cle);
    elements.push(element);
  };

  const globauxParId = new Map(entrees.carte.elementsGlobaux.map((element) => [element.id, element]));
  const relationsParId = new Map(entrees.carte.relationsGlobales.map((relation) => [relation.id, relation]));
  const competencesParCode = new Map(
    entrees.carte.competencesLocales.map((etat) => [etat.code, etat]),
  );
  const rangRecommandation = new Map(
    entrees.recommandations.map((recommandation, index) => [recommandation.etat.skill.code, index]),
  );
  const competencesActives = entrees.carte.competencesLocales
    .filter(({ etatConsolide }) => etatConsolide.skill.active && !etatConsolide.skill.archive)
    .slice()
    .sort((a, b) =>
      (rangRecommandation.get(a.code) ?? Number.MAX_SAFE_INTEGER)
        - (rangRecommandation.get(b.code) ?? Number.MAX_SAFE_INTEGER)
      || a.etatConsolide.skill.ordre - b.etatConsolide.skill.ordre
      || a.code.localeCompare(b.code),
    );

  const ajouterCompetence = (
    code: string,
    origine: OrigineEspaceActif,
    referenceOrigine?: string,
  ) => {
    const etat = competencesParCode.get(code);
    if (!etat) {
      reserves.push(`Compétence locale ${code} introuvable.`);
      return;
    }
    const skill = etat.etatConsolide.skill;
    if (!skill.active || skill.archive) {
      reserves.push(
        `Compétence locale ${code} ${skill.archive ? "archivée" : "hors périmètre"} : conservée dans la carte, non actionnable.`,
      );
      return;
    }
    ajouter({
      cle: `competence-locale:${code}`,
      type: "competence-locale",
      id: code,
      libelle: skill.intitule,
      origine,
      referenceOrigine,
      actionnable: rangRecommandation.has(code),
      codeCompetence: code,
    });
  };

  const ajouterGlobal = (
    elementId: string,
    origine: OrigineEspaceActif,
    referenceOrigine?: string,
  ) => {
    const element = globauxParId.get(elementId);
    if (!element) {
      reserves.push(`Élément global ${elementId} introuvable ou retiré.`);
      return;
    }
    ajouter({
      cle: `element-global:${elementId}`,
      type: "element-global",
      id: elementId,
      libelle: element.nom,
      origine,
      referenceOrigine,
      actionnable: false,
    });
  };

  const ajouterCible = (
    cible: CibleObjectif,
    origine: OrigineEspaceActif,
    referenceOrigine?: string,
  ) => {
    if (cible.type === "element-global") {
      ajouterGlobal(cible.elementId, origine, referenceOrigine);
      return;
    }
    if (cible.type === "relation-globale") {
      const relation = relationsParId.get(cible.relationId);
      if (!relation) {
        reserves.push(`Relation globale ${cible.relationId} introuvable ou retirée.`);
        return;
      }
      ajouterGlobal(relation.sourceId, origine, referenceOrigine);
      ajouterGlobal(relation.cibleId, origine, referenceOrigine);
      return;
    }
    if (cible.type === "competence-locale") {
      ajouterCompetence(cible.code, origine, referenceOrigine);
      return;
    }
    const duDomaine = competencesActives.filter(({ etatConsolide }) => {
      const skill = etatConsolide.skill;
      return skill.domaine === cible.domaineId
        || (skill.domainesSecondaires ?? []).includes(cible.domaineId);
    });
    if (duDomaine.length === 0) {
      reserves.push(`Domaine local ${cible.domaineId} sans compétence active.`);
      return;
    }
    for (const etat of duDomaine) ajouterCompetence(etat.code, origine, referenceOrigine);
  };

  const objectifsParId = new Map(entrees.carte.objectifs.map((objectif) => [objectif.id, objectif]));
  const parcoursActifs = entrees.carte.parcours
    .filter((parcours) => parcours.statut === "actif" && parcours.archiveLe === undefined)
    .slice()
    .sort((a, b) => {
      const objectifA = a.objectifId ? objectifsParId.get(a.objectifId) : undefined;
      const objectifB = b.objectifId ? objectifsParId.get(b.objectifId) : undefined;
      return (
        (objectifB?.priorite ?? 0) - (objectifA?.priorite ?? 0)
        || (objectifA?.echeanceLe ?? "9999-12-31").localeCompare(
          objectifB?.echeanceLe ?? "9999-12-31",
        )
        || a.creeLe.localeCompare(b.creeLe)
        || a.id.localeCompare(b.id)
      );
    });
  for (const parcours of parcoursActifs) {
    ajouterCible(parcours.cible, "parcours", parcours.id);
  }

  const objectifsActifs = entrees.carte.objectifs
    .filter((objectif) => objectif.statut === "actif" && objectif.archiveLe === undefined)
    .slice()
    .sort(comparerObjectifs);
  for (const objectif of objectifsActifs) {
    ajouterCible(objectif.cible, "objectif", objectif.id);
  }

  for (const selection of entrees.carte.selectionsGlobales
    .slice()
    .sort((a, b) => a.selectionneLe.localeCompare(b.selectionneLe))) {
    ajouterGlobal(selection.elementId, "selection-globale", selection.elementId);
  }

  const codesDejaClasses = new Set<string>();
  for (const recommandation of entrees.recommandations) {
    const code = recommandation.etat.skill.code;
    codesDejaClasses.add(code);
    ajouterCompetence(code, "referentiel-local", code);
  }
  for (const etat of competencesActives) {
    if (!codesDejaClasses.has(etat.code)) {
      ajouterCompetence(etat.code, "referentiel-local", etat.code);
    }
  }

  if (tronques > 0) {
    reserves.push(
      `${tronques} élément(s) écarté(s) par la borne explicite de ${limite}.`,
    );
  }
  const codesCompetences = elements.flatMap((element) =>
    element.codeCompetence ? [element.codeCompetence] : [],
  );
  if (codesCompetences.length === 0 && elements.length > 0) {
    reserves.push(
      "Aucune cible active ne correspond explicitement à une compétence locale : le classement local est conservé sans rapprochement automatique.",
    );
  }
  const idsGlobaux = new Set(
    elements.filter((element) => element.type === "element-global").map((element) => element.id),
  );

  return {
    limite,
    elements,
    relationsGlobales: entrees.carte.relationsGlobales.filter(
      (relation) => idsGlobaux.has(relation.sourceId) && idsGlobaux.has(relation.cibleId),
    ),
    codesCompetences,
    reserves,
  };
}

export interface PrioriteRecommandationLot5 {
  origine: OrigineEspaceActif;
  reference?: string;
  explication: string;
}

export interface RecommandationAdaptee extends Recommandation {
  prioriteLot5: PrioriteRecommandationLot5;
  reservesLot5: string[];
}

function explicationPriorite(element: ElementEspaceActif | undefined): string {
  if (!element || element.origine === "referentiel-local") {
    return "Ordre conservé depuis le classement explicable du référentiel local.";
  }
  if (element.origine === "parcours") {
    return "Cette compétence appartient à la cible d'un parcours actif.";
  }
  if (element.origine === "objectif") {
    return "Cette compétence appartient à la cible d'un objectif actif.";
  }
  return "Cette priorité provient d'une sélection globale explicite.";
}

/**
 * Borne et réordonne la file historique sans recalculer son score. Quand
 * l'espace actif ne porte aucun code local, l'ordre existant est conservé et
 * la réserve explique pourquoi.
 */
export function adapterRecommandationsAEspaceActif(
  recommandations: readonly Recommandation[],
  espace: EspaceActif,
  limite = 6,
): RecommandationAdaptee[] {
  const rangActif = new Map(espace.codesCompetences.map((code, index) => [code, index]));
  const elementParCode = new Map(
    espace.elements.flatMap((element) =>
      element.codeCompetence ? [[element.codeCompetence, element] as const] : [],
    ),
  );
  const rangInitial = new Map(
    recommandations.map((recommandation, index) => [recommandation.etat.skill.code, index]),
  );
  const aucuneCorrespondanceLocale = rangActif.size === 0;

  return recommandations
    .slice()
    .sort((a, b) => {
      if (aucuneCorrespondanceLocale) {
        return (rangInitial.get(a.etat.skill.code) ?? 0) - (rangInitial.get(b.etat.skill.code) ?? 0);
      }
      return (
        (rangActif.get(a.etat.skill.code) ?? Number.MAX_SAFE_INTEGER)
          - (rangActif.get(b.etat.skill.code) ?? Number.MAX_SAFE_INTEGER)
        || (rangInitial.get(a.etat.skill.code) ?? 0) - (rangInitial.get(b.etat.skill.code) ?? 0)
      );
    })
    .slice(0, limite)
    .map((recommandation) => {
      const element = elementParCode.get(recommandation.etat.skill.code);
      const horsEspace = !aucuneCorrespondanceLocale && element === undefined;
      return {
        ...recommandation,
        prioriteLot5: {
          origine: element?.origine ?? "referentiel-local",
          reference: element?.referenceOrigine,
          explication: explicationPriorite(element),
        },
        reservesLot5: [
          ...espace.reserves,
          ...(horsEspace
            ? ["Cette recommandation complète la file après les cibles de l'espace actif."]
            : []),
        ],
      };
    });
}
