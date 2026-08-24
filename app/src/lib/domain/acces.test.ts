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
    role: "membre",
    suspenduLe: null,
    motif: null,
    creeLe: null,
    observations: 0,
    exercices: 0,
    seances: 0,
    competences: 0,
    derniereActivite: null,
    quotaMensuel: 150,
    quotaAppels: 0,
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
    expect(refusChangementRole(moi, "membre", "moi")).toMatch(/votre propre rôle/);
  });

  it("refuse formellement de rétrograder un administrateur", () => {
    const adminA = compte({ userId: "maxime", role: "admin" });
    expect(refusChangementRole(adminA, "membre", "autre_admin")).toMatch(
      /administrateur ne peut pas être rétrogradé/,
    );
  });

  it("laisse promouvoir un membre en administrateur", () => {
    const cible = compte({ userId: "cible", role: "membre" });
    expect(refusChangementRole(cible, "admin", "moi")).toBeNull();
  });

  it("refuse un rôle déjà porté", () => {
    const cible = compte({ userId: "cible", role: "admin" });
    expect(refusChangementRole(cible, "admin", "moi")).toMatch(/déjà ce rôle/);
  });
});

describe("refusSuspension", () => {
  it("refuse de se suspendre soi-même", () => {
    const moi = compte({ userId: "moi", role: "admin" });
    expect(refusSuspension(moi, "moi")).toMatch(/votre propre accès/);
  });

  it("refuse formellement de suspendre un administrateur", () => {
    const adminA = compte({ userId: "maxime", role: "admin" });
    expect(refusSuspension(adminA, "autre_admin")).toMatch(
      /administrateur ne peut pas être suspendu/,
    );
  });

  it("laisse suspendre un membre", () => {
    const cible = compte({ userId: "cible", role: "membre" });
    expect(refusSuspension(cible, "moi")).toBeNull();
  });

  it("refuse de suspendre deux fois", () => {
    const cible = compte({ userId: "cible", suspenduLe: "2026-08-16" });
    expect(refusSuspension(cible, "moi")).toMatch(/déjà suspendu/);
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
