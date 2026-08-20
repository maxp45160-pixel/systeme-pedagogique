import { describe, expect, it } from "vitest";
import { calculerStatistiquesAdmin, filtrerComptes } from "./admin-kpi";
import type { CompteAdministre } from "./acces";

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
    ...partiel,
  };
}

describe("calculerStatistiquesAdmin", () => {
  const maintenant = new Date("2026-08-16T12:00:00Z");

  it("gère une liste vide sans division par zéro", () => {
    const kpis = calculerStatistiquesAdmin([], maintenant);
    expect(kpis.totalComptes).toBe(0);
    expect(kpis.comptesActifs).toBe(0);
    expect(kpis.comptesSuspendus).toBe(0);
    expect(kpis.totalAdmins).toBe(0);
    expect(kpis.totalMembres).toBe(0);
    expect(kpis.moyenneObservations).toBe(0);
    expect(kpis.tauxEngagement).toBe(0);
    expect(kpis.topActifs).toEqual([]);
    expect(kpis.derniersInscrits).toEqual([]);
  });

  it("calcule les totaux, moyennes et taux d'engagement", () => {
    const c1 = compte({
      userId: "u1",
      email: "alice@test.com",
      prenom: "Alice",
      role: "admin",
      creeLe: "2026-08-14T10:00:00Z", // 2j avant
      derniereActivite: "2026-08-16T08:00:00Z", // aujourd'hui
      observations: 10,
      exercices: 5,
      seances: 4,
      competences: 6,
    });
    const c2 = compte({
      userId: "u2",
      email: "bob@test.com",
      prenom: "Bob",
      role: "membre",
      creeLe: "2026-07-01T10:00:00Z", // >30j avant
      derniereActivite: "2026-08-01T10:00:00Z", // 15j avant
      observations: 2,
      exercices: 1,
      seances: 1,
      competences: 2,
    });
    const c3 = compte({
      userId: "u3",
      email: "charlie@test.com",
      prenom: "Charlie",
      role: "membre",
      suspenduLe: "2026-08-10T10:00:00Z",
      creeLe: "2026-08-05T10:00:00Z", // 11j avant
      derniereActivite: null,
      observations: 0,
      exercices: 0,
      seances: 0,
      competences: 0,
    });

    const kpis = calculerStatistiquesAdmin([c1, c2, c3], maintenant);

    expect(kpis.totalComptes).toBe(3);
    expect(kpis.comptesActifs).toBe(2);
    expect(kpis.comptesSuspendus).toBe(1);
    expect(kpis.totalAdmins).toBe(1);
    expect(kpis.totalMembres).toBe(2);

    expect(kpis.totalObservations).toBe(12);
    expect(kpis.totalExercices).toBe(6);
    expect(kpis.totalSeances).toBe(5);
    expect(kpis.totalCompetences).toBe(8);

    expect(kpis.moyenneObservations).toBe(4); // 12 / 3 = 4
    expect(kpis.moyenneExercices).toBe(2); // 6 / 3 = 2
    expect(kpis.moyenneSeances).toBe(1.7); // 5 / 3 = 1.666 -> 1.7

    // 2 sur 3 ont de l'activité -> 67%
    expect(kpis.tauxEngagement).toBe(67);

    // Temporel
    expect(kpis.nouveaux7j).toBe(1); // Alice
    expect(kpis.nouveaux30j).toBe(2); // Alice, Charlie
    expect(kpis.actifs7j).toBe(1); // Alice
    expect(kpis.actifs30j).toBe(2); // Alice, Bob

    // Répartition d'activité
    expect(kpis.repartitionActivite.aucune).toBe(1); // Charlie
    expect(kpis.repartitionActivite.debutant).toBe(1); // Bob (1 séance)
    expect(kpis.repartitionActivite.regulier).toBe(1); // Alice (4 séances)
    expect(kpis.repartitionActivite.intensif).toBe(0);

    // Listes ordonnées
    expect(kpis.topActifs[0]?.userId).toBe("u1");
    expect(kpis.topActifs[1]?.userId).toBe("u2");
    expect(kpis.derniersInscrits[0]?.userId).toBe("u1");
    expect(kpis.derniersInscrits[1]?.userId).toBe("u3");
  });
});

describe("filtrerComptes", () => {
  const maintenant = new Date("2026-08-16T12:00:00Z");

  const c1 = compte({
    userId: "1",
    prenom: "Maxime",
    email: "maxime@test.com",
    role: "admin",
    derniereActivite: "2026-08-16T10:00:00Z",
  });
  const c2 = compte({
    userId: "2",
    prenom: "Sophie",
    email: "sophie@ecole.fr",
    role: "membre",
    derniereActivite: "2026-07-01T10:00:00Z",
  });
  const c3 = compte({
    userId: "3",
    prenom: "Thomas",
    email: "thomas@gmail.com",
    role: "membre",
    suspenduLe: "2026-08-15T10:00:00Z",
  });

  const comptes = [c1, c2, c3];

  it("recherche par prénom et e-mail insensible à la casse", () => {
    expect(filtrerComptes(comptes, { recherche: "max" })).toEqual([c1]);
    expect(filtrerComptes(comptes, { recherche: "ECOLE.FR" })).toEqual([c2]);
    expect(filtrerComptes(comptes, { recherche: "inconnu" })).toEqual([]);
  });

  it("filtre par rôle", () => {
    expect(filtrerComptes(comptes, { role: "admin" })).toEqual([c1]);
    expect(filtrerComptes(comptes, { role: "membre" })).toEqual([c2, c3]);
  });

  it("filtre par statut", () => {
    expect(filtrerComptes(comptes, { statut: "actifs" })).toEqual([c1, c2]);
    expect(filtrerComptes(comptes, { statut: "suspendus" })).toEqual([c3]);
    expect(filtrerComptes(comptes, { statut: "recents" }, maintenant)).toEqual([c1]);
    expect(filtrerComptes(comptes, { statut: "inactifs" }, maintenant)).toEqual([c2]);
  });
});
