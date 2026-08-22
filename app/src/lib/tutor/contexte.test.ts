import { describe, expect, it } from "vitest";
import {
  construireContexte,
  fautChargerProtocoleReferentiel,
  fautChargerSyntheseEvaluation,
} from "./contexte";
import { fenetrerHistorique, MAX_MESSAGES_FENETRE } from "./fenetre";
import { DOMAINES_TEST, REFERENTIEL_TEST, REFERENTIEL_VIDE } from "@/lib/domain/referentiel.fixture";
import { computeAllSkillStates } from "@/lib/engine/skill-state";
import { OUTIL_REFERENTIEL } from "./outils";
import { calculerEtatGlobal } from "@/lib/engine/progression";
import { recommander } from "@/lib/engine/recommend";
import { calibrerToutes } from "@/lib/engine/calibration";
import { evaluerMaitrises } from "@/lib/engine/maitrise";
import type { Contexte } from "@/lib/store/context";
import type { Exercise, ExerciseAttempt } from "@/lib/domain/types";
import { adaptLegacyActivities } from "@/lib/domain/legacy-activity-adapter";
import {
  construireCarteIndividuelle,
  construireEspaceActif,
} from "@/lib/engine/vues-twiny";

/*
 * ADR-021 : le protocole d'évaluation complet (§12-17 — score macro,
 * robustesse, synthèse périodique, priorisation, format de bilan) n'est
 * chargé que sur signal de synthèse probable, pour économiser des tokens sur
 * les moteurs à petite fenêtre de contexte. §1-11 restent toujours chargés
 * (non couverts ici, chargés inconditionnellement dans `construireContexte`).
 *
 * Deux déclencheurs indépendants : un mot-clé dans le dernier message, ou une
 * cadence de secours qui revient périodiquement même sans mot-clé reconnu —
 * pour qu'une formulation imprévue ne prive jamais durablement le tuteur du
 * protocole complet.
 */

describe("fautChargerSyntheseEvaluation", () => {
  it("ne charge pas le protocole complet sur un message ordinaire", () => {
    expect(fautChargerSyntheseEvaluation("Peux-tu m'expliquer la récursivité ?", 1)).toBe(false);
    expect(fautChargerSyntheseEvaluation("J'ai une erreur dans mon code, aide-moi", 3)).toBe(false);
  });

  it("charge le protocole complet sur un mot-clé de synthèse", () => {
    expect(fautChargerSyntheseEvaluation("Tu peux me faire un bilan ?", 2)).toBe(true);
    expect(fautChargerSyntheseEvaluation("Où j'en suis sur DEV-03 ?", 2)).toBe(true);
    expect(fautChargerSyntheseEvaluation("Quelle est ma prochaine priorité ?", 2)).toBe(true);
  });

  it("ignore la casse et les accents du mot-clé", () => {
    expect(fautChargerSyntheseEvaluation("BILAN stp", 2)).toBe(true);
    expect(fautChargerSyntheseEvaluation("un petit RÉSUMÉ ?", 2)).toBe(true);
  });

  it("revient au protocole complet par cadence, même sans mot-clé", () => {
    expect(fautChargerSyntheseEvaluation("continue", 5)).toBe(true);
    expect(fautChargerSyntheseEvaluation("continue", 10)).toBe(true);
    expect(fautChargerSyntheseEvaluation("continue", 4)).toBe(false);
    expect(fautChargerSyntheseEvaluation("continue", 6)).toBe(false);
  });

  it("ne déclenche pas la cadence au tour zéro", () => {
    expect(fautChargerSyntheseEvaluation("bonjour", 0)).toBe(false);
  });
});

