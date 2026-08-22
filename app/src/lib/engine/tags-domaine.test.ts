import { describe, expect, it } from "vitest";

import { agregerDomaine, calculerEtatGlobal } from "./progression";
import { computeAllSkillStates } from "./skill-state";
import { assemblerReferentiel } from "@/lib/domain/referentiel-compte";
import type { Domaine, Skill, SkillObservation } from "@/lib/domain/types";

/**
 * Ce que fige ce fichier : les tags de domaine d'ADR-107, et surtout ce qu'ils
 * ne changent pas. Le test de réfutation de l'ADR demande explicitement qu'un
 * déplacement de domaine « ne modifie aucun état ni score global » — c'est le
 * dernier cas ci-dessous, et il tomberait au premier score qu'on stockerait.
 */

const MAINTENANT = new Date("2026-08-23T12:00:00.000Z");

const domaine = (id: string, nom: string, prefixe: string, parentId?: string): Domaine => ({
  id, nom, prefixe, description: "", ordre: 0, version: 1, archive: false,
  origine: "utilisateur", ...(parentId ? { parentId } : {}),
});

const skill = (code: string, intitule: string, domaineId: string): Skill => ({
  code, intitule, domaine: domaineId, palier: "fondamentaux", prerequis: [], importance: 0.5,
  ordre: 0, active: true, archive: false, origine: "utilisateur",
});

const observation = (code: string): SkillObservation => ({
  id: `obs-${code}`,
  skillCode: code,
  date: "2026-08-22T12:00:00.000Z",
  type: "exercice",
  niveauObservation: "A",
  autonomie: "A3",
  qualite: "moyenne",
  resultat: "reussi",
  contexte: "Contexte A",
  dimensions: { comprehension: 0.9, application: 0.85 },
  source: { kind: "exercice", ref: "ex-test" },
});

const STATISTIQUES = domaine("statistiques", "Statistiques", "STA");
const LOGISTIQUE = domaine("logistique", "Logistique", "LOG");
const PARTAGEE = skill("STA-01", "Lire un tableau de données", "statistiques");
const PROPRE = skill("LOG-01", "Dimensionner un stock de sécurité", "logistique");

