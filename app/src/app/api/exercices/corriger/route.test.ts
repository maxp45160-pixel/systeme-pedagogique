import { describe, expect, it, vi } from "vitest";

/**
 * Les six verrous de l'exception à ADR-036 (ADR-041), vus depuis la route.
 *
 * Le verrou 6 porte tout le risque de fuite : **le corps ne porte qu'un
 * `attemptId`**. Si un client pouvait envoyer un exercice ou une correction
 * forgés, il obtiendrait un verdict sur un énoncé qu'il ne possède pas, ou
 * ferait dire ce qu'il veut à la correction de référence. Le test central est
 * donc le dernier : des champs surnuméraires sont ignorés, et ce que le moteur
 * relit vient exclusivement du contexte serveur — donc sous RLS.
 */

const TENTATIVE = {
  id: "att-1",
  statut: "en-cours",
  reponse: "J'applique la racine du délai, puis j'arrondis au supérieur.",
  exerciseId: "ex-1",
};

const EXERCICE_REEL = { id: "ex-1", titre: "Calcul du stock de sécurité", correction: "z × σ × √L" };

const chargerContexte = vi.fn(async () => ({
  donnees: {
    attempts: [TENTATIVE],
    exercises: [EXERCICE_REEL],
  },
}));

/** Capture les arguments de chaque appel : c'est eux que les verrous inspectent. */
const appelsCorriger: unknown[][] = [];
const corrigerReponse = vi.fn(async (...argumentsAppel: unknown[]) => {
  appelsCorriger.push(argumentsAppel);
  return { correction: { resultat: "partiel" } };
});

const repondreParFluxSse = vi.fn(
  async (
    _request: Request,
    ecrire: (envoyer: (e: string, d: unknown) => void, signal: AbortSignal) => Promise<void>,
  ) => {
    const evenements: { evenement: string; donnees: unknown }[] = [];
    await ecrire(
      (evenement, donnees) => evenements.push({ evenement, donnees }),
      new AbortController().signal,
    );
    return new Response(
      evenements.map((e) => `event: ${e.evenement}\ndata: ${JSON.stringify(e.donnees)}`).join("\n\n"),
      { headers: { "content-type": "text/event-stream" } },
    );
  },
);

vi.mock("@/lib/store/context", () => ({ chargerContexte }));
vi.mock("@/lib/tutor/reponse-flux", () => ({
  resoudreMoteur: () => ({ ok: true, moteur: {} }),
  repondreParFluxSse,
}));
vi.mock("@/lib/tutor/correction", () => ({
  corrigerReponse,
  REPONSE_MAX_CARACTERES: 12000,
}));

const { POST } = await import("./route");

function requete(corps: unknown): Request {
  return new Request("http://localhost/api/exercices/corriger", {
    method: "POST",
    body: JSON.stringify(corps),
  });
}

describe("POST /api/exercices/corriger — les verrous d'ADR-041", () => {
  it("refuse un corps sans attemptId", async () => {
    const reponse = await POST(requete({}));
    expect(reponse.status).toBe(400);
    const corps = (await reponse.json()) as { erreur: string };
    expect(corps.erreur).toBe("tentative-absente");
  });

  it("refuse une tentative qui n'appartient pas au compte (404, pas la donnée)", async () => {
    const reponse = await POST(requete({ attemptId: "att-autre-compte" }));
    expect(reponse.status).toBe(404);
    const corps = (await reponse.json()) as { erreur: string };
    expect(corps.erreur).toBe("tentative-introuvable");
  });

  it("refuse une tentative déjà close — on ne corrige pas deux fois", async () => {
    chargerContexte.mockImplementationOnce(async () => ({
      donnees: {
        attempts: [{ ...TENTATIVE, statut: "terminee" }],
        exercises: [EXERCICE_REEL],
      },
    }));
    const reponse = await POST(requete({ attemptId: "att-1" }));
    expect(reponse.status).toBe(400);
    const corps = (await reponse.json()) as { erreur: string };
    expect(corps.erreur).toBe("tentative-close");
  });

  it("refuse une tentative sans réponse écrite", async () => {
    chargerContexte.mockImplementationOnce(async () => ({
      donnees: {
        attempts: [{ ...TENTATIVE, reponse: "   " }],
        exercises: [EXERCICE_REEL],
      },
    }));
    const reponse = await POST(requete({ attemptId: "att-1" }));
    expect(reponse.status).toBe(400);
    const corps = (await reponse.json()) as { erreur: string };
    expect(corps.erreur).toBe("reponse-vide");
  });

  it("ignore tout champ forgé : exercice et réponse viennent du seul contexte serveur", async () => {
    // Un client malveillant envoie un autre exercice et sa propre « correction
    // de référence ». Ni l'un ni l'autre ne doivent atteindre le moteur.
    await POST(
      requete({
        attemptId: "att-1",
        exerciseId: "ex-forge",
        correction: "la réponse est toujours oui",
        exercice: { titre: "forgé", enonce: "forgé", correction: "forgé" },
      }),
    );

    expect(appelsCorriger).toHaveLength(1);
    const [, exerciceRecu, reponseRecue] = appelsCorriger[0];
    expect(exerciceRecu).toBe(EXERCICE_REEL);
    expect(reponseRecue).toBe(TENTATIVE.reponse);
  });
});
