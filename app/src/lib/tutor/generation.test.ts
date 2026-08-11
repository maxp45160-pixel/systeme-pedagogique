/**
 * Ce que ces tests protègent.
 *
 * `construirePromptGeneration` est la couture entre le 3ᵉ maillon de la boucle
 * (`lib/engine/calibration.ts`) et le tuteur. Si la difficulté conseillée
 * n'arrive pas dans le prompt, la génération redevient ce qu'elle était avant
 * ADR-028 : un modèle qui choisit la difficulté à vue.
 *
 * Le cas le plus important est le second : quand `calibrer` ne conclut pas, le
 * prompt doit le DIRE, pas inventer un nombre. C'est P2 à la couture — un
 * chiffre plausible glissé ici serait indiscernable d'une mesure.
 */

import { describe, expect, it } from "vitest";

import { construirePromptGeneration, genererExercices } from "./generation";
import type { Calibration } from "@/lib/engine/calibration";
import type { Referentiel, Skill } from "@/lib/domain/types";
import type { MoteurTuteur } from "./moteurs";
import type { PropositionExercice } from "./proposition";

/* ------------------------------------------------------------------ */
/* Fixtures                                                            */
/* ------------------------------------------------------------------ */

const LOG_10 = {
  code: "LOG-10",
  intitule: "Analyser un flux logistique",
  domaine: "logistique",
} as unknown as Skill;

const DEV_03 = {
  code: "DEV-03",
  intitule: "Filtrer et transformer une collection",
  domaine: "developpement",
} as unknown as Skill;

const REFERENTIEL: Referentiel = {
  domaines: [
    { id: "logistique", nom: "Logistique", prefixe: "LOG", description: "" },
    { id: "developpement", nom: "Développement", prefixe: "DEV", description: "" },
    { id: "dormant", nom: "Dormant", prefixe: "DOR", description: "" },
  ],
  skills: [LOG_10, DEV_03],
  actifs: [LOG_10, DEV_03],
} as unknown as Referentiel;

function calibration(surcharge: Partial<Calibration> = {}): Calibration {
  return {
    skillCode: "LOG-10",
    difficulteConseillee: 3,
    signal: "calibre",
    dimensionFaible: null,
    verdicts: [],
    explication: { resume: "", facteurs: [], nombrePreuves: 0, reserves: [] },
    ...surcharge,
  };
}

/* ------------------------------------------------------------------ */
/* La difficulté                                                       */
/* ------------------------------------------------------------------ */

describe("construirePromptGeneration — la difficulté conseillée", () => {
  it("porte la difficulté dérivée jusqu'au prompt", () => {
    const prompt = construirePromptGeneration(REFERENTIEL, [
      { competence: LOG_10, calibration: calibration({ difficulteConseillee: 4 }) },
    ]);
    expect(prompt).toContain("LOG-10");
    expect(prompt).toContain("difficulté 4");
  });

  it("retire la difficulté de l'appréciation du modèle, explicitement", () => {
    const prompt = construirePromptGeneration(REFERENTIEL, [
      { competence: LOG_10, calibration: calibration() },
    ]);
    expect(prompt).toContain("N'EST PAS À TON APPRÉCIATION");
  });

  /*
   * Le cas de P2. `calibrer` rend `null` quand aucune tentative n'est
   * exploitable — toutes abandonnées sous 25 % de la durée estimée, par
   * exemple. Le prompt doit refléter cette absence, et surtout ne pas porter
   * un nombre que rien n'étaye.
   */
  it("ne conseille aucun nombre quand la calibration ne conclut pas", () => {
    const prompt = construirePromptGeneration(REFERENTIEL, [
      { competence: LOG_10, calibration: calibration({ difficulteConseillee: null }) },
    ]);
    expect(prompt).toContain("aucune tentative exploitable");
    expect(prompt).not.toMatch(/difficulté [1-5]/);
  });

  it("dit la même chose quand il n'y a aucune calibration du tout", () => {
    const prompt = construirePromptGeneration(REFERENTIEL, [
      { competence: LOG_10, calibration: null },
    ]);
    expect(prompt).toContain("aucune tentative exploitable");
    expect(prompt).not.toMatch(/difficulté [1-5]/);
  });
});

/* ------------------------------------------------------------------ */
/* L'angle                                                             */
/* ------------------------------------------------------------------ */