describe("les tags de domaine (ADR-107)", () => {
  it("laisse « À classer » une compétence qu'aucun tag ne vise", () => {
    const referentiel = assemblerReferentiel([STATISTIQUES, LOGISTIQUE], [PARTAGEE, PROPRE]);

    // Elle reste un fait entier du référentiel…
    expect(referentiel.parCode.get("STA-01")?.tagsDomaine).toEqual([]);
    expect(referentiel.actifs).toHaveLength(2);

    // …mais aucun domaine ne la montre, et aucun agrégat ne la compte.
    const etats = computeAllSkillStates(referentiel.actifs, [observation("STA-01")], MAINTENANT);
    expect(agregerDomaine("statistiques", etats, referentiel.domaines).competencesTotal).toBe(0);
    const global = calculerEtatGlobal(etats, MAINTENANT, referentiel.domaines);
    expect(global.parDomaine).toEqual([]);
    // Le score global, lui, la voit : elle est mesurée, seulement pas rangée.
    expect(global.competencesTotal).toBe(2);
  });

  it("accepte plusieurs tags sur une compétence, sans lui changer de code", () => {
    const referentiel = assemblerReferentiel(
      [STATISTIQUES, LOGISTIQUE],
      [PARTAGEE, PROPRE],
      [
        { code: "STA-01", domaine: "statistiques" },
        { code: "STA-01", domaine: "logistique" },
        { code: "LOG-01", domaine: "logistique" },
      ],
    );
    const partagee = referentiel.parCode.get("STA-01")!;

    expect(partagee.code).toBe("STA-01");
    // Le domaine de création ne bouge pas : c'est lui qui a produit le code.
    expect(partagee.domaine).toBe("statistiques");
    expect(partagee.tagsDomaine).toEqual(["statistiques", "logistique"]);
  });

  it("accepte un tag vers le domaine de création, et refuse un doublon ou un domaine disparu", () => {
    // Ce que la migration écrit pour chaque compétence existante : ce tag est
    // désormais le cas normal, là où ADR-081 le refusait.
    expect(() => assemblerReferentiel(
      [STATISTIQUES, LOGISTIQUE],
      [PARTAGEE],
      [{ code: "STA-01", domaine: "statistiques" }],
    )).not.toThrow();

    expect(() => assemblerReferentiel(
      [STATISTIQUES, LOGISTIQUE],
      [PARTAGEE],
      [{ code: "STA-01", domaine: "logistique" }, { code: "STA-01", domaine: "logistique" }],
    )).toThrow(/dupliqué/);

    expect(() => assemblerReferentiel(
      [STATISTIQUES, LOGISTIQUE],
      [PARTAGEE],
      [{ code: "STA-01", domaine: "domaine-supprime" }],
    )).toThrow(/domaine absent/);
  });

  it("compte la compétence taguée dans la couverture de chaque domaine qu'elle sert", () => {
    const referentiel = assemblerReferentiel(
      [STATISTIQUES, LOGISTIQUE],
      [PARTAGEE, PROPRE],
      [
        { code: "STA-01", domaine: "statistiques" },
        { code: "STA-01", domaine: "logistique" },
        { code: "LOG-01", domaine: "logistique" },
      ],
    );
    const etats = computeAllSkillStates(referentiel.actifs, [observation("STA-01")], MAINTENANT);

    const stats = agregerDomaine("statistiques", etats, referentiel.domaines);
    const logistique = agregerDomaine("logistique", etats, referentiel.domaines);

    expect(stats.competencesTotal).toBe(1);
    expect(logistique.competencesTotal).toBe(2);
    expect(stats.observations).toBe(1);
    expect(logistique.observations).toBe(1);
  });

  /*
   * Le point qui rend ce modèle sûr : `calculerEtatGlobal` somme sur les
   * compétences, jamais sur les domaines. Une compétence multi-taguée ne pèse
   * donc qu'une fois dans le score global, quel que soit le nombre de domaines
   * qu'elle sert — et quelle que soit la profondeur de la hiérarchie.
   */
  it("ne compte pas deux fois une compétence multi-taguée dans le score global", () => {
    const observations = [observation("STA-01")];
    const unSeulTag = assemblerReferentiel(
      [STATISTIQUES, LOGISTIQUE],
      [PARTAGEE, PROPRE],
      [{ code: "STA-01", domaine: "statistiques" }, { code: "LOG-01", domaine: "logistique" }],
    );
    const deuxTags = assemblerReferentiel(
      [STATISTIQUES, LOGISTIQUE],
      [PARTAGEE, PROPRE],
      [
        { code: "STA-01", domaine: "statistiques" },
        { code: "STA-01", domaine: "logistique" },
        { code: "LOG-01", domaine: "logistique" },
      ],
    );

    const global = (referentiel: typeof unSeulTag) =>
      calculerEtatGlobal(
        computeAllSkillStates(referentiel.actifs, observations, MAINTENANT),
        MAINTENANT,
        referentiel.domaines,
      );

    expect(global(deuxTags).scoreGlobal).toBe(global(unSeulTag).scoreGlobal);
    expect(global(deuxTags).competencesTotal).toBe(global(unSeulTag).competencesTotal);
    expect(global(deuxTags).nombreObservations).toBe(global(unSeulTag).nombreObservations);
  });
});