function construireCtxDeTest(
  referentiel = REFERENTIEL_TEST,
  corpus: { exercises?: Exercise[]; attempts?: ExerciseAttempt[] } = {},
): Contexte {
  const now = new Date("2026-07-29T10:00:00.000Z");
  const exercises = corpus.exercises ?? [];
  const attempts = corpus.attempts ?? [];
  const etats = computeAllSkillStates(referentiel.actifs, [], now);
  const global = calculerEtatGlobal(etats, now, DOMAINES_TEST);
  const calibrations = calibrerToutes(etats, exercises, attempts);
  const recommandations = recommander(etats, exercises, attempts, 5, calibrations);
  const carteIndividuelle = construireCarteIndividuelle(etats);
  const espaceActif = construireEspaceActif({ carte: carteIndividuelle, recommandations });
  return {
    referentiel,
    calibrations,
    maitrises: evaluerMaitrises(etats),
    exercicesActifs: exercises.filter((e) => !e.archive),
    dureesEstimees: new Map(exercises.map((e) => [e.id, e.dureeEstimeeMin])),
    donnees: {
      user: {
        id: "test",
        prenom: "Test",
        formation: "BUT QLIO",
        objectifMoyenTerme: "Objectif à moyen terme à renseigner",
        objectifLongTerme: "Objectif à long terme à renseigner",
        debutSuivi: now.toISOString(),
      },
      observations: [],
      exercises,
      attempts,
      sessions: [],
      refusRecommandations: [],
      engagements: [],
    },
    etats,
    etatsParCode: new Map(etats.map((e) => [e.skill.code, e])),
    global,
    recommandations,
    carteIndividuelle,
    espaceActif,
    contexteDocumentaire: new Map(),
    observationsEffectives: [],
    now,
    refus: { codes: new Set(), exercices: new Set() },
    adaptiveLegacy: adaptLegacyActivities("test", exercises, attempts),
  };
}

function exerciceDeTest(options: Partial<Exercise> = {}): Exercise {
  return {
    id: "ex-1",
    titre: "Dérouler un pipeline de fonctions pures",
    domaine: "developpement",
    type: "application",
    difficulte: 2,
    competences: ["DEV-01"],
    dureeEstimeeMin: 25,
    enonce: "ÉNONCÉ-TÉMOIN : calcule le résultat de map puis filter.",
    indices: ["indice 1", "indice 2", "indice 3"],
    correction: "CORRECTION-TÉMOIN : le résultat est [4, 8].",
    criteres: [],
    origine: "tuteur",
    ...options,
  };
}

function tentativeDeTest(options: Partial<ExerciseAttempt> = {}): ExerciseAttempt {
  return {
    id: "at-1",
    exerciseId: "ex-1",
    debut: "2026-07-29T09:00:00.000Z",
    indicesUtilises: 1,
    reponse: "",
    evaluation: {},
    resultat: "partiel",
    statut: "en-cours",
    ...options,
  };
}

/*
 * Le tuteur ne voyait ni le corpus ni l'exercice ouvert : `contexte.ts`
 * n'ouvrait ni `donnees.exercises` ni `donnees.attempts`, alors que les deux
 * étaient dans `Contexte`. D'où deux exercices quasi identiques produits sur
 * LOG-10, et l'obligation de recoller un énoncé à la main pour demander de
 * l'aide dessus.
 */
