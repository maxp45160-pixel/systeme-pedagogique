import { describe, expect, it, vi } from "vitest";

import { creerFetchAvecReessaiJwtFutur } from "./fetch";

function erreurJwtFutur() {
  return Response.json(
    { code: "PGRST303", message: "JWT issued at future" },
    { status: 401 },
  );
}

describe("fetch Supabase — course après rafraîchissement du JWT", () => {
  it("rejoue une seule fois une lecture touchée par PGRST303", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(erreurJwtFutur())
      .mockResolvedValueOnce(Response.json([{ code: "LOG-01" }]));
    const attendre = vi.fn(async () => {});
    const reponse = await creerFetchAvecReessaiJwtFutur(fetcher, attendre)(
      "https://example.supabase.co/rest/v1/competence_domaines",
    );

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(attendre).toHaveBeenCalledWith(500);
    expect(reponse.status).toBe(200);
  });

  it("ne rejoue jamais une écriture, même avec la même erreur", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(erreurJwtFutur());
    const reponse = await creerFetchAvecReessaiJwtFutur(fetcher, async () => {})(
      "https://example.supabase.co/rest/v1/competences",
      { method: "POST", body: "{}" },
    );

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(reponse.status).toBe(401);
  });

  it("laisse remonter toute autre erreur sans délai", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({ code: "PGRST301", message: "Invalid JWT" }, { status: 401 }),
    );
    const attendre = vi.fn(async () => {});
    await creerFetchAvecReessaiJwtFutur(fetcher, attendre)(
      "https://example.supabase.co/rest/v1/domaines",
    );

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(attendre).not.toHaveBeenCalled();
  });
});