describe("la visibilité héritée", () => {
  const SCIENCES = domaine("sciences", "Sciences", "SCI");
  const PHYSIQUE = domaine("physique", "Physique", "PHY", "sciences");
  const THERMO = domaine("thermodynamique", "Thermodynamique", "THE", "physique");

  const CHALEUR = skill("THE-01", "Calculer un transfert de chaleur", "thermodynamique");
  const FORCE = skill("PHY-01", "Décomposer un système de forces", "physique");

  /** Taguée au plus profond, elle doit remonter toute la lignée — sans rien écrire. */
  const referentiel = assemblerReferentiel(
    [SCIENCES, PHYSIQUE, THERMO],
    [CHALEUR, FORCE],
    [{ code: "THE-01", domaine: "thermodynamique" }, { code: "PHY-01", domaine: "physique" }],
  );

  it("n'écrit aucune ligne pour les ancêtres", () => {
    // Seuls les tags déclarés sont portés par la compétence. « sciences » et
    // « physique » n'y figurent pas : ils se dérivent à la lecture.
    expect(referentiel.parCode.get("THE-01")?.tagsDomaine).toEqual(["thermodynamique"]);
  });

  it("fait remonter la compétence dans tous ses ancêtres", () => {
    const etats = computeAllSkillStates(
      referentiel.actifs,
      [observation("THE-01"), observation("PHY-01")],
      MAINTENANT,
    );

    expect(agregerDomaine("thermodynamique", etats, referentiel.domaines).competencesTotal).toBe(1);
    // Physique voit la sienne et celle de son sous-domaine.
    expect(agregerDomaine("physique", etats, referentiel.domaines).competencesTotal).toBe(2);
    // Sciences voit tout le sous-arbre, chaque compétence une seule fois.
    expect(agregerDomaine("sciences", etats, referentiel.domaines).competencesTotal).toBe(2);
  });

  it("déduplique un sous-arbre où la compétence est taguée deux fois", () => {
    const doubleTag = assemblerReferentiel(
      [SCIENCES, PHYSIQUE, THERMO],
      [CHALEUR],
      [
        { code: "THE-01", domaine: "thermodynamique" },
        { code: "THE-01", domaine: "sciences" },
      ],
    );
    const etats = computeAllSkillStates(doubleTag.actifs, [observation("THE-01")], MAINTENANT);

    const sciences = agregerDomaine("sciences", etats, doubleTag.domaines);
    expect(sciences.competencesTotal).toBe(1);
    expect(sciences.observations).toBe(1);
  });

  /*
   * Le test de réfutation d'ADR-107, écrit noir sur blanc : déplacer un domaine
   * ne modifie aucun score. Il ne le peut pas — rien n'est stocké de ce qui
   * dépend de la hiérarchie.
   */
  it("déplacer un domaine ne change AUCUN score", () => {
    const observations = [observation("THE-01"), observation("PHY-01")];
    const tags = [
      { code: "THE-01", domaine: "thermodynamique" },
      { code: "PHY-01", domaine: "physique" },
    ];

    const avant = assemblerReferentiel([SCIENCES, PHYSIQUE, THERMO], [CHALEUR, FORCE], tags);
    // Thermodynamique passe de « sous Physique » à « sous Sciences ». Les
    // compétences, les observations et les tags sont les mêmes objets.
    const apres = assemblerReferentiel(
      [SCIENCES, PHYSIQUE, domaine("thermodynamique", "Thermodynamique", "THE", "sciences")],
      [CHALEUR, FORCE],
      tags,
    );

    const globalAvant = calculerEtatGlobal(
      computeAllSkillStates(avant.actifs, observations, MAINTENANT), MAINTENANT, avant.domaines,
    );
    const globalApres = calculerEtatGlobal(
      computeAllSkillStates(apres.actifs, observations, MAINTENANT), MAINTENANT, apres.domaines,
    );

    expect(globalApres.scoreGlobal).toBe(globalAvant.scoreGlobal);
    expect(globalApres.niveauMoyen).toBe(globalAvant.niveauMoyen);
    expect(globalApres.competencesTotal).toBe(globalAvant.competencesTotal);
    expect(globalApres.competencesEvaluees).toBe(globalAvant.competencesEvaluees);
    expect(globalApres.nombreObservations).toBe(globalAvant.nombreObservations);

    // Ce qui change, et seulement cela : la lecture par domaine. Physique perd
    // la compétence de thermodynamique, qui remonte désormais ailleurs.
    const parDomaine = (etat: typeof globalAvant, id: string) =>
      etat.parDomaine.find((agregat) => agregat.domaine === id)!.competencesTotal;
    expect(parDomaine(globalAvant, "physique")).toBe(2);
    expect(parDomaine(globalApres, "physique")).toBe(1);
    // Sciences, racine des deux arbres, voit toujours les deux.
    expect(parDomaine(globalAvant, "sciences")).toBe(2);
    expect(parDomaine(globalApres, "sciences")).toBe(2);
  });

  /*
   * Le test que réclame ADR-108 avant merge : « une scission validée ne change
   * AUCUN score global ni aucune observation ».
   *
   * Une scission déplace des TAGS, du parent vers un enfant neuf. Comme la
   * visibilité héritée se dérive (ADR-107), le parent continue de voir ce
   * qu'il voyait — et le score global, qui somme sur les compétences et non
   * sur les domaines, ne peut pas bouger. Ce test tomberait au premier score
   * qu'on stockerait par domaine.
   */
  it("scinder un domaine ne change AUCUN score, et le parent ne perd rien", () => {
    const LOGI = domaine("logistique", "Logistique industrielle", "LOG");
    const FLUX = skill("LOG-01", "Lire un plan de flux", "logistique");
    const BOUCLE = skill("LOG-02", "Régler une boucle de rappel", "logistique");
    const STOCK = skill("LOG-03", "Dimensionner un stock de sécurité", "logistique");
    const observations = [observation("LOG-01"), observation("LOG-02"), observation("LOG-03")];

    const avant = assemblerReferentiel(
      [LOGI],
      [FLUX, BOUCLE, STOCK],
      [
        { code: "LOG-01", domaine: "logistique" },
        { code: "LOG-02", domaine: "logistique" },
        { code: "LOG-03", domaine: "logistique" },
      ],
    );

    /*
     * Après la scission : « Gestion kanban » naît SOUS Logistique, et deux tags
     * passent du parent à l'enfant. Aucune compétence n'est créée, recodée ni
     * déplacée — `competences.domaine` reste « logistique » pour les trois,
     * puisqu'il est le namespace de création et non un rattachement.
     */
    const apres = assemblerReferentiel(
      [LOGI, domaine("kanban", "Gestion kanban", "KAN", "logistique")],
      [FLUX, BOUCLE, STOCK],
      [
        { code: "LOG-01", domaine: "kanban" },
        { code: "LOG-02", domaine: "kanban" },
        { code: "LOG-03", domaine: "logistique" },
      ],
    );

    const etatsAvant = computeAllSkillStates(avant.actifs, observations, MAINTENANT);
    const etatsApres = computeAllSkillStates(apres.actifs, observations, MAINTENANT);
    const globalAvant = calculerEtatGlobal(etatsAvant, MAINTENANT, avant.domaines);
    const globalApres = calculerEtatGlobal(etatsApres, MAINTENANT, apres.domaines);

    expect(globalApres.scoreGlobal).toBe(globalAvant.scoreGlobal);
    expect(globalApres.niveauMoyen).toBe(globalAvant.niveauMoyen);
    expect(globalApres.competencesTotal).toBe(globalAvant.competencesTotal);
    expect(globalApres.competencesEvaluees).toBe(globalAvant.competencesEvaluees);
    expect(globalApres.nombreObservations).toBe(globalAvant.nombreObservations);

    // Les codes ne bougent pas : ce sont les clés étrangères des observations.
    expect(apres.actifs.map((s) => s.code).sort()).toEqual(["LOG-01", "LOG-02", "LOG-03"]);
    // Le namespace de création non plus.
    expect(apres.parCode.get("LOG-01")?.domaine).toBe("logistique");

    /*
     * Le point qui fait qu'une scission ne perd rien : le parent voit toujours
     * ses trois compétences, par HÉRITAGE, alors que deux ne portent plus son
     * tag. C'est ce que la carte annonce à la personne — « elles restent
     * comptées dans Logistique industrielle ».
     */
    expect(agregerDomaine("logistique", etatsApres, apres.domaines).competencesTotal).toBe(3);
    expect(agregerDomaine("kanban", etatsApres, apres.domaines).competencesTotal).toBe(2);
  });
});