describe("construireContexte — corpus et exercice en cours", () => {
  it("dit franchement qu'il n'y a aucun exercice, plutôt que de taire le bloc", async () => {
    const p = await construireContexte(construireCtxDeTest());
    expect(p.systemeProfil).toContain("Aucun exercice dans la bibliothèque");
    expect(p.systemeProfil).toContain("Aucun exercice ouvert");
    expect(p.manifeste.map((s) => s.nom)).toContain("Exercices existants");
  });

  it("liste les titres existants pour que le tuteur n'en refasse pas un doublon", async () => {
    const p = await construireContexte(
      construireCtxDeTest(REFERENTIEL_TEST, { exercises: [exerciceDeTest()] }),
    );
    expect(p.systemeProfil).toContain("Dérouler un pipeline de fonctions pures");
    expect(p.systemeProfil).toContain("NE PROPOSE PAS");
  });

  it("ne transmet PAS les énoncés du corpus — c'est le budget de contexte", async () => {
    // La règle qui protège le coût par message : trente titres coûtent quelques
    // centaines de jetons, trente énoncés en coûteraient des dizaines de
    // milliers. Seul l'exercice OUVERT donne son énoncé (test suivant).
    const p = await construireContexte(
      construireCtxDeTest(REFERENTIEL_TEST, { exercises: [exerciceDeTest()] }),
    );
    expect(p.systemeProfil).not.toContain("ÉNONCÉ-TÉMOIN");
  });

  it("écarte les exercices archivés du corpus annoncé", async () => {
    const p = await construireContexte(
      construireCtxDeTest(REFERENTIEL_TEST, {
        exercises: [exerciceDeTest({ archive: true })],
      }),
    );
    expect(p.systemeProfil).toContain("Aucun exercice dans la bibliothèque");
  });

  it("transmet l'énoncé et le brouillon de l'exercice ouvert", async () => {
    const p = await construireContexte(
      construireCtxDeTest(REFERENTIEL_TEST, {
        exercises: [exerciceDeTest()],
        attempts: [tentativeDeTest({ reponse: "BROUILLON-TÉMOIN : je bloque sur filter." })],
      }),
    );
    expect(p.systemeProfil).toContain("ÉNONCÉ-TÉMOIN");
    expect(p.systemeProfil).toContain("BROUILLON-TÉMOIN");
    expect(p.systemeProfil).toContain("Indices consultés : 1 sur 3");
  });

  it("ne transmet JAMAIS la correction — le tuteur la recopierait sur demande", async () => {
    const p = await construireContexte(
      construireCtxDeTest(REFERENTIEL_TEST, {
        exercises: [exerciceDeTest()],
        attempts: [tentativeDeTest()],
      }),
    );
    expect(p.systemeProfil).not.toContain("CORRECTION-TÉMOIN");
  });

  it("suit l'exercice explicitement ciblé, même sans tentative ouverte", async () => {
    const p = await construireContexte(
      construireCtxDeTest(REFERENTIEL_TEST, { exercises: [exerciceDeTest()] }),
      [],
      "ex-1",
    );
    expect(p.systemeProfil).toContain("ÉNONCÉ-TÉMOIN");
  });

  it("un identifiant inconnu ne fabrique aucun exercice", async () => {
    const p = await construireContexte(construireCtxDeTest(), [], "ex-inexistant");
    expect(p.systemeProfil).toContain("Aucun exercice ouvert");
  });
});

/* ------------------------------------------------------------------ */
/* Trajectoire (ADR-046) — l'histoire, et la frontière                 */
/* ------------------------------------------------------------------ */

/** Deux tentatives closes sur DEV-01, la seconde portant un verdict archivé. */
function corpusAvecHistorique() {
  const verdict = {
    resultat: "partiel",
    appreciations: { 0: 0.5 },
    justifications: { 0: "JUSTIFICATION-TÉMOIN" },
    bilan: {
      pointsForts: "FORTS-TÉMOIN",
      pointsBloquants: "BLOQUANTS-TÉMOIN",
      aRetravailler: ["RETRAVAILLER-TÉMOIN : confond map et filter"],
    },
    date: "2026-07-28T10:00:00.000Z",
  };
  return {
    exercises: [exerciceDeTest()],
    attempts: [
      tentativeDeTest({
        id: "at-vieux",
        debut: "2026-07-20T09:00:00.000Z",
        fin: "2026-07-20T09:30:00.000Z",
        dureeMin: 30,
        statut: "terminee",
        resultat: "echec",
      }),
      tentativeDeTest({
        id: "at-recent",
        debut: "2026-07-28T09:00:00.000Z",
        fin: "2026-07-28T09:20:00.000Z",
        dureeMin: 20,
        statut: "terminee",
        resultat: "partiel",
        verdictTuteur: verdict,
      }),
    ],
  };
}

