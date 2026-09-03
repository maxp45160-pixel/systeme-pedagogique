import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  Exercise,
  ExerciseAttempt,
  LearningSession,
} from "@/lib/domain/types";

/*
 * Le parcours d'onboarding, bout à bout, au niveau des écritures (ADR-128).
 *
 * Un compte neuf valide un axe : le tuteur rédige UN exercice, son acceptation
 * crée une séance unitaire (`creerSeanceFocusExercice`, marquée
 * `premierParcours` dans son blueprint), la personne fait le test, soumet son
 * bilan (`terminerExercice`). Le contrat vérifié ici :
 *
 *  1. une seule tentative close, une seule entrée de journal, une observation ;
 *  2. la séance du premier parcours est REFERMÉE avec l'exercice — avant le
 *     correctif, elle restait « en cours » pour toujours et le tableau de bord
 *     reproposait l'exercice comme si rien n'avait eu lieu (frictions 5 et 6) ;
 *  3. la destination retournée est `/app`, après les écritures ;
 *  4. une séance ordinaire conserve le workspace et son bilan après validation
 *     (`/seances?session=…&exercice=…&bilan=1`) ;
 *  5. un ABANDON sur le premier parcours ne referme rien et ne va pas sur
 *     `/app` : la séance reste en cours, on peut la quitter ou la reprendre.
 *
 * La dorsale est simulée au niveau `./db` et `./cloture-exercice` ; tout le
 * reste — règles de domaine, moteur, assemblage de la destination — est réel.
 */