describe("construirePromptGeneration — la dimension faible", () => {
  it("transmet l'angle à travailler quand il est mesuré", () => {
    const prompt = construirePromptGeneration(REFERENTIEL, [
      {
        competence: LOG_10,
        calibration: calibration({
          dimensionFaible: { dimension: "application", moyenne: 0.4, observations: 2 },
        }),
      },
    ]);
    expect(prompt).toContain("Application");
  });

  it("n'invente aucun angle quand aucune dimension ne ressort", () => {
    const prompt = construirePromptGeneration(REFERENTIEL, [
      { competence: LOG_10, calibration: calibration({ dimensionFaible: null }) },
    ]);
    expect(prompt).not.toContain("dimension «");
  });
});

/* ------------------------------------------------------------------ */
/* Le périmètre                                                        */
/* ------------------------------------------------------------------ */

describe("construirePromptGeneration — les domaines", () => {
  it("ne liste que les domaines portant au moins une compétence active", () => {
    const prompt = construirePromptGeneration(REFERENTIEL, [
      { competence: LOG_10, calibration: calibration() },
    ]);
    expect(prompt).toContain("logistique");
    expect(prompt).toContain("developpement");
    // Un domaine sans compétence active ne doit pas entrer dans l'`enum` du
    // schéma : un exercice y serait rattaché sans rien à mesurer.
    expect(prompt).not.toContain("dormant");
  });

  it("le dit plutôt que de laisser la liste vide quand rien n'est actif", () => {
    const vide = { ...REFERENTIEL, actifs: [] } as unknown as Referentiel;
    const prompt = construirePromptGeneration(vide, [
      { competence: LOG_10, calibration: calibration() },
    ]);
    expect(prompt).toContain("aucun");
  });
});

/* ------------------------------------------------------------------ */
/* Plusieurs demandes                                                  */
/* ------------------------------------------------------------------ */

describe("construirePromptGeneration — plusieurs compétences", () => {
  it("porte une ligne de calibrage par compétence demandée", () => {
    const prompt = construirePromptGeneration(REFERENTIEL, [
      { competence: LOG_10, calibration: calibration({ difficulteConseillee: 2 }) },
      {
        competence: DEV_03,
        calibration: calibration({ skillCode: "DEV-03", difficulteConseillee: 5 }),
      },
    ]);
    expect(prompt).toContain("LOG-10 — Analyser un flux logistique : difficulté 2");
    expect(prompt).toContain("DEV-03 — Filtrer et transformer une collection : difficulté 5");
  });
});

describe("construirePromptGeneration — modification guidée", () => {
  it("transmet la consigne et la proposition comme données à réviser", () => {
    const prompt = construirePromptGeneration(REFERENTIEL, [{
      competence: DEV_03,
      calibration: null,
      modification: {
        consigne: "Rends l'énoncé plus concret.",
        proposition: {
          titre: "Ancien titre",
          domaine: "developpement",
          type: "application",
          difficulte: "2",
          competences: [DEV_03.code],
          dureeEstimeeMin: "20",
          enonce: "Ancien énoncé",
          indices: [],
          correction: "Correction",
          criteres: [{ dimension: "application", libelle: "Appliquer" }],
        },
      },
    }]);

    expect(prompt).toContain("RÉVISION DEMANDÉE");
    expect(prompt).toContain("Rends l'énoncé plus concret.");
    expect(prompt).toContain("Ancien énoncé");
    expect(prompt).toContain("conservant les compétences ciblées");
  });
});

/* ------------------------------------------------------------------ */
/* La collecte — ce que `genererExercices` retient, et ce qu'il refuse  */
/* ------------------------------------------------------------------ */

/**
 * Un moteur de test qui rejoue une suite d'événements figée.
 *
 * C'est exactement le contrat que `genererExercices` exploite : les moteurs
 * exposent `repondre({… envoyer})`, et un `envoyer` qui collecte au lieu de
 * diffuser suffit à faire du chat un chemin d'appel non conversationnel.
 */
function moteurQuiEmet(
  evenements: { evenement: string; donnees: unknown }[],
): MoteurTuteur {
  return {
    async repondre({ envoyer }: { envoyer: (e: string, d: unknown) => void }) {
      for (const e of evenements) envoyer(e.evenement, e.donnees);
    },
  } as unknown as MoteurTuteur;
}

const EXERCICE = {
  titre: "Réordonner une tournée",
  competences: ["LOG-10"],
} as unknown as PropositionExercice;

