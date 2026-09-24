import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import type { DepotDocumentaire } from "@/lib/documents/depot";

vi.mock("@/lib/store/travail-documentaire-actions", () => ({ enregistrerTravailDocumentaireAction: vi.fn() }));
import { TravailDocumentaireFormulaire } from "./travail-documentaire-formulaire";

it("ne déclare pas automatiquement qu'un document joint a été travaillé", () => {
  const depot = { id: "depot-abc", version: 2, titre: "Notes de logique" } as DepotDocumentaire;
  const html = renderToStaticMarkup(createElement(TravailDocumentaireFormulaire, { depots: [depot], occupe: false }));
  expect(html).toContain("Conserver mon travail d’aujourd’hui");
  expect(html).toContain("Notes de logique");
  expect(html).toContain("Choisir un geste");
  expect(html).toMatch(/type="checkbox"[^>]*>/);
  expect(html).not.toMatch(/type="checkbox"[^>]*checked/);
  expect(html).toMatch(/disabled=""[^>]*>Enregistrer ce travail/);
});
