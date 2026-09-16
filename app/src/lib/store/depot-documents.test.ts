import { expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ analyses: [] as unknown[] }));
vi.mock("./documents", () => ({ lireDocument: async () => ({ frontmatter: { depot_version: "2" }, contenuMd: "# Livret\n", titre: "Livret" }) }));
vi.mock("./document-attachments", () => ({ lirePiecesJointes: async () => [] }));
vi.mock("./depot-budget", () => ({ comptePiloteDepot: async () => ({ userId: "compte", supabase: { from: (table: string) => {
  const query = { select: () => query, eq: () => query, order: async () => ({ data: table === "document_depot_analyses" ? m.analyses : [], error: null }) };
  return query;
} } }) }));
import { lireDepotDocumentaire } from "./depot-documents";

it("ouvre les documents même lorsqu’une ancienne interruption a un message vide", async () => {
  m.analyses = [{ id: "analyse", document_id: "livret", empreinte: "empreinte", statut: "interrompue", pages: [], couvertures: [], restitution: null, erreur: "", created_at: "2026-09-16", updated_at: "2026-09-16" }];
  const depot = await lireDepotDocumentaire("livret");
  expect(depot.titre).toBe("Livret");
  expect(depot.analyses[0]).toMatchObject({ statut: "interrompue", erreur: null });
});
