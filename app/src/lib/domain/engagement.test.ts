import { describe, expect, it } from "vitest";
import type { SkillState } from "@/lib/domain/types";
import {
  couvertureCompetences,
  estOuvert,
  fenetreEcheance,
  joursRestants,
  libelleCompte,
  triParUrgence,
  validerNouvelEngagement,
  type Engagement,
} from "./engagement";

const MAINTENANT = new Date(2026, 7, 22); // 22/08/2026, midi local
const iso = (annee: number, mois: number, jour: number) =>
  `${annee}-${String(mois).padStart(2, "0")}-${String(jour).padStart(2, "0")}`;

function engagement(options: Partial<Engagement> = {}): Engagement {
  return {
    id: "eng-1",
    type: "examen",
    libelle: "Contrôle de stocks",
    echeanceLe: iso(2026, 9, 5),
    codes: ["LOG-01"],
    ...options,
  };
}

describe("joursRestants", () => {
  it("compte des jours calendaires", () => {
    expect(joursRestants(iso(2026, 8, 25), MAINTENANT)).toBe(3);
    expect(joursRestants(iso(2026, 8, 22), MAINTENANT)).toBe(0);
    expect(joursRestants(iso(2026, 8, 20), MAINTENANT)).toBe(-2);
  });

  it("traverse une frontière de mois", () => {
    expect(joursRestants(iso(2026, 9, 1), MAINTENANT)).toBe(10);
  });
});

describe("fenêtre d'échéance — J-21 inclus à la veille incluse", () => {
  it("entre dans la fenêtre à J-21", () => {
    expect(fenetreEcheance(MAINTENANT, iso(2026, 9, 12))).toBe(true);
  });

  it("reste dans la fenêtre à la veille (J-1)", () => {
    expect(fenetreEcheance(MAINTENANT, iso(2026, 8, 23))).toBe(true);
  });

  it("sort de la fenêtre au-delà de trois semaines", () => {
    expect(fenetreEcheance(MAINTENANT, iso(2026, 9, 13))).toBe(false);
  });

  it("exclut le jour même et le passé", () => {
    expect(fenetreEcheance(MAINTENANT, iso(2026, 8, 22))).toBe(false);
    expect(fenetreEcheance(MAINTENANT, iso(2026, 8, 15))).toBe(false);
  });
});

describe("libelleCompte", () => {
  it("nomme les distances usuelles sans invention", () => {
    expect(libelleCompte(21)).toBe("dans 21 jours");
    expect(libelleCompte(3)).toBe("dans 3 jours");
    expect(libelleCompte(1)).toBe("demain");
    expect(libelleCompte(0)).toBe("aujourd'hui");
    expect(libelleCompte(-3)).toBe("passé depuis 3 jours");
    expect(libelleCompte(-1)).toBe("passé depuis 1 jour");
  });
});

describe("estOuvert / triParUrgence", () => {
  it("un engagement clôturé n'est plus ouvert", () => {
    expect(estOuvert(engagement())).toBe(true);
    expect(estOuvert(engagement({ clotureLe: "2026-08-22T10:00:00Z" }))).toBe(false);
    expect(
      estOuvert(engagement({ clotureType: "passe", clotureLe: "2026-08-22T10:00:00Z" })),
    ).toBe(false);
  });

  it("tri par urgence croissante, sans muter l'entrée", () => {
    const lointain = engagement({ id: "b", echeanceLe: iso(2026, 10, 1) });
    const proche = engagement({ id: "a", echeanceLe: iso(2026, 8, 30) });
    const liste = [lointain, proche];
    const triee = triParUrgence(liste);
    expect(triee.map((e) => e.id)).toEqual(["a", "b"]);
    expect(liste.map((e) => e.id)).toEqual(["b", "a"]);
  });
});

describe("validation de création — refus bruyant sur chaque règle", () => {
  const CODES = new Set(["LOG-01", "LOG-02"]);

  it("accepte une création valide et rogne le libellé", () => {
    expect(
      validerNouvelEngagement(
        { type: "examen", libelle: "  Contrôle  ", echeanceLe: "2026-09-05", codes: ["LOG-01"] },
        CODES,
      ),
    ).toEqual({ type: "examen", libelle: "Contrôle", echeanceLe: "2026-09-05", codes: ["LOG-01"] });
  });

  it("refuse un type hors énumération fermée", () => {
    expect(() =>
      validerNouvelEngagement(
        { type: "rappel", libelle: "X", echeanceLe: "2026-09-05" },
        CODES,
      ),
    ).toThrow(/type « rappel » inconnu/);
  });

  it("refuse un libellé vide", () => {
    expect(() =>
      validerNouvelEngagement({ type: "examen", libelle: "   ", echeanceLe: "2026-09-05" }, CODES),
    ).toThrow(/libellé ne peut pas être vide/);
  });

  it("refuse une date non ISO ou inexistante", () => {
    expect(() =>
      validerNouvelEngagement({ type: "examen", libelle: "X", echeanceLe: "05/09/2026" }, CODES),
    ).toThrow(/AAAA-MM-JJ/);
    expect(() =>
      validerNouvelEngagement({ type: "examen", libelle: "X", echeanceLe: "2026-02-31" }, CODES),
    ).toThrow(/n'existe pas au calendrier/);
  });

  it("refuse bruyamment tout code hors référentiel, en citant les codes", () => {
    expect(() =>
      validerNouvelEngagement(
        { type: "rendu", libelle: "Dossier", echeanceLe: "2026-09-05", codes: ["LOG-01", "ZZ-99"] },
        CODES,
      ),
    ).toThrow(/inconnue\(s\) du référentiel : ZZ-99/);
  });

  it("déduplique les codes fournis", () => {
    const resultat = validerNouvelEngagement(
      { type: "examen", libelle: "X", echeanceLe: "2026-09-05", codes: ["LOG-01", "LOG-01"] },
      CODES,
    );
    expect(resultat.codes).toEqual(["LOG-01"]);
  });
});

describe("couverture dérivée (A5) — absence de preuve ≠ zéro", () => {
  const etatObserve = {
    skill: { code: "LOG-01", intitule: "Quantité économique" },
    niveau: 3,
    observations: [{ id: "obs-1" }],
    derniereObservation: "2026-08-18",
  } as unknown as SkillState;

  const etatVide = {
    skill: { code: "LOG-02", intitule: "Stocks de sécurité" },
    niveau: null,
    observations: [],
    derniereObservation: null,
  } as unknown as SkillState;

  const etats = new Map([
    ["LOG-01", etatObserve],
    ["LOG-02", etatVide],
  ]);

  it("lit le niveau et la dernière activité quand ils existent", () => {
    const [couverture] = couvertureCompetences(["LOG-01"], etats);
    expect(couverture.observe).toBe(true);
    expect(couverture.niveau).toBe(3);
    expect(couverture.derniereActivite).toBe("2026-08-18");
    expect(couverture.phrase).toContain("niveau 3");
  });

  it("dit explicitement l'absence de preuve, jamais un zéro", () => {
    const [couverture] = couvertureCompetences(["LOG-02"], etats);
    expect(couverture.observe).toBe(false);
    expect(couverture.niveau).toBeNull();
    expect(couverture.phrase).toContain("Rien encore observé");
  });

  it("traite un code sorti du référentiel comme une absence, pas une erreur", () => {
    const [couverture] = couvertureCompetences(["XX-99"], etats);
    expect(couverture.observe).toBe(false);
    expect(couverture.niveau).toBeNull();
    expect(couverture.phrase).toContain("Rien encore observé sur XX-99");
  });
});
