/**
 * Ce que ces tests protègent.
 *
 * Ce module est le seul du système à mettre la correction d'un exercice dans un
 * prompt. L'exception à ADR-036 ne tient que si elle reste bornée — d'où deux
 * familles de tests :
 *
 * 1. **le prompt contient ce qu'il faut pour corriger** (énoncé, correction,
 *    critères numérotés, barème) et **dans les mêmes termes que l'écran**. Une
 *    échelle qui diverge de celle du formulaire ne lèverait aucune erreur : elle
 *    produirait une mesure fausse et silencieuse ;
 * 2. **rien ne fuit et rien n'est fabriqué** : aucun fragment de texte n'est
 *    relayé, aucune proposition d'un autre genre n'est prise pour un verdict, et
 *    un fournisseur sans outils se distingue d'un tuteur muet.
 */

import { describe, expect, it } from "vitest";

import {
  construirePromptCorrection as construirePromptCorrectionBlocs,
  corrigerReponse,
  reponseTropPauvrePourUneReussiteAutomatique,
} from "./correction";
import { RESULTATS } from "@/lib/domain/bilan";
import type { Exercise } from "@/lib/domain/types";
import type { MoteurTuteur } from "./moteurs";
import type { PropositionCorrection } from "./outils";
import { promptComplet } from "./prompt";

/* ------------------------------------------------------------------ */
/* Fixtures                                                            */
/* ------------------------------------------------------------------ */

const EXERCICE = {
  id: "ex-1",
  titre: "Calcul du stock de sécurité",
  enonce: "Une référence consomme 120 unités par semaine, écart-type 20, délai 2 semaines.",
  correction: "z × σ × √L, soit 1,65 × 20 × √2 ≈ 47 unités.",
  criteres: [
    { dimension: "application", libelle: "Applique la formule au bon horizon" },
    { dimension: "justification", libelle: "Justifie le niveau de service retenu" },
  ],
} as unknown as Exercise;

/**
 * La réponse de test ne doit être un fragment d'AUCUN texte du prompt.
 *
 * La première version disait « 47 unités. » — qui figure mot pour mot dans la
 * correction de référence. Le test « la réponse ne part pas dans le prompt
 * système » échouait alors sur une collision de fixture, pas sur un défaut.
 */
const REPONSE = "J'applique la racine du délai, puis j'arrondis au supérieur.";

const VERDICT: PropositionCorrection = {
  resultat: "partiel",
  appreciations: [
    { critere: "1", valeur: "1", justification: "La racine du délai est bien là." },
    { critere: "2", valeur: "0", justification: "Le 95 % est posé sans être justifié." },
  ],
  bilan: {
    pointsForts: "Tu poses la bonne méthode et tu la mènes jusqu'au bout.",
    pointsBloquants:
      "Le niveau de service est choisi sans motif : sans lui, le stock obtenu n'est pas défendable devant un tiers.",
    aRetravailler: ["Justifier le niveau de service retenu avant de calculer"],
  },
};

function moteurQuiEmet(evenements: { evenement: string; donnees: unknown }[]): MoteurTuteur {
  return {
    async repondre({ envoyer }: { envoyer: (e: string, d: unknown) => void }) {
      for (const e of evenements) envoyer(e.evenement, e.donnees);
    },
  } as unknown as MoteurTuteur;
}

