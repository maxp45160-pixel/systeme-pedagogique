import {
  HORIZONS_OBJECTIF,
  STATUTS_OBJECTIF,
  STATUTS_PARCOURS,
  TYPES_CIBLE_OBJECTIF,
  TYPES_EVENEMENT_LOT4,
  motifRefusCibleObjectif,
  type ActeurEvenementLot4,
  type CibleObjectif,
  type EvenementLot4,
  type HorizonObjectif,
  type Objectif,
  type Parcours,
  type ProvenanceLot4,
  type ResultatCommandeLot4,
  type StatutObjectif,
  type StatutParcours,
  type TypeEvenementLot4,
} from "@/lib/domain/objectifs";

type Objet = Record<string, unknown>;

export class DonneeObjectifInvalide extends Error {
  constructor(public readonly chemin: string, attendu: string) {
    super(`Donnée lot 4 invalide à ${chemin} : ${attendu}.`);
    this.name = "DonneeObjectifInvalide";
  }
}

function objet(valeur: unknown, chemin: string): Objet {
  if (!valeur || typeof valeur !== "object" || Array.isArray(valeur)) {
    throw new DonneeObjectifInvalide(chemin, "objet attendu");
  }
  return valeur as Objet;
}

function texte(valeur: unknown, chemin: string, vide = false): string {
  if (typeof valeur !== "string" || (!vide && valeur.trim().length === 0)) {
    throw new DonneeObjectifInvalide(chemin, "texte non vide attendu");
  }
  return valeur;
}

function entier(valeur: unknown, chemin: string): number {
  if (typeof valeur !== "number" || !Number.isInteger(valeur)) {
    throw new DonneeObjectifInvalide(chemin, "entier attendu");
  }
  return valeur;
}

function booleen(valeur: unknown, chemin: string): boolean {
  if (typeof valeur !== "boolean") throw new DonneeObjectifInvalide(chemin, "booléen attendu");
  return valeur;
}

function dateHeure(valeur: unknown, chemin: string): string {
  const date = texte(valeur, chemin);
  if (!Number.isFinite(Date.parse(date))) throw new DonneeObjectifInvalide(chemin, "date ISO attendue");
  return date;
}

function dateJour(valeur: unknown, chemin: string): string | undefined {
  if (valeur === null || valeur === undefined) return undefined;
  const date = texte(valeur, chemin);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new DonneeObjectifInvalide(chemin, "date ISO (AAAA-MM-JJ) attendue");
  }
  return date;
}

function idOptionnel(valeur: unknown, chemin: string): string | undefined {
  if (valeur === null || valeur === undefined) return undefined;
  return texte(valeur, chemin);
}

function enumere<const T extends readonly string[]>(
  valeur: unknown,
  valeurs: T,
  chemin: string,
): T[number] {
  if (typeof valeur !== "string" || !valeurs.includes(valeur)) {
    throw new DonneeObjectifInvalide(chemin, `valeur parmi ${valeurs.join(", ")}`);
  }
  return valeur as T[number];
}

function cibleDepuisLigne(ligne: Objet, chemin: string): CibleObjectif {
  const type = enumere(ligne.cible_type, TYPES_CIBLE_OBJECTIF, `${chemin}.cible_type`);
  const cible: CibleObjectif = type === "element-global"
    ? { type, elementId: texte(ligne.cible_element_global_id, `${chemin}.cible_element_global_id`) }
    : type === "domaine-local"
      ? { type, domaineId: texte(ligne.cible_domaine_local_id, `${chemin}.cible_domaine_local_id`) }
      : type === "competence-locale"
        ? { type, code: texte(ligne.cible_competence_local_code, `${chemin}.cible_competence_local_code`) }
        : { type, relationId: texte(ligne.cible_relation_globale_id, `${chemin}.cible_relation_globale_id`) };
  const refus = motifRefusCibleObjectif(cible);
  if (refus) throw new DonneeObjectifInvalide(`${chemin}.cible`, refus);
  return cible;
}

function cibleDepuisEntite(valeur: unknown, chemin: string): CibleObjectif {
  const cible = objet(valeur, chemin);
  const type = enumere(cible.type, TYPES_CIBLE_OBJECTIF, `${chemin}.type`);
  const structure = motifRefusCibleObjectif(cible as CibleObjectif);
  if (structure) throw new DonneeObjectifInvalide(chemin, structure);
  const sortie: CibleObjectif = type === "element-global"
    ? { type, elementId: texte(cible.elementId, `${chemin}.elementId`) }
    : type === "domaine-local"
      ? { type, domaineId: texte(cible.domaineId, `${chemin}.domaineId`) }
      : type === "competence-locale"
        ? { type, code: texte(cible.code, `${chemin}.code`) }
        : { type, relationId: texte(cible.relationId, `${chemin}.relationId`) };
  const refus = motifRefusCibleObjectif(sortie);
  if (refus) throw new DonneeObjectifInvalide(chemin, refus);
  return sortie;
}

function champsCible(cible: CibleObjectif): Record<string, string | null> {
  return {
    cible_type: cible.type,
    cible_element_global_id: cible.type === "element-global" ? cible.elementId : null,
    cible_domaine_local_id: cible.type === "domaine-local" ? cible.domaineId : null,
    cible_competence_local_code: cible.type === "competence-locale" ? cible.code : null,
    cible_relation_globale_id: cible.type === "relation-globale" ? cible.relationId : null,
  };
}

