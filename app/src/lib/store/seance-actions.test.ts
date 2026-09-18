import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Exercise, LearningSession } from "@/lib/domain/types";

const mocks = vi.hoisted(() => ({
  ajouter: vi.fn(),
  dorsaleCompte: vi.fn(),
  lire: vi.fn(),
  modifier: vi.fn(),
  nouvelId: vi.fn(),
  cloreExerciceAtomiquement: vi.fn(),
  redirect: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("./db", () => ({
  ajouter: mocks.ajouter,
  dorsaleCompte: mocks.dorsaleCompte,
  lire: mocks.lire,
  modifier: mocks.modifier,
  nouvelId: mocks.nouvelId,
}));
vi.mock("./supabase-backend", () => ({ verifier: vi.fn() }));
vi.mock("./cloture-exercice", () => ({ cloreExerciceAtomiquement: mocks.cloreExerciceAtomiquement }));
vi.mock("@/lib/seed/exercises", () => ({ EXERCICES_DIAGNOSTIC: [] }));

import {
  annulerSeance,
  creerSeanceFocusExercice,
  demarrerSeance,
  planifierExerciceRecommande,
  terminerIntervention,
  terminerSeance,
} from "./seance-actions";

const EXERCICE: Exercise = {
  id: "ex-focus",
  titre: "Exercice focus",
  domaine: "developpement",
  type: "application",
  difficulte: 2,
  competences: ["DEV-01"],
  dureeEstimeeMin: 15,
  enonce: "Énoncé",
  indices: [],
  correction: "Correction",
  criteres: [],
  diagnostic: false,
  origine: "manuel",
};

const SEANCE_EXISTANTE = {
  id: "ses-existante",
  date: "2026-08-20T10:33:31.278Z",
  domaines: ["developpement"],
  skillCodes: ["DEV-01"],
  activites: [{ type: "exercice", ref: EXERCICE.id, libelle: EXERCICE.titre }],
  genereAutomatiquement: false,
  statut: "en-cours",
} as LearningSession;

describe("création d'une séance focus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.dorsaleCompte.mockResolvedValue({});
    mocks.nouvelId.mockReturnValue("ses-nouvelle");
  });

  it("réutilise la séance déjà ouverte quand le CTA est soumis de nouveau", async () => {
    mocks.lire.mockImplementation(async (collection: string) =>
      collection === "exercises" ? [EXERCICE] : [SEANCE_EXISTANTE],
    );

    await expect(creerSeanceFocusExercice(EXERCICE.id)).resolves.toBe(SEANCE_EXISTANTE.id);
    expect(mocks.ajouter).not.toHaveBeenCalled();
  });

  it("crée une séance quand aucune séance de cet exercice n'est ouverte", async () => {
    mocks.lire.mockImplementation(async (collection: string) =>
      collection === "exercises" ? [EXERCICE] : [],
    );

    await expect(creerSeanceFocusExercice(EXERCICE.id)).resolves.toBe("ses-nouvelle");
    expect(mocks.ajouter).toHaveBeenCalledTimes(1);
  });
});