/** Capture la demande passée au moteur, pour inspecter le prompt et les outils. */
function moteurQuiCapture(capture: { demande?: Record<string, unknown> }): MoteurTuteur {
  return {
    async repondre(demande: Record<string, unknown>) {
      capture.demande = demande;
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
const construirePromptCorrection = (
  ...args: Parameters<typeof construirePromptCorrectionBlocs>
) => promptComplet(construirePromptCorrectionBlocs(...args));

describe("construirePromptCorrection", () => {
  /*
   * La coupure elle-même. Énoncé, correction et critères changent à chaque
   * correction : dans le bloc stable, ils cassaient le préfixe mis en cache —
   * sur ce chemin, le plus long, que le cache aurait le plus à donner (ADR-097).
   */
  it("place énoncé, correction de référence et critères HORS du bloc stable", () => {
    const { stable, variable } = construirePromptCorrectionBlocs(EXERCICE);
    expect(variable).toContain("Une référence consomme 120 unités");
    expect(variable).toContain("1,65 × 20 × √2");
    expect(stable).not.toContain("Une référence consomme 120 unités");
    expect(stable).not.toContain("1,65 × 20 × √2");
    expect(stable).not.toContain("Applique la formule au bon horizon");
  });

  it("laisse barème et consignes dans le bloc stable — c'est ce qui ne change jamais", () => {
    const { stable } = construirePromptCorrectionBlocs(EXERCICE);
    expect(stable).toContain("BARÈME PAR CRITÈRE");
    expect(stable).toContain("TU N'ENREGISTRES RIEN.");
  });

  it("porte l'énoncé et la correction de référence", () => {
    // C'est l'exception à ADR-036, assumée : sans la correction, le tuteur ne
    // corrigerait pas, il improviserait un barème.
    const prompt = construirePromptCorrection(EXERCICE);
    expect(prompt).toContain("Une référence consomme 120 unités");
    expect(prompt).toContain("1,65 × 20 × √2");
  });

  it("numérote les critères de 1 à n avec leur dimension", () => {
    // La numérotation du prompt est le contrat que `convertirCorrection`
    // rebascule en index 0. Si elle partait de 0 ici, tout décalerait d'un cran.
    const prompt = construirePromptCorrection(EXERCICE);
    expect(prompt).toContain("1. Applique la formule au bon horizon — dimension : Application");
    expect(prompt).toContain("2. Justifie le niveau de service retenu — dimension : Justification");
  });

  it("porte le barème dans les mêmes termes que le formulaire", () => {
    /*
     * `lib/domain/bilan.ts` est la source unique. L'assertion sur les résultats
     * porte sur le texte réel de la constante : si quelqu'un change un libellé
     * côté écran, ce test le suit ; si quelqu'un désynchronise le prompt, il casse.
     */
    const prompt = construirePromptCorrection(EXERCICE);
    expect(prompt).toContain("0 = Non");
    expect(prompt).toContain("0.5 = En partie");
    expect(prompt).toContain("1 = Oui");
    for (const r of RESULTATS) {
      expect(prompt).toContain(`${r.valeur} = ${r.aide}`);
    }
  });

  it("interdit explicitement de recopier la correction dans les justifications", () => {
    // La borne de confinement est double : ce rappel, et `JUSTIFICATION_MAX`
    // côté validateur. La phrase seule ne suffirait pas.
    expect(construirePromptCorrection(EXERCICE)).toContain("ne la recopie pas");
  });

  it("dit que le tuteur n'enregistre rien", () => {
    expect(construirePromptCorrection(EXERCICE)).toContain("TU N'ENREGISTRES RIEN");
  });

  it("demande de juger ce que la réponse contient", () => {
    // Un correcteur qui complète ce qu'il devine de l'intention note une
    // compétence qu'il a lui-même fournie.
    expect(construirePromptCorrection(EXERCICE)).toContain(
      "Ce qui n'y figure pas n'est pas démontré",
    );
  });
});

/* ------------------------------------------------------------------ */
/* La demande passée au moteur                                         */
/* ------------------------------------------------------------------ */

describe("corrigerReponse — ce qui part au moteur", () => {
  it("n'arme qu'un seul outil, et pas ceux du chat", async () => {
    // Sans cela, une correction pourrait déraper en création d'exercice ou en
    // proposition de branche — des écritures que ce chemin n'a pas à ouvrir.
    const capture: { demande?: Record<string, unknown> } = {};
    await corrigerReponse(moteurQuiCapture(capture), EXERCICE, REPONSE);
    const outils = capture.demande?.outils as { nom: string }[];
    expect(outils.map((o) => o.nom)).toEqual(["proposer_correction"]);
  });

  it("met la réponse dans le message, pas dans le prompt système", async () => {
    // Le prompt système est le préfixe mis en cache : y glisser une valeur qui
    // change à chaque appel casserait le cache, et coûterait à chaque bilan.
    const capture: { demande?: Record<string, unknown> } = {};
    await corrigerReponse(moteurQuiCapture(capture), EXERCICE, REPONSE);
    const messages = capture.demande?.messages as { content: string }[];
    expect(messages[0].content).toContain(REPONSE);
    expect(capture.demande?.systemeStable).not.toContain(REPONSE);
  });

  it("n'envoie aucun historique de conversation", async () => {
    // Quatrième verrou : un seul message, construit côté serveur.
    const capture: { demande?: Record<string, unknown> } = {};
    await corrigerReponse(moteurQuiCapture(capture), EXERCICE, REPONSE);
    expect((capture.demande?.messages as unknown[]).length).toBe(1);
  });
});

/* ------------------------------------------------------------------ */
/* La collecte                                                         */
/* ------------------------------------------------------------------ */

describe("corrigerReponse — rien n'est fabriqué", () => {
  it("ne laisse pas une suite de lettres hors sujet devenir une réussite", async () => {
    const r = await corrigerReponse(
      moteurQuiEmet([
        { evenement: "proposition", donnees: { genre: "correction", correction: { ...VERDICT, resultat: "reussi" } } },
      ]),
      EXERCICE,
      "hhjklmlkm",
    );
    expect(r.correction).toBeNull();
    expect(r.erreur).toContain("trop pauvre");
  });

  it("n'applique pas cette barrière à une réponse qui reprend le vocabulaire du sujet", () => {
    expect(
      reponseTropPauvrePourUneReussiteAutomatique("stock", EXERCICE),
    ).toBe(false);
  });

  it("retient un verdict validé et ne signale aucune erreur", async () => {
    const r = await corrigerReponse(
      moteurQuiEmet([
        { evenement: "proposition", donnees: { genre: "correction", correction: VERDICT } },
      ]),
      EXERCICE,
      REPONSE,
    );
    expect(r.correction).toEqual(VERDICT);
    expect(r.erreur).toBeNull();
  });

  it("ne rend aucune correction, et le dit, quand le moteur n'appelle aucun outil", async () => {
    const r = await corrigerReponse(
      moteurQuiEmet([{ evenement: "texte", donnees: { delta: "Ta réponse est bonne." } }]),
      EXERCICE,
      REPONSE,
    );
    expect(r.correction).toBeNull();
    expect(r.erreur).toBe("Le tuteur n'a produit aucune correction exploitable.");
  });

  it("ne prend pas une proposition d'un autre genre pour une correction", async () => {
    const r = await corrigerReponse(
      moteurQuiEmet([
        { evenement: "proposition", donnees: { genre: "exercice", exercice: { titre: "X" } } },
      ]),
      EXERCICE,
      REPONSE,
    );
    expect(r.correction).toBeNull();
    expect(r.erreur).not.toBeNull();
  });

  it("ne relaie AUCUN fragment de texte", async () => {
    /*
     * Deux raisons. La duplication observée sur Mistral (ADR-031) — le tuteur
     * écrivait l'exercice en prose ET dans l'appel d'outil. Et surtout : ce
     * texte-là peut contenir la correction de référence, que l'utilisateur n'a
     * pas forcément demandé à voir.
     */
    const vus: string[] = [];
    await corrigerReponse(
      moteurQuiEmet([
        { evenement: "texte", donnees: { delta: "z × σ × √L ≈ 47" } },
        { evenement: "proposition-en-cours", donnees: { outil: "proposer_correction" } },
        { evenement: "proposition", donnees: { genre: "correction", correction: VERDICT } },
      ]),
      EXERCICE,
      REPONSE,
      undefined,
      (evenement) => vus.push(evenement),
    );
    expect(vus).toEqual(["proposition-en-cours", "proposition"]);
  });

  it("distingue un fournisseur sans outils d'un tuteur muet", async () => {
    const r = await corrigerReponse(
      moteurQuiEmet([
        { evenement: "fin", donnees: { stopReason: "stop", outils: { actifs: false, appels: 0 } } },
      ]),
      EXERCICE,
      REPONSE,
    );
    expect(r.outilsActifs).toBe(false);
    expect(r.erreur).toContain("n'accepte pas les appels d'outil");
  });
});
