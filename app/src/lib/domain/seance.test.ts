import { describe, expect, it } from "vitest";
import {
  avancementSeance,
  ecartBesoinRealise,
  exercicesDeLaSeance,
  motifRefusBesoin,
  motifRefusActivites,
  motifRefusBlueprint,
  motifRefusDemande,
  peutReprendreSeance,
  resumeSeance,
  resumeSeanceAbandonnee,
  seanceALieu,
  seanceEnCoursPour,
  seanceHoteDeLExercice,
  statutSeance,
  tentativeDeSeance,
  EXERCICES_PAR_SEANCE_MAX,
  INTENTION_MAX,
  TEMPS_DECLARE_MAX,
} from "./seance";
import { DUREE_ESTIMEE_MAX, DUREE_ESTIMEE_MIN } from "./exercice";
import type {
  BesoinDeclare,
  BlueprintSeance,
  DemandeSeance,
  ExerciseAttempt,
  LearningSession,
} from "./types";

/*
 * Le domaine de la séance (ADR-048).
 *
 * Deux propriétés sont vérifiées ici plus que les autres, parce que ce sont
 * elles qui, si elles cèdent, cèdent en silence :
 *
 *  - une séance sans `statut` est TERMINÉE. Les 45 séances écrites avant le
 *    10/08/2026 n'en ont pas, et les lire comme « planifiées » les ferait
 *    réapparaître dans la file des séances à faire ;
 *  - l'avancement ne compte QUE les tentatives postérieures au début de la
 *    séance. Sans cette borne, une séance composée d'exercices déjà travaillés
 *    s'afficherait terminée avant d'avoir commencé.
 */

const DEBUT = "2026-08-10T09:00:00.000Z";

function seance(extra: Partial<LearningSession> = {}): LearningSession {
  return {
    id: "ses-1",
    date: DEBUT,
    domaines: ["developpement"],
    skillCodes: ["DEV-01"],
    activites: [
      { type: "exercice", ref: "ex-a", libelle: "Exercice A" },
      { type: "exercice", ref: "ex-b", libelle: "Exercice B" },
    ],
    genereAutomatiquement: false,
    ...extra,
  };
}

let compteur = 0;
function tentative(
  exerciseId: string,
  statut: ExerciseAttempt["statut"],
  options: { debut?: string; dureeMin?: number } = {},
): ExerciseAttempt {
  return {
    id: `at-${++compteur}`,
    exerciseId,
    debut: options.debut ?? "2026-08-10T09:30:00.000Z",
    dureeMin: options.dureeMin,
    indicesUtilises: 0,
    reponse: "…",
    evaluation: {},
    resultat: "partiel",
    statut,
  };
}

const BESOIN: BesoinDeclare = {
  intention: "Revoir les boucles avant l'examen.",
  codesVises: ["DEV-01", "DEV-02"],
  tempsDisponibleMin: 60,
  declareLe: "2026-08-10T08:55:00.000Z",
};

const DEMANDE: DemandeSeance = {
  dureeCibleMin: 60,
  nombreExercices: 2,
  portee: { type: "mono", domaine: "developpement" },
};

const BLUEPRINT: BlueprintSeance = {
  ...DEMANDE,
  cibles: [
    { code: "DEV-01", difficulte: 2, raison: "jamais évaluée" },
    { code: "DEV-02", difficulte: 3, raison: "due pour révision" },
  ],
};

/* ------------------------------------------------------------------ */

describe("statutSeance — l'absence de statut a un sens", () => {
  it("lit une séance historique sans statut comme terminée", () => {
    // Les 45 séances auto-générées d'avant ADR-048. Les lire autrement les
    // ferait revenir dans la file des séances à faire.
    expect(statutSeance(seance())).toBe("terminee");
  });

  it("respecte le statut quand il est posé", () => {
    expect(statutSeance(seance({ statut: "planifiee" }))).toBe("planifiee");
    expect(statutSeance(seance({ statut: "en-cours" }))).toBe("en-cours");
  });
});

describe("seanceALieu — le garde du bandeau d'activité", () => {
  it("exclut la séance planifiée : elle n'a pas eu lieu", () => {
    expect(seanceALieu(seance({ statut: "planifiee" }))).toBe(false);
  });

  it("inclut la séance en cours et la séance terminée", () => {
    expect(seanceALieu(seance({ statut: "en-cours" }))).toBe(true);
    expect(seanceALieu(seance({ statut: "terminee" }))).toBe(true);
    expect(seanceALieu(seance())).toBe(true);
  });

  it("exclut l'abandon sec : rien n'y a été ouvert", () => {
    // Le même piège que la séance planifiée, sous une autre forme : la séance
    // porte une date réelle, mais aucune minute n'y a été observée. La compter
    // colorerait une case du bandeau d'activité avec un renoncement.
    expect(seanceALieu(seance({ statut: "abandonnee" }))).toBe(false);
  });

  it("inclut l'abandon qui a laissé une durée observée", () => {
    expect(seanceALieu(seance({ statut: "abandonnee", dureeMin: 12 }))).toBe(true);
  });
});