describe("écritures concurrentes d'une séance", () => {
  afterEach(() => vi.useRealTimers());

  function persistance(initiale: LearningSession) {
    let session = structuredClone(initiale);
    const ecritures: object[] = [];
    let apresEcriture = () => {};
    function appliquer(champs: object) {
      ecritures.push(structuredClone(champs));
      session = { ...session, ...structuredClone(champs) };
      apresEcriture();
      return structuredClone(session);
    }
    const from = vi.fn(() => {
      let champs: object;
      const filtres: [string, unknown][] = [];
      const requete = {
        update: (valeur: object) => { champs = valeur; return requete; },
        eq: (cle: string, valeur: unknown) => { filtres.push([cle, valeur]); return requete; },
        is: (cle: string, valeur: unknown) => { filtres.push([cle, valeur]); return requete; },
        select: () => requete,
        maybeSingle: async () => {
          const correspond = filtres.every(([cle, valeur]) => {
            if (cle === "user_id") return valeur === "compte-1";
            if (cle === "interventions") return valeur === (session.interventions === undefined
              ? null : JSON.stringify(session.interventions));
            return (session[cle as keyof LearningSession] ?? null) === valeur;
          });
          return { data: correspond ? appliquer(champs) : null, error: null };
        },
      };
      return requete;
    });
    vi.clearAllMocks();
    mocks.dorsaleCompte.mockResolvedValue({ userId: "compte-1", supabase: { from } });
    mocks.lire.mockImplementation(async (collection: string) => collection === "sessions"
      ? [structuredClone(session)] : []);
    mocks.modifier.mockImplementation(async (_collection: string, _id: string, champs: object) => appliquer(champs));
    return {
      lire: () => structuredClone(session),
      ecritures,
      apresEcriture: (callback: () => void) => { apresEcriture = callback; },
    };
  }

  it("refuse une clôture concurrente au lieu d'effacer celle déjà enregistrée", async () => {
    const stockage = persistance({
      ...SEANCE_EXISTANTE,
      activites: [],
      interventions: ["a", "b"].map((id) => ({
        id, type: "read", label: id,
        source: { kind: "document", ref: `doc-${id}` }, expectedEffect: "preparation",
      })),
    });
    const resultats = await Promise.allSettled([
      terminerIntervention(SEANCE_EXISTANTE.id, "a"),
      terminerIntervention(SEANCE_EXISTANTE.id, "b"),
    ]);
    expect(resultats.filter((resultat) => resultat.status === "rejected")).toHaveLength(1);
    const indexRefuse = resultats.findIndex((resultat) => resultat.status === "rejected");
    expect(stockage.ecritures).toHaveLength(1);
    expect(stockage.lire().interventions?.filter((intervention) => intervention.statut === "completed"))
      .toHaveLength(1);

    // Le réessai explicite repart de l'état frais et conserve le premier geste.
    await terminerIntervention(SEANCE_EXISTANTE.id, ["a", "b"][indexRefuse]);
    expect(stockage.lire().interventions?.every((intervention) => intervention.statut === "completed"))
      .toBe(true);
  });

  it("conserve la première date quand deux démarrages ont lu la séance planifiée", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-17T08:00:00.000Z"));
    const stockage = persistance({ ...SEANCE_EXISTANTE, statut: "planifiee" });
    let liberer: () => void = () => {};
    const premiereEcriture = new Promise<void>((resolve) => { liberer = resolve; });
    let lectures = 0;
    mocks.lire.mockImplementation(async () => {
      const instantane = stockage.lire();
      if (++lectures === 2) await premiereEcriture;
      return [instantane];
    });
    stockage.apresEcriture(() => {
      vi.setSystemTime(new Date("2026-09-17T08:00:01.000Z"));
      liberer();
    });

    const destinations = await Promise.all([
      demarrerSeance(SEANCE_EXISTANTE.id), demarrerSeance(SEANCE_EXISTANTE.id),
    ]);
    expect(destinations.every((destination) => destination.includes(`session=${SEANCE_EXISTANTE.id}`))).toBe(true);
    expect(stockage.ecritures).toHaveLength(1);
    expect(stockage.lire().date).toBe("2026-09-17T08:00:00.000Z");
  });

  it("retrouve une séance déjà démarrée après la perte de la réponse serveur", async () => {
    const stockage = persistance(SEANCE_EXISTANTE);
    await expect(demarrerSeance(SEANCE_EXISTANTE.id))
      .resolves.toBe(`/seances?session=${SEANCE_EXISTANTE.id}&focus=1`);
    expect(stockage.ecritures).toHaveLength(0);
    expect(stockage.lire().date).toBe(SEANCE_EXISTANTE.date);
  });

  it("ne rouvre pas une séance annulée entre la lecture et le démarrage", async () => {
    const stockage = persistance({ ...SEANCE_EXISTANTE, statut: "abandonnee" });
    mocks.lire.mockResolvedValueOnce([{ ...SEANCE_EXISTANTE, statut: "planifiee" }]);
    await expect(demarrerSeance(SEANCE_EXISTANTE.id)).rejects.toThrow("a changé pendant le démarrage");
    expect(stockage.ecritures).toHaveLength(0);
    expect(stockage.lire().statut).toBe("abandonnee");
  });

  it("n'enregistre pas une intervention dans une séance abandonnée après sa lecture", async () => {
    const interventions: LearningSession["interventions"] = [{
      id: "lecture", type: "read", label: "Lire",
      source: { kind: "document", ref: "document-test" }, expectedEffect: "preparation",
    }];
    const stockage = persistance({ ...SEANCE_EXISTANTE, statut: "abandonnee", interventions });
    mocks.lire.mockResolvedValueOnce([{ ...SEANCE_EXISTANTE, interventions }]);
    await expect(terminerIntervention(SEANCE_EXISTANTE.id, "lecture"))
      .rejects.toThrow("vérifier le résultat avant de réessayer");
    expect(stockage.ecritures).toHaveLength(0);
    expect(stockage.lire().interventions).toEqual(interventions);
  });
});

describe("planification d'une recommandation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.dorsaleCompte.mockResolvedValue({});
    mocks.nouvelId.mockReturnValue("ses-planifiee");
  });

  it("écrit une séance planifiée à la date explicitement choisie", async () => {
    mocks.lire.mockImplementation(async (collection: string) =>
      collection === "exercises" ? [EXERCICE] : [],
    );

    await expect(
      planifierExerciceRecommande(EXERCICE.id, "2026-08-30T14:30:00.000Z"),
    ).resolves.toBe("ses-planifiee");

    expect(mocks.ajouter).toHaveBeenCalledWith(
      "sessions",
      expect.objectContaining({
        id: "ses-planifiee",
        statut: "planifiee",
        planifieePour: "2026-08-30T14:30:00.000Z",
        activites: [{ type: "exercice", ref: EXERCICE.id, libelle: EXERCICE.titre }],
      }),
      {},
    );
  });

  it("refuse une date invalide sans écrire de séance", async () => {
    await expect(planifierExerciceRecommande(EXERCICE.id, "pas-une-date"))
      .rejects.toThrow("Choisissez une date et une heure valides.");
    expect(mocks.ajouter).not.toHaveBeenCalled();
  });
});

