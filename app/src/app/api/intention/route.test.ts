import { describe, expect, it, vi } from "vitest";

/**
 * Le court-circuit de la traduction d'un besoin.
 *
 * Deux chemins n'ont jamais eu besoin du modèle : le point d'entrée « nouveau
 * domaine », dont le genre est imposé par l'écran d'où l'on écrit, et la
 * demande de séance sans sujet. Sur les deux, les recadrages de
 * `forcerTraductionIntention` réécrivaient CHAQUE champ de l'action produite par le
 * moteur — le compte payait ~90 s pour une réponse intégralement remplacée.
 *
 * Ce que ce test garantit n'est donc pas une forme de sortie : c'est
 * l'**absence d'appel**. Un moteur espion qui échoue s'il est sollicité est la
 * seule façon de faire échouer un retour en arrière silencieux, où quelqu'un
 * remettrait l'appel « au cas où » sans que rien ne le signale.
 */

const chargerContexte = vi.fn(async () => {
  throw new Error("chargerContexte ne doit pas être appelé sur un chemin court-circuité");
});
const creerMoteur = vi.fn(() => {
  throw new Error("aucun moteur ne doit être créé sur un chemin court-circuité");
});

vi.mock("@/lib/store/context", () => ({ chargerContexte }));
vi.mock("@/lib/tutor/moteurs", () => ({
  choisirConfiguration: () => ({ kind: "aucun", raison: "test" }),
  creerMoteur,
}));
vi.mock("@/lib/tutor/intention", () => ({
  traduireIntention: () => {
    throw new Error("le moteur ne doit pas être sollicité sur un chemin court-circuité");
  },
}));

const { POST } = await import("./route");

/** Rejoue le flux SSE d'une réponse en couples `(événement, données)`. */
async function lireFlux(reponse: Response): Promise<{ evenement: string; donnees: unknown }[]> {
  const texte = await reponse.text();
  return texte
    .split("\n\n")
    .filter((bloc) => bloc.trim() !== "")
    .map((bloc) => {
      const evenement = /^event: (.+)$/m.exec(bloc)?.[1] ?? "";
      const donnees = /^data: (.+)$/m.exec(bloc)?.[1] ?? "null";
      return { evenement, donnees: JSON.parse(donnees) };
    });
}

function requete(corps: unknown): Request {
  return new Request("http://localhost/api/intention", {
    method: "POST",
    body: JSON.stringify(corps),
  });
}

describe("POST /api/intention — court-circuit déterministe", () => {
  it("rend la structuration d'un domaine sans appeler le moteur", async () => {
    const reponse = await POST(
      requete({ besoin: "La gestion financière d'entreprise", contexte: "domaine" }),
    );

    expect(reponse.headers.get("content-type")).toContain("text/event-stream");
    const evenements = await lireFlux(reponse);

    expect(evenements.map((e) => e.evenement)).toEqual(["avertissement", "proposition"]);
    const proposition = evenements[1].donnees as {
      traduction: { action: { genre: string; sujet: string; codes: string[] } };
    };
    expect(proposition.traduction.action.genre).toBe("referentiel");
    expect(proposition.traduction.action.sujet).toBe("La gestion financière d'entreprise");
    // Le tuteur n'écrit aucun code : l'application les attribue (ADR-026).
    expect(proposition.traduction.action.codes).toEqual([]);
    expect(chargerContexte).not.toHaveBeenCalled();
    expect(creerMoteur).not.toHaveBeenCalled();
  });

  it("rend une séance libre sans appeler le moteur quand aucun sujet n'est donné", async () => {
    const reponse = await POST(requete({ besoin: "Crée une séance d'entraînement" }));
    const evenements = await lireFlux(reponse);

    const proposition = evenements.at(-1)?.donnees as {
      traduction: { action: { genre: string; codes: string[] } };
    };
    expect(proposition.traduction.action.genre).toBe("travail");
    // Aucune compétence choisie à la place de la personne : elle décidera de la
    // portée dans le compositeur.
    expect(proposition.traduction.action.codes).toEqual([]);
    expect(creerMoteur).not.toHaveBeenCalled();
  });

  it("annonce le recadrage avant la proposition, pas après", async () => {
    const reponse = await POST(requete({ besoin: "La physique quantique", contexte: "domaine" }));
    const evenements = await lireFlux(reponse);

    expect(evenements[0].evenement).toBe("avertissement");
    expect((evenements[0].donnees as { message: string }).message).toMatch(/nouveau domaine/);
  });

  it("refuse un besoin invalide avant tout court-circuit", async () => {
    const reponse = await POST(requete({ besoin: "x" }));
    expect(reponse.status).toBe(400);
    expect(await reponse.json()).toMatchObject({ erreur: "besoin-invalide" });
  });
});
