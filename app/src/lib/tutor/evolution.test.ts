/**
 * Ce que ces tests protègent.
 *
 * « Que devient cette compétence ? » est la question la plus propice à
 * l'invention de tout le système : les progressions pédagogiques plausibles
 * sont un genre que le modèle connaît bien, et il peut en produire une sans
 * jamais regarder les preuves.
 *
 * Le prompt est donc le garde-fou, et ces tests le vérifient sur deux points :
 * il porte **les valeurs mesurées** (et seulement elles), et il porte les
 * **intitulés voisins** — sans lesquels le successeur proposé redouble une
 * compétence qui existe à trois lignes de là.
 */

import { describe, expect, it } from "vitest";

import { construirePromptEvolution, proposerEvolution } from "./evolution";
import type { Domaine, Skill, SkillState } from "@/lib/domain/types";
import type { Maitrise } from "@/lib/engine/maitrise";
import type { MoteurTuteur } from "./moteurs";
import type { PropositionEvolution } from "./outils";

/* ------------------------------------------------------------------ */
/* Fixtures                                                            */
/* ------------------------------------------------------------------ */

const DOMAINE: Domaine = {
  id: "debutant",
  nom: "Développement logiciel pour débutants",
  prefixe: "DEB",
  description: "",
} as unknown as Domaine;

const DEB_01 = {
  code: "DEB-01",
  intitule: "Organiser une séquence d'actions sous contrainte",
  domaine: "debutant",
  palier: "fondamentaux",
} as unknown as Skill;

const VOISINES = [
  { code: "DEB-02", intitule: "Lire une trace d'exécution", palier: "fondamentaux" },
  { code: "DEB-03", intitule: "Décomposer un problème en sous-problèmes", palier: "intermediaire" },
] as unknown as Skill[];

function etat(surcharge: Partial<SkillState> = {}): SkillState {
  return {
    skill: DEB_01,
    niveau: 4,
    score: 78,
    confiance: "moyenne",
    robustesse: 62,
    dimensions: {},
    preuves: [],
    contextesTestes: ["Une partie de League of Legends", "Une quête dans le Royaume d'Eldoria"],
    dernierePreuve: "2026-08-06",
    joursDepuisDernierePreuve: 1,
    contradictions: [],
    prochaineEtape: "",
    explication: { resume: "", facteurs: [], nombrePreuves: 2, reserves: [] },
    statut: "evalue",
    ...surcharge,
  } as SkillState;
}

function maitrise(surcharge: Partial<Maitrise> = {}): Maitrise {
  return {
    code: "DEB-01",
    maitrisee: true,
    manque: null,
    explication: { resume: "", facteurs: [], nombrePreuves: 2, reserves: [] },
    ...surcharge,
  };
}

const EVOLUTION: PropositionEvolution = {
  evolution: "successeur",
  raisonnement: "Deux réussites autonomes sur deux contextes éloignés.",
  intitule: "Ordonnancer des tâches sous contraintes de dépendances",
  palier: "intermediaire",
  importance: "0.6",
  contexte: "",
};

function moteurQuiEmet(evenements: { evenement: string; donnees: unknown }[]): MoteurTuteur {
  return {
    async repondre({ envoyer }: { envoyer: (e: string, d: unknown) => void }) {
      for (const e of evenements) envoyer(e.evenement, e.donnees);
    },
  } as unknown as MoteurTuteur;
}

function moteurQuiCapture(capture: { demande?: Record<string, unknown> }): MoteurTuteur {
  return {
    async repondre(demande: Record<string, unknown>) {
      capture.demande = demande;
    },
  } as unknown as MoteurTuteur;
}

/* ------------------------------------------------------------------ */
/* Le prompt                                                           */
/* ------------------------------------------------------------------ */