describe("annulation d'une séance planifiée", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.dorsaleCompte.mockResolvedValue({});
  });

  it("conserve le fait abandonné sans créer d'observation", async () => {
    mocks.lire.mockResolvedValue([{
      id: "ses-planifiee",
      date: "2026-08-28T09:00:00.000Z",
      domaines: ["developpement"],
      skillCodes: ["DEV-01"],
      activites: [],
      genereAutomatiquement: false,
      statut: "planifiee",
      planifieePour: "2026-08-28T09:00:00.000Z",
    } satisfies LearningSession]);

    await expect(annulerSeance("ses-planifiee")).resolves.toBe("/seances");
    expect(mocks.modifier).toHaveBeenCalledWith(
      "sessions",
      "ses-planifiee",
      { statut: "abandonnee", renonceeLe: expect.any(String) },
      {},
    );
    expect(mocks.ajouter).not.toHaveBeenCalled();
  });
});

describe("clôture d'une séance", () => {
  it("revient sur le jour avec la séance repliée", async () => {
    vi.clearAllMocks();
    mocks.dorsaleCompte.mockResolvedValue({});
    mocks.lire.mockImplementation(async (collection: string) =>
      collection === "sessions" ? [SEANCE_EXISTANTE] : [],
    );
    mocks.modifier.mockResolvedValue({ ...SEANCE_EXISTANTE, statut: "terminee" });

    await expect(terminerSeance(SEANCE_EXISTANTE.id))
      .resolves.toBe("/seances?jour=2026-08-20");
    expect(mocks.modifier).toHaveBeenCalledWith(
      "sessions",
      SEANCE_EXISTANTE.id,
      expect.objectContaining({ statut: "terminee" }),
      {},
    );
  });
});

describe("clôture d'une intervention sans observation", () => {
  function dorsaleConditionnelle(id: string) {
    const requete = {
      update: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id }, error: null }),
    };
    mocks.dorsaleCompte.mockResolvedValue({ userId: "compte-1", supabase: { from: () => requete } });
    return requete;
  }

  it("met à jour uniquement le statut canonique", async () => {
    vi.clearAllMocks();
    const requete = dorsaleConditionnelle("ses-multi");
    const session = {
      id: "ses-multi",
      date: "2026-08-28T09:00:00.000Z",
      domaines: ["developpement"],
      skillCodes: ["DEV-01"],
      activites: [],
      genereAutomatiquement: false,
      statut: "en-cours",
      interventions: [{
        id: "i-read",
        type: "read",
        label: "Lire",
        source: { kind: "document", ref: "doc-1" },
        expectedEffect: "preparation",
      }],
    } as LearningSession;
    mocks.lire.mockResolvedValue([session]);

    await expect(terminerIntervention("ses-multi", "i-read")).resolves.toContain("intervention=i-read");
    expect(requete.update).toHaveBeenCalledWith(
      { interventions: [{ ...session.interventions![0], statut: "completed" }] },
    );
    expect(mocks.modifier).not.toHaveBeenCalled();
    expect(mocks.ajouter).not.toHaveBeenCalled();
  });

  it("clôture une intervention Feynman sans recréer de séance ni d'observation", async () => {
    vi.clearAllMocks();
    const requete = dorsaleConditionnelle("ses-feynman");
    const session = {
      id: "ses-feynman",
      date: "2026-08-28T09:00:00.000Z",
      domaines: ["developpement"],
      skillCodes: ["DEV-01"],
      activites: [],
      genereAutomatiquement: false,
      statut: "en-cours",
      interventions: [{
        id: "i-explain",
        type: "explain",
        label: "Expliquer les invariants",
        source: { kind: "course", ref: "cours-1" },
        targetSkillCodes: ["DEV-01"],
        expectedEffect: "preparation",
      }],
    } as LearningSession;
    mocks.lire.mockResolvedValue([session]);

    await expect(terminerIntervention("ses-feynman", "i-explain"))
      .resolves.toContain("intervention=i-explain");
    expect(requete.update).toHaveBeenCalledWith(
      { interventions: [{ ...session.interventions![0], statut: "completed" }] },
    );
    expect(mocks.modifier).not.toHaveBeenCalled();
    expect(mocks.ajouter).not.toHaveBeenCalled();
    expect(mocks.cloreExerciceAtomiquement).not.toHaveBeenCalled();
  });
});