describe("serialiserTrajectoire — le temps entre dans le contexte", () => {
  it("transmet la suite des tentatives et les points relevés", async () => {
    const p = await construireContexte(construireCtxDeTest(REFERENTIEL_TEST, corpusAvecHistorique()));

    expect(p.systemeProfil).toContain("# TRAJECTOIRE");
    // La suite chronologique : c'est elle qui permet de dire « ça revient ».
    expect(p.systemeProfil).toContain("echec en 30 min");
    expect(p.systemeProfil).toContain("partiel en 20 min");
    expect(p.systemeProfil).toContain("RETRAVAILLER-TÉMOIN");
    expect(p.manifeste.some((s) => s.nom === "Trajectoire")).toBe(true);
  });

  /*
   * ⚠️ LE test de ce lot.
   *
   * `pointsForts` et `pointsBloquants` sont rédigés par le tuteur avec la
   * correction sous les yeux, sur le chemin confiné de `correction.ts`. Les
   * faire remonter dans le contexte du CHAT rouvrirait l'exception qu'ADR-036
   * borne — un tunnel, pas une fenêtre. Seul `aRetravailler` franchit.
   */
  it("ne fait JAMAIS remonter la prose du verdict dans le contexte du chat", async () => {
    const p = await construireContexte(construireCtxDeTest(REFERENTIEL_TEST, corpusAvecHistorique()));

    expect(p.systemeProfil).not.toContain("FORTS-TÉMOIN");
    expect(p.systemeProfil).not.toContain("BLOQUANTS-TÉMOIN");
    expect(p.systemeProfil).not.toContain("JUSTIFICATION-TÉMOIN");
    expect(p.systemeProfil).not.toContain("CORRECTION-TÉMOIN");
    // Et ce qui a le droit de passer y est bien.
    expect(p.systemeProfil).toContain("RETRAVAILLER-TÉMOIN");
  });

  it("n'écrit aucun bloc quand il n'y a pas encore d'histoire", async () => {
    // Un bloc « TRAJECTOIRE » vide se lirait comme « aucun motif observé », qui
    // est une affirmation. L'absence de mesure n'est pas une mesure (P2).
    const p = await construireContexte(construireCtxDeTest());
    expect(p.systemeProfil).not.toContain("# TRAJECTOIRE");
    expect(p.manifeste.some((s) => s.nom === "Trajectoire")).toBe(false);
  });

  it("ignore une tentative encore ouverte — elle n'a pas de verdict", async () => {
    const p = await construireContexte(
      construireCtxDeTest(REFERENTIEL_TEST, {
        exercises: [exerciceDeTest()],
        attempts: [tentativeDeTest()],
      }),
    );
    expect(p.systemeProfil).not.toContain("# TRAJECTOIRE");
  });

  it("part aussi en aide sur exercice — « tu avais déjà buté là-dessus »", async () => {
    const p = await construireContexte(
      construireCtxDeTest(REFERENTIEL_TEST, corpusAvecHistorique()),
      [],
      "ex-1",
    );
    expect(p.systemeProfil).toContain("# TRAJECTOIRE");
    // Le corpus et les priorités, eux, restent omis sur ce chemin.
    expect(p.systemeProfil).not.toContain("# EXERCICES EXISTANTS");
  });
});

/*
 * Aider sur un exercice ouvert n'est pas la même conversation que choisir quoi
 * faire ensuite.
 *
 * `exerciceId` ne vient que de l'interface de résolution. Le catalogue (jusqu'à
 * 60 lignes, dont l'unique raison d'être est d'empêcher un doublon) et les
 * priorités du moteur n'y servent aucune réponse possible — et repartaient à
 * chaque message.
 */
