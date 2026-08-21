import { describe, expect, it } from "vitest";
import { consommerFluxSse } from "./flux-sse";

function reponseDepuis(corps: string): Response {
  return new Response(corps, {
    headers: { "content-type": "text/event-stream; charset=utf-8" },
  });
}

describe("consommerFluxSse", () => {
  it("délègue chaque événement complet au consommateur", async () => {
    const recus: { type: string; donnees: string }[] = [];
    await consommerFluxSse(
      reponseDepuis(
        'event: proposition-en-cours\ndata: {"etape":"redaction"}\n\nevent: propositions\ndata: {"exercices":[]}\n\n',
      ),
      (type, donnees) => recus.push({ type, donnees }),
    );
    expect(recus).toEqual([
      { type: "proposition-en-cours", donnees: '{"etape":"redaction"}' },
      { type: "propositions", donnees: '{"exercices":[]}' },
    ]);
  });

  it("reconstitue un événement coupé entre deux fragments de flux", async () => {
    const recus: string[] = [];
    const flux = new ReadableStream<Uint8Array>({
      start(controller) {
        const encodeur = new TextEncoder();
        controller.enqueue(encodeur.encode("event: erreur\nda"));
        controller.enqueue(encodeur.encode('ta: {"message":"panne"}\n\n'));
        controller.close();
      },
    });
    await consommerFluxSse(
      new Response(flux),
      (_type, donnees) => recus.push(donnees),
    );
    expect(recus).toEqual(['{"message":"panne"}']);
  });

  it("ignore les blocs sans données et le tampon résiduel incomplet", async () => {
    const recus: { type: string; donnees: string }[] = [];
    await consommerFluxSse(
      reponseDepuis("event: ping\n\nevent: fin\ndata: {}\n\ndata orpheline sans terminaison"),
      (type, donnees) => recus.push({ type, donnees }),
    );
    expect(recus).toEqual([{ type: "fin", donnees: "{}" }]);
  });

  it("traite un événement sans ligne event: comme message", async () => {
    const types: string[] = [];
    await consommerFluxSse(reponseDepuis('data: {"ok":true}\n\n'), (type) =>
      types.push(type),
    );
    expect(types).toEqual(["message"]);
  });
});
