/**
 * Ce que ces tests protègent.
 *
 * `suggererBranche` est le pendant de `genererExercices` pour le référentiel :
 * même moteur, même validation, un `envoyer` qui collecte au lieu de diffuser.
 * Il n'avait aucun test — les 335 d'alors couvraient le prompt d'exercice mais
 * pas celui de branche.
 *
 * Le cas central est le dernier : « aucune branche exploitable » recouvrait
 * deux pannes que rien ne distinguait — un tuteur muet, et un fournisseur qui
 * n'a jamais reçu `tools`. La première se relance en reformulant, la seconde
 * pas du tout.
 */

import { describe, expect, it } from "vitest";

import { construirePromptSuggestion, suggererBranche } from "./generation-referentiel";
import type { Referentiel, Skill } from "@/lib/domain/types";
import type { MoteurTuteur } from "./moteurs";
import type { PropositionReferentiel } from "./proposition";

/* ------------------------------------------------------------------ */
/* Fixtures                                                            */
/* ------------------------------------------------------------------ */

const LOG_10 = {
  code: "LOG-10",
  intitule: "Analyser un flux logistique",
  domaine: "logistique",
} as unknown as Skill;

const REFERENTIEL: Referentiel = {
  domaines: [
    { id: "logistique", nom: "Logistique", prefixe: "LOG", description: "" },
    { id: "dormant", nom: "Dormant", prefixe: "DOR", description: "" },
  ],
  skills: [LOG_10],
  actifs: [LOG_10],
} as unknown as Referentiel;

const REFERENTIEL_VIDE: Referentiel = {
  domaines: [],
  skills: [],
  actifs: [],
} as unknown as Referentiel;

const BRANCHE = {
  domaine: "Stoïcisme",
  competences: [{ intitule: "Distinguer ce qui dépend de soi", palier: "fondamentaux" }],
} as unknown as PropositionReferentiel;

/**
 * Un moteur de test qui rejoue une suite d'événements figée — même contrat
 * que celui de `generation.test.ts`.
 */
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

describe("construirePromptSuggestion", () => {
  it("porte le sujet demandé tel qu'il a été écrit", () => {
    const prompt = construirePromptSuggestion(REFERENTIEL, "le stoïcisme");
    expect(prompt).toContain("Sujet demandé : le stoïcisme");
  });

  it("ne liste que les domaines qui portent une compétence active", () => {
    // « dormant » n'a aucune compétence active : le proposer comme rattachement
    // enverrait la branche dans un domaine que rien n'alimente.
    const prompt = construirePromptSuggestion(REFERENTIEL, "le stoïcisme");
    expect(prompt).toContain("logistique");
    expect(prompt).not.toContain("dormant");
  });

  it("dit qu'il n'y a aucun domaine plutôt que d'en inventer un", () => {
    const prompt = construirePromptSuggestion(REFERENTIEL_VIDE, "le stoïcisme");
    expect(prompt).toContain("aucun");
  });

  it("n'autorise pas le tuteur à écrire un code", () => {
    // ADR-026/031 : le schéma le rend inexprimable, le prompt ne doit pas
    // laisser croire l'inverse en parlant de codes.
    const prompt = construirePromptSuggestion(REFERENTIEL, "le stoïcisme");
    expect(prompt).not.toMatch(/\bcodes?\b/i);
  });
});

/* ------------------------------------------------------------------ */
/* La collecte                                                         */
/* ------------------------------------------------------------------ */

describe("suggererBranche — rien n'est fabriqué", () => {
  it("retient une branche validée et ne signale aucune erreur", async () => {
    const r = await suggererBranche(
      moteurQuiEmet([
        { evenement: "proposition", donnees: { genre: "referentiel", branche: BRANCHE } },
      ]),
      REFERENTIEL,
      "le stoïcisme",
    );
    expect(r.branche).toEqual(BRANCHE);
    expect(r.erreur).toBeNull();
  });

  it("ne prend pas une proposition d'un autre genre pour une branche", async () => {
    // Le même canal porte les exercices. Collecter sur le seul nom de
    // l'événement écrirait un exercice dans le référentiel.
    const r = await suggererBranche(
      moteurQuiEmet([
        { evenement: "proposition", donnees: { genre: "exercice", exercice: { titre: "X" } } },
      ]),
      REFERENTIEL,
      "le stoïcisme",
    );
    expect(r.branche).toBeNull();
    expect(r.erreur).toBe("Aucune branche exploitable n'a été produite.");
  });

  it("distingue un fournisseur qui a refusé les outils d'un tuteur qui n'a rien proposé", async () => {
    const r = await suggererBranche(
      moteurQuiEmet([
        { evenement: "texte", donnees: { delta: "Voici une branche…" } },
        { evenement: "fin", donnees: { stopReason: "stop", outils: { actifs: false, appels: 0 } } },
      ]),
      REFERENTIEL,
      "le stoïcisme",
    );
    expect(r.branche).toBeNull();
    expect(r.outilsActifs).toBe(false);
    expect(r.erreur).toContain("n'accepte pas les appels d'outil");
    expect(r.erreur).not.toContain("Aucune branche exploitable");
  });

  it("ne signale pas de repli quand le moteur dit que les outils étaient actifs", async () => {
    const r = await suggererBranche(
      moteurQuiEmet([
        { evenement: "fin", donnees: { stopReason: "stop", outils: { actifs: true, appels: 0 } } },
      ]),
      REFERENTIEL,
      "le stoïcisme",
    );
    expect(r.outilsActifs).toBe(true);
    expect(r.erreur).toBe("Aucune branche exploitable n'a été produite.");
  });

  it("relaie les événements au fil de l'eau", async () => {
    // La modale écoute `proposition-en-cours` pour ne pas rester sur un écran
    // figé : un appel d'outil n'émet aucun texte, donc la rédaction — la partie
    // la plus longue du tour — ne produisait rien de visible.
    const vus: string[] = [];
    await suggererBranche(
      moteurQuiEmet([
        { evenement: "proposition-en-cours", donnees: { outil: "proposer_referentiel" } },
        { evenement: "proposition", donnees: { genre: "referentiel", branche: BRANCHE } },
      ]),
      REFERENTIEL,
      "le stoïcisme",
      undefined,
      (evenement) => vus.push(evenement),
    );
    expect(vus).toEqual(["proposition-en-cours", "proposition"]);
  });
});
