import { describe, expect, it } from "vitest";
import { creerDepuisTemplate, analyserDocumentMarkdown, parserFrontMatter } from "./markdown";
import { reconstruireIndexDocumentaire, reconstruireIndexDepuisApercus } from "./index";

describe("documents Markdown", () => {
  it("parse le front-matter et les wikilinks", () => {
    const contenu = `---
type: preuve
id: preuve-transport
created_at: 2026-08-12
competencies:
  - gestion-des-flux
  - analyse-de-processus
---

# Optimisation d'un processus

- [[gestion-des-flux]]
- [[cours-lean|Cours Lean]]
- [[article-kanban#kanban]]
`;

    const document = analyserDocumentMarkdown("preuve-transport", contenu);

    expect(document.type).toBe("preuve");
    expect(document.schema).toBe(null);
    expect(document.schemaCompatible).toBe(true);
    expect(document.titre).toBe("Optimisation d'un processus");
    expect(document.frontMatter.competencies).toEqual([
      "gestion-des-flux",
      "analyse-de-processus",
    ]);
    expect(document.liens).toEqual([
      { cible: "gestion-des-flux" },
      { cible: "cours-lean", libelle: "Cours Lean" },
      { cible: "article-kanban", ancre: "kanban" },
    ]);
  });

  it("ne fabrique pas de métadonnées quand le front-matter est absent", () => {
    const resultat = parserFrontMatter("# Une note\n\nTexte.");
    expect(resultat.frontMatter).toEqual({});
    expect(resultat.corps).toBe("# Une note\n\nTexte.");
  });

  it("versionne les nouveaux documents sans invalider les documents historiques", () => {
    const contenu = creerDepuisTemplate("note", "note-versionnee", "Note versionnée");
    const document = analyserDocumentMarkdown("note-versionnee", contenu);

    expect(document.schema).toBe("pedagogie/v1");
    expect(document.schemaCompatible).toBe(true);
    expect(contenu).toContain("schema: pedagogie/v1");
  });

  it("conserve le rôle d'une note comme intention déclarée", () => {
    const contenu = creerDepuisTemplate(
      "projet",
      "projet-transversal",
      "Projet transversal",
      "2026-08-12",
      { role: "operationnel" },
    );
    const document = analyserDocumentMarkdown("projet-transversal", contenu);

    expect(document.frontMatter.role).toBe("operationnel");
    expect(document.frontMatter).not.toHaveProperty("score");
    expect(document.frontMatter).not.toHaveProperty("niveau");
    expect(document.frontMatter).not.toHaveProperty("preuve");
  });

  it("signale un contrat futur sans inventer de compatibilité", () => {
    const document = analyserDocumentMarkdown(
      "note-future",
      "---\nschema: pedagogie/v2\ntype: note\nid: note-future\n---\n\n# Note",
    );

    expect(document.schema).toBe("pedagogie/v2");
    expect(document.schemaCompatible).toBe(false);
  });

  it("reconstruit les relations avec les cibles connues et conserve les inconnues", () => {
    const lignes = [
      { id: "competence-a", contenuMd: creerDepuisTemplate("competence", "competence-a", "Compétence A") },
      {
        id: "preuve-a",
        contenuMd: `---\ntype: preuve\nid: preuve-a\ncreated_at: 2026-08-12\n---\n\n# Preuve A\n\n[[competence-a]] [[competence-inconnue]]`,
      },
    ];

    const premier = reconstruireIndexDocumentaire(lignes);
    const second = reconstruireIndexDocumentaire(
      premier.documents.map((document) => ({ id: document.id, contenuMd: document.contenuMd })),
    );

    expect(premier.liens).toHaveLength(2);
    expect(premier.liens.filter((lien) => lien.resolu)).toHaveLength(1);
    expect(premier.sortants.get("preuve-a")).toEqual(["competence-a"]);
    expect(second.liens).toEqual(premier.liens);
    expect(second.sortants).toEqual(premier.sortants);
    expect(second.entrants).toEqual(premier.entrants);
  });

  it("résout aussi les liens vers des projections externes au corpus", () => {
    const index = reconstruireIndexDocumentaire([
      {
        id: "preuve-a",
        contenuMd: "---\ntype: preuve\nid: preuve-a\ncreated_at: 2026-08-12\n---\n\n# Preuve\n\n[[LOG-01]] [[exercice:exo-1]]",
      },
    ], ["LOG-01", "exercice:exo-1"]);

    expect(index.liens.every((lien) => lien.resolu)).toBe(true);
    expect(index.sortants.get("preuve-a")).toEqual(["LOG-01", "exercice:exo-1"]);
    expect(index.entrants.get("LOG-01")).toEqual(["preuve-a"]);
  });
  it("reconstruit un index léger sans corps Markdown", () => {
    const index = reconstruireIndexDepuisApercus([
      {
        id: "preuve-a",
        titre: "Preuve A",
        type: "preuve",
        tags: ["transport"],
        schema: "pedagogie/v1",
        schemaCompatible: true,
        frontMatter: { type: "preuve", id: "preuve-a" },
        liens: [{ cible: "LOG-01" }],
      },
    ], ["LOG-01"]);

    expect(index.documents[0].contenuMd).toBe("");
    expect(index.documents[0].titre).toBe("Preuve A");
    expect(index.sortants.get("preuve-a")).toEqual(["LOG-01"]);
  });
});
