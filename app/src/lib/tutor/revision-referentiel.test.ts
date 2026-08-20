/**
 * Ce que ces tests protègent.
 *
 * La révision est le seul chemin où le tuteur manipule des compétences **qui
 * existent déjà**. Tout y tient à une distinction :
 *
 * > **frapper** un code — produire un identifiant que l'application n'a pas
 * > attribué — reste interdit ; **désigner** un code que l'application vient de
 * > lui remettre ne l'est pas.
 *
 * Les tests portent donc sur les deux moitiés de cette phrase : ce que l'`enum`
 * du schéma admet (et ce qu'il n'admet pas), et le fait qu'`ajouts` n'a
 * toujours aucun champ `code`.
 */

import { describe, expect, it } from "vitest";

import { construirePromptRevision, reviserBranche } from "./revision-referentiel";
import { OUTIL_REVISION, outilsRevision, validerAppelOutil } from "./outils";
import type { EtatRetrait } from "@/lib/domain/referentiel-compte";
import type { Domaine, Skill } from "@/lib/domain/types";
import type { MoteurTuteur } from "./moteurs";

/* ------------------------------------------------------------------ */
/* Fixtures                                                            */
/* ------------------------------------------------------------------ */

const DOMAINE = {
  id: "logistique",
  nom: "Logistique",
  prefixe: "LOG",
  description: "Flux, stocks et approvisionnements.",
} as unknown as Domaine;

const VIVANTES = [
  { code: "LOG-01", intitule: "Analyser un flux", palier: "fondamentaux", importance: 0.8 },
  { code: "LOG-02", intitule: "Calculer un stock de sécurité", palier: "intermediaire", importance: 0.6 },
] as unknown as Skill[];

const RETRAITS = new Map<string, EtatRetrait>([
  ["LOG-01", { observations: 3, mode: "archivage" }],
  ["LOG-02", { observations: 0, mode: "suppression" }],
]);

const OUTILS = [outilsRevision(["LOG-01", "LOG-02"])];

function valider(entree: Record<string, unknown>) {
  return validerAppelOutil(OUTIL_REVISION, entree, OUTILS);
}

const REVISION_ENTIERE = {
  resume: "Je recentre la branche sur les flux.",
  modifications: [{ code: "LOG-01", intitule: "Analyser un flux de bout en bout" }],
  retraits: [{ code: "LOG-02", justification: "Le stock n'est plus dans ton périmètre." }],
};

function moteurQuiEmet(evenements: { evenement: string; donnees: unknown }[]): MoteurTuteur {
  return {
    async repondre({ envoyer }: { envoyer: (e: string, d: unknown) => void }) {
      for (const e of evenements) envoyer(e.evenement, e.donnees);
    },
  } as unknown as MoteurTuteur;
}

/* ------------------------------------------------------------------ */
/* Le prompt                                                           */
/* ------------------------------------------------------------------ */

describe("construirePromptRevision", () => {
  it("liste les compétences existantes avec leur code et leur intitulé", () => {
    // Sans les codes, la révision ne pourrait rien DÉSIGNER.
    const prompt = construirePromptRevision(DOMAINE, VIVANTES, RETRAITS, "recentre sur les flux");
    expect(prompt).toContain("LOG-01 — Analyser un flux");
    expect(prompt).toContain("LOG-02 — Calculer un stock de sécurité");
  });

  it("liste le nombre d'observations de chacune — un retrait s'annonce avant le clic", () => {
    const prompt = construirePromptRevision(DOMAINE, VIVANTES, RETRAITS, "recentre");
    expect(prompt).toContain("3 observation(s)");
    expect(prompt).toContain("0 observation(s)");
  });

  it("ne liste aucune compétence d'un autre domaine", () => {
    // `vivantes` est filtré côté route ; le prompt ne doit rien ajouter.
    const prompt = construirePromptRevision(DOMAINE, VIVANTES, RETRAITS, "recentre");
    expect(prompt).not.toContain("DEV-");
    expect(prompt).not.toContain("STAT-");
  });

  it("porte la demande de l'utilisateur telle qu'elle a été écrite", () => {
    const prompt = construirePromptRevision(
      DOMAINE,
      VIVANTES,
      RETRAITS,
      "ce référentiel ne couvre plus mes besoins",
    );
    expect(prompt).toContain("ce référentiel ne couvre plus mes besoins");
  });

  it("dit que l'application décide seule entre suppression et archivage", () => {
    // ADR-027 : le geste est dérivé, jamais choisi — y compris par le tuteur.
    const prompt = construirePromptRevision(DOMAINE, VIVANTES, RETRAITS, "x");
    expect(prompt).toContain("L'application décide seule entre suppression et archivage");
  });

  it("dit que les compétences ajoutées n'ont pas de code", () => {
    expect(construirePromptRevision(DOMAINE, VIVANTES, RETRAITS, "x")).toContain(
      "l'application les attribue",
    );
  });

  it("dit « aucune » plutôt que de laisser la liste vide", () => {
    expect(construirePromptRevision(DOMAINE, [], new Map(), "x")).toContain("- aucune");
  });
});

