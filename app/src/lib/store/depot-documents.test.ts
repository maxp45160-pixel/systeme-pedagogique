import { beforeEach, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ analyses: [] as unknown[], corrections: [] as unknown[], frontmatter: { depot_version: "2" } as Record<string, unknown>, markdown: "# Livret\n" }));
vi.mock("./documents", () => ({ lireDocument: async () => ({ frontmatter: m.frontmatter, contenuMd: m.markdown, titre: "Livret" }) }));
vi.mock("./document-attachments", () => ({ lirePiecesJointes: async () => [] }));
vi.mock("./depot-budget", () => ({ comptePiloteDepot: async () => ({ userId: "compte", supabase: { from: (table: string) => {
  const query = { select: () => query, eq: () => query, order: async () => ({ data: table === "document_depot_analyses" ? m.analyses : m.corrections, error: null }) };
  return query;
} } }) }));
import { encoderCreationDomaineDeleguee } from "@/lib/documents/creation-domaine-deleguee";
import { lireDepotDocumentaire } from "./depot-documents";
import { CORPUS_QUALITE_DOCUMENTAIRE } from "@/lib/documents/fixtures/qualite-documentaire";

beforeEach(() => {
  m.analyses = [];
  m.corrections = [];
  m.frontmatter = { depot_version: "2" };
  m.markdown = "# Livret\n";
});

it("relit les doublons historiques sans déplacer les indices ni réécrire les sources", async () => {
  const cas = CORPUS_QUALITE_DOCUMENTAIRE.find((c) => c.id === "doublon-code")!;
  const documentId = cas.reponse.organisation.sources[0].documentId;
  m.analyses = [{ id:"historique",document_id:documentId,empreinte:"historique",statut:"terminee",pages:cas.pages,couvertures:[],note_source:cas.note,erreur:null,created_at:"2026-09-16",updated_at:"2026-09-16",
    restitution:{version:2,modele:"historique",creeLe:"2026-09-16",couvertures:[],elements:[{nature:"sujet",texte:cas.matiere,sources:cas.reponse.organisation.sources}],organisation:cas.reponse.organisation} }];
  const restitution = (await lireDepotDocumentaire(documentId)).analyses[0].restitution;
  expect(restitution?.version).toBe(2);
  if (restitution?.version !== 2) throw new Error("Restitution V2 attendue");
  expect(restitution.organisation.competences).toHaveLength(2);
  expect(restitution.organisation.competences.map((c) => c.sources)).toEqual(cas.reponse.organisation.competences.map((c) => c.sources));
});

it("relit un dépôt V1 historique avec sa note, sa restitution sourcée et sa correction humaine", async () => {
  const note = "Revoir les équations du premier degré.";
  m.frontmatter = { depot_version: "1" };
  m.markdown = `---\ndepot_version: 1\n---\n# Dépôt\n\n${note}`;
  m.analyses = [{
    id: "analyse-v1", document_id: "livret", empreinte: "empreinte-v1", statut: "terminee",
    pages: [], couvertures: [], note_source: note, erreur: null,
    created_at: "2026-09-01", updated_at: "2026-09-01",
    restitution: {
      version: 1, modele: "modele-historique", creeLe: "2026-09-01", couvertures: [],
      elements: [{ nature: "sujet", texte: "Équations du premier degré", sources: [{ documentId: "livret", citation: "équations du premier degré" }] }],
    },
  }];
  m.corrections = [{ id: "correction-v1", element_id: "analyse-v1-0", texte: "Commencer par les exemples du cours.", created_at: "2026-09-02" }];
  const depot = await lireDepotDocumentaire("livret");
  expect(depot).toMatchObject({ version: 1, note });
  expect(depot.analyses[0].restitution).toEqual({
    version: 1, modele: "modele-historique", creeLe: "2026-09-01", couvertures: [],
    elements: [{ id: "analyse-v1-0", nature: "sujet", texte: "Équations du premier degré", sources: [{ documentId: "livret", citation: "équations du premier degré" }] }],
  });
  expect(depot.corrections).toEqual([{ id: "correction-v1", elementId: "analyse-v1-0", texte: "Commencer par les exemples du cours.", creeLe: "2026-09-02" }]);
});

it("ouvre les documents même lorsqu’une ancienne interruption a un message vide", async () => {
  m.analyses = [{ id: "analyse", document_id: "livret", empreinte: "empreinte", statut: "interrompue", pages: [], couvertures: [], restitution: null, erreur: "", created_at: "2026-09-16", updated_at: "2026-09-16" }];
  const depot = await lireDepotDocumentaire("livret");
  expect(depot.titre).toBe("Livret");
  expect(depot.analyses[0]).toMatchObject({ statut: "interrompue", erreur: null });
});

it("relit strictement la trace de création déléguée conservée avec la source", async () => {
  const recu = { version: 1 as const, cle: "a".repeat(64), compteId: "compte", documentId: "livret", analyseId: "a", domaineId: "astronomie", nom: "Astronomie", statut: "reservee" as const };
  m.frontmatter.classement_creation_deleguee = encoderCreationDomaineDeleguee(recu);
  expect((await lireDepotDocumentaire("livret")).creationDomaineDeleguee).toEqual(recu);
  m.frontmatter.classement_creation_deleguee = "invalide";
  await expect(lireDepotDocumentaire("livret")).rejects.toThrow("trace de création déléguée est invalide");
  delete m.frontmatter.classement_creation_deleguee;
});