describe("construireContexte — contexte allégé quand un exercice est ouvert", () => {
  it("omet le catalogue et les priorités, et le manifeste ne les annonce pas", async () => {
    const ctx = construireCtxDeTest(REFERENTIEL_TEST, {
      exercises: [exerciceDeTest(), exerciceDeTest({ id: "ex-2", titre: "AUTRE-EXERCICE" })],
      attempts: [tentativeDeTest()],
    });

    const aide = await construireContexte(ctx, [{ role: "user", content: "Je bloque" }], "ex-1");
    expect(aide.systemeProfil).not.toContain("AUTRE-EXERCICE");
    expect(aide.systemeProfil).not.toContain("PRIORITÉS CALCULÉES");
    const noms = aide.manifeste.map((s) => s.nom);
    expect(noms).not.toContain("Exercices existants");
    expect(noms).not.toContain("Priorités calculées");

    // Ce qui reste : l'énoncé, et de quoi calibrer le grain de l'aide.
    expect(aide.systemeProfil).toContain("ÉNONCÉ-TÉMOIN");
    expect(noms).toContain("État courant des compétences");
    expect(noms).toContain("Travail récent");
    expect(noms).toContain("Calibrage du prochain exercice");
  });

  it("hors exercice ouvert, les deux blocs repartent — c'est là qu'ils servent", async () => {
    const ctx = construireCtxDeTest(REFERENTIEL_TEST, {
      exercises: [exerciceDeTest({ id: "ex-2", titre: "AUTRE-EXERCICE" })],
    });
    const chat = await construireContexte(ctx, [{ role: "user", content: "Et maintenant ?" }]);
    expect(chat.systemeProfil).toContain("AUTRE-EXERCICE");
    expect(chat.manifeste.map((s) => s.nom)).toContain("Priorités calculées");
  });

  it("un exercice ouvert impose la gradation, que la concision contredisait", async () => {
    const p = await construireContexte(
      construireCtxDeTest(REFERENTIEL_TEST, {
        exercises: [exerciceDeTest()],
        attempts: [tentativeDeTest()],
      }),
    );
    expect(p.systemeProfil).toContain("AIDE PAS À PAS");

    // Aucun exercice ouvert : la consigne n'a pas de raison d'être là.
    const sansExercice = await construireContexte(construireCtxDeTest());
    expect(sansExercice.systemeProfil).not.toContain("AIDE PAS À PAS");
  });
});

/*
 * Vérifie le comportement bout en bout de `construireContexte` (jamais
 * exercé avant ADR-021) : sans historique transmis, le protocole complet est
 * chargé par prudence ; avec un historique, l'heuristique décide, et le
 * manifeste — la seule garantie de transparence envers l'utilisateur sur ce
 * que le tuteur a réellement reçu — le reflète fidèlement.
 */
describe("construireContexte — chargement conditionnel (ADR-021)", () => {
  it("charge le protocole complet par défaut, sans historique (GET, copier le contexte)", async () => {
    const pedagogique = await construireContexte(construireCtxDeTest());
    const noms = pedagogique.manifeste.map((s) => s.nom);
    expect(noms).toContain("Protocole d'évaluation (essentiel)");
    expect(noms).toContain("Protocole d'évaluation (complet)");
  });

  it("n'ajoute pas le protocole complet sur un message ordinaire", async () => {
    const pedagogique = await construireContexte(construireCtxDeTest(), [
      { role: "user", content: "Peux-tu corriger cet exercice ?" },
    ]);
    const noms = pedagogique.manifeste.map((s) => s.nom);
    expect(noms).toContain("Protocole d'évaluation (essentiel)");
    expect(noms).not.toContain("Protocole d'évaluation (complet)");
  });

  it("ajoute le protocole complet sur une demande de bilan", async () => {
    const pedagogique = await construireContexte(construireCtxDeTest(), [
      { role: "user", content: "Fais-moi un bilan de ma progression" },
    ]);
    const noms = pedagogique.manifeste.map((s) => s.nom);
    expect(noms).toContain("Protocole d'évaluation (complet)");
  });

  /*
   * Non-régression : `construireContexte` doit recevoir l'historique COMPLET,
   * jamais la fenêtre d'envoi (`fenetrerHistorique`). Passer la fenêtre
   * plafonnerait `messages.length` à sa taille, et la cadence de secours —
   * qui se compte en tours réellement échangés — ne se déclencherait plus
   * jamais sur une longue conversation, ou se déclencherait à chaque message
   * si ce plafond tombait sur un multiple de la cadence. Dans les deux cas le
   * garde-fou d'ADR-021 est perdu en silence.
   */
  it("garde une cadence juste sur une conversation plus longue que la fenêtre d'envoi", async () => {
    const conversation = construireConversation(45);
    expect(conversation.length).toBeGreaterThan(MAX_MESSAGES_FENETRE);
    expect(conversation.length % 5).toBe(0); // tombe sur la cadence

    const pedagogique = await construireContexte(construireCtxDeTest(), conversation);
    const noms = pedagogique.manifeste.map((s) => s.nom);
    expect(noms).toContain("Protocole d'évaluation (complet)");

    // Le tour suivant, hors cadence, ne doit pas le recharger.
    const horsCadence = construireConversation(46);
    const suivant = await construireContexte(construireCtxDeTest(), horsCadence);
    expect(suivant.manifeste.map((s) => s.nom)).not.toContain(
      "Protocole d'évaluation (complet)",
    );
  });
});

