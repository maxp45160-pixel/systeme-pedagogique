import { describe, expect, it } from "vitest";

import type { Domaine, Skill } from "./types";
import { organisationDurableDuModule } from "./organisation-module";

const domaine = (
  id: string,
  nom: string,
  usage: Domaine["usage"],
): Domaine => ({
  id,
  nom,
  prefixe: id.slice(0, 3).toUpperCase(),
  description: "",
  ordre: 0,
  version: 1,
  archive: false,
  origine: "utilisateur",
  usage,
});

const skill = (code: string, titre: string, tagsDomaine: string[]): Skill => ({
  code,
  intitule: titre,
  domaine: "module-s1",
  palier: "fondamentaux",
  prerequis: [],
  importance: 0.5,
  ordre: 0,
  active: true,
  archive: false,
  origine: "utilisateur",
  tagsDomaine,
});

describe("organisation durable d'un module", () => {
  it("distingue les domaines continus des tags temporaires et déduplique les compétences", () => {
    const domaineModule = domaine("module-s1", "Macroéconomie S1", {
      type: "module",
      module: { anneeAcademique: "2026-2027", periode: "S1" },
    });
    const economie = domaine("economie", "Économie", { type: "continu" });
    const mathematiques = domaine("mathematiques", "Mathématiques", { type: "continu" });
    const autreModule = domaine("module-s2", "Macroéconomie S2", {
      type: "module",
      module: { anneeAcademique: "2026-2027", periode: "S2" },
    });

    const vue = organisationDurableDuModule(
      domaineModule.id,
      [
        skill("MAC-01", "Analyser un équilibre", [domaineModule.id, economie.id, mathematiques.id]),
        skill("MAC-02", "Interpréter un multiplicateur", [domaineModule.id, autreModule.id]),
      ],
      [domaineModule, economie, mathematiques, autreModule],
    );

    expect(vue.domainesAlimentes).toEqual([
      expect.objectContaining({ id: economie.id, competences: [{ code: "MAC-01", titre: "Analyser un équilibre" }] }),
      expect.objectContaining({ id: mathematiques.id, competences: [{ code: "MAC-01", titre: "Analyser un équilibre" }] }),
    ]);
    expect(vue.competencesAOrganiser).toEqual([
      { code: "MAC-02", titre: "Interpréter un multiplicateur" },
    ]);
    expect(vue.competences).toHaveLength(2);
  });

  it("ignore les compétences archivées et les domaines durables archivés", () => {
    const domaineModule = domaine("module-s1", "Macroéconomie S1", {
      type: "module",
      module: { anneeAcademique: "2026-2027" },
    });
    const economie = { ...domaine("economie", "Économie", { type: "continu" }), archive: true };
    const archivee = { ...skill("MAC-01", "Analyser un équilibre", [domaineModule.id]), archive: true };

    expect(organisationDurableDuModule(domaineModule.id, [archivee], [domaineModule, economie])).toEqual({
      competences: [],
      domainesAlimentes: [],
      competencesAOrganiser: [],
      domainesDisponibles: [],
    });
  });
});
