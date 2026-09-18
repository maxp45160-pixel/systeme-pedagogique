import { describe, expect, it } from "vitest";
import { domaineAffichageCorpus, regrouperFichesParDomaine, separerGroupesNommes, type FicheCorpus } from "./corpus-groupe";
import { rangementDomaine, rangementRessource } from "./rangement-atelier";

interface Entree extends FicheCorpus {
  id: string;
  corpus: boolean;
  domaineAttendu: string | null;
}

const competences = Object.freeze({ "A-1": "algebre", "B-1": "biologie" });
// Oracles explicites : les cas décrivent le contrat, sans recalculer la règle testée.
const scenarios = [
  { domaineId: "algebre", rangement: rangementRessource(["B-1"]), domaineAttendu: "algebre" },
  { domaineId: "biologie", rangement: rangementRessource(["A-1"]), domaineAttendu: "biologie" },
  { domaineId: "inconnu", rangement: rangementRessource(["A-1"]), domaineAttendu: "inconnu" },
  { domaineId: "retire", rangement: rangementRessource(["B-1"]), domaineAttendu: "retire" },
  { rangement: rangementRessource([]), domaineAttendu: null },
  { rangement: rangementRessource(["A-1"]), domaineAttendu: "algebre" },
  { rangement: rangementRessource(["ABSENT-1"]), domaineAttendu: null },
  { rangement: rangementDomaine("biologie"), domaineAttendu: "biologie" },
] satisfies Array<Partial<FicheCorpus> & { domaineAttendu: string | null }>;

const catalogues: Array<{ nom: string; domaines: Record<string, string> }> = [
  { nom: "deux domaines", domaines: { algebre: "Algèbre", biologie: "Biologie" } },
  { nom: "domaine retiré du catalogue", domaines: { biologie: "Biologie" } },
  { nom: "catalogue vide", domaines: {} },
  { nom: "domaines homonymes", domaines: { algebre: "Sciences", biologie: "Sciences" } },
];
const ordres = ["initial", "inverse", "rotation"] as const;

function figerEntrees(entrees: Entree[]): readonly Entree[] {
  for (const entree of entrees) {
    Object.freeze(entree.rangement.rattachements);
    Object.freeze(entree.rangement);
    Object.freeze(entree);
  }
  return Object.freeze(entrees);
}

function lire(entrees: readonly Entree[], noms: Readonly<Record<string, string>>) {
  const groupes = regrouperFichesParDomaine(entrees, {
    estFicheCorpus: (entree) => entree.corpus,
    domaineDe: (entree) => domaineAffichageCorpus(entree, competences),
    nomDuDomaine: (id) => noms[id] ?? null,
  });
  return { tousLesGroupes: groupes, ...separerGroupesNommes(entrees, groupes) };
}

function verifierConservation(entrees: readonly Entree[], noms: Readonly<Record<string, string>>) {
  const avant = structuredClone(entrees);
  const resultat = lire(entrees, noms);
  const sorties = [...resultat.groupes.flatMap((groupe) => groupe.elements), ...resultat.autres];
  expect(sorties).toHaveLength(entrees.length);
  for (const entree of entrees) {
    // Identité de l'entrée, pas son titre : deux homonymes restent deux documents.
    expect(sorties.filter((sortie) => sortie === entree), entree.id).toHaveLength(1);
    expect(domaineAffichageCorpus(entree, competences), entree.id).toBe(entree.domaineAttendu);
    if (entree.corpus && entree.domaineAttendu !== null) {
      const groupe = resultat.tousLesGroupes.find((groupe) => groupe.elements.includes(entree));
      expect(groupe?.cle, entree.id).toBe(entree.domaineAttendu);
    }
  }
  const autresAttendus = entrees.filter((entree) =>
    !entree.corpus || entree.domaineAttendu === null || !noms[entree.domaineAttendu]);
  expect(resultat.autres.map((entree) => entree.id)).toEqual(autresAttendus.map((entree) => entree.id));
  expect(entrees).toEqual(avant);
  return resultat;
}

describe("campagne déterministe de conservation du corpus", () => {
  for (const catalogue of catalogues) {
    it.each(ordres)(`${catalogue.nom} — ordre %s : aucune perte, duplication ou mutation`, (ordre) => {
      const entrees: Entree[] = scenarios.flatMap((scenario, index) =>
        [true, false].flatMap((corpus) => [0, 1].map((copie) => ({
          ...structuredClone(scenario),
          id: `${index}-${corpus}-${copie}`,
          titre: index % 2 ? "Même titre" : "Autre titre",
          corpus,
        }))));
      const ordonnees = ordre === "inverse" ? entrees.toReversed()
        : ordre === "rotation" ? [...entrees.slice(11), ...entrees.slice(0, 11)] : entrees;
      const resultat = verifierConservation(figerEntrees(ordonnees), Object.freeze(catalogue.domaines));
      if (catalogue.nom === "domaines homonymes") {
        expect(resultat.groupes.map((groupe) => groupe.cle).sort()).toEqual(["algebre", "biologie"]);
      }
    });
  }

  it("suit les corrections, retraits et disparition d'un domaine sans réutiliser un ancien classement", () => {
    const etapes = [
      { domaineId: "algebre", codes: ["B-1"], attendu: "algebre" },
      { domaineId: "biologie", codes: ["A-1"], attendu: "biologie" },
      { domaineId: "inconnu", codes: ["A-1"], attendu: "inconnu" },
      { domaineId: undefined, codes: ["A-1"], attendu: "algebre" },
      { domaineId: undefined, codes: [], attendu: null },
      { domaineId: "algebre", codes: ["B-1"], attendu: "algebre" },
      { domaineId: "algebre", codes: ["B-1"], attendu: "algebre", catalogueRetire: true },
    ];
    const lectures = etapes.map((etape) => {
      const entrees = figerEntrees([
        { id: "corrigee", titre: "Même titre", domaineId: etape.domaineId,
          rangement: rangementRessource(etape.codes), corpus: true, domaineAttendu: etape.attendu },
        { id: "temoin", titre: "Même titre", domaineId: "biologie",
          rangement: rangementRessource([]), corpus: true, domaineAttendu: "biologie" },
      ]);
      const noms = etape.catalogueRetire ? catalogues[1].domaines : catalogues[0].domaines;
      return { entrees, noms, resultat: verifierConservation(entrees, noms) };
    });
    // Rejouer les anciens instantanés après toutes les corrections ne les change pas.
    for (const lecture of lectures) expect(lire(lecture.entrees, lecture.noms)).toEqual(lecture.resultat);
    expect(lectures.at(-1)?.resultat.autres.map((entree) => entree.id)).toEqual(["corrigee"]);
  });
});