/** Conversation ordinaire de `n` messages, sans aucun mot-clé de synthèse. */
function construireConversation(n: number): { role: "user" | "assistant"; content: string }[] {
  return Array.from({ length: n }, (_, i) => ({
    role: i % 2 === 0 ? ("user" as const) : ("assistant" as const),
    content: `Message ordinaire numero ${i}`,
  }));
}

/*
 * La fenêtre d'envoi borne le payload transmis au fournisseur. Elle est
 * testée ici parce qu'elle a deux propriétés que rien d'autre ne garantit :
 * elle conserve l'intention initiale de la séance, et elle ne laisse jamais
 * une réponse du tuteur sans la question qui l'a produite.
 */
describe("fenetrerHistorique", () => {
  it("ne touche pas une conversation courte", () => {
    const messages = construireConversation(4);
    const { fenetre, tronque } = fenetrerHistorique(messages);
    expect(tronque).toBe(false);
    expect(fenetre).toEqual(messages);
  });

  it("borne la conversation longue en gardant le premier message utilisateur", () => {
    const messages = construireConversation(60);
    const { fenetre, tronque } = fenetrerHistorique(messages);

    expect(tronque).toBe(true);
    expect(fenetre.length).toBeLessThanOrEqual(MAX_MESSAGES_FENETRE);
    expect(fenetre[0]).toEqual(messages[0]);
    // La fin de la conversation est toujours transmise intégralement.
    expect(fenetre[fenetre.length - 1]).toEqual(messages[messages.length - 1]);
  });

  it("ne laisse jamais une réponse du tuteur orpheline en tête", () => {
    // La parité décale le début de la queue : on couvre les deux cas, plus
    // les longueurs voisines, pour que la normalisation soit exercée.
    for (const n of [40, 41, 42, 43]) {
      const { fenetre } = fenetrerHistorique(construireConversation(n));
      // Un assistant en tête serait lu comme une affirmation spontanée du
      // tuteur, sa question ayant disparu.
      expect(fenetre[0]?.role).toBe("user");
      // La couture (premier message + saut vers la fenêtre récente) peut
      // juxtaposer deux messages utilisateur : c'est voulu et licite dans le
      // format de conversation, contrairement à un assistant orphelin.
      expect(fenetre.filter((m, i) => m.role === "assistant" && i === 0)).toHaveLength(0);
    }
  });
});

/*
 * ADR-026 — le référentiel est propre au compte, et un compte neuf n'en a
 * aucun. Le contexte doit alors dire ce qui est plutôt que de sérialiser un
 * tableau vide : un en-tête de colonnes suivi de rien se lit comme « mesuré
 * et trouvé nul », exactement ce que le protocole anti-hallucination interdit.
 */
