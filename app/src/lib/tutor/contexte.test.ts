import { describe, expect, it } from "vitest";
import {
  construireContexte,
  fautChargerProtocoleReferentiel,
  fautChargerSyntheseEvaluation,
} from "./contexte";
import { fenetrerHistorique, MAX_MESSAGES_FENETRE } from "./fenetre";
import { DOMAINES_TEST, REFERENTIEL_TEST } from "@/lib/domain/referentiel.fixture";
import { REFERENTIEL_VIDE } from "@/lib/domain/referentiel-compte";
import { computeAllSkillStates } from "@/lib/engine/skill-state";
import { calculerEtatGlobal } from "@/lib/engine/progression";
import { recommander } from "@/lib/engine/recommend";
import { calibrerToutes } from "@/lib/engine/calibration";
import type { Contexte } from "@/lib/store/context";

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

function construireCtxDeTest(referentiel = REFERENTIEL_TEST): Contexte {
  const now = new Date("2026-07-29T10:00:00.000Z");
  const etats = computeAllSkillStates(referentiel.actifs, [], now);
  const global = calculerEtatGlobal(etats, now, DOMAINES_TEST);
  const calibrations = calibrerToutes(etats, [], []);
  const recommandations = recommander(etats, [], [], 5, calibrations);
  return {
    referentiel,
    calibrations,
    donnees: {
      user: {
        id: "test",
        prenom: "Test",
        formation: "BUT QLIO",
        objectifMoyenTerme: "Master ITI",
        objectifLongTerme: "Chercheur",
        debutSuivi: now.toISOString(),
      },
      evidence: [],
      exercises: [],
      attempts: [],
      sessions: [],
    },
    etats,
    etatsParCode: new Map(etats.map((e) => [e.skill.code, e])),
    global,
    recommandations,
    now,
  };
}

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
    expect(systemeProfil).toContain("PROPOSITION DE RÉFÉRENTIEL");
    // Aucun en-tête de colonnes : il n'y a pas de tableau à lire.
    expect(systemeProfil).not.toContain("Colonnes :");
  });

  it("interdit les propositions de preuve et d'exercice tant qu'aucune compétence n'existe", async () => {
    const { systemeProfil } = await construireContexte(construireCtxDeTest(REFERENTIEL_VIDE));
    expect(systemeProfil).toContain("Ne propose ni preuve ni exercice");
  });

  it("transmet quand même les objectifs déclarés — ils fondent l'importance des compétences", async () => {
    const { systemeProfil } = await construireContexte(construireCtxDeTest(REFERENTIEL_VIDE));
    expect(systemeProfil).toContain("Master ITI");
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

  it("charge sur une intention d'étendre le référentiel", () => {
    expect(fautChargerProtocoleReferentiel("Je veux ajouter une compétence", false)).toBe(true);
    expect(fautChargerProtocoleReferentiel("On peut créer un domaine philo ?", false)).toBe(true);
    expect(fautChargerProtocoleReferentiel("j'aimerais travailler sur le droit", false)).toBe(true);
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
          objectifMoyenTerme: "Objectif à moyen terme à renseigner",
          objectifLongTerme: "Objectif à long terme à renseigner",
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
    expect(tout).toContain("N'INVENTE NI DIPLÔME NI OBJECTIF");
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
