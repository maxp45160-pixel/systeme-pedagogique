import { describe, expect, it } from "vitest";

import { agregerDomaine, calculerEtatGlobal } from "./progression";
import { computeAllSkillStates } from "./skill-state";
import { assemblerReferentiel } from "@/lib/domain/referentiel-compte";
import type { Domaine, Skill, SkillEvidence } from "@/lib/domain/types";

const MAINTENANT = new Date("2026-08-16T12:00:00.000Z");

const domaine = (id: string, nom: string, prefixe: string): Domaine => ({
  id, nom, prefixe, description: "", ordre: 0, version: 1, archive: false, origine: "utilisateur",
});

const skill = (code: string, intitule: string, domaineId: string): Skill => ({
  code, intitule, domaine: domaineId, palier: "fondamentaux", prerequis: [], importance: 0.5,
  ordre: 0, active: true, archive: false, origine: "utilisateur",
});

const preuve = (code: string): SkillEvidence => ({
  id: `ev-${code}`,
  skillCode: code,
  date: "2026-08-15T12:00:00.000Z",
  type: "exercice",
  niveauPreuve: "A",
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

describe("rattachement d'une compétence à plusieurs domaines", () => {
  it("n'ajoute aucun domaine secondaire quand rien n'est rattaché", () => {
    const referentiel = assemblerReferentiel([STATISTIQUES, LOGISTIQUE], [PARTAGEE, PROPRE]);
    expect(referentiel.parCode.get("STA-01")?.domainesSecondaires).toEqual([]);
  });

  it("rattache une compétence sans lui changer de porteur", () => {
    const referentiel = assemblerReferentiel(
      [STATISTIQUES, LOGISTIQUE],
      [PARTAGEE, PROPRE],
      [{ code: "STA-01", domaine: "logistique" }],
    );
    const partagee = referentiel.parCode.get("STA-01")!;
    expect(partagee.domaine).toBe("statistiques");
    expect(partagee.domainesSecondaires).toEqual(["logistique"]);
  });

  /*
   * Un rattachement vers le porteur compterait la compétence deux fois dans sa
   * propre couverture. La base l'interdit par trigger ; l'assemblage ne doit pas
   * le laisser passer non plus si une ligne ancienne traînait.
   */
  it("ignore un rattachement vers le domaine porteur ou vers un domaine disparu", () => {
    const referentiel = assemblerReferentiel(
      [STATISTIQUES, LOGISTIQUE],
      [PARTAGEE],
      [
        { code: "STA-01", domaine: "statistiques" },
        { code: "STA-01", domaine: "domaine-supprime" },
      ],
    );
    expect(referentiel.parCode.get("STA-01")?.domainesSecondaires).toEqual([]);
  });

  it("compte la compétence rattachée dans la couverture du second domaine", () => {
    const referentiel = assemblerReferentiel(
      [STATISTIQUES, LOGISTIQUE],
      [PARTAGEE, PROPRE],
      [{ code: "STA-01", domaine: "logistique" }],
    );
    const etats = computeAllSkillStates(referentiel.actifs, [preuve("STA-01")], MAINTENANT);

    const stats = agregerDomaine("statistiques", etats, referentiel.domaines);
    const logistique = agregerDomaine("logistique", etats, referentiel.domaines);

    // La couverture du second domaine inclut la compétence rattachée, et ses
    // preuves y remontent : c'est bien la même mesure qui informe les deux.
    expect(stats.competencesTotal).toBe(1);
    expect(logistique.competencesTotal).toBe(2);
    expect(logistique.preuves).toBe(1);
    expect(stats.preuves).toBe(1);
  });

  /*
   * Le point qui rendait ce chantier sûr : `calculerEtatGlobal` somme sur les
   * compétences, jamais sur les domaines. Une compétence rattachée ne doit donc
   * peser qu'une fois dans le score global, quel que soit le nombre de domaines
   * qu'elle sert.
   */
  it("ne compte pas deux fois une compétence rattachée dans le score global", () => {
    const sans = assemblerReferentiel([STATISTIQUES, LOGISTIQUE], [PARTAGEE, PROPRE]);
    const avec = assemblerReferentiel(
      [STATISTIQUES, LOGISTIQUE],
      [PARTAGEE, PROPRE],
      [{ code: "STA-01", domaine: "logistique" }],
    );
    const preuves = [preuve("STA-01")];

    const globalSans = calculerEtatGlobal(
      computeAllSkillStates(sans.actifs, preuves, MAINTENANT), MAINTENANT, sans.domaines,
    );
    const globalAvec = calculerEtatGlobal(
      computeAllSkillStates(avec.actifs, preuves, MAINTENANT), MAINTENANT, avec.domaines,
    );

    expect(globalAvec.scoreGlobal).toBe(globalSans.scoreGlobal);
    expect(globalAvec.competencesTotal).toBe(globalSans.competencesTotal);
    expect(globalAvec.nombrePreuves).toBe(globalSans.nombrePreuves);
  });
});
