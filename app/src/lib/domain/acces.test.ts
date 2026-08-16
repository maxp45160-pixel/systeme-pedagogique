import { describe, expect, it } from "vitest";
import {
  MOTIF_MAX,
  estRoleConnu,
  estSuspendu,
  normaliserMotif,
  refusChangementRole,
  refusReactivation,
  refusSuspension,
  type CompteAdministre,
} from "./acces";

function compte(partiel: Partial<CompteAdministre> & { userId: string }): CompteAdministre {
  return {
    email: null,
    prenom: null,
    plan: null,
    role: "membre",
    suspenduLe: null,
    motif: null,
    creeLe: null,
    preuves: 0,
    exercices: 0,
    seances: 0,
    competences: 0,
    derniereActivite: null,
    ...partiel,
  };
}

describe("estRoleConnu", () => {
  it("n'accepte que les deux rôles du produit", () => {
    expect(estRoleConnu("membre")).toBe(true);
    expect(estRoleConnu("admin")).toBe(true);
    expect(estRoleConnu("superadmin")).toBe(false);
    expect(estRoleConnu("")).toBe(false);
  });
});

describe("refusChangementRole", () => {
  const moi = compte({ userId: "moi", role: "admin" });

  it("refuse de changer son propre rôle", () => {
    const comptes = [moi, compte({ userId: "autre", role: "admin" })];
    expect(refusChangementRole(moi, "membre", "moi", comptes)).toMatch(/ton propre rôle/);
  });

  it("refuse de retirer le dernier administrateur actif", () => {
    const seul = compte({ userId: "seul", role: "admin" });
    const comptes = [seul, compte({ userId: "membre" })];
    expect(refusChangementRole(seul, "membre", "moi", comptes)).toMatch(/dernier administrateur/);
  });

  it("compte un administrateur suspendu comme absent", () => {
    const actif = compte({ userId: "actif", role: "admin" });
    const suspendu = compte({ userId: "endormi", role: "admin", suspenduLe: "2026-08-01" });
    expect(refusChangementRole(actif, "membre", "moi", [actif, suspendu])).toMatch(
      /dernier administrateur/,
    );
  });

  it("laisse retirer un administrateur quand un autre reste actif", () => {
    const cible = compte({ userId: "cible", role: "admin" });
    const comptes = [cible, compte({ userId: "moi", role: "admin" })];
    expect(refusChangementRole(cible, "membre", "moi", comptes)).toBeNull();
  });

  it("laisse promouvoir un membre", () => {
    const cible = compte({ userId: "cible" });
    expect(refusChangementRole(cible, "admin", "moi", [cible])).toBeNull();
  });

  it("refuse un rôle déjà porté", () => {
    const cible = compte({ userId: "cible", role: "admin" });
    expect(refusChangementRole(cible, "admin", "moi", [cible])).toMatch(/déjà ce rôle/);
  });
});

describe("refusSuspension", () => {
  it("refuse de se suspendre soi-même", () => {
    const moi = compte({ userId: "moi", role: "admin" });
    expect(refusSuspension(moi, "moi", [moi, compte({ userId: "b", role: "admin" })])).toMatch(
      /ton propre accès/,
    );
  });

  it("refuse de suspendre le dernier administrateur", () => {
    const seul = compte({ userId: "seul", role: "admin" });
    expect(refusSuspension(seul, "moi", [seul])).toMatch(/dernier administrateur/);
  });

  it("laisse suspendre un membre", () => {
    const cible = compte({ userId: "cible" });
    expect(refusSuspension(cible, "moi", [cible])).toBeNull();
  });

  it("refuse de suspendre deux fois", () => {
    const cible = compte({ userId: "cible", suspenduLe: "2026-08-16" });
    expect(refusSuspension(cible, "moi", [cible])).toMatch(/déjà suspendu/);
  });
});

describe("refusReactivation", () => {
  it("n'accepte que les comptes suspendus", () => {
    expect(refusReactivation(compte({ userId: "a", suspenduLe: "2026-08-16" }))).toBeNull();
    expect(refusReactivation(compte({ userId: "a" }))).toMatch(/n'est pas suspendu/);
  });
});

describe("estSuspendu", () => {
  it("lit la date, pas un drapeau séparé", () => {
    expect(estSuspendu(compte({ userId: "a" }))).toBe(false);
    expect(estSuspendu(compte({ userId: "a", suspenduLe: "2026-08-16T10:00:00Z" }))).toBe(true);
  });
});

describe("normaliserMotif", () => {
  it("rend null pour un motif vide ou blanc", () => {
    expect(normaliserMotif("")).toBeNull();
    expect(normaliserMotif("   \n ")).toBeNull();
  });

  it("réduit les espaces et borne la longueur", () => {
    expect(normaliserMotif("  compte   de   test ")).toBe("compte de test");
    expect(normaliserMotif("x".repeat(MOTIF_MAX + 50))).toHaveLength(MOTIF_MAX);
  });
});