describe("exercicesDeLaSeance", () => {
  it("ne retient que les activités de type exercice", () => {
    const s = seance({
      activites: [
        { type: "exercice", ref: "ex-a", libelle: "A" },
        { type: "lecture", ref: "doc-1", libelle: "Un document" },
      ],
    });
    expect(exercicesDeLaSeance(s)).toEqual(["ex-a"]);
  });
});

describe("tentativeDeSeance — rattachement sans lien fabriqué", () => {
  it("ignore une tentative antérieure au début d'une séance composée", () => {
    const ancienne = tentative("ex-a", "terminee", { debut: "2026-08-09T09:00:00.000Z" });
    const courante = tentative("ex-a", "terminee", { debut: "2026-08-10T09:30:00.000Z" });
    expect(tentativeDeSeance(seance(), "ex-a", [ancienne, courante])?.id).toBe(courante.id);
  });

  it("rattache une séance historique à la clôture la plus proche", () => {
    const loin = tentative("ex-a", "terminee", { debut: "2026-08-08T09:00:00.000Z" });
    const proche = {
      ...tentative("ex-a", "terminee", { debut: "2026-08-10T08:50:00.000Z" }),
      fin: "2026-08-10T09:01:00.000Z",
    };
    const historique = seance({ genereAutomatiquement: true });
    expect(tentativeDeSeance(historique, "ex-a", [loin, proche])?.id).toBe(proche.id);
  });
});

describe("seanceEnCoursPour — le garde contre le double journal", () => {
  it("trouve la séance en cours qui contient l'exercice", () => {
    const s = seance({ statut: "en-cours" });
    expect(seanceEnCoursPour("ex-a", [s])?.id).toBe("ses-1");
  });

  it("ignore une séance planifiée ou terminée", () => {
    expect(seanceEnCoursPour("ex-a", [seance({ statut: "planifiee" })])).toBeNull();
    expect(seanceEnCoursPour("ex-a", [seance({ statut: "terminee" })])).toBeNull();
    // Sans statut = terminée : c'est le cas des séances mono-exercice
    // auto-générées, qui ne doivent surtout pas capter un exercice refait.
    expect(seanceEnCoursPour("ex-a", [seance()])).toBeNull();
  });

  it("ignore un exercice absent de la séance", () => {
    expect(seanceEnCoursPour("ex-z", [seance({ statut: "en-cours" })])).toBeNull();
  });

  it("préfère la séance commencée le plus récemment", () => {
    const ancienne = seance({ id: "ses-vieille", statut: "en-cours", date: "2026-08-01T09:00:00.000Z" });
    const recente = seance({ id: "ses-recente", statut: "en-cours", date: "2026-08-10T09:00:00.000Z" });
    expect(seanceEnCoursPour("ex-a", [ancienne, recente])?.id).toBe("ses-recente");
  });
});

describe("seanceHoteDeLExercice — le rattachement ne se devine plus", () => {
  /*
   * La contrepartie de la levée de l'invariant « une seule séance en cours »
   * (16/08/2026). Le défaut qu'elle ferme est invisible : deux séances ouvertes
   * contenant le même exercice produiraient un rattachement au hasard de la
   * date, et les deux lignes de journal resteraient exactes prises séparément.
   */
  const ancienne = seance({ id: "ses-vieille", statut: "en-cours", date: "2026-08-01T09:00:00.000Z" });
  const recente = seance({ id: "ses-recente", statut: "en-cours", date: "2026-08-10T09:00:00.000Z" });

  it("préfère la séance désignée par le contexte, même si elle est plus ancienne", () => {
    expect(seanceHoteDeLExercice("ex-a", [ancienne, recente], "ses-vieille")?.id).toBe("ses-vieille");
  });

  it("retombe sur la déduction sans contexte", () => {
    expect(seanceHoteDeLExercice("ex-a", [ancienne, recente])?.id).toBe("ses-recente");
  });

  it("refuse un contexte qui ne contient pas l'exercice", () => {
    const autre = seance({ id: "ses-autre", statut: "en-cours", activites: [{ type: "exercice", ref: "ex-z", libelle: "Z" }] });
    expect(seanceHoteDeLExercice("ex-a", [autre, recente], "ses-autre")?.id).toBe("ses-recente");
  });

  it("refuse un contexte périmé : une séance close ne capte plus rien", () => {
    const close = seance({ id: "ses-close", statut: "abandonnee" });
    expect(seanceHoteDeLExercice("ex-a", [close], "ses-close")).toBeNull();
  });
});

