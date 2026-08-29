import { describe, expect, it } from "vitest";
import {
  SOURCE_DISPONIBILITE_PROFIL,
  ajouterDisponibiliteDeclaree,
  modifierDisponibiliteDeclaree,
  normaliserDisponibilitesDeclarees,
  supprimerDisponibiliteDeclaree,
} from "./contexte-orchestration";

const creneau = (jour: string, debut: string, fin: string) => ({
  startsAt: "2026-09-" + jour + "T" + debut + ":00.000Z",
  endsAt: "2026-09-" + jour + "T" + fin + ":00.000Z",
});

describe("disponibilités déclarées", () => {
  it("ajoute trois créneaux et conserve leur source explicite", () => {
    const un = ajouterDisponibiliteDeclaree([], creneau("01", "08:00", "09:00"));
    const deux = ajouterDisponibiliteDeclaree(un, creneau("02", "10:00", "11:00"));
    const trois = ajouterDisponibiliteDeclaree(deux, creneau("03", "14:00", "15:00"));

    expect(trois).toHaveLength(3);
    expect(trois.every((entree) => entree.sourceRef === SOURCE_DISPONIBILITE_PROFIL)).toBe(true);
  });

  it("modifie le deuxième créneau sans perdre les deux autres", () => {
    const trois = normaliserDisponibilitesDeclarees([
      creneau("01", "08:00", "09:00"),
      creneau("02", "10:00", "11:00"),
      creneau("03", "14:00", "15:00"),
    ]);
    const modifie = modifierDisponibiliteDeclaree(
      trois,
      1,
      creneau("02", "12:00", "13:30"),
    );

    expect(modifie).toHaveLength(3);
    expect(modifie[0].startsAt).toContain("08:00");
    expect(modifie[1].startsAt).toContain("12:00");
    expect(modifie[2].startsAt).toContain("14:00");
  });

  it("supprime le premier créneau et conserve le deuxième modifié et le troisième", () => {
    const trois = normaliserDisponibilitesDeclarees([
      creneau("01", "08:00", "09:00"),
      creneau("02", "12:00", "13:30"),
      creneau("03", "14:00", "15:00"),
    ]);

    expect(supprimerDisponibiliteDeclaree(trois, 0).map((entree) => entree.startsAt)).toEqual([
      "2026-09-02T12:00:00.000Z",
      "2026-09-03T14:00:00.000Z",
    ]);
  });

  it("refuse une fenêtre inversée et les chevauchements", () => {
    expect(() => normaliserDisponibilitesDeclarees([
      creneau("04", "10:00", "09:00"),
    ])).toThrow(/se terminer après/);
    expect(() => normaliserDisponibilitesDeclarees([
      creneau("04", "10:00", "12:00"),
      creneau("04", "11:00", "13:00"),
    ])).toThrow(/chevauchent/);
  });

  it("accepte deux créneaux contigus : une fin n'est pas un chevauchement", () => {
    expect(normaliserDisponibilitesDeclarees([
      creneau("05", "10:00", "11:00"),
      creneau("05", "11:00", "12:00"),
    ])).toHaveLength(2);
  });

  it("refuse un index d'édition ou de suppression inexistant", () => {
    const existant = normaliserDisponibilitesDeclarees([
      creneau("06", "10:00", "11:00"),
    ]);
    expect(() => modifierDisponibiliteDeclaree(existant, 1, creneau("06", "12:00", "13:00"))).toThrow(/modifier/);
    expect(() => supprimerDisponibiliteDeclaree(existant, 1)).toThrow(/supprimer/);
  });
});
