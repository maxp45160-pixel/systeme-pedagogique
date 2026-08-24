import { describe, expect, it } from "vitest";
import { construireContexte } from "./contexte";
import { DOMAINES_TEST, REFERENTIEL_TEST } from "@/lib/domain/referentiel.fixture";
import { computeAllSkillStates } from "@/lib/engine/skill-state";
import { calculerEtatGlobal } from "@/lib/engine/progression";
import { recommander } from "@/lib/engine/recommend";
import { calibrerToutes } from "@/lib/engine/calibration";
import { evaluerMaitrises } from "@/lib/engine/maitrise";
import { construireCarteIndividuelle, construireEspaceActif } from "@/lib/engine/vues-twiny";
import type { Contexte } from "@/lib/store/context";

/**
 * Le budget de contexte du chat, tenu par un plafond plutôt que par la vigilance.
 *
 * ## Pourquoi ce test existe
 *
 * `/api/tutor` est la SEULE route qui charge `app/data/00_instructions/` ; les
 * treize autres construisent un prompt court. Tout ce qui grossit dans ces
 * fichiers se paie donc ici, à chaque message, et nulle part ailleurs — ce qui
 * rend la dérive indolore à l'écriture et coûteuse à l'usage.
 *
 * Mesuré le 24/08/2026 sur ce même fixture : un message ordinaire embarquait
 * 33 891 caractères, dont **92 % de doctrine statique et 7,6 % de données de la
 * personne**. Personne ne l'avait mesuré, et l'audit venait d'en ajouter encore.
 *
 * ## Ce que le plafond veut dire
 *
 * Il ne dit pas « ne jamais dépasser ». Il dit : **si vous dépassez, c'est une
 * décision, pas un effet de bord.** Le relever se fait en connaissance de cause,
 * et le chiffre du jour reste lisible dans l'historique du fichier.
 *
 * Le fixture (6 compétences, aucune observation) mesure la part FIXE. Un compte
 * réel ajoute son état et ses priorités par-dessus ; c'est justement la part
 * qu'on veut voir grandir, et elle n'entre pas dans ce plafond.
 */

/** Mesuré à 28 849 le 24/08/2026 (ADR-125). La marge absorbe une reformulation. */
const PLAFOND_MESSAGE_ORDINAIRE = 30_000;

/**
 * La part de doctrine, sur ce fixture, ne doit pas repartir vers les 92 %.
 * Un compte réel fait mécaniquement mieux — d'où un seuil lâche : ce qu'on
 * surveille est le sens de la pente, pas la valeur.
 */
const PART_STATIQUE_MAX = 0.93;

function contexteDeTest(): Contexte {
  const now = new Date("2026-07-29T10:00:00.000Z");
  const referentiel = REFERENTIEL_TEST;
  const etats = computeAllSkillStates(referentiel.actifs, [], now);
  const calibrations = calibrerToutes(etats, [], []);
  const recommandations = recommander(etats, [], [], 5, calibrations);
  const carteIndividuelle = construireCarteIndividuelle(etats);
  return {
    referentiel,
    calibrations,
    maitrises: evaluerMaitrises(etats),
    exercicesActifs: [],
    dureesEstimees: new Map(),
    donnees: {
      user: {
        id: "t",
        prenom: "T",
        formation: "BUT QLIO",
        objectifMoyenTerme: "Objectif a moyen terme",
        objectifLongTerme: "Objectif a long terme",
        debutSuivi: now.toISOString(),
      },
      observations: [],
      exercises: [],
      attempts: [],
      sessions: [],
      refusRecommandations: [],
      engagements: [],
    },
    etats,
    etatsParCode: new Map(etats.map((e) => [e.skill.code, e])),
    global: calculerEtatGlobal(etats, now, DOMAINES_TEST),
    recommandations,
    carteIndividuelle,
    espaceActif: construireEspaceActif({ carte: carteIndividuelle, recommandations }),
    now,
    observationsEffectives: [],
  } as unknown as Contexte;
}

/** Un message qui ne déclenche ni synthèse ni protocole de référentiel. */
const MESSAGE_ORDINAIRE = [
  { role: "user" as const, content: "peux-tu m'expliquer la recursivite ?" },
];

describe("le budget de contexte d'un message ordinaire", () => {
  it("tient sous le plafond", async () => {
    const p = await construireContexte(contexteDeTest(), MESSAGE_ORDINAIRE);
    const total = p.manifeste.reduce((somme, bloc) => somme + bloc.caracteres, 0);

    expect(total).toBeLessThanOrEqual(PLAFOND_MESSAGE_ORDINAIRE);
  });

  it("ne charge ni la synthèse ni la charte du référentiel", async () => {
    /*
     * Le plafond ne vaut que si le message est vraiment ordinaire : si un
     * déclencheur se met à répondre à tout, le total mesuré cesserait de
     * décrire le cas courant.
     */
    const p = await construireContexte(contexteDeTest(), MESSAGE_ORDINAIRE);
    const noms = p.manifeste.map((bloc) => bloc.nom);

    expect(noms).not.toContain("Protocole d'évaluation (complet)");
    expect(noms).not.toContain("Protocole de construction du référentiel");
  });

  it("ne laisse pas la doctrine reprendre toute la place", async () => {
    const p = await construireContexte(contexteDeTest(), MESSAGE_ORDINAIRE);
    const total = p.manifeste.reduce((somme, bloc) => somme + bloc.caracteres, 0);

    /*
     * « Statique » = ce qui ne dépend pas de ce que la personne a fait :
     * les protocoles, le cadre d'intervention, les schémas d'outil. Le reste
     * est son état, son travail récent, ses priorités.
     */
    const STATIQUES = new Set([
      "Instructions principales",
      "Protocole d'évaluation (essentiel)",
      "Protocole anti-hallucination",
      "Cadre d'intervention dans l'interface",
      "Outils de proposition (schémas)",
    ]);
    const statique = p.manifeste
      .filter((bloc) => STATIQUES.has(bloc.nom))
      .reduce((somme, bloc) => somme + bloc.caracteres, 0);

    expect(statique / total).toBeLessThanOrEqual(PART_STATIQUE_MAX);
  });
});
