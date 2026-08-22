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

import {
  construirePromptReferentiel as construirePromptReferentielBlocs,
  construirePromptSuggestion as construirePromptSuggestionBlocs,
  proposerReferentiel,
  resumerReferentielExistant,
  suggererBranche,
} from "./generation-referentiel";
import { OUTIL_REFERENTIEL_COMPLET, validerAppelOutil } from "./outils";
import type { Referentiel, Skill } from "@/lib/domain/types";
import { REFERENTIEL_VIDE } from "@/lib/domain/referentiel.fixture";
import type { MoteurTuteur } from "./moteurs";
import type { PropositionReferentiel } from "./proposition";
import { promptComplet } from "./prompt";

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


/*
 * Les constructeurs de prompt rendent désormais deux blocs — le préfixe stable
 * et la demande du moment (`PromptTuteur`). Ces tests portent sur le contenu
 * des consignes, pas sur le côté de la coupure où elles tombent : ils lisent
 * donc le prompt assemblé, comme un lecteur humain le lirait.
 */
const construirePromptSuggestion = (
  ...args: Parameters<typeof construirePromptSuggestionBlocs>
) => promptComplet(construirePromptSuggestionBlocs(...args));

const construirePromptReferentiel = (
  ...args: Parameters<typeof construirePromptReferentielBlocs>
) => promptComplet(construirePromptReferentielBlocs(...args));