describe("construireContexte — compte sans référentiel", () => {
  it("annonce l'absence de référentiel au lieu d'un profil vide", async () => {
    const { systemeProfil } = await construireContexte(construireCtxDeTest(REFERENTIEL_VIDE));

    expect(systemeProfil).toContain("AUCUN RÉFÉRENTIEL");
    // La consigne d'amorçage : construire AVEC l'utilisateur, pas deviner.
    expect(systemeProfil).toContain("pas de le deviner");
    /*
     * Elle nomme l'OUTIL, plus le gabarit markdown.
     *
     * Ce test épinglait « PROPOSITION DE RÉFÉRENTIEL » — un bloc dont les
     * étiquettes ont disparu des prompts au lot 3.2. Le test passait donc en
     * garantissant la présence d'une consigne périmée : le tuteur était invité
     * à produire une forme que plus rien ne décrivait (audit §2.17).
     */
    expect(systemeProfil).toContain(OUTIL_REFERENTIEL);
    expect(systemeProfil).not.toContain("PROPOSITION DE RÉFÉRENTIEL");
    // Aucun en-tête de colonnes : il n'y a pas de tableau à lire.
    expect(systemeProfil).not.toContain("Colonnes :");
  });

  it("interdit les propositions d'observation et d'exercice tant qu'aucune compétence n'existe", async () => {
    const { systemeProfil } = await construireContexte(construireCtxDeTest(REFERENTIEL_VIDE));
    expect(systemeProfil).toContain("Ne propose ni observation ni exercice");
  });

  it("le gabarit d'exercice n'invente aucun domaine quand il n'y en a pas", async () => {
    const { systemeStable } = await construireContexte(construireCtxDeTest(REFERENTIEL_VIDE));
    expect(systemeStable).toContain("aucun domaine");
  });

  it("avec un référentiel, le gabarit liste les domaines réellement actifs", async () => {
    const { systemeStable } = await construireContexte(construireCtxDeTest());
    expect(systemeStable).toContain("developpement");
    // `statistiques` est hors périmètre dans la fixture : le tuteur ne doit pas
    // se voir offrir un domaine qui n'est pas travaillé.
    expect(systemeStable).not.toContain("<statistiques");
  });
});

/*
 * ADR-026 — la charte de rédaction d'une compétence pèse ~6 Ko. Même arbitrage
 * qu'ADR-021 : inutile quand l'utilisateur travaille un exercice, indispensable
 * quand il construit son référentiel. Un compte vide la reçoit toujours, parce
 * que c'est sa seule conversation possible.
 */
describe("fautChargerProtocoleReferentiel", () => {
  it("charge toujours sur un compte sans référentiel, quel que soit le message", () => {
    expect(fautChargerProtocoleReferentiel("bonjour", true)).toBe(true);
    expect(fautChargerProtocoleReferentiel("", true)).toBe(true);
  });

  it("ne charge pas sur un message de travail ordinaire", () => {
    expect(fautChargerProtocoleReferentiel("Corrige ma réponse à l'exercice 3", false)).toBe(false);
    expect(fautChargerProtocoleReferentiel("Explique-moi la récursivité", false)).toBe(false);
  });

  /*
   * Les verbes du langage courant ne sont plus des déclencheurs.
   *
   * `ajouter`, `apprendre`, `commencer`, `me lancer`, `travailler sur`
   * figuraient dans la liste : « par où commencer cet exo ? » chargeait 6,8 Ko
   * de charte de construction du référentiel, en pleine résolution, à chaque
   * message. Le prix de ce resserrement est assumé : « j'aimerais travailler
   * sur le droit » ne charge plus la charte, et le tuteur propose alors une
   * branche avec les seules conditions de mesurabilité portées par la
   * description de `proposer_referentiel` — qui, elle, part à chaque message.
   */
  it("ne charge plus sur un verbe ordinaire — c'est ce qui coûtait le plus", () => {
    expect(fautChargerProtocoleReferentiel("Par où commencer cet exercice ?", false)).toBe(false);
    expect(fautChargerProtocoleReferentiel("Je veux travailler sur la question 2", false)).toBe(
      false,
    );
    expect(fautChargerProtocoleReferentiel("Comment apprendre cette méthode ?", false)).toBe(false);
    expect(fautChargerProtocoleReferentiel("Tu peux ajouter un détail ?", false)).toBe(false);
  });

  it("charge sur une intention d'étendre le référentiel", () => {
    expect(fautChargerProtocoleReferentiel("Je veux ajouter une compétence", false)).toBe(true);
    expect(fautChargerProtocoleReferentiel("On peut créer un domaine philo ?", false)).toBe(true);
    expect(fautChargerProtocoleReferentiel("Ajouter un domaine pour le droit ?", false)).toBe(true);
    expect(fautChargerProtocoleReferentiel("J'attaque un nouveau sujet : la lutherie", false)).toBe(
      true,
    );
  });

  it("ignore la casse et les accents", () => {
    expect(fautChargerProtocoleReferentiel("Mon RÉFÉRENTIEL est incomplet", false)).toBe(true);
  });

  it("le manifeste reflète le chargement réel — c'est la garantie de transparence", async () => {
    const avecReferentiel = await construireContexte(construireCtxDeTest(), [
      { role: "user", content: "Corrige ma réponse" },
    ]);
    expect(avecReferentiel.manifeste.map((s) => s.nom)).not.toContain(
      "Protocole de construction du référentiel",
    );

    const compteVide = await construireContexte(construireCtxDeTest(REFERENTIEL_VIDE), [
      { role: "user", content: "Corrige ma réponse" },
    ]);
    expect(compteVide.manifeste.map((s) => s.nom)).toContain(
      "Protocole de construction du référentiel",
    );
  });
});