const mocks = vi.hoisted(() => ({
  ajouter: vi.fn(),
  cloreExerciceAtomiquement: vi.fn(),
  dorsaleCompte: vi.fn(),
  lire: vi.fn(),
  lireParId: vi.fn(),
  modifier: vi.fn(),
  nouvelId: vi.fn(),
  redirect: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("./db", () => ({
  ajouter: mocks.ajouter,
  dorsaleCompte: mocks.dorsaleCompte,
  lire: mocks.lire,
  lireParId: mocks.lireParId,
  modifier: mocks.modifier,
  nouvelId: mocks.nouvelId,
}));
vi.mock("./supabase-backend", () => ({ verifier: vi.fn() }));
vi.mock("./cloture-exercice", () => ({
  cloreExerciceAtomiquement: mocks.cloreExerciceAtomiquement,
}));
vi.mock("./documents", () => ({
  capturerDocumentProduction: vi.fn().mockResolvedValue(undefined),
  inscrireFicheExercice: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/seed/exercises", () => ({ EXERCICES_DIAGNOSTIC: [] }));

import { abandonnerExercice, terminerExercice } from "./actions";
import { creerSeanceFocusExercice } from "./seance-actions";

const EXERCICE: Exercise = {
  id: "ex-premier",
  titre: "Premier test",
  domaine: "algebre",
  type: "application",
  difficulte: 2,
  competences: ["ALGC-01"],
  dureeEstimeeMin: 5,
  enonce: "Énoncé du premier test.",
  indices: [],
  correction: "Correction.",
  criteres: [{ dimension: "comprehension", libelle: "La méthode est comprise" }],
  diagnostic: false,
  origine: "tuteur",
};

const JOUR = "2026-08-25T08:00:00.000Z";

/** L'état « base » partagé par les mocks de lecture/écriture. */
let db: { exercises: Exercise[]; attempts: ExerciseAttempt[]; sessions: LearningSession[] };

function tentativeEnCours(debut: string): ExerciseAttempt {
  return {
    id: "att-1",
    exerciseId: EXERCICE.id,
    debut,
    fin: null,
    dureeMin: null,
    indicesUtilises: 0,
    reponse: "Ma réponse rédigée.",
    evaluation: {},
    resultat: "partiel",
    statut: "en-cours",
  } as unknown as ExerciseAttempt;
}

function tentativeApresSeance(seance: LearningSession): ExerciseAttempt {
  const debut = new Date(new Date(seance.date).getTime() + 60_000).toISOString();
  return tentativeEnCours(debut);
}

async function creerSeanceAmorce(premierParcours: boolean): Promise<LearningSession> {
  const id = await creerSeanceFocusExercice(EXERCICE.id, { premierParcours });
  expect(mocks.ajouter).toHaveBeenCalledTimes(1);
  const seance = mocks.ajouter.mock.calls[0][1] as LearningSession;
  expect(seance.id).toBe(id);
  return seance;
}

describe("parcours d'onboarding — du premier axe au tableau de bord", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db = { exercises: [EXERCICE], attempts: [], sessions: [] };
    mocks.dorsaleCompte.mockResolvedValue({});
    mocks.nouvelId.mockImplementation((prefixe: string) =>
      prefixe === "ses" ? "ses-journal" : `${prefixe}-genere`,
    );
    mocks.lire.mockImplementation(async (collection: keyof typeof db) => db[collection]);
    mocks.lireParId.mockImplementation(
      async (collection: keyof typeof db, id: string) =>
        (db[collection] as Array<{ id: string }>).find((e) => e.id === id) ?? null,
    );
    mocks.cloreExerciceAtomiquement.mockImplementation(
      async (cloture: {
        tentative: { id: string; statut: "terminee" | "abandonnee"; dureeMin: number; fin: string };
        seanceIdContexte?: string;
      }) => {
        // La RPC réelle verrouille puis écrit : la simulation reflète l'état
        // que les lectures suivantes doivent voir.
        db.attempts = db.attempts.map((t) =>
          t.id === cloture.tentative.id
            ? { ...t, ...cloture.tentative, fin: cloture.tentative.fin }
            : t,
        );
        return {
          appliquee: true,
          tentativeId: cloture.tentative.id,
          observations: 1,
          seanceId: cloture.seanceIdContexte ?? null,
          seanceCreee: false,
        };
      },
    );
  });

  it("clôture l'exercice et montre la conclusion de la séance du premier parcours", async () => {
    const seance = await creerSeanceAmorce(true);
    expect(seance.blueprint?.premierParcours).toBe(true);
    expect(seance.activites).toHaveLength(1);

    db.sessions = [seance];
    db.attempts = [tentativeApresSeance(seance)];

    const destination = await terminerExercice({
      attemptId: "att-1",
      exerciseId: EXERCICE.id,
      resultat: "reussi",
      evaluation: { comprehension: 4 },
      dureeMin: 6,
      navigation: { seanceId: seance.id },
    });

    expect(destination).toBe(`/seances?session=${encodeURIComponent(seance.id)}`);

    // La transaction pédagogique : une tentative close, une observation, un
    // seul rattachement de contexte de séance (pas de double journal).
    expect(mocks.cloreExerciceAtomiquement).toHaveBeenCalledTimes(1);
    const cloture = mocks.cloreExerciceAtomiquement.mock.calls[0][0];
    expect(cloture.tentative).toMatchObject({ id: "att-1", statut: "terminee" });
    expect(cloture.observations).toHaveLength(1);
    expect(cloture.seance.genereAutomatiquement).toBe(true);
    expect(cloture.seanceIdContexte).toBe(seance.id);

    // La séance hôte est refermée par le même chemin que « Terminer ».
    expect(mocks.modifier).toHaveBeenCalledWith(
      "sessions",
      seance.id,
      expect.objectContaining({ statut: "terminee" }),
      {},
    );

    // La destination ne part qu'après les écritures.
    expect(mocks.revalidatePath).toHaveBeenCalled();
  });

  it("conserve le workspace et le bilan après validation d'une séance ordinaire", async () => {
    const seance = await creerSeanceAmorce(false);
    expect(seance.blueprint?.premierParcours).toBeUndefined();

    db.sessions = [seance];
    db.attempts = [tentativeApresSeance(seance)];

    const destination = await terminerExercice({
      attemptId: "att-1",
      exerciseId: EXERCICE.id,
      resultat: "partiel",
      evaluation: { comprehension: 3 },
      dureeMin: 12,
      navigation: { seanceId: seance.id },
    });

    expect(destination).toBe(
      `/seances?session=${encodeURIComponent(seance.id)}&exercice=${EXERCICE.id}&bilan=1`,
    );
    // Une séance ordinaire reste en cours et le bilan reste consultable dans le workspace.
    expect(mocks.modifier).not.toHaveBeenCalled();
  });

  it("ne referme rien et reste dans le workspace après un abandon du premier parcours", async () => {
    const seance = await creerSeanceAmorce(true);
    db.sessions = [seance];
    db.attempts = [tentativeEnCours("2026-08-25T09:00:00.000Z")];

    const destination = await abandonnerExercice(
      "att-1",
      EXERCICE.id,
      3,
      { seanceId: seance.id },
    );

    expect(destination).toBe(
      `/seances?session=${encodeURIComponent(seance.id)}&exercice=${EXERCICE.id}&abandon=1`,
    );
    // La tentative est bien close (abandonnée), la séance reste en cours.
    expect(db.attempts[0].statut).toBe("abandonnee");
    expect(mocks.cloreExerciceAtomiquement.mock.calls[0][0].observations).toEqual([]);
    expect(mocks.modifier).not.toHaveBeenCalled();

    // Une confirmation répétée converge vers le même état : elle ne recrée
    // ni séance ni entrée de journal.
    const replay = await abandonnerExercice(
      "att-1",
      EXERCICE.id,
      3,
      { seanceId: seance.id },
    );
    expect(replay).toBe(destination);
    expect(mocks.cloreExerciceAtomiquement).toHaveBeenCalledTimes(1);
  });
});
