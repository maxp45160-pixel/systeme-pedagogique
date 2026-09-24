import { describe, expect, it } from "vitest";
import Ajv from "ajv";
import { fabriquerSchemaRestitutionDepot } from "./schema-restitution-depot";
import { INTITULE_MAX_ATOMIQUE, OBJET_MAX, PRECISION_MAX, VERBES_ACTION, composerIntitule } from "@/lib/domain/atomicite";
import { validerElementsDepot, validerOrganisationDepot } from "@/lib/documents/depot-validation";
import { sourcesRestitution, traduireSourcesRestitution } from "@/lib/documents/sources-restitution";
import type { ReferentielDepotPourModele } from "@/lib/documents/depot";
import { filtrerAncragesCompetences, MAX_ATTENDU_ANCRAGE, MAX_ELEMENTS_FOURNISSEUR_V2, NATURES_ANCRAGE_COMPETENCE } from "@/lib/documents/ancrage-competences";

// Ajv est déjà fourni par l'outillage ESLint ; aucun validateur supplémentaire
// n'est embarqué dans le chemin applicatif ou utilisé à la place du métier.
const ajv = new Ajv({ allErrors: true });
const referentiel: ReferentielDepotPourModele = {
  domaines: [{ id: "maths", nom: "Mathématiques", description: "Cours ATS" }],
  competences: [{ code: "MATH-01", intitule: "Calculer une dérivée", domaine: "maths" }],
};
const sources = [{ passageId: "passage-fiable" }];
const sourcee = { justification: "Le passage enseigne ce geste.", sources };
const ancrage = { nature: "consigne", passageId: "passage-fiable", attendu: "Calculer une intégrale pour obtenir une primitive." };
const nouvelle = () => ({
  ancrage: { ...ancrage }, mode: "nouvelle", verbeAction: "calculer", objet: "une intégrale", precision: null as string | null,
  palier: "fondamentaux", importance: 0.5, domaine: { mode: "existant", id: "maths" }, ...sourcee,
});
const restitution = () => ({
  elements: [{ nature: "sujet", texte: "Calcul intégral", sources }],
  organisation: {
    titreSuggere: "Livret ATS", typeSuggere: "cours", domaine: { mode: "existant", id: "maths", ...sourcee },
    competences: [nouvelle()], ...sourcee,
  },
});