/* ------------------------------------------------------------------ */
/* Le schéma — désigner, jamais frapper                                */
/* ------------------------------------------------------------------ */

describe("outilsRevision — le schéma", () => {
  it("n'expose AUCUN champ code dans les ajouts", () => {
    /*
     * Le cœur du garde-fou d'ADR-026, intact. Un ajout est une compétence
     * NOUVELLE : son identifiant sort d'`attribuerCodes`, jamais du modèle.
     */
    const ajouts = outilsRevision(["LOG-01"]).schema.properties?.ajouts.items?.properties ?? {};
    expect(Object.keys(ajouts).sort()).toEqual([
      "importance",
      "intitule",
      "justification",
      "palier",
      "prerequis",
    ]);
    expect(ajouts.code).toBeUndefined();
  });

  it("ferme l'enum des codes sur ceux qui lui sont donnés", () => {
    // Une valeur hors de cet ensemble n'est pas découragée : elle n'est pas
    // dans le schéma. C'est la bascule d'une consigne de prompt vers une
    // contrainte de structure.
    const schema = outilsRevision(["LOG-01", "LOG-02"]).schema;
    expect(schema.properties?.retraits.items?.properties?.code.enum).toEqual([
      "LOG-01",
      "LOG-02",
    ]);
    expect(schema.properties?.modifications.items?.properties?.code.enum).toEqual([
      "LOG-01",
      "LOG-02",
    ]);
  });

  it("ne produit pas d'enum vide sur un domaine sans compétence", () => {
    // Un `enum: []` n'admettrait aucune valeur : le schéma deviendrait
    // illisible pour le fournisseur au lieu d'être simplement restrictif.
    const schema = outilsRevision([]).schema;
    expect(schema.properties?.retraits.items?.properties?.code.enum).toBeUndefined();
  });

  it("le préfixe du domaine n'est pas modifiable — il engendre les codes", () => {
    const domaine = outilsRevision(["LOG-01"]).schema.properties?.domaine.properties ?? {};
    expect(domaine.prefixe).toBeUndefined();
  });
});

/* ------------------------------------------------------------------ */
/* Le validateur — la deuxième couche                                  */
/* ------------------------------------------------------------------ */