export function cibleObjectifVersColonnes(cible: CibleObjectif): Record<string, string | null> {
  return champsCible(cible);
}

export function validerObjectifLigne(valeur: unknown, chemin = "objectifs"): Objectif {
  const ligne = objet(valeur, chemin);
  const objectif: Objectif = {
    id: texte(ligne.id, `${chemin}.id`),
    formulation: texte(ligne.formulation, `${chemin}.formulation`),
    cible: cibleDepuisLigne(ligne, chemin),
    priorite: entier(ligne.priorite, `${chemin}.priorite`),
    horizon: enumere(ligne.horizon, HORIZONS_OBJECTIF, `${chemin}.horizon`) as HorizonObjectif,
    echeanceLe: dateJour(ligne.echeance_le, `${chemin}.echeance_le`),
    statut: enumere(ligne.statut, STATUTS_OBJECTIF, `${chemin}.statut`) as StatutObjectif,
    version: entier(ligne.version, `${chemin}.version`),
    creeLe: dateHeure(ligne.created_at, `${chemin}.created_at`),
    modifieLe: dateHeure(ligne.updated_at, `${chemin}.updated_at`),
    archiveLe: ligne.archive_le === null || ligne.archive_le === undefined
      ? undefined
      : dateHeure(ligne.archive_le, `${chemin}.archive_le`),
  };
  if (objectif.priorite < 1 || objectif.priorite > 5) throw new DonneeObjectifInvalide(`${chemin}.priorite`, "entier entre 1 et 5");
  return objectif;
}

export function validerParcoursLigne(valeur: unknown, chemin = "parcours"): Parcours {
  const ligne = objet(valeur, chemin);
  return {
    id: texte(ligne.id, `${chemin}.id`),
    objectifId: idOptionnel(ligne.objectif_id, `${chemin}.objectif_id`),
    contexte: texte(ligne.contexte, `${chemin}.contexte`),
    cible: cibleDepuisLigne(ligne, chemin),
    statut: enumere(ligne.statut, STATUTS_PARCOURS, `${chemin}.statut`) as StatutParcours,
    version: entier(ligne.version, `${chemin}.version`),
    creeLe: dateHeure(ligne.created_at, `${chemin}.created_at`),
    modifieLe: dateHeure(ligne.updated_at, `${chemin}.updated_at`),
    archiveLe: ligne.archive_le === null || ligne.archive_le === undefined
      ? undefined
      : dateHeure(ligne.archive_le, `${chemin}.archive_le`),
  };
}

function provenance(valeur: unknown, chemin: string): ProvenanceLot4 {
  const ligne = objet(valeur, chemin);
  return {
    type: texte(ligne.type, `${chemin}.type`),
    reference: texte(ligne.reference, `${chemin}.reference`),
    note: ligne.note === null || ligne.note === undefined ? undefined : texte(ligne.note, `${chemin}.note`, true),
  };
}

export function validerEvenementLigne(valeur: unknown, chemin = "evenements"): EvenementLot4 {
  const ligne = objet(valeur, chemin);
  const payload = objet(ligne.payload, `${chemin}.payload`);
  return {
    id: texte(ligne.id, `${chemin}.id`),
    requestId: texte(ligne.request_id, `${chemin}.request_id`),
    type: enumere(ligne.type, TYPES_EVENEMENT_LOT4, `${chemin}.type`) as TypeEvenementLot4,
    acteur: enumere(ligne.acteur, ["personne", "systeme"] as const, `${chemin}.acteur`) as ActeurEvenementLot4,
    consentement: booleen(ligne.consentement, `${chemin}.consentement`),
    survenuLe: dateHeure(ligne.survenu_le, `${chemin}.survenu_le`),
    objectifId: idOptionnel(ligne.objectif_id, `${chemin}.objectif_id`),
    parcoursId: idOptionnel(ligne.parcours_id, `${chemin}.parcours_id`),
    sessionId: idOptionnel(ligne.session_id, `${chemin}.session_id`),
    provenance: provenance(ligne.provenance, `${chemin}.provenance`),
    payload,
  };
}

export function validerResultatCommandeLot4(valeur: unknown): ResultatCommandeLot4 {
  const resultat = objet(valeur, "commandeLot4");
  return {
    requestId: texte(resultat.requestId, "commandeLot4.requestId"),
    rejoue: booleen(resultat.rejoue, "commandeLot4.rejoue"),
    eventId: texte(resultat.eventId, "commandeLot4.eventId"),
    eventType: enumere(resultat.eventType, TYPES_EVENEMENT_LOT4, "commandeLot4.eventType") as TypeEvenementLot4,
    objectifId: idOptionnel(resultat.objectifId, "commandeLot4.objectifId"),
    parcoursId: idOptionnel(resultat.parcoursId, "commandeLot4.parcoursId"),
    sessionId: idOptionnel(resultat.sessionId, "commandeLot4.sessionId"),
  };
}

export function cibleEntiteVersColonnes(cible: unknown): Record<string, string | null> {
  return champsCible(cibleDepuisEntite(cible, "cible"));
}
