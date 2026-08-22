/**
 * Vues personnelles du lot 5.
 *
 * Ce module ne lit et n'écrit rien. Il compose les états déjà calculés par le
 * moteur. La couche « carte globale » qui complétait ces vues a été retirée le
 * 21/08/2026 : ses tables n'avaient jamais reçu une seule ligne et son chemin
 * d'écriture applicatif n'existait plus (voir ARCHITECTURE_DECISIONS.md,
 * « Retrait de la carte globale »).
 */

import type { SkillObservation, SkillState } from "@/lib/domain/types";
import { evaluerMaitrise, type Maitrise } from "./maitrise";
import type { Recommandation } from "./recommend";

/** Borne validée humainement pour le lot 5. */
export const LIMITE_ESPACE_ACTIF = 15;

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
 * Overlay privé composé à la lecture : la projection locale des états. Rien
 * n'est persisté — la carte n'est ni une copie ni une nouvelle autorité.
 */
export interface CarteIndividuelle {
  competencesLocales: EtatCompetence[];
}

export function construireCarteIndividuelle(
  etatsLocaux: readonly SkillState[],
): CarteIndividuelle {
  return { competencesLocales: etatsLocaux.map(construireEtatCompetence) };
}

export interface ElementEspaceActif {
  cle: string;
  id: string;
  libelle: string;
  actionnable: boolean;
  codeCompetence: string;
}

export interface EspaceActif {
  limite: number;
  elements: ElementEspaceActif[];
  codesCompetences: string[];
  reserves: string[];
}

export interface EntreesEspaceActif {
  carte: CarteIndividuelle;
  recommandations: readonly Recommandation[];
  limite?: number;
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

  const rangRecommandation = new Map(
    entrees.recommandations.map((recommandation, index) => [recommandation.etat.skill.code, index]),
  );

  const ordonnees = entrees.carte.competencesLocales
    .slice()
    .sort((a, b) =>
      (rangRecommandation.get(a.code) ?? Number.MAX_SAFE_INTEGER)
        - (rangRecommandation.get(b.code) ?? Number.MAX_SAFE_INTEGER)
      || a.etatConsolide.skill.ordre - b.etatConsolide.skill.ordre
      || a.code.localeCompare(b.code),
    );

  for (const { code, etatConsolide } of ordonnees) {
    const skill = etatConsolide.skill;
    if (!skill.active || skill.archive) {
      // Une recommandation ne peut pas désigner une compétence sortie du
      // périmètre : la carte la garde, l'espace actif la refuse et l'explique.
      if (rangRecommandation.has(code)) {
        reserves.push(
          `Compétence locale ${code} ${skill.archive ? "archivée" : "hors périmètre"} : conservée dans la carte, non actionnable.`,
        );
      }
      continue;
    }
    ajouter({
      cle: `competence:${code}`,
      id: code,
      libelle: skill.intitule,
      actionnable: rangRecommandation.has(code),
      codeCompetence: code,
    });
  }

  if (tronques > 0) {
    reserves.push(
      `${tronques} élément(s) écarté(s) par la borne explicite de ${limite}.`,
    );
  }

  return {
    limite,
    elements,
    codesCompetences: elements.map((element) => element.codeCompetence),
    reserves,
  };
}

export type OriginePrioriteLot5 = "referentiel-local";

export interface PrioriteRecommandationLot5 {
  origine: OriginePrioriteLot5;
  explication: string;
}

export interface RecommandationAdaptee extends Recommandation {
  prioriteLot5: PrioriteRecommandationLot5;
  reservesLot5: string[];
}

const EXPLICATION_PRIORITE_LOCALE =
  "Ordre conservé depuis le classement explicable du référentiel local.";

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
    .map((recommandation) => ({
      ...recommandation,
      prioriteLot5: {
        origine: "referentiel-local" as const,
        explication: EXPLICATION_PRIORITE_LOCALE,
      },
      reservesLot5: espace.reserves,
    }));
}
