import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import type { DepotDocumentaire } from "@/lib/documents/depot";
import type { ContexteOrganisationDepot } from "@/lib/documents/organisation-depot";

vi.mock("@/lib/store/rangement-manuel-actions", () => ({ enregistrerRangementManuelSansAnalyseAction: vi.fn() }));
import { ClassementManuelSansAnalyse } from "./classement-manuel-sans-analyse";

it("permet de ranger à la main un dépôt sans analyse et n'affirme aucun travail par défaut", () => {
  const depot = {
    id: "depot-abc", version: 2, titre: "Notes de probabilités", type: "cours", creeLe: "2026-09-24", modifieLe: "2026-09-24T10:00:00Z",
    note: "", competencesLiees: ["MAT-01"], pieces: [], analyses: [], corrections: [], domaineId: "math",
  } as DepotDocumentaire;
  const referentiel: ContexteOrganisationDepot = {
    compteId: "user", domaines: [{ id: "math", nom: "Mathématiques", prefixe: "MAT", description: "" }],
    competences: [{ code: "MAT-01", intitule: "Calculer une probabilité", domaine: "math", domaineNom: "Mathématiques" }],
  };
  const html = renderToStaticMarkup(createElement(ClassementManuelSansAnalyse, { depot, referentiel, occupe: false }));
  expect(html).toContain("Aucune proposition IA terminée n’est nécessaire");
  expect(html).toContain("Enregistrer ce rangement");
  expect(html).toContain("Calculer une probabilité");
  expect(html).toContain("À trier");
  expect(html).toContain("checked");
  expect(html).not.toContain("Enregistrer ce travail");
});
