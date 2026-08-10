/**
 * Résolution d'une intention libre en compétences existantes — le chemin
 * d'appel du lot 2 du chantier « thèmes » (10/08/2026, ADR-053).
 *
 * Même mécanique que `generation-referentiel.ts` : un prompt court, un seul
 * outil armé (`proposer_theme`, jamais `outilsTuteur` — voir `OUTIL_THEME`), un
 * `envoyer` qui collecte au lieu de diffuser. La différence de fond : cet
 * outil ne PRODUIT rien — il désigne, parmi des compétences qui existent déjà,
 * celles qui correspondent à l'intention. Aucun code n'est jamais frappé.
 *
 * ⚠️ Dépendance à l'outillage, comme `suggererBranche` : sans fournisseur
 * capable d'appeler un outil, la route le dit plutôt que d'inventer une
 * réponse.
 */

import type { Referentiel } from "@/lib/domain/types";
import type { MoteurTuteur } from "./moteurs";
import { lireOutilsActifs, messageSansOutils } from "./moteurs";
import { outilTheme, type PropositionTheme } from "./outils";

export interface ResultatResolutionTheme {
  /** Proposition validée, prête à être relue et enregistrée — ou `null` si
   * rien n'a pu être produit (voir `erreur` pour la distinguer d'une liste
   * de codes vide, qui EST un résultat valide). */
  theme: PropositionTheme | null;
  outilsActifs: boolean;
  erreur: string | null;
}

/**
 * Le prompt de résolution.
 *
 * Court, sans protocole d'évaluation ni anti-hallucination : cette étape ne
 * produit aucune mesure, elle désigne du contenu déjà existant. La liste des
 * compétences actives tient sur une ligne chacune — comparable au corpus
 * plafonné à `MAX_LIGNES_CORPUS` dans `contexte.ts`.
 */
export function construirePromptTheme(referentiel: Referentiel, intention: string): string {
  const domainesParId = referentiel.domainesParId;
  const lignes = referentiel.actifs.map(
    (s) => `${s.code} — ${s.intitule} — ${domainesParId.get(s.domaine)?.nom ?? s.domaine}`,
  );

  return [
    "Tu es le tuteur du système pédagogique. La personne décrit librement ce qu'elle veut travailler.",
    "Ta tâche : désigner, parmi les compétences EXISTANTES ci-dessous, celles qui correspondent vraiment à son intention.",
    "",
    "TU N'ÉCRIS RIEN DE NOUVEAU. Tu ne frappes aucun code : uniquement ceux de la liste.",
    "Si aucune compétence ne correspond vraiment, rends une liste de codes vide plutôt que de rapprocher de force — ce n'est pas un échec, c'est l'information demandée.",
    "",
    `Intention de la personne : ${intention}`,
    "",
    "Compétences existantes (code — intitulé — domaine) :",
    ...(lignes.length > 0 ? lignes : ["(aucune compétence active dans ce compte)"]),
    "",
    "Appelle l'outil proposer_theme UNE fois. Ne recopie pas le contenu de l'appel dans ta réponse.",
  ].join("\n");
}

/**
 * Résout une intention libre en compétences existantes, sans conversation.
 */
export async function resoudreTheme(
  moteur: MoteurTuteur,
  referentiel: Referentiel,
  intention: string,
  signal?: AbortSignal,
  diffuser?: (evenement: string, donnees: unknown) => void,
): Promise<ResultatResolutionTheme> {
  let theme: PropositionTheme | null = null;
  let outilsActifs = true;

  const envoyer = (evenement: string, donnees: unknown) => {
    diffuser?.(evenement, donnees);
    const actifs = lireOutilsActifs(evenement, donnees);
    if (actifs !== null) outilsActifs = actifs;
    if (evenement === "proposition") {
      const proposition = donnees as { genre: string; theme?: PropositionTheme };
      if (proposition.genre === "theme" && proposition.theme) {
        theme = proposition.theme;
      }
    }
  };

  const codesActifs = referentiel.actifs.map((s) => s.code);

  await moteur.repondre({
    systemeStable: construirePromptTheme(referentiel, intention),
    systemeProfil: "",
    messages: [
      { role: "user" as const, content: `Ce que je veux travailler : ${intention}` },
    ],
    outils: [outilTheme(codesActifs)],
    signal,
    envoyer,
  });

  const erreur =
    theme !== null
      ? null
      : outilsActifs
        ? "Aucune résolution exploitable n'a été produite."
        : messageSansOutils("la résolution du thème");

  return { theme, outilsActifs, erreur };
}
