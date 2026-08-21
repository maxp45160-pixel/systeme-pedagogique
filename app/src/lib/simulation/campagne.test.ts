import { describe, expect, it } from "vitest";
import {
  agregerCampagne,
  comparer,
  executerRun,
  MESURES,
  planifierCampagne,
  planRapide,
  serie,
  type LigneRun,
} from "./campagne";
import { construireExportCampagne, redigerConclusionCampagne } from "./export";
import { ARCHETYPES, construireMondeFictif } from "./monde";
import { BRAS, brasParId, deroulerParcoursLong } from "./parcours-long";
import { construireTableauDeBord } from "./tableau-de-bord";

describe("séries et comparaison", () => {
  it("résume une distribution sans supposer une loi", () => {
    const s = serie([1, 2, 3, 4, 5, null]);
    expect(s).not.toBeNull();
    expect(s!.n).toBe(5);
    expect(s!.mediane).toBe(3);
    expect(s!.q1).toBe(2);
    expect(s!.q3).toBe(4);
  });

  it("ne conclut pas quand les interquartiles se recouvrent", () => {
    const a = serie([10, 11, 12, 13]);
    const b = serie([11, 12, 13, 14]);
    expect(comparer(a, b, "haut")).toBe("equivalent");
  });

  it("tranche quand les boîtes sont disjointes, dans le bon sens", () => {
    const bas = serie([1, 1.2, 1.4, 1.5]);
    const haut = serie([9, 9.2, 9.4, 9.5]);
    expect(comparer(haut, bas, "haut")).toBe("mieux");
    expect(comparer(haut, bas, "bas")).toBe("pire");
    expect(comparer(haut, bas, "neutre")).toBe("indecidable");
  });
});

describe("plan", () => {
  it("croise graines, archétypes et bras", () => {
    const plan = planifierCampagne({
      graines: [1, 2],
      archetypes: ["regulier", "assidu"],
      bras: ["moteur", "aleatoire"],
    });
    expect(plan.runs).toHaveLength(8);
    expect(new Set(plan.runs.map((r) => r.bras)).size).toBe(2);
  });

  it("garde le préréglage du navigateur tenable", () => {
    expect(planRapide().runs.length).toBeLessThanOrEqual(60);
  });
});

describe("bras", () => {
  it("oppose au moteur des témoins naïfs et des ablations", () => {
    expect(BRAS.filter((b) => b.temoin).length).toBeGreaterThanOrEqual(3);
    expect(BRAS.filter((b) => b.id.startsWith("sans-")).length).toBeGreaterThanOrEqual(2);
    expect(brasParId("inconnu").id).toBe("moteur");
  });

  it(
    "un témoin ne sert pas les mêmes exercices que le moteur",
    () => {
      const monde = construireMondeFictif(7);
      const moteur = deroulerParcoursLong(monde, { bras: brasParId("moteur") });
      const temoin = deroulerParcoursLong(monde, { bras: brasParId("tourniquet") });
      const codesMoteur = moteur.actions.map((a) => a.code).join(",");
      const codesTemoin = temoin.actions.map((a) => a.code).join(",");
      expect(codesTemoin).not.toBe(codesMoteur);
      // Le tourniquet passe par tout le monde : c'est sa raison d'être.
      expect(new Set(temoin.actions.map((a) => a.code)).size).toBeGreaterThan(
        new Set(moteur.actions.map((a) => a.code)).size,
      );
    },
    60_000,
  );

  it(
    "le catalogue ne s'assèche plus : le manque est fabriqué, pas subi",
    () => {
      const parcours = deroulerParcoursLong(construireMondeFictif(4242));
      const tableau = construireTableauDeBord(parcours);
      expect(tableau.selection.joursSansExercice).toBe(0);
      expect(parcours.exercicesGeneres).toBeGreaterThan(0);
      expect(parcours.actions.every((a) => a.exerciceId.length > 0)).toBe(true);
    },
    60_000,
  );
});

describe("agrégation", () => {
  const plan = planifierCampagne({
    graines: [1, 2],
    archetypes: ["regulier"],
    bras: ["moteur", "aleatoire", "sans-revision"],
  });

  const lignes: LigneRun[] = plan.runs.map((run, i) => ({
    ...run,
    valeurs: Object.fromEntries(
      MESURES.map((m) => [m.cle, run.bras === "moteur" ? 10 + i : 1 + i]),
    ),
    verdicts: { zone: run.bras === "moteur" ? "echec" : "ok", biais: "ok" },
  }));

  const rapport = agregerCampagne(plan, lignes, 1234);

  it("compare le moteur au meilleur témoin, jamais à lui-même", () => {
    const mesure = rapport.mesures.find((m) => m.cle === "gain-par-heure")!;
    expect(mesure.meilleurTemoin?.bras).toBe("aleatoire");
    expect(mesure.face).toBe("mieux");
  });

  it("mesure l'effet de chaque ablation du point de vue de l'ablation", () => {
    const mesure = rapport.mesures.find((m) => m.cle === "gain-par-heure")!;
    const ablation = mesure.ablations.find((a) => a.bras === "sans-revision");
    expect(ablation).toBeDefined();
    expect(ablation!.effet).toBe("pire");
  });

  it("ne retient un constat que s'il tient sur assez de profils", () => {
    const zone = rapport.stabilite.find((s) => s.cle === "zone")!;
    expect(zone.partNonVert).toBe(1);
    expect(zone.retenu).toBe(true);
    const biais = rapport.stabilite.find((s) => s.cle === "biais")!;
    expect(biais.retenu).toBe(false);
  });

  it("produit un export autodescriptif et relisable", () => {
    const analyse = construireExportCampagne(rapport);
    expect(analyse.format).toBe("simulation-campagne-analyse");
    expect(analyse.parametres.parcours).toBe(6);
    expect(analyse.notice.methode).toContain("témoin");
    expect(analyse.conclusion.face.length).toBeGreaterThan(3);
    expect(JSON.parse(JSON.stringify(analyse)).lignes).toHaveLength(6);
  });

  it("dit combien de fois le moteur bat le témoin, sans arrondir la vérité", () => {
    const conclusion = redigerConclusionCampagne(rapport);
    expect(conclusion.resume).toContain("mesures externes");
    expect(conclusion.reserve).toContain("hypothèse");
  });
});

describe("un run réel", () => {
  it(
    "réduit un parcours entier à ses mesures",
    () => {
      const ligne = executerRun({ graine: 7, archetype: "assidu", bras: "moteur" });
      expect(ligne.archetype).toBe("assidu");
      expect(Object.keys(ligne.valeurs)).toHaveLength(MESURES.length);
      expect(ligne.valeurs["heures"]).toBeGreaterThan(0);
      expect(Object.keys(ligne.verdicts).length).toBeGreaterThan(5);
    },
    60_000,
  );

  it("donne un archétype à chaque profil déclaré", () => {
    for (const archetype of ARCHETYPES) {
      expect(construireMondeFictif(1, archetype).archetype).toBe(archetype.id);
    }
  });
});