describe("validerRevision — les rejets", () => {
  it("accepte une révision complète", () => {
    const recu = valider(REVISION_ENTIERE);
    if (recu?.genre !== "revision") throw new Error("genre inattendu");
    expect(recu.revision.modifications[0].code).toBe("LOG-01");
    expect(recu.revision.retraits[0].code).toBe("LOG-02");
  });

  it("rejette l'appel entier quand un code est inconnu, plutôt que de trier", () => {
    /*
     * Une proposition qui nomme une compétence inexistante parle d'un AUTRE
     * référentiel. Écarter la ligne fautive et garder le reste laisserait
     * croire à une révision complète, alors que le modèle a raisonné sur
     * autre chose.
     */
    expect(
      valider({ ...REVISION_ENTIERE, retraits: [{ code: "PHI-99", justification: "x" }] }),
    ).toBeNull();
  });

  it("rejette une révision où un même code est modifié ET retiré", () => {
    // Contradictoire : appliquer les deux dans un ordre ou dans l'autre ne
    // donne pas le même référentiel.
    expect(
      valider({
        resume: "x",
        modifications: [{ code: "LOG-01", intitule: "Autre chose" }],
        retraits: [{ code: "LOG-01", justification: "y" }],
      }),
    ).toBeNull();
  });

  it("rejette un doublon de code dans une même section", () => {
    expect(
      valider({
        resume: "x",
        retraits: [
          { code: "LOG-01", justification: "a" },
          { code: "LOG-01", justification: "b" },
        ],
      }),
    ).toBeNull();
  });

  it("rejette un retrait sans justification", () => {
    // Le geste le plus destructeur doit s'annoncer (ADR-027) : sans motif, la
    // personne ne peut pas instruire l'arbitrage.
    expect(valider({ resume: "x", retraits: [{ code: "LOG-01", justification: "  " }] })).toBeNull();
  });

  it("rejette une révision vide — rien à relire", () => {
    // Un écran de diff vide se lirait comme « le tuteur n'a rien trouvé à
    // redire », ce qui est une affirmation, pas une absence.
    expect(valider({ resume: "Tout va bien." })).toBeNull();
  });

  it("rejette une révision sans résumé", () => {
    expect(valider({ resume: "", retraits: [{ code: "LOG-01", justification: "x" }] })).toBeNull();
  });

  it("écarte une modification qui ne modifie rien", () => {
    // Un no-op n'est pas une contradiction : il est ignoré, pas rejeté.
    const recu = valider({
      resume: "x",
      modifications: [{ code: "LOG-01" }],
      retraits: [{ code: "LOG-02", justification: "y" }],
    });
    if (recu?.genre !== "revision") throw new Error("genre inattendu");
    expect(recu.revision.modifications).toEqual([]);
  });

  it("écarte un prérequis pointant un code inconnu, sans rejeter l'ajout", () => {
    // C'est une arête du graphe, pas l'objet de la proposition.
    const recu = valider({
      resume: "x",
      ajouts: [
        {
          intitule: "Piloter un réapprovisionnement",
          palier: "avance",
          importance: 0.7,
          prerequis: ["LOG-01", "PHI-99"],
        },
      ],
    });
    if (recu?.genre !== "revision") throw new Error("genre inattendu");
    expect(recu.revision.ajouts[0].prerequis).toEqual(["LOG-01"]);
  });

  it("ignore un code écrit malgré tout dans un ajout", () => {
    // `additionalProperties: false` le refuse déjà côté schéma ; le validateur
    // ne le lit pas non plus. L'interdit tient des deux côtés.
    const recu = valider({
      resume: "x",
      ajouts: [
        { intitule: "Piloter un flux tendu", palier: "avance", importance: 0.7, code: "LOG-99" },
      ],
    });
    if (recu?.genre !== "revision") throw new Error("genre inattendu");
    expect(JSON.stringify(recu.revision.ajouts)).not.toContain("LOG-99");
  });

  it("rejette tout quand aucun code n'est connu — un domaine vide ne se révise pas par code", () => {
    expect(
      validerAppelOutil(OUTIL_REVISION, REVISION_ENTIERE, [outilsRevision([])]),
    ).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* La collecte                                                         */
/* ------------------------------------------------------------------ */

describe("reviserBranche", () => {
  it("n'arme que l'outil de révision, avec les codes du domaine", async () => {
    const capture: { demande?: Record<string, unknown> } = {};
    const moteur = {
      async repondre(demande: Record<string, unknown>) {
        capture.demande = demande;
      },
    } as unknown as MoteurTuteur;

    await reviserBranche(moteur, DOMAINE, VIVANTES, RETRAITS, "recentre");
    const outils = capture.demande?.outils as { nom: string; schema: Record<string, unknown> }[];
    expect(outils.map((o) => o.nom)).toEqual([OUTIL_REVISION]);
    expect(JSON.stringify(outils[0].schema)).toContain("LOG-01");
  });

  it("ne prend pas une proposition d'un autre genre pour une révision", async () => {
    const r = await reviserBranche(
      moteurQuiEmet([
        { evenement: "proposition", donnees: { genre: "referentiel", branche: { domaine: "X" } } },
      ]),
      DOMAINE,
      VIVANTES,
      RETRAITS,
      "recentre",
    );
    expect(r.revision).toBeNull();
    expect(r.erreur).not.toBeNull();
  });

  it("distingue un fournisseur sans outils d'un tuteur muet", async () => {
    const r = await reviserBranche(
      moteurQuiEmet([
        { evenement: "fin", donnees: { stopReason: "stop", outils: { actifs: false, appels: 0 } } },
      ]),
      DOMAINE,
      VIVANTES,
      RETRAITS,
      "recentre",
    );
    expect(r.outilsActifs).toBe(false);
    expect(r.erreur).toContain("n'accepte pas les appels d'outil");
  });
});