describe("construirePromptEvolution", () => {
  it("porte le niveau, la confiance et le nombre de preuves réellement mesurés", () => {
    const prompt = construirePromptEvolution(etat(), maitrise(), VOISINES, DOMAINE);
    expect(prompt).toContain("Niveau 4 sur 5");
    expect(prompt).toContain("Confiance moyenne");
    expect(prompt).toContain("2 preuve(s) retenue(s)");
  });

  it("nomme les contextes réellement testés", () => {
    // C'est ce qui permet au tuteur de dire « tes deux contextes se
    // ressemblent, élargis » plutôt que d'enchaîner sur un successeur.
    const prompt = construirePromptEvolution(etat(), maitrise(), VOISINES, DOMAINE);
    expect(prompt).toContain("Une partie de League of Legends");
    expect(prompt).toContain("Une quête dans le Royaume d'Eldoria");
  });

  it("liste les intitulés voisins du domaine", () => {
    // Sans eux, le successeur proposé redouble une compétence qui existe déjà.
    const prompt = construirePromptEvolution(etat(), maitrise(), VOISINES, DOMAINE);
    expect(prompt).toContain("Lire une trace d'exécution");
    expect(prompt).toContain("Décomposer un problème en sous-problèmes");
  });

  it("n'écrit pas une ligne pour une valeur absente", () => {
    /*
     * Une ligne « Robustesse : — » est une invitation à combler le trou. Ce
     * qui n'a pas été mesuré ne s'écrit pas (P2, anti-hallucination §7).
     */
    const prompt = construirePromptEvolution(
      etat({ robustesse: null, joursDepuisDernierePreuve: null }),
      maitrise(),
      VOISINES,
      DOMAINE,
    );
    expect(prompt).not.toContain("Robustesse");
    expect(prompt).not.toContain("Dernière preuve");
  });

  it("signale les preuves contradictoires quand il y en a", () => {
    const prompt = construirePromptEvolution(
      etat({ contradictions: [{}, {}] as SkillState["contradictions"] }),
      maitrise(),
      VOISINES,
      DOMAINE,
    );
    expect(prompt).toContain("2 preuve(s) contradictoire(s)");
  });

  it("nomme les trois évolutions et rien d'autre", () => {
    const prompt = construirePromptEvolution(etat(), maitrise(), VOISINES, DOMAINE);
    expect(prompt).toContain("« successeur »");
    expect(prompt).toContain("« elargissement »");
    expect(prompt).toContain("« retrait »");
  });

  it("interdit d'affirmer ce qui ne figure pas dans le prompt", () => {
    expect(construirePromptEvolution(etat(), maitrise(), VOISINES, DOMAINE)).toContain(
      "N'affirme rien qui ne figure pas ci-dessus",
    );
  });

  it("dit que le tuteur n'applique rien", () => {
    expect(construirePromptEvolution(etat(), maitrise(), VOISINES, DOMAINE)).toContain(
      "TU N'APPLIQUES RIEN",
    );
  });

  it("dit « aucune autre » plutôt que de laisser la liste vide", () => {
    // Une section vide se lit comme une section oubliée.
    const prompt = construirePromptEvolution(etat(), maitrise(), [], DOMAINE);
    expect(prompt).toContain("aucune autre");
  });
});

/* ------------------------------------------------------------------ */
/* La collecte                                                         */
/* ------------------------------------------------------------------ */

describe("proposerEvolution — rien n'est fabriqué", () => {
  it("n'arme que l'outil d'évolution", async () => {
    const capture: { demande?: Record<string, unknown> } = {};
    await proposerEvolution(moteurQuiCapture(capture), etat(), maitrise(), VOISINES, DOMAINE);
    const outils = capture.demande?.outils as { nom: string }[];
    expect(outils.map((o) => o.nom)).toEqual(["proposer_evolution"]);
  });

  it("retient une évolution validée", async () => {
    const r = await proposerEvolution(
      moteurQuiEmet([
        { evenement: "proposition", donnees: { genre: "evolution", evolution: EVOLUTION } },
      ]),
      etat(),
      maitrise(),
      VOISINES,
      DOMAINE,
    );
    expect(r.evolution).toEqual(EVOLUTION);
    expect(r.erreur).toBeNull();
  });

  it("ne prend pas une proposition d'un autre genre pour une évolution", async () => {
    const r = await proposerEvolution(
      moteurQuiEmet([
        { evenement: "proposition", donnees: { genre: "referentiel", branche: { domaine: "X" } } },
      ]),
      etat(),
      maitrise(),
      VOISINES,
      DOMAINE,
    );
    expect(r.evolution).toBeNull();
    expect(r.erreur).not.toBeNull();
  });

  it("distingue un fournisseur sans outils d'un tuteur muet", async () => {
    const r = await proposerEvolution(
      moteurQuiEmet([
        { evenement: "fin", donnees: { stopReason: "stop", outils: { actifs: false, appels: 0 } } },
      ]),
      etat(),
      maitrise(),
      VOISINES,
      DOMAINE,
    );
    expect(r.outilsActifs).toBe(false);
    expect(r.erreur).toContain("n'accepte pas les appels d'outil");
  });

  it("ne relaie aucun fragment de texte", async () => {
    const vus: string[] = [];
    await proposerEvolution(
      moteurQuiEmet([
        { evenement: "texte", donnees: { delta: "Je propose…" } },
        { evenement: "proposition", donnees: { genre: "evolution", evolution: EVOLUTION } },
      ]),
      etat(),
      maitrise(),
      VOISINES,
      DOMAINE,
      undefined,
      (evenement) => vus.push(evenement),
    );
    expect(vus).toEqual(["proposition"]);
  });
});