describe("construirePromptSuggestion", () => {
  it("porte le sujet demandé tel qu'il a été écrit", () => {
    const prompt = construirePromptSuggestion(REFERENTIEL, "le stoïcisme");
    expect(prompt).toContain("Sujet demandé : le stoïcisme");
  });

  /*
   * La coupure elle-même. Le sujet est la seule chose qui change d'une
   * suggestion à l'autre : s'il regagnait le préfixe, `cacheLu` retomberait à
   * zéro sur ce chemin sans que rien d'autre ne tombe (ADR-097).
   */
  it("place le sujet demandé HORS du bloc stable", () => {
    const { stable, variable } = construirePromptSuggestionBlocs(REFERENTIEL, "l'épicurisme");
    expect(variable).toContain("l'épicurisme");
    expect(stable).not.toContain("l'épicurisme");
  });

  it("laisse le référentiel du compte dans le bloc stable — c'est lui qui ne bouge pas entre deux tours", () => {
    const { stable, variable } = construirePromptSuggestionBlocs(REFERENTIEL, "peu importe");
    expect(stable).toContain("logistique");
    expect(variable).not.toContain("logistique");
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
    expect(prompt).toContain("Aucun — le référentiel est vide");
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

/* ------------------------------------------------------------------ */
/* Le référentiel complet — plusieurs branches d'un seul geste          */
/* ------------------------------------------------------------------ */

const BRANCHE_VALIDE = {
  domaine: "Stoïcisme antique",
  prefixe: "STO",
  description: "Les sources et la dichotomie du contrôle.",
  competences: [
    { palier: "fondamentaux", importance: 0.8, verbeAction: "identifier", objet: "ce qui dépend de soi" },
  ],
  justification: "Demandé par l'utilisateur.",
};

describe("construirePromptReferentiel", () => {
  it("demande un découpage en branches quand le sujet le mérite", () => {
    // C'est la seule différence avec le prompt d'une branche, et elle change
    // tout : un sujet large forcé dans un domaine produit vingt compétences
    // que personne ne relit.
    const prompt = construirePromptReferentiel(REFERENTIEL, "le stoïcisme");
    expect(prompt).toContain("COMMENT DÉCOUPER");
    expect(prompt).toContain("Quatre à huit compétences par branche");
  });

  it("plafonne les domaines nouveaux quand le compte en a déjà (ADR-104)", () => {
    // Le défaut mesuré : « les LLM » avaient produit cinq domaines et
    // 40 compétences, aucune mesurée. Le prompt le dit, le schéma l'impose.
    const prompt = construirePromptReferentiel(REFERENTIEL, "les LLM");
    expect(prompt).toContain("domaines nouveaux au maximum");
    expect(prompt).toContain("Aucun thème persistant n'est créé");
  });

  it("ne plafonne pas l'amorçage d'un compte vide", () => {
    const vide = { ...REFERENTIEL, domaines: [] };
    const prompt = construirePromptReferentiel(vide, "les LLM");
    expect(prompt).toContain("Une branche par grand domaine");
    expect(prompt).not.toContain("domaines nouveaux au maximum");
  });

  it("porte les domaines déjà existants pour ne pas les redoubler", () => {
    const prompt = construirePromptReferentiel(REFERENTIEL, "le stoïcisme");
    expect(prompt).toContain("Logistique");
  });
  it("dit que le référentiel est vide plutôt que de laisser la liste blanche", () => {
    expect(construirePromptReferentiel(REFERENTIEL_VIDE, "x")).toContain(
      "Aucun — le référentiel est vide",
    );
  });

  it("cadre une vue d'ensemble débutante sans accepter une branche isolée", () => {
    const prompt = construirePromptReferentiel(
      REFERENTIEL_VIDE,
      "Je veux apprendre la physique, je suis un gros noob",
    );
    expect(prompt).toContain("vue d'ensemble pour débutant");
    expect(prompt).toContain("Ne réduis jamais cette demande à une seule compétence isolée");
  });

  it("n'autorise pas le tuteur à écrire un code", () => {
    expect(construirePromptReferentiel(REFERENTIEL, "le stoïcisme")).toContain(
      "L'application attribue",
    );
  });
});

describe("validerReferentielComplet — écarter n'est pas accepter à moitié", () => {
  it("rend plusieurs branches", () => {
    const recu = validerAppelOutil(OUTIL_REFERENTIEL_COMPLET, {
      resume: "Trois thèmes.",
      branches: [BRANCHE_VALIDE, { ...BRANCHE_VALIDE, domaine: "Stoïcisme moderne" }],
    });
    if (recu?.genre !== "referentiel-complet") throw new Error("genre inattendu");
    expect(recu.branches).toHaveLength(2);
    expect(recu.ecartees).toBe(0);
  });

  it("écarte une branche sans compétence et le COMPTE, sans jeter les autres", () => {
    /*
     * Divergence assumée avec la règle « refuser plutôt qu'accepter à moitié »
     * du reste du module. Elle tient à ce qu'est l'objet : les parties d'un
     * exercice forment UN objet — un demi-exercice n'en est pas un. Cinq
     * branches sont CINQ unités, relues et cochées séparément.
     *
     * La condition est que l'écart soit annoncé : une liste tronquée en
     * silence se lirait comme un corpus complet (ADR-036).
     */
    const recu = validerAppelOutil(OUTIL_REFERENTIEL_COMPLET, {
      resume: "Deux thèmes.",
      branches: [BRANCHE_VALIDE, { domaine: "Vide", competences: [] }],
    });
    if (recu?.genre !== "referentiel-complet") throw new Error("genre inattendu");
    expect(recu.branches).toHaveLength(1);
    expect(recu.ecartees).toBe(1);
  });

  it("rejette quand aucune branche n'est exploitable — il n'y a rien à relire", () => {
    expect(
      validerAppelOutil(OUTIL_REFERENTIEL_COMPLET, {
        resume: "x",
        branches: [{ domaine: "Vide", competences: [] }],
      }),
    ).toBeNull();
  });

  it("rejette un lot vide", () => {
    expect(validerAppelOutil(OUTIL_REFERENTIEL_COMPLET, { resume: "x", branches: [] })).toBeNull();
  });

  it("n'accepte aucun code dans une branche", () => {
    // Hérité de `validerReferentiel`, réutilisée telle quelle : une seule
    // définition de ce qu'est une branche recevable.
    const recu = validerAppelOutil(OUTIL_REFERENTIEL_COMPLET, {
      resume: "x",
      branches: [
        {
          ...BRANCHE_VALIDE,
          competences: [
            { palier: "avance", importance: 0.5, verbeAction: "décrire", objet: "une pratique méditative", code: "STO-99" },
          ],
        },
      ],
    });
    expect(JSON.stringify(recu)).not.toContain("STO-99");
  });
});

describe("proposerReferentiel", () => {
  it("distingue un fournisseur sans outils d'un tuteur muet", async () => {
    const r = await proposerReferentiel(
      moteurQuiEmet([
        { evenement: "fin", donnees: { stopReason: "stop", outils: { actifs: false, appels: 0 } } },
      ]),
      REFERENTIEL,
      "le stoïcisme",
    );
    expect(r.outilsActifs).toBe(false);
    expect(r.erreur).toContain("n'accepte pas les appels d'outil");
  });

  it("remonte le nombre de branches écartées jusqu'à l'appelant", async () => {
    const r = await proposerReferentiel(
      moteurQuiEmet([
        {
          evenement: "proposition",
          donnees: {
            genre: "referentiel-complet",
            resume: "Deux thèmes.",
            branches: [BRANCHE_VALIDE],
            ecartees: 2,
          },
        },
      ]),
      REFERENTIEL,
      "le stoïcisme",
    );
    expect(r.branches).toHaveLength(1);
    expect(r.ecartees).toBe(2);
    expect(r.erreur).toBeNull();
  });
});

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

describe("resumerReferentielExistant — ancrer la proposition dans ce qui existe", () => {
  it("liste chaque domaine actif avec son volume et un échantillon d'intitulés", () => {
    const resume = resumerReferentielExistant(REFERENTIEL);
    expect(resume).toContain("Logistique (LOG)");
    expect(resume).toContain("1 compétence active");
    expect(resume).toContain("« Analyser un flux logistique »");
  });

  it("ne liste pas un domaine sans compétence active", () => {
    // « dormant » n'a rien à alimenter : le proposer comme rattachement
    // enverrait la branche dans un domaine vide.
    const resume = resumerReferentielExistant(REFERENTIEL);
    expect(resume).not.toContain("Dormant");
  });

  it("dit que le référentiel est vide plutôt que de rendre une liste blanche", () => {
    expect(resumerReferentielExistant(REFERENTIEL_VIDE)).toContain(
      "Aucun — le référentiel est vide",
    );
  });

  it("plafonne l'échantillon d'intitulés par domaine", () => {
    const refDense = {
      domaines: [{ id: "d", nom: "Dense", prefixe: "DEN", description: "" }],
      actifs: Array.from({ length: 9 }, (_, i) => ({
        code: `DEN-0${i + 1}`,
        intitule: `Savoir-faire ${i + 1}`,
        domaine: "d",
      })),
    } as unknown as Referentiel;
    const resume = resumerReferentielExistant(refDense, 6);
    expect(resume).toContain("9 compétences actives");
    expect(resume).toContain("(+3 autres)");
    expect(resume).not.toContain("Savoir-faire 7 »");
  });
});
