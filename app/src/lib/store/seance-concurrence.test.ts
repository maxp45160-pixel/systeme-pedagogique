import { describe, expect, it, vi } from "vitest";
import { PostgrestClient } from "@supabase/postgrest-js";
import type { LearningSession } from "@/lib/domain/types";
import type { DorsaleCompte } from "./db";
import { modifierSeanceSiInchangee } from "./seance-concurrence";

const SEANCE: LearningSession = {
  id: "session-test", date: "2026-09-17T08:00:00.000Z", statut: "en-cours",
  domaines: [], skillCodes: [], activites: [], genereAutomatiquement: false,
  interventions: [{
    id: "lecture", type: "read", label: "Lire, puis expliquer (A & B)",
    source: { kind: "document", ref: "document-test" }, expectedEffect: "preparation",
  }],
};

function dorsaleAvecReponse(data: unknown, status = 200) {
  // Le vrai client construit la requête ; seul le transport est simulé.
  const fetch = vi.fn(async () => new Response(JSON.stringify(data), {
    status, headers: { "Content-Type": "application/json" },
  }));
  const client = new PostgrestClient("https://test.invalid/rest/v1", { fetch });
  return { fetch, dorsale: { userId: "compte-test", supabase: client } as unknown as DorsaleCompte };
}

describe("écriture conditionnelle de séance", () => {
  it("compare le compte, la date, le statut et le JSONB exact dans une seule requête", async () => {
    const { fetch, dorsale } = dorsaleAvecReponse({ id: SEANCE.id });
    const interventions = SEANCE.interventions!.map((intervention) => ({
      ...intervention, statut: "completed" as const,
    }));
    await expect(modifierSeanceSiInchangee(SEANCE, { interventions }, dorsale)).resolves.toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
    const [adresse, options] = fetch.mock.calls[0] as unknown as [URL, RequestInit];
    const url = new URL(adresse);
    expect(url.searchParams.get("user_id")).toBe("eq.compte-test");
    expect(url.searchParams.get("id")).toBe(`eq.${SEANCE.id}`);
    expect(url.searchParams.get("date")).toBe(`eq.${SEANCE.date}`);
    expect(url.searchParams.get("statut")).toBe("eq.en-cours");
    expect(url.searchParams.get("interventions")).toBe(`eq.${JSON.stringify(SEANCE.interventions)}`);
    expect(url.searchParams.get("select")).toBe("id");
    expect(options.method).toBe("PATCH");
    expect(JSON.parse(options.body as string)).toEqual({ interventions });
  });

  it("compare les colonnes historiques absentes à NULL, jamais à un tableau vide", async () => {
    const { fetch, dorsale } = dorsaleAvecReponse({ id: SEANCE.id });
    await modifierSeanceSiInchangee({ ...SEANCE, statut: undefined, interventions: undefined }, {}, dorsale);
    const [adresse] = fetch.mock.calls[0] as unknown as [URL];
    const url = new URL(adresse);
    expect(url.searchParams.get("statut")).toBe("is.null");
    expect(url.searchParams.get("interventions")).toBe("is.null");
  });

  it("signale un conflit sans réessayer lorsque l'UPDATE ne retourne aucune ligne", async () => {
    const { fetch, dorsale } = dorsaleAvecReponse(null);
    await expect(modifierSeanceSiInchangee(SEANCE, { statut: "en-cours" }, dorsale)).resolves.toBe(false);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it.each([{ reponse: {} }, { reponse: { id: "autre-seance" } }, { reponse: 42 }])(
    "refuse une réponse mal formée ou visant une autre séance : %j",
    async ({ reponse }) => {
      const { dorsale } = dorsaleAvecReponse(reponse);
      await expect(modifierSeanceSiInchangee(SEANCE, { statut: "en-cours" }, dorsale))
        .rejects.toThrow("identifiant de la séance modifiée attendu");
    },
  );

  it("propage l'erreur du serveur sans repli vers une écriture inconditionnelle", async () => {
    const { fetch, dorsale } = dorsaleAvecReponse({ message: "indisponible" }, 503);
    await expect(modifierSeanceSiInchangee(SEANCE, { statut: "en-cours" }, dorsale)).rejects.toThrow("indisponible");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