describe("abandon et reprise d'une séance", () => {
  it("compte sans juger", () => {
    const avancement = avancementSeance(seance({ statut: "abandonnee" }), [
      tentative("ex-a", "terminee"),
    ]);
    const phrase = resumeSeanceAbandonnee(avancement);
    expect(phrase).toContain("1 exercice(s) mené(s) sur 2");
    expect(phrase).toContain("1 jamais ouvert(s)");
    // Aucun qualificatif sur la personne ni sur la séance (P2, P3).
    expect(phrase).not.toMatch(/rat|échec|echec/i);
  });

  it("ne propose la reprise que s'il reste quelque chose à reprendre", () => {
    const s = seance({ statut: "abandonnee" });
    const rien = avancementSeance(s, [
      tentative("ex-a", "terminee"),
      tentative("ex-b", "terminee"),
    ]);
    expect(peutReprendreSeance(s, rien)).toBe(false);

    const reste = avancementSeance(s, [tentative("ex-a", "terminee")]);
    expect(peutReprendreSeance(s, reste)).toBe(true);
  });

  it("ne propose la reprise que d'une séance abandonnée", () => {
    const enCours = seance({ statut: "en-cours" });
    expect(peutReprendreSeance(enCours, avancementSeance(enCours, []))).toBe(false);
    const terminee = seance({ statut: "terminee" });
    expect(peutReprendreSeance(terminee, avancementSeance(terminee, []))).toBe(false);
  });
});

describe("motifRefusBesoin", () => {
  it("accepte un besoin complet", () => {
    expect(motifRefusBesoin(BESOIN)).toBeNull();
  });

  it("accepte un besoin sans intention rédigée — elle est facultative", () => {
    /*
     * Exiger une phrase avant de composer faisait du formulaire l'obstacle que
     * la séance devait lever (10/08/2026). Choisir un thème et un temps est
     * déjà une déclaration datée, et l'écart besoin/réalisé ne lit pas la
     * phrase — il compare `codesVises` et `tempsDisponibleMin`.
     */
    expect(motifRefusBesoin({ ...BESOIN, intention: undefined })).toBeNull();
  });

  it("refuse une intention plus longue que la borne", () => {
    const trop = "a".repeat(INTENTION_MAX + 1);
    expect(motifRefusBesoin({ ...BESOIN, intention: trop })).toContain("trop longue");
  });

  it("refuse un temps disponible hors bornes", () => {
    expect(motifRefusBesoin({ ...BESOIN, tempsDisponibleMin: 0 })).toContain("hors bornes");
    expect(
      motifRefusBesoin({ ...BESOIN, tempsDisponibleMin: TEMPS_DECLARE_MAX + 1 }),
    ).toContain("hors bornes");
    expect(motifRefusBesoin({ ...BESOIN, tempsDisponibleMin: 30.5 })).toContain("hors bornes");
  });

  it("refuse un besoin sans date : sans date, ce n'est pas un fait observé", () => {
    expect(motifRefusBesoin({ ...BESOIN, declareLe: "" })).toContain("fait observé");
  });

  it("accepte un besoin sans compétence visée", () => {
    // Déclarer « je veux travailler une heure » sans savoir sur quoi est
    // légitime : c'est le moteur qui proposera les cibles.
    expect(motifRefusBesoin({ ...BESOIN, codesVises: [] })).toBeNull();
  });
});

