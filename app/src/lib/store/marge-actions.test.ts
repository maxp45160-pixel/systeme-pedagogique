import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  creerDocument: vi.fn(),
  dorsaleCompte: vi.fn(),
  lireContenuMarge: vi.fn(),
  modifierDocument: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("./documents", () => ({
  creerDocument: mocks.creerDocument,
  modifierDocument: mocks.modifierDocument,
}));
vi.mock("./marge", () => ({ lireContenuMarge: mocks.lireContenuMarge }));

import { noterDansLaMarge } from "./marge-actions";
import { analyserMarge, ecrireMarge, documentMargeInitial } from "@/lib/documents/marge";

/**
 * La friction du 25/08/2026 : les lignes du bloc-notes étaient datées par le
 * serveur (UTC), donc décalées autour de minuit européen, et la page du jour
 * empilait toutes les lignes ouvertes — une mémoire automatique. Désormais le
 * formulaire porte le jour civil du navigateur, et le serveur le borne à un
 * jour de part et d'autre : assez large pour tout fuseau réel, trop étroit
 * pour dater une note d'une semaine passée.
 */

function formData(ligne: string, jour?: string): FormData {
  const donnees = new FormData();
  donnees.set("ligne", ligne);
  if (jour !== undefined) donnees.set("jour", jour);
  return donnees;
}

describe("noterDansLaMarge — le jour déclaré par le formulaire", () => {
  afterEach(() => vi.useRealTimers());

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-25T12:00:00Z"));
    vi.clearAllMocks();
    mocks.lireContenuMarge.mockResolvedValue(null);
    mocks.creerDocument.mockResolvedValue(undefined);
  });

  it("date la note du jour porté par le formulaire", async () => {
    await noterDansLaMarge(formData("Revoir les intégrales", "2026-08-25"));
    const contenu = mocks.creerDocument.mock.calls[0][1] as string;
    expect(analyserMarge(contenu)[0]?.notee).toBe("2026-08-25");
  });

  it("refuse un jour mal formé plutôt que d'en fabriquer un", async () => {
    await expect(noterDansLaMarge(formData("x", "demain"))).rejects.toThrow(/mal formé/);
    expect(mocks.creerDocument).not.toHaveBeenCalled();
  });

  it("refuse une note datée d'une semaine passée", async () => {
    const vieux = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await expect(noterDansLaMarge(formData("x", vieux))).rejects.toThrow(/jour où elle est écrite/);
    expect(mocks.creerDocument).not.toHaveBeenCalled();
  });

  it("sans jour déclaré, retombe sur le jour du serveur (comportement antérieur)", async () => {
    await noterDansLaMarge(formData("Sans champ jour"));
    const contenu = mocks.creerDocument.mock.calls[0][1] as string;
    const attendu = new Date().toISOString().slice(0, 10);
    expect(analyserMarge(contenu)[0]?.notee).toBe(attendu);
  });

  it("le document produit reste relisible par le domaine existant", () => {
    // Garde de non-régression : la section Markdown ne bouge pas.
    const contenu = ecrireMarge(documentMargeInitial(), [
      { texte: "Une phrase", faite: false, notee: "2026-08-25" },
    ]);
    expect(analyserMarge(contenu)).toEqual([
      { texte: "Une phrase", faite: false, notee: "2026-08-25" },
    ]);
  });
});
