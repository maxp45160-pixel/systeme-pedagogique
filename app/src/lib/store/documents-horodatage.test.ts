import { beforeEach, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ dorsale: vi.fn(), index: vi.fn() }));
vi.mock("./db", () => ({ dorsaleCompte: m.dorsale }));
vi.mock("./depot-budget", () => ({ comptePiloteDepot: m.dorsale }));
vi.mock("./document-attachments", () => ({ lirePiecesJointes: async () => [], supprimerStockagePiecesJointes: vi.fn() }));
vi.mock("@/lib/documents/index", () => ({ reconstruireIndexDocumentaire: m.index }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { lireDocument, resynchroniserLiensDocument } from "./documents";
import { lireDepotDocumentaire } from "./depot-documents";

let ligne: Record<string, unknown>;
const creeLe = "2026-09-15T12:04:03.123456+00:00";
const modifieLe = "2026-09-15T18:07:06.654321+00:00";

beforeEach(() => {
  vi.clearAllMocks();
  ligne = {
    id: "depot-test", user_id: "compte-qa", contenu_md: "---\ntitle: Livret\ntype: cours\nrole: support\ndepot_version: 2\n---\n# Livret\n",
    titre: "Livret", type: "cours", tags: [], schema_version: "pedagogie/v1", frontmatter: { role: "support", depot_version: 2 },
    created_at: creeLe, updated_at: modifieLe,
  };
  m.index.mockReturnValue({ liens: [] });
  m.dorsale.mockResolvedValue({ userId: "compte-qa", supabase: { from: (table: string) => {
    const resultat = () => ({ data: table === "documents" ? [ligne] : [], error: null });
    const query = {
      select: () => query, eq: () => query, order: () => query, delete: () => query, in: () => query,
      maybeSingle: async () => ({ data: ligne, error: null }),
      then: (resolve: (valeur: ReturnType<typeof resultat>) => unknown) => Promise.resolve(resultat()).then(resolve),
    };
    return query;
  } } });
});

it("conserve les horodatages SQL exacts jusqu'au dépôt utilisé pour confirmer", async () => {
  const document = await lireDocument("depot-test");
  expect(document.createdAt).toBe(creeLe);
  expect(document.updatedAt).toBe(modifieLe);
  const depot = await lireDepotDocumentaire("depot-test");
  expect(depot.creeLe).toBe(creeLe);
  expect(depot.modifieLe).toBe(modifieLe);
});

it("conserve aussi les horodatages lors de la lecture du corpus documentaire", async () => {
  await resynchroniserLiensDocument("depot-test");
  expect(m.index.mock.calls[0][0][0]).toMatchObject({ createdAt: creeLe, updatedAt: modifieLe });
});

it.each([
  ["created_at", undefined], ["updated_at", undefined], ["created_at", ""], ["updated_at", "date-invalide"], ["updated_at", 123],
])("refuse %s=%s sans fabriquer un horodatage", async (colonne, valeur) => {
  ligne[colonne as string] = valeur;
  await expect(lireDepotDocumentaire("depot-test")).rejects.toThrow("dates du document");
  await expect(resynchroniserLiensDocument("depot-test")).rejects.toThrow("dates du document");
  expect(m.index).not.toHaveBeenCalled();
});