describe("motifRefusDemande — les bornes sont dérivées de celles d'un exercice", () => {
  it("accepte une demande cohérente", () => {
    expect(motifRefusDemande(DEMANDE)).toBeNull();
  });

  it("refuse un nombre d'exercices hors bornes", () => {
    expect(motifRefusDemande({ ...DEMANDE, nombreExercices: 0 })).toContain("hors bornes");
    expect(
      motifRefusDemande({ ...DEMANDE, nombreExercices: EXERCICES_PAR_SEANCE_MAX + 1 }),
    ).toContain("hors bornes");
  });

  it("refuse une durée cible sous le plancher des exercices demandés", () => {
    // 3 exercices ne tiennent pas en 10 min : aucun exercice ne descend sous
    // DUREE_ESTIMEE_MIN. La borne n'est pas un nombre de plus, elle est dérivée.
    const plancher = 3 * DUREE_ESTIMEE_MIN;
    const refus = motifRefusDemande({
      ...DEMANDE,
      nombreExercices: 3,
      dureeCibleMin: plancher - 1,
    });
    expect(refus).toContain(String(plancher));
  });

  it("refuse une durée cible au-delà du plafond des exercices demandés", () => {
    const plafond = 2 * DUREE_ESTIMEE_MAX;
    expect(
      motifRefusDemande({ ...DEMANDE, nombreExercices: 2, dureeCibleMin: plafond + 1 }),
    ).toContain(String(plafond));
  });

  it("refuse une portée transverse à un seul domaine", () => {
    const refus = motifRefusDemande({
      ...DEMANDE,
      portee: { type: "transverse", domaines: ["developpement"] },
    });
    expect(refus).toContain("deux domaines");
  });

  it("refuse une portée thème sans aucune compétence active", () => {
    const refus = motifRefusDemande({
      ...DEMANDE,
      portee: { type: "theme", themeId: "t", codes: [] },
    });
    expect(refus).toContain("rien à composer");
  });

  it("accepte une portée thème avec des codes", () => {
    expect(
      motifRefusDemande({
        ...DEMANDE,
        portee: { type: "theme", themeId: "t", codes: ["DEV-01"] },
      }),
    ).toBeNull();
  });
});

describe("motifRefusBlueprint — la même règle, plus les cibles", () => {
  it("accepte un blueprint cohérent", () => {
    expect(motifRefusBlueprint(BLUEPRINT)).toBeNull();
  });

  it("applique les refus de la demande : une seule implémentation", () => {
    // L'observation que les deux ne peuvent pas diverger : le message est le même.
    const casse = { ...BLUEPRINT, nombreExercices: 0, cibles: [] };
    expect(motifRefusBlueprint(casse)).toBe(motifRefusDemande(casse));
  });

  it("accepte moins de cibles que d'exercices demandés — le cas normal à sec", () => {
    expect(
      motifRefusBlueprint({ ...BLUEPRINT, cibles: [BLUEPRINT.cibles[0]] }),
    ).toBeNull();
  });

  it("refuse plus de cibles que d'exercices demandés", () => {
    const trop = {
      ...BLUEPRINT,
      cibles: [...BLUEPRINT.cibles, { code: "DEV-03", difficulte: 2 as const, raison: "…" }],
    };
    expect(motifRefusBlueprint(trop)).toContain("3 compétences pour 2");
  });
});

describe("motifRefusActivites — une séance sans exercice disponible est refusée", () => {
  const act = (ref: string) => ({ type: "exercice" as const, ref, libelle: ref });

  it("accepte une séance avec au moins un exercice retenu", () => {
    expect(motifRefusActivites([act("ex-1"), act("ex-2")])).toBeNull();
  });

  it("refuse une séance sans aucune activité", () => {
    expect(motifRefusActivites([])).not.toBeNull();
  });

  it("refuse une séance dont aucune activité n'est un exercice", () => {
    // Les places « à générer » ne comptent pas encore comme activités : une
    // séance qui n'en retiendrait que des manquants serait vide au premier
    // exercice (P2). Le tuteur n'écrit jamais d'autre type d'activité, mais le
    // refuse doit le prouver plutôt que de le supposer.
    expect(motifRefusActivites([{ type: "pauvre" as string, ref: "x", libelle: "x" }])).not.toBeNull();
    expect(motifRefusActivites([act("ex-1"), { type: "autre", ref: "y", libelle: "y" }])).toBeNull();
  });
});

describe("avancementSeance — la borne temporelle est la règle", () => {
  it("ignore les tentatives antérieures au début de la séance", () => {
    // Le défaut que ce test empêche : une séance composée d'exercices déjà
    // travaillés s'afficherait terminée avant d'avoir commencé.
    const avant = tentative("ex-a", "terminee", { debut: "2026-08-01T10:00:00.000Z" });
    const a = avancementSeance(seance({ statut: "en-cours" }), [avant]);
    expect(a.menes).toEqual([]);
    expect(a.restants).toEqual(["ex-a", "ex-b"]);
  });

  it("classe menés, en cours, abandonnés et restants", () => {
    const s = seance({
      statut: "en-cours",
      activites: [
        { type: "exercice", ref: "ex-a", libelle: "A" },
        { type: "exercice", ref: "ex-b", libelle: "B" },
        { type: "exercice", ref: "ex-c", libelle: "C" },
        { type: "exercice", ref: "ex-d", libelle: "D" },
      ],
    });
    const a = avancementSeance(s, [
      tentative("ex-a", "terminee"),
      tentative("ex-b", "en-cours"),
      tentative("ex-c", "abandonnee"),
    ]);
    expect(a).toEqual({
      total: 4,
      menes: ["ex-a"],
      enCours: ["ex-b"],
      abandonnes: ["ex-c"],
      restants: ["ex-d"],
    });
  });

  it("retient le meilleur état atteint : abandonné puis mené compte comme mené", () => {
    const a = avancementSeance(seance({ statut: "en-cours" }), [
      tentative("ex-a", "abandonnee"),
      tentative("ex-a", "terminee", { debut: "2026-08-10T10:00:00.000Z" }),
    ]);
    expect(a.menes).toEqual(["ex-a"]);
    expect(a.abandonnes).toEqual([]);
  });
});

