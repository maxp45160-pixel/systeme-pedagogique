import { describe, expect, it } from "vitest";
import {
  analyserFicheProjet,
  CHAMP_JALONS_FAITS,
  ecrireJalonsFaits,
  lireJalonsFaits,
} from "./projet";
import { lireValeursSections } from "./sections-markdown";
import { parserFrontMatter } from "./markdown";

/*
 * La fiche de référence : exactement ce que `remplirFicheProjet` écrit. Si le
 * writer change, ce test tombe — c'est le point.
 */
const FICHE = `---
schema: 1
type: projet
id: doc-1
role: operationnel
projet_visee: application
projet_duree_min: 120
projet_competences: LOG-01, LOG-10
created_at: 2026-08-16
---

# Mise en place d'un suivi de stock

## Énoncé

Vous êtes chargé(e) de mettre en place un système de suivi de stock.

Les vélos sont composés de sous-ensembles.

*Durée estimée : 120 min, reprenable par segments de 20 min.*

**Compétences visées**

- [[LOG-01]] — Modéliser et résoudre un problème de gestion de stock
- [[LOG-10]] — Lire et interpréter un schéma de flux logistique

## Étapes

1. **Modéliser les flux** — Décris la nomenclature multi-niveaux.
   *Attendu :* un schéma commenté.
2. **Calculer les paramètres** — Applique la méthode MRP.
   *Attendu :* un tableau de besoins nets.

## Critères d'évaluation

**Sections attendues du rendu**

- **Analyse** — ce que tu as compris du flux
- **Calculs** — les paramètres retenus et leur justification

**Critères d'évaluation**

- [[LOG-01]] — Le modèle rend compte de la demande variable
- [[LOG-10]] — Les goulots sont identifiés et justifiés

> Ces critères se lisent : ils ne produisent aucune mesure automatique.
> Ce que le travail démontre reste à établir à la relecture.

## Travail réalisé

## Résultats
`;

const SECTIONS = [
  "Énoncé",
  "Étapes",
  "Critères d'évaluation",
  "Travail réalisé",
  "Résultats",
];

function fiche() {
  return analyserFicheProjet(lireValeursSections(FICHE, SECTIONS));
}

describe("analyserFicheProjet", () => {
  it("garde le brief entier, sans la durée ni les compétences", () => {
    const analyse = fiche();
    expect(analyse.brief).toContain("Vous êtes chargé(e)");
    expect(analyse.brief).toContain("Les vélos sont composés");
    expect(analyse.brief).not.toContain("Durée estimée");
    expect(analyse.brief).not.toContain("LOG-01");
  });

  it("lit la durée et le segment", () => {
    expect(fiche().dureeMin).toBe(120);
    expect(fiche().segmentMin).toBe(20);
  });

  it("nomme les compétences visées", () => {
    expect(fiche().competences).toEqual([
      { code: "LOG-01", intitule: "Modéliser et résoudre un problème de gestion de stock" },
      { code: "LOG-10", intitule: "Lire et interpréter un schéma de flux logistique" },
    ]);
  });

  it("rattache chaque attendu à son jalon", () => {
    const jalons = fiche().jalons;
    expect(jalons).toHaveLength(2);
    expect(jalons[0]).toEqual({
      titre: "Modéliser les flux",
      consigne: "Décris la nomenclature multi-niveaux.",
      attendu: "un schéma commenté.",
    });
    expect(jalons[1].titre).toBe("Calculer les paramètres");
  });

  it("sépare les sections attendues des critères", () => {
    const analyse = fiche();
    expect(analyse.sectionsRendu).toHaveLength(2);
    expect(analyse.sectionsRendu[0].section).toBe("Analyse");
    expect(analyse.criteres).toHaveLength(2);
    expect(analyse.criteres[0]).toEqual({
      code: "LOG-01",
      label: "Le modèle rend compte de la demande variable",
    });
  });

  it("recueille les avertissements en citation", () => {
    expect(fiche().notes).toHaveLength(2);
    expect(fiche().notes[0]).toContain("aucune mesure automatique");
  });

  it("ne fabrique rien depuis une fiche vide", () => {
    const vide = analyserFicheProjet({});
    expect(vide.brief).toBe("");
    expect(vide.competences).toEqual([]);
    expect(vide.jalons).toEqual([]);
    expect(vide.criteres).toEqual([]);
    expect(vide.dureeMin).toBeUndefined();
  });
});

describe("jalons faits", () => {
  it("relit ce qui a été écrit", () => {
    const suivant = ecrireJalonsFaits(FICHE, [2, 1, 1]);
    expect(suivant).toContain(`${CHAMP_JALONS_FAITS}: 1, 2`);
    const { frontMatter } = parserFrontMatter(suivant);
    expect([...lireJalonsFaits(frontMatter)].sort()).toEqual([1, 2]);
  });

  it("retire le champ quand plus rien n'est coché", () => {
    const avec = ecrireJalonsFaits(FICHE, [1]);
    const sans = ecrireJalonsFaits(avec, []);
    expect(sans).not.toContain(CHAMP_JALONS_FAITS);
  });

  it("n'écrit pas deux fois le même champ", () => {
    const deuxFois = ecrireJalonsFaits(ecrireJalonsFaits(FICHE, [1]), [3]);
    expect(deuxFois.match(new RegExp(CHAMP_JALONS_FAITS, "g"))).toHaveLength(1);
    expect(deuxFois).toContain(`${CHAMP_JALONS_FAITS}: 3`);
  });

  it("laisse intact un document sans front-matter", () => {
    const nu = "# Titre\n\n## Étapes\n";
    expect(ecrireJalonsFaits(nu, [1])).toBe(nu);
  });

  it("ne touche pas au corps", () => {
    const suivant = ecrireJalonsFaits(FICHE, [1]);
    expect(suivant).toContain("## Étapes");
    expect(suivant).toContain("*Attendu :* un schéma commenté.");
  });

  it("ignore une valeur qui n'est pas un index de jalon", () => {
    expect([...lireJalonsFaits({ [CHAMP_JALONS_FAITS]: "1, zéro, -2, 3" })]).toEqual([1, 3]);
  });
});
