import { describe, expect, it } from "vitest";
import type { ApercuDocument } from "@/lib/documents/types-documents";
import {
  adaptNoteDocumentaire,
  adaptNotesDocumentaires,
  adaptNoteOperationnelle,
  adaptNotesOperationnelles,
  idActiviteNote,
  idActiviteRessource,
  idDocumentDepuisActivite,
} from "./note-activity-adapter";

const CODES_ACTIFS = new Set(["LOG-1", "LOG-2"]);
const AUCUN_FIGE: ReadonlySet<string> = new Set();
const OPTIONS = { codesActifs: CODES_ACTIFS, documentsFiges: AUCUN_FIGE };

function apercu(surcharge: Partial<ApercuDocument> = {}): ApercuDocument {
  return {
    id: "projet-audit-flux",
    titre: "Audit du flux de préparation",
    type: "projet",
    tags: [],
    schema: "pedagogie/v1",
    schemaCompatible: true,
    frontMatter: { role: "operationnel", contexte: "Projet professionnel", domaine: "logistique" },
    liens: [{ cible: "LOG-1" }],
    createdAt: "2026-08-10T08:00:00.000Z",
    updatedAt: "2026-08-12T09:00:00.000Z",
    ...surcharge,
  };
}

describe("une note opérationnelle devient un candidat", () => {
  it("dérive son identifiant de celui de la fiche, dans les deux sens", () => {
    const activite = adaptNoteOperationnelle("compte-1", apercu(), OPTIONS);
    expect(activite?.id).toBe(idActiviteNote("projet-audit-flux"));
    expect(idDocumentDepuisActivite(activite!.id)).toBe("projet-audit-flux");
  });

  it("range chaque branche dans sa famille", () => {
    const famille = (type: string) =>
      adaptNoteOperationnelle("compte-1", apercu({ type }), OPTIONS)?.family;
    expect(famille("seance")).toBe("entrainer");
    expect(famille("experimentation")).toBe("explorer");
    expect(famille("projet")).toBe("produire");
    expect(famille("etude-de-cas")).toBe("produire");
  });

  it("ne retient comme cibles que les codes actifs", () => {
    const activite = adaptNoteOperationnelle(
      "compte-1",
      apercu({ liens: [{ cible: "LOG-1" }, { cible: "ex-42" }, { cible: "LOG-1" }] }),
      OPTIONS,
    );
    expect(activite?.target.skillCodes).toEqual(["LOG-1"]);
  });

  it("garde le titre comme repère même sans compétence liée", () => {
    const activite = adaptNoteOperationnelle("compte-1", apercu({ liens: [] }), OPTIONS);
    expect(activite?.target.skillCodes).toEqual([]);
    expect(activite?.target.label).toBe("Audit du flux de préparation");
  });

  it("ne segmente que la famille que le moteur sait segmenter", () => {
    const segment = (type: string) =>
      adaptNoteOperationnelle("compte-1", apercu({ type }), OPTIONS)?.minimumSegmentMinutes;
    expect(segment("projet")).toBe(20);
    expect(segment("seance")).toBeUndefined();
    expect(segment("experimentation")).toBeUndefined();
  });

  it("n'attend aucune observation d'une exploration", () => {
    const explorer = adaptNoteOperationnelle("compte-1", apercu({ type: "experimentation" }), OPTIONS);
    expect(explorer?.proofMode).toBe("support-seul");
    expect(explorer?.evaluationContract.scope).toBe("aucune");
  });
});

describe("une ressource support devient un travail documentaire", () => {
  it("propose un geste adapté au type sans créer d'observation", () => {
    const activite = adaptNoteDocumentaire(
      "compte-1",
      apercu({
        id: "papier-1",
        titre: "Les boucles de rétroaction",
        type: "article",
        frontMatter: { role: "support" },
      }),
      OPTIONS,
    );

    expect(activite?.title).toContain("Lire et ficher le papier de recherche");
    expect(activite?.id).toBe(idActiviteRessource("papier-1"));
    expect(activite?.family).toBe("entrainer");
    expect(activite?.authorizedResources[0]?.ref).toBe("papier-1");
    expect(activite?.proofMode).toBe("support-seul");
  });

  it("ignore les supports inconnus et les ressources déjà figées", () => {
    expect(adaptNoteDocumentaire("compte-1", apercu({ type: "inconnu", frontMatter: { role: "support" } }), OPTIONS)).toBeNull();
    expect(adaptNoteDocumentaire("compte-1", apercu({ type: "cours", frontMatter: { role: "support" } }), {
      ...OPTIONS,
      documentsFiges: new Set(["projet-audit-flux"]),
    })).toBeNull();
  });

  it("ajoute les supports au même corpus de candidats", () => {
    const activites = adaptNotesDocumentaires("compte-1", [
      apercu({ type: "cours", frontMatter: { role: "support" } }),
      apercu({ type: "projet", frontMatter: { role: "operationnel" } }),
    ], OPTIONS);

    expect(activites).toHaveLength(1);
    expect(activites[0].title).toContain("Lire et structurer le cours");
  });
});

describe("ce qui n'est pas un candidat", () => {
  it("écarte une note de support", () => {
    const support = apercu({ type: "cours", frontMatter: { role: "support" } });
    expect(adaptNoteOperationnelle("compte-1", support, OPTIONS)).toBeNull();
  });

  it("écarte une fiche sans rôle déclaré", () => {
    expect(adaptNoteOperationnelle("compte-1", apercu({ frontMatter: {} }), OPTIONS)).toBeNull();
  });

  /*
   * Un format hors des branches connues n'entre pas dans la file sous une
   * étiquette inventée : lui donner une famille par défaut ferait arbitrer le
   * moteur sur une nature qu'on n'a pas su déterminer.
   */
  it("écarte un format qui n'appartient à aucune famille", () => {
    const inconnu = apercu({ type: "observation", frontMatter: { role: "operationnel" } });
    expect(adaptNoteOperationnelle("compte-1", inconnu, OPTIONS)).toBeNull();
  });

  /*
   * Figer une révision est le geste par lequel une production est rendue. Une
   * note figée a livré : la reproposer demanderait de refaire un travail fait.
   */
  it("écarte une note qui porte une version figée", () => {
    const figes = new Set(["projet-audit-flux"]);
    expect(
      adaptNoteOperationnelle("compte-1", apercu(), { codesActifs: CODES_ACTIFS, documentsFiges: figes }),
    ).toBeNull();
  });
});

describe("adaptation d'un corpus", () => {
  it("ne garde que les notes opérationnelles ouvertes", () => {
    const activites = adaptNotesOperationnelles(
      "compte-1",
      [
        apercu(),
        apercu({ id: "cours-flux", type: "cours", frontMatter: { role: "support" } }),
        apercu({ id: "seance-lundi", type: "seance" }),
      ],
      OPTIONS,
    );
    expect(activites.map(({ id }) => id)).toEqual([
      idActiviteNote("projet-audit-flux"),
      idActiviteNote("seance-lundi"),
    ]);
  });

  it("rend une liste vide sur un corpus vide", () => {
    expect(adaptNotesOperationnelles("compte-1", [], OPTIONS)).toEqual([]);
  });
});