describe("resumeSeance — il compte, il ne juge pas", () => {
  it("cite les nombres, sans appréciation sur l'ensemble", () => {
    const texte = resumeSeance({
      total: 4,
      menes: ["a", "b", "c"],
      enCours: [],
      abandonnes: [],
      restants: ["d"],
    });
    expect(texte).toBe("Séance — 3 exercice(s) mené(s) sur 4");
    expect(texte).not.toMatch(/réussi|échou|bonne|mauvaise/i);
  });

  it("mentionne les abandons quand il y en a", () => {
    expect(
      resumeSeance({ total: 2, menes: ["a"], enCours: [], abandonnes: ["b"], restants: [] }),
    ).toContain("1 abandonné(s)");
  });
});

describe("ecartBesoinRealise — des faits comparés, jamais un score", () => {
  const competences = new Map([
    ["ex-a", ["DEV-01"]],
    ["ex-b", ["DEV-03"]],
  ]);

  it("rend null sans besoin déclaré : pas d'intention, pas d'écart", () => {
    expect(ecartBesoinRealise(seance(), [], competences)).toBeNull();
  });

  it("sépare tenu, délaissé et imprévu", () => {
    const s = seance({ statut: "en-cours", besoinDeclare: BESOIN });
    const e = ecartBesoinRealise(
      s,
      [
        tentative("ex-a", "terminee", { dureeMin: 20 }),
        tentative("ex-b", "terminee", { dureeMin: 14 }),
      ],
      competences,
    )!;
    expect(e.codesTenus).toEqual(["DEV-01"]);
    expect(e.codesDelaisses).toEqual(["DEV-02"]);
    expect(e.codesImprevus).toEqual(["DEV-03"]);
  });

  it("cite les deux valeurs de temps côte à côte", () => {
    const s = seance({ statut: "en-cours", besoinDeclare: BESOIN });
    const e = ecartBesoinRealise(
      s,
      [tentative("ex-a", "terminee", { dureeMin: 34 })],
      competences,
    )!;
    expect(e.tempsDeclareMin).toBe(60);
    expect(e.tempsPasseMin).toBe(34);
    expect(e.constats[0]).toContain("60 min déclarées");
    expect(e.constats[0]).toContain("34 min effectivement passées");
  });

  it("ne conclut jamais sur la personne", () => {
    // D6 : l'écart est une matière à observation, pas un diagnostic. Un seul
    // écart ne dit rien d'une tendance, et la réserve le dit à la place du
    // lecteur plutôt que de le laisser deviner.
    const s = seance({ statut: "en-cours", besoinDeclare: BESOIN });
    const e = ecartBesoinRealise(
      s,
      [tentative("ex-a", "terminee", { dureeMin: 5 })],
      competences,
    )!;
    const tout = [...e.constats, ...e.reserves].join(" ");
    expect(tout).not.toMatch(/surestim|sous-estim|biais|score|indice de/i);
    expect(e.reserves.join(" ")).toContain("ne dit rien d'une tendance");
  });

  it("rend null et non zéro quand aucune tentative n'a été menée", () => {
    // P2 : l'absence de mesure n'est pas une durée nulle.
    const s = seance({ statut: "en-cours", besoinDeclare: BESOIN });
    const e = ecartBesoinRealise(s, [tentative("ex-a", "en-cours")], competences)!;
    expect(e.tempsPasseMin).toBeNull();
    expect(e.constats[0]).toContain("aucun temps mesuré");
  });

  it("ignore une tentative menée sur un exercice hors de la séance", () => {
    const s = seance({ statut: "en-cours", besoinDeclare: BESOIN });
    const e = ecartBesoinRealise(
      s,
      [tentative("ex-hors-seance", "terminee", { dureeMin: 90 })],
      new Map([["ex-hors-seance", ["DEV-05"]]]),
    )!;
    expect(e.tempsPasseMin).toBeNull();
    expect(e.codesImprevus).toEqual([]);
  });
});