/*
 * ADR-029 — non-régression sur la fuite de profil entre comptes.
 *
 * Le § 2 des instructions principales décrivait en dur le parcours d'un seul
 * utilisateur (« BUT QLIO », « Master ITI ») et ce fichier est chargé SANS
 * CONDITION pour tous les comptes. Un compte tiers se voyait donc attribuer un
 * diplôme et des objectifs qui n'étaient pas les siens, et le tuteur
 * initialisait son profil là-dessus.
 *
 * Ce test lit le contexte COMPLET — protocoles inclus, pas seulement les
 * blocs calculés — parce que c'est justement dans un fichier de protocole que
 * la fuite se trouvait.
 */
describe("aucun profil ne fuit d'un compte à l'autre (ADR-029)", () => {
  function ctxAnonyme() {
    const ctx = construireCtxDeTest();
    return {
      ...ctx,
      donnees: {
        ...ctx.donnees,
        user: {
          ...ctx.donnees.user,
          formation: "Formation à renseigner",
          preferencesPedagogiques: [],
        },
      },
    };
  }

  it("le contexte d'un compte sans profil déclaré ne nomme aucun diplôme", async () => {
    const c = await construireContexte(ctxAnonyme());
    const tout = `${c.systemeStable}\n${c.systemeProfil}`;
    expect(tout).not.toContain("QLIO");
    expect(tout).not.toMatch(/Master ITI/);
  });

  it("idem sur un compte sans référentiel — le cas de l'initialisation", async () => {
    const vide = { ...ctxAnonyme(), referentiel: REFERENTIEL_VIDE, etats: [] };
    const c = await construireContexte(vide as never);
    const tout = `${c.systemeStable}\n${c.systemeProfil}`;
    expect(tout).not.toContain("QLIO");
    expect(tout).not.toMatch(/Master ITI/);
    // Et l'interdiction d'inventer doit être présente, pas seulement l'absence.
    expect(tout).toContain("N'INVENTE PAS");
  });

  it("les instructions principales ne portent plus aucun profil ni référentiel figé", async () => {
    const c = await construireContexte(ctxAnonyme());
    expect(c.systemeStable).toContain("CE FICHIER NE CONTIENT AUCUN PROFIL");
    expect(c.systemeStable).toContain("IL N'EXISTE AUCUNE LISTE UNIVERSELLE DE COMPÉTENCES");
    // La liste des sept domaines historiques a disparu.
    expect(c.systemeStable).not.toContain("logistique industrielle, gestion de production");
  });

  it("un profil réellement déclaré, lui, est bien transmis", async () => {
    const ctx = construireCtxDeTest();
    const c = await construireContexte({
      ...ctx,
      donnees: {
        ...ctx.donnees,
        user: { ...ctx.donnees.user, formation: "Licence de philosophie" },
      },
    } as never);
    expect(c.systemeProfil).toContain("Licence de philosophie");
  });
});
