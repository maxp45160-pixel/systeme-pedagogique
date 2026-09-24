import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LearningSession } from "@/lib/domain/types";

const mocks = vi.hoisted(() => ({
  dorsaleCompte: vi.fn(),
  lireParId: vi.fn(),
  ajouter: vi.fn(),
  revalidatePath: vi.fn(),
}));
vi.mock("./db", () => ({
  dorsaleCompte: mocks.dorsaleCompte,
  lireParId: mocks.lireParId,
  ajouter: mocks.ajouter,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { enregistrerTravailDocumentaireAction } from "./travail-documentaire-actions";

const cle = "00000000-0000-4000-8000-000000000001";
const entree = { documentIds: ["depot-a", "depot-b"], geste: "read" as const, note: "  Lu et annoté.  ", cle };
type DocumentTest = { id: string; titre: string; owner: string; frontmatter: Record<string, unknown> };
let documents: DocumentTest[];
let sessions: Map<string, LearningSession>;
let compteActif: string;
let requetesDocuments: number;

beforeEach(() => {
  vi.resetAllMocks();
  compteActif = "compte-a";
  requetesDocuments = 0;
  sessions = new Map();
  documents = [
    { id: "depot-a", titre: "Cours", owner: "compte-a", frontmatter: { depot_version: 2 } },
    { id: "depot-b", titre: "Mes notes", owner: "compte-a", frontmatter: { depot_version: 2 } },
  ];
  mocks.dorsaleCompte.mockImplementation(async () => ({
    userId: compteActif,
    supabase: {
      from: (table: string) => {
        expect(table).toBe("documents");
        requetesDocuments++;
        let userId = "";
        const requete = {
          select: () => requete,
          eq: (colonne: string, valeur: string) => {
            expect(colonne).toBe("user_id");
            userId = valeur;
            return requete;
          },
          in: async (colonne: string, ids: string[]) => {
            expect(colonne).toBe("id");
            return {
              data: documents.filter((document) => document.owner === userId && ids.includes(document.id))
                .map(({ id, titre, frontmatter }) => ({ id, titre, frontmatter })),
              error: null,
            };
          },
        };
        return requete;
      },
    },
  }));
  mocks.lireParId.mockImplementation(async (_collection: string, id: string) => sessions.get(id) ?? null);
  mocks.ajouter.mockImplementation(async (_collection: string, seance: LearningSession) => {
    if (sessions.has(seance.id)) throw new Error("conflit");
    sessions.set(seance.id, seance);
  });
});

describe("enregistrer le travail documentaire du jour", () => {
  it("écrit une seule séance terminée et retrouve le même reçu au rejeu", async () => {
    const premier = await enregistrerTravailDocumentaireAction(entree);
    const second = await enregistrerTravailDocumentaireAction(entree);
    expect(second).toEqual(premier);
    expect(mocks.ajouter).toHaveBeenCalledTimes(1);
    expect(requetesDocuments).toBe(1);
    expect(mocks.ajouter.mock.calls[0][0]).toBe("sessions");
    const seance = sessions.get(premier.sessionId)!;
    expect(seance.date).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/);
    expect(seance.notePersonnelle).toBe(entree.note);
    expect(seance.statut).toBe("terminee");
    expect(seance.skillCodes).toEqual([]);
    expect(seance.dureeMin).toBeUndefined();
    expect(seance.interventions?.map(({ source, type, statut, expectedEffect, proofContract }) => ({ source, type, statut, expectedEffect, proofContract }))).toEqual([
      { source: { kind: "document", ref: "depot-a" }, type: "read", statut: "completed", expectedEffect: "preparation", proofContract: undefined },
      { source: { kind: "document", ref: "depot-b" }, type: "read", statut: "completed", expectedEffect: "preparation", proofContract: undefined },
    ]);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/seances");
  });

  it("refuse la même clé avec un autre geste ou une autre sélection", async () => {
    await enregistrerTravailDocumentaireAction(entree);
    await expect(enregistrerTravailDocumentaireAction({ ...entree, geste: "synthesize" })).rejects.toThrow("autre travail");
    await expect(enregistrerTravailDocumentaireAction({ ...entree, documentIds: ["depot-b"] })).rejects.toThrow("autre travail");
    expect(mocks.ajouter).toHaveBeenCalledTimes(1);
  });

  it("refuse une ressource absente du compte ou de version 1", async () => {
    documents[1].owner = "compte-b";
    await expect(enregistrerTravailDocumentaireAction(entree)).rejects.toThrow("autre compte");
    documents[1].owner = "compte-a";
    documents[1].frontmatter = { depot_version: 1 };
    await expect(enregistrerTravailDocumentaireAction(entree)).rejects.toThrow("V2");
    expect(mocks.ajouter).not.toHaveBeenCalled();
  });

  it("reprend une écriture concurrente identique sans créer de double entrée", async () => {
    const [resultat, secondeReponse] = await Promise.all([
      enregistrerTravailDocumentaireAction(entree),
      enregistrerTravailDocumentaireAction(entree),
    ]);
    expect(secondeReponse).toEqual(resultat);
    expect(sessions.size).toBe(1);
    expect(sessions.has(resultat.sessionId)).toBe(true);
  });
});