describe("genererExercices — rien n'est fabriqué", () => {
  it("ne rend aucun exercice, et le dit, quand le moteur n'en produit aucun", async () => {
    // Une proposition tronquée est rejetée en amont par `validerAppelOutil` :
    // le moteur n'émet alors aucun événement `proposition`. Le cas doit se
    // solder par une erreur annoncée, jamais par un exercice à moitié rempli.
    const r = await genererExercices(
      moteurQuiEmet([{ evenement: "message", donnees: { texte: "Je réfléchis…" } }]),
      REFERENTIEL,
      [{ competence: LOG_10, calibration: calibration() }],
    );
    expect(r.exercices).toEqual([]);
    expect(r.erreur).toBe("Aucun exercice exploitable n'a été produit.");
  });

  it("ne prend pas une proposition d'un autre genre pour un exercice", async () => {
    // Le même canal porte les branches de référentiel. Collecter sur le seul
    // nom de l'événement écrirait une branche dans la bibliothèque d'exercices.
    const r = await genererExercices(
      moteurQuiEmet([
        { evenement: "proposition", donnees: { genre: "referentiel", branche: { domaine: "X" } } },
      ]),
      REFERENTIEL,
      [{ competence: LOG_10, calibration: calibration() }],
    );
    expect(r.exercices).toEqual([]);
    expect(r.erreur).not.toBeNull();
  });

  it("retient un exercice validé et ne signale aucune erreur", async () => {
    const r = await genererExercices(
      moteurQuiEmet([
        { evenement: "proposition", donnees: { genre: "exercice", exercice: EXERCICE } },
      ]),
      REFERENTIEL,
      [{ competence: LOG_10, calibration: calibration() }],
    );
    expect(r.exercices).toEqual([EXERCICE]);
    expect(r.erreur).toBeNull();
  });

  it("distingue un fournisseur qui a refusé les outils d'un tuteur qui n'a rien proposé", async () => {
    /*
     * Les deux cas produisent zéro exercice, et rendaient le même message.
     * Ils n'appellent pourtant pas le même geste : reformuler la demande ne
     * réparera jamais un fournisseur qui n'a pas reçu `tools`. ADR-031 avait
     * fermé ce silence pour le chat en faisant porter `outils` par `fin` ;
     * les chemins sans conversation ne le lisaient pas.
     */
    const r = await genererExercices(
      moteurQuiEmet([
        { evenement: "texte", donnees: { delta: "Voici un exercice…" } },
        { evenement: "fin", donnees: { stopReason: "stop", outils: { actifs: false, appels: 0 } } },
      ]),
      REFERENTIEL,
      [{ competence: LOG_10, calibration: calibration() }],
    );
    expect(r.exercices).toEqual([]);
    expect(r.outilsActifs).toBe(false);
    expect(r.erreur).toContain("n'accepte pas les appels d'outil");
    expect(r.erreur).not.toContain("Aucun exercice exploitable");
  });

  it("ne signale pas de repli quand le moteur dit que les outils étaient actifs", async () => {
    const r = await genererExercices(
      moteurQuiEmet([
        { evenement: "fin", donnees: { stopReason: "stop", outils: { actifs: true, appels: 0 } } },
      ]),
      REFERENTIEL,
      [{ competence: LOG_10, calibration: calibration() }],
    );
    expect(r.outilsActifs).toBe(true);
    expect(r.erreur).toBe("Aucun exercice exploitable n'a été produit.");
  });

  it("présume les outils servis quand aucun `fin` exploitable n'arrive", async () => {
    // Une absence d'information n'est pas un `false` : accuser le fournisseur
    // sur un silence serait fabriquer un diagnostic (P2).
    const r = await genererExercices(
      moteurQuiEmet([{ evenement: "fin", donnees: { stopReason: "stop" } }]),
      REFERENTIEL,
      [{ competence: LOG_10, calibration: calibration() }],
    );
    expect(r.outilsActifs).toBe(true);
    expect(r.erreur).toBe("Aucun exercice exploitable n'a été produit.");
  });

  it("relaie les événements au fil de l'eau, pas seulement à la fin", async () => {
    // Sans ce relais, la modale restait figée jusqu'à 300 s puis recevait tout
    // d'un coup : le flux existait, la progression non.
    const vus: string[] = [];
    await genererExercices(
      moteurQuiEmet([
        { evenement: "proposition-en-cours", donnees: { outil: "proposer_exercice" } },
        { evenement: "proposition", donnees: { genre: "exercice", exercice: EXERCICE } },
      ]),
      REFERENTIEL,
      [{ competence: LOG_10, calibration: calibration() }],
      undefined,
      (evenement) => vus.push(evenement),
    );
    expect(vus).toEqual(["proposition-en-cours", "proposition"]);
  });
});
