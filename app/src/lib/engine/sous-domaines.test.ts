import { describe, expect, it } from "vitest";
import { deriverSousDomaines } from "./sous-domaines";

/*
 * Ce que ce fichier protège : un sous-domaine sort des intitulés, jamais d'un
 * modèle. Les verbes d'action ne regroupent rien, un terme qui nomme le
 * domaine ne fait pas un sous-ensemble, et une compétence n'appartient qu'à
 * un groupe.
 *
 * Le cas de tête est réel : « Logistique industrielle » porte treize
 * compétences dont quatre nomment le Kanban, et le système ne le voyait pas
 * (constaté le 22/08/2026).
 */

const LOGISTIQUE = [
  { code: "LOG-01", intitule: "Décrire les principes de base du Kanban" },
  { code: "LOG-02", intitule: "Identifier les éléments d'un tableau Kanban" },
  { code: "LOG-03", intitule: "Appliquer les règles de base du Kanban" },
  { code: "LOG-04", intitule: "Concevoir un tableau Kanban pour un processus simple" },
  { code: "LOG-05", intitule: "Dimensionner un stock de sécurité" },
  { code: "LOG-06", intitule: "Calculer un stock moyen sur une période" },
  { code: "LOG-07", intitule: "Planifier une tournée de livraison" },
  { code: "LOG-08", intitule: "Évaluer le coût d'un entrepôt" },
];

describe("deriverSousDomaines", () => {
  it("reconnaît le Kanban comme sous-domaine, et le nomme d'après les intitulés", () => {
    const { groupes } = deriverSousDomaines(LOGISTIQUE);
    const kanban = groupes.find((groupe) => groupe.libelle === "Kanban");

    expect(kanban).toBeDefined();
    expect(kanban?.codes).toEqual(["LOG-01", "LOG-02", "LOG-03", "LOG-04"]);
  });

  it("groupe aussi les compétences de stock, sans les confondre avec le Kanban", () => {
    const { groupes } = deriverSousDomaines(LOGISTIQUE);
    const stock = groupes.find((groupe) => groupe.libelle === "Stock");

    expect(stock?.codes).toEqual(["LOG-05", "LOG-06"]);
  });

  it("ne regroupe jamais par verbe d'action — ce serait un palier déguisé", () => {
    const competences = [
      { code: "A-01", intitule: "Décrire un flux de production" },
      { code: "A-02", intitule: "Décrire une chaîne d'approvisionnement" },
      { code: "A-03", intitule: "Décrire un entrepôt" },
      { code: "A-04", intitule: "Appliquer une méthode de prévision" },
      { code: "A-05", intitule: "Appliquer un barème tarifaire" },
    ];

    const { groupes } = deriverSousDomaines(competences);

    expect(groupes.map((groupe) => groupe.libelle)).not.toContain("Décrire");
    expect(groupes.map((groupe) => groupe.libelle)).not.toContain("Appliquer");
  });

  it("écarte un terme qui nomme le domaine plutôt qu'un sous-ensemble", () => {
    const competences = [
      { code: "B-01", intitule: "Lire un tableau statistique" },
      { code: "B-02", intitule: "Construire un tableau statistique" },
      { code: "B-03", intitule: "Corriger un tableau statistique" },
      { code: "B-04", intitule: "Commenter un tableau statistique" },
      { code: "B-05", intitule: "Publier un tableau statistique" },
    ];

    const { groupes } = deriverSousDomaines(competences);

    /* « tableau » et « statistique » sont partout : ils décrivent le domaine. */
    expect(groupes).toEqual([]);
  });

  it("n'affecte une compétence qu'à un seul groupe, le plus distinctif", () => {
    const { groupes } = deriverSousDomaines(LOGISTIQUE);
    const affectations = groupes.flatMap((groupe) => groupe.codes);

    expect(new Set(affectations).size).toBe(affectations.length);
    /* « tableau Kanban » va sous Kanban, pas sous un groupe « tableau ». */
    expect(groupes.find((groupe) => groupe.libelle === "Kanban")?.codes).toContain("LOG-02");
  });

  it("ne découpe pas un domaine trop petit pour en valoir la peine", () => {
    const competences = [
      { code: "C-01", intitule: "Décrire les principes du Kanban" },
      { code: "C-02", intitule: "Appliquer les règles du Kanban" },
    ];

    const { groupes, isolees } = deriverSousDomaines(competences);

    expect(groupes).toEqual([]);
    expect(isolees).toEqual(["C-01", "C-02"]);
  });

  it("laisse isolées les compétences qu'aucun terme partagé ne rassemble", () => {
    const { isolees } = deriverSousDomaines(LOGISTIQUE);

    expect(isolees).toContain("LOG-07");
    expect(isolees).toContain("LOG-08");
  });

  it("ne perd aucune compétence : chacune est dans un groupe ou isolée", () => {
    const { groupes, isolees } = deriverSousDomaines(LOGISTIQUE);
    const vues = [...groupes.flatMap((groupe) => groupe.codes), ...isolees];

    expect(vues.sort()).toEqual(LOGISTIQUE.map((c) => c.code).sort());
  });

  it("rend le même découpage d'un appel à l'autre", () => {
    expect(deriverSousDomaines(LOGISTIQUE)).toEqual(deriverSousDomaines(LOGISTIQUE));
  });

  it("classe les groupes du plus fourni au moins fourni", () => {
    const { groupes } = deriverSousDomaines(LOGISTIQUE);
    const tailles = groupes.map((groupe) => groupe.codes.length);

    expect([...tailles].sort((a, b) => b - a)).toEqual(tailles);
  });
});
