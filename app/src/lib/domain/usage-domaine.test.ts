import { describe, expect, it } from "vitest";
import type { Domaine } from "@/lib/domain/types";
import {
  USAGE_INDETERMINE,
  estModuleActif,
  motifRefusUsageDomaine,
  repartirDomainesParUsage,
  usageDuDomaine,
  validerNouvelUsage,
} from "./usage-domaine";

function domaine(options: Partial<Domaine> = {}): Domaine {
  return {
    id: "algebre",
    nom: "Algèbre",
    prefixe: "ALG",
    description: "",
    ordre: 0,
    version: 1,
    archive: false,
    origine: "utilisateur",
    ...options,
  };
}

describe("motifRefusUsageDomaine", () => {
  it("accepte les trois natures fermées", () => {
    expect(motifRefusUsageDomaine({ type: "indetermine" })).toBeNull();
    expect(motifRefusUsageDomaine({ type: "continu" })).toBeNull();
    expect(
      motifRefusUsageDomaine({ type: "module", anneeAcademique: "2026-2027" }),
    ).toBeNull();
    expect(
      motifRefusUsageDomaine({
        type: "module",
        anneeAcademique: "2026-2027",
        periode: "S1",
      }),
    ).toBeNull();
  });

  it("refuse une nature inconnue avec son motif", () => {
    expect(motifRefusUsageDomaine({ type: "cours" })).toContain("nature « cours » inconnue");
  });

  it("exige l'année académique d'un module — un module sans cadre est un module deviné", () => {
    expect(motifRefusUsageDomaine({ type: "module" })).toContain("année académique");
    expect(motifRefusUsageDomaine({ type: "module", anneeAcademique: "   " })).toContain(
      "année académique",
    );
  });

  it("refuse une année ou une période hors module", () => {
    expect(
      motifRefusUsageDomaine({ type: "continu", anneeAcademique: "2026-2027" }),
    ).toContain("ne se déclare que pour un module");
    expect(motifRefusUsageDomaine({ type: "indetermine", periode: "S2" })).toContain(
      "ne se déclare que pour un module",
    );
  });
});

describe("validerNouvelUsage", () => {
  it("renvoie les champs prêts pour la commande SQL", () => {
    expect(validerNouvelUsage({ type: "continu" })).toEqual({
      usageType: "continu",
      anneeAcademique: null,
      periode: null,
    });
    expect(
      validerNouvelUsage({ type: "module", anneeAcademique: " 2026-2027 ", periode: "S1 " }),
    ).toEqual({
      usageType: "module",
      anneeAcademique: "2026-2027",
      periode: "S1",
    });
  });

  it("traduit « à préciser » en NULL — remise explicite, jamais déduite", () => {
    expect(validerNouvelUsage({ type: "indetermine" })).toEqual({
      usageType: null,
      anneeAcademique: null,
      periode: null,
    });
  });

  it("lève bruyamment sur une année manquante — aucun repli silencieux", () => {
    expect(() => validerNouvelUsage({ type: "module" })).toThrow("Usage du domaine refusé");
  });
});

describe("usageDuDomaine", () => {
  it("lit l'absence de champ comme « à préciser » — le même fait", () => {
    expect(usageDuDomaine(domaine())).toBe(USAGE_INDETERMINE);
    expect(usageDuDomaine(domaine({ usage: { type: "indetermine" } }))).toEqual({
      type: "indetermine",
    });
  });

  it("rend le cadre module tel que déclaré", () => {
    const usage = usageDuDomaine(
      domaine({ usage: { type: "module", module: { anneeAcademique: "2026-2027" } } }),
    );
    expect(usage).toEqual({ type: "module", module: { anneeAcademique: "2026-2027" } });
  });
});

describe("repartirDomainesParUsage", () => {
  it("sépare les trois natures et exclut les archivés", () => {
    const moduleActif = domaine({
      id: "stats-l1",
      nom: "Statistiques L1",
      usage: { type: "module", module: { anneeAcademique: "2026-2027", periode: "S1" } },
    });
    const moduleClos = domaine({
      id: "algo-l1",
      nom: "Algorithmique L1",
      usage: {
        type: "module",
        module: { anneeAcademique: "2025-2026", closLe: "2026-06-30T00:00:00Z" },
      },
    });
    const continu = domaine({ id: "musique", nom: "Piano", usage: { type: "continu" } });
    const aPreciser = domaine({ id: "divers", nom: "Divers" });
    const archive = domaine({ id: "vieux", nom: "Vieux", archive: true });

    const repartition = repartirDomainesParUsage([
      aPreciser,
      moduleClos,
      continu,
      moduleActif,
      archive,
    ]);

    expect(repartition.modulesActifs).toEqual([moduleActif]);
    expect(repartition.modulesClos).toEqual([moduleClos]);
    expect(repartition.continues).toEqual([continu]);
    expect(repartition.aPreciser).toEqual([aPreciser]);
  });

  it("trie les modules par année puis période déclarées", () => {
    const s2 = domaine({
      id: "b",
      nom: "B",
      usage: { type: "module", module: { anneeAcademique: "2026-2027", periode: "S2" } },
    });
    const s1 = domaine({
      id: "a",
      nom: "Zeta",
      usage: { type: "module", module: { anneeAcademique: "2026-2027", periode: "S1" } },
    });
    const avant = domaine({
      id: "c",
      nom: "C",
      usage: { type: "module", module: { anneeAcademique: "2025-2026" } },
    });

    const repartition = repartirDomainesParUsage([s2, avant, s1]);
    expect(repartition.modulesActifs.map((d) => d.id)).toEqual(["c", "a", "b"]);
  });

  it("clôturer un module le fait passer d'actif à clos sans rien effacer", () => {
    const avant = domaine({
      usage: { type: "module", module: { anneeAcademique: "2025-2026" } },
    });
    expect(estModuleActif(avant)).toBe(true);

    const apres: Domaine = {
      ...avant,
      usage: {
        type: "module",
        module: { anneeAcademique: "2025-2026", closLe: "2026-06-30T00:00:00Z" },
      },
    };
    expect(estModuleActif(apres)).toBe(false);

    const repartition = repartirDomainesParUsage([apres]);
    expect(repartition.modulesActifs).toHaveLength(0);
    expect(repartition.modulesClos).toHaveLength(1);
  });
});