describe("schéma de restitution documentaire", () => {
  const valider = ajv.compile(fabriquerSchemaRestitutionDepot(["passage-fiable"], referentiel));

  it("accepte le contrat V1 sans rendre l'organisation obligatoire", () => {
    const v1 = ajv.compile(fabriquerSchemaRestitutionDepot(["passage-fiable"]));
    expect(v1({ elements: restitution().elements })).toBe(true);
    expect(v1(restitution())).toBe(false);
    expect(valider({ elements: [] })).toBe(false);
  });

  it("accepte les nouveautés sourcées et les références existantes", () => {
    expect(valider(restitution())).toBe(true);
    const existante = { ancrage, mode: "existante", code: "MATH-01", ...sourcee };
    expect(valider({ ...restitution(), organisation: { ...restitution().organisation, competences: [existante] } })).toBe(true);
  });

  it("exige un ancrage fermé, borné et issu du catalogue pour chaque mode de compétence", () => {
    for (const competence of [nouvelle(), { ancrage, mode: "existante", code: "MATH-01", ...sourcee }]) {
      const avec = (c: object) => ({ ...restitution(), organisation: { ...restitution().organisation, competences: [c] } });
      const sans: Record<string, unknown> = { ...competence };
      delete sans.ancrage;
      expect(valider(avec(sans))).toBe(false);
      for (const nature of NATURES_ANCRAGE_COMPETENCE) {
        expect(valider(avec({ ...competence, ancrage: { ...ancrage, nature, attendu: "a".repeat(MAX_ATTENDU_ANCRAGE) } }))).toBe(true);
      }
      for (const invalide of [
        { ...ancrage, nature: "invente" }, { ...ancrage, passageId: "absent" },
        { ...ancrage, attendu: "" }, { ...ancrage, attendu: "a".repeat(MAX_ATTENDU_ANCRAGE + 1) },
      ]) expect(valider(avec({ ...competence, ancrage: invalide }))).toBe(false);
    }
  });

  it("ne laisse pas le modèle choisir directement la relation conservée", () => {
    const value = restitution();
    const proposition = { ...value.organisation.competences[0], relationSupport: "enseignee" };
    expect(valider({ ...value, organisation: { ...value.organisation, competences: [proposition] } })).toBe(false);
  });

  it("réserve une place serveur en V2 sans réduire la borne historique V1", () => {
    const v1 = ajv.compile(fabriquerSchemaRestitutionDepot(["passage-fiable"]));
    const elements = Array.from({ length: MAX_ELEMENTS_FOURNISSEUR_V2 }, () => restitution().elements[0]);
    expect(valider({ ...restitution(), elements })).toBe(true);
    elements.push(restitution().elements[0]);
    expect(valider({ ...restitution(), elements })).toBe(false);
    expect(v1({ elements })).toBe(true);
    const schema = fabriquerSchemaRestitutionDepot(["passage-fiable"], referentiel);
    for (const variante of schema.properties?.organisation.properties?.competences.items?.anyOf ?? []) {
      expect(Object.keys(variante.properties ?? {})[0]).toBe("ancrage");
    }
  });

  it("refuse la précision de 25 caractères qui bloquait ATS, accepte 24 ou null", () => {
    const value = restitution();
    value.organisation.competences[0].precision = "a".repeat(PRECISION_MAX);
    expect(valider(value)).toBe(true);
    value.organisation.competences[0].precision += "a";
    expect(valider(value)).toBe(false);
    expect(valider.errors).toEqual(expect.arrayContaining([expect.objectContaining({ keyword: "maxLength" })]));
  });

  it("borne chaque intitulé à partir des constantes atomiques réelles", () => {
    const value = restitution();
    for (const verbeAction of VERBES_ACTION) {
      const structure = { verbeAction, objet: "a".repeat(OBJET_MAX), precision: "b".repeat(PRECISION_MAX) };
      expect(composerIntitule(structure).length).toBeLessThanOrEqual(INTITULE_MAX_ATOMIQUE);
      Object.assign(value.organisation.competences[0], structure);
      expect(valider(value)).toBe(true);
    }
    value.organisation.competences[0].objet += "a";
    expect(valider(value)).toBe(false);
  });

  it.each(["source", "element", "organisation", "domaine", "competence", "referenceDomaine", "ancrage"])(
    "ferme les propriétés supplémentaires de %s", (niveau) => {
      const value = structuredClone(restitution());
      const cibles: Record<string, object> = {
        source: value.elements[0].sources[0], element: value.elements[0], organisation: value.organisation,
        domaine: value.organisation.domaine, competence: value.organisation.competences[0],
        referenceDomaine: value.organisation.competences[0].domaine,
        ancrage: value.organisation.competences[0].ancrage,
      };
      Object.assign(cibles[niveau], { proprieteInconnue: "interdit" });
      expect(valider(value)).toBe(false);
    },
  );

  it("refuse les identifiants, codes et verbes absents de leurs enums", () => {
    const value = restitution();
    value.elements[0].sources = [{ passageId: "passage-invente" }];
    expect(valider(value)).toBe(false);
    value.elements[0].sources = sources;
    value.organisation.competences[0].domaine.id = "qualite";
    expect(valider(value)).toBe(false);
    value.organisation.competences[0].domaine.id = "maths";
    value.organisation.competences[0].verbeAction = "comprendre";
    expect(valider(value)).toBe(false);
    expect(valider({ ...value, organisation: { ...value.organisation, competences: [{ ancrage, mode: "existante", code: "FAUX-01", ...sourcee }] } })).toBe(false);
  });

  it("respecte les bornes des éléments, compétences, textes, sources et importance", () => {
    const value = restitution();
    for (const invalide of [
      { ...value, elements: Array.from({ length: 9 }, () => value.elements[0]) },
      { ...value, elements: [{ ...value.elements[0], texte: "a".repeat(701) }] },
      { ...value, elements: [{ ...value.elements[0], sources: [] }] },
      { ...value, elements: [{ ...value.elements[0], sources: Array.from({ length: 4 }, () => sources[0]) }] },
      { ...value, organisation: { ...value.organisation, competences: Array.from({ length: 31 }, nouvelle) } },
      { ...value, organisation: { ...value.organisation, competences: [{ ...nouvelle(), importance: 1.01 }] } },
      { ...value, organisation: { ...value.organisation, typeSuggere: "invente" } },
    ]) expect(valider(invalide)).toBe(false);
  });

  it("un référentiel vide laisse les nouveautés possibles sans enum vide ou id inventé", () => {
    const schema = fabriquerSchemaRestitutionDepot(["passage-fiable", "passage-fiable"], { domaines: [], competences: [] });
    const sansReferentiel = ajv.compile(schema);
    expect(JSON.stringify(schema)).not.toContain('"enum":[]');
    expect(schema.$defs?.source.properties?.passageId.enum).toEqual(["passage-fiable"]);
    expect(sansReferentiel(restitution())).toBe(false);
    const domaine = { mode: "nouveau", nom: "Mathématiques" };
    const value = restitution();
    expect(sansReferentiel({ ...value, organisation: {
      ...value.organisation, domaine: { ...domaine, description: "Cours de mathématiques", parentId: null, ...sourcee },
      competences: [{ ...nouvelle(), domaine }],
    } })).toBe(true);
  });

  it("refuse un catalogue vide avant d'engager une génération sans preuve", () => {
    expect(() => fabriquerSchemaRestitutionDepot([])).toThrow(/catalogue/);
    expect(() => fabriquerSchemaRestitutionDepot([" "])).toThrow(/catalogue/);
  });

  it("la réponse autorisée traverse l'extraction de citation et les validateurs métier réels", () => {
    const note = "Calculer une intégrale par la méthode du changement de variable.";
    const catalogue = sourcesRestitution(note, []);
    const passageId = catalogue.sources[0].passages[0].passageId;
    const reponse = JSON.parse(JSON.stringify(restitution()).replaceAll("passage-fiable", passageId));
    expect(ajv.compile(fabriquerSchemaRestitutionDepot([passageId], referentiel))(reponse)).toBe(true);
    const canonique = traduireSourcesRestitution(filtrerAncragesCompetences(reponse, note, [], referentiel), note, []);
    expect(JSON.stringify(canonique)).not.toContain('"ancrage"');
    expect(validerElementsDepot(canonique, "doc", note, [], "preuve")).toHaveLength(1);
    expect(validerOrganisationDepot(canonique, "doc", note, [], referentiel).competences).toHaveLength(1);
  });
});
