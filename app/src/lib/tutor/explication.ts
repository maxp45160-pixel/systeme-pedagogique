/**
 * Évaluation d'une auto-explication de concept par le tuteur (méthode Feynman).
 *
 * Le tuteur évalue la compréhension conceptuelle de l'apprenant sans bavardage,
 * via l'outil fermé `proposer_evaluation_explication`.
 */

import type { Skill, Domaine } from "@/lib/domain/types";
import {
  ATTRIBUTION_RESULTAT_EXPLICATION,
  CRITERES_AUTO_EXPLICATION,
  type EvaluationExplication,
} from "@/lib/domain/explication";
import type { MoteurTuteur } from "./moteurs";
import { lireErreurMoteur, lireOutilsActifs } from "./moteurs";
import { REGLE_VOUVOIEMENT } from "./prompt";
import {
  outilEvaluationExplication,
  type PropositionEvaluationExplication,
} from "./outils";

export interface ResultatEvaluationExplication {
  evaluation: EvaluationExplication | null;
  outilsActifs: boolean;
  erreur: string | null;
}

export function construirePromptExplication(
  skill: Pick<Skill, "code" | "intitule" | "palier">,
  domaine?: Pick<Domaine, "nom" | "description">,
): string {
  return [
    "Tu es un tuteur pédagogique exigeant, bienveillant et rigoureux.",
    "L'apprenant s'exerce à la méthode Feynman : il doit reformuler avec ses propres mots un concept fondamental pour prouver sa compréhension.",
    "",
    "CONCEPT À ÉVALUER :",
    `- Compétence : [${skill.code}] ${skill.intitule}`,
    `- Palier : ${skill.palier}`,
    domaine ? `- Domaine : ${domaine.nom} — ${domaine.description}` : "",
    "",
    "CRITÈRES D'ÉVALUATION DE LA COMPRÉHENSION :",
    ...CRITERES_AUTO_EXPLICATION.map((critere, rang) => `${rang + 1}. ${critere}`),
    "",
    "RÈGLES D'ATTRIBUTION DU RÉSULTAT :",
    ...ATTRIBUTION_RESULTAT_EXPLICATION.map((regle) => `- ${regle}`),
    "",
    "CONSIGNES DE RÉDACTION DU FEEDBACK :",
    "- Sois précis, concis et encourageant.",
    "- points_cles : cite explicitement ce qui est bien compris.",
    "- points_manquants : nomme les nuances absentes ou les confusions à rectifier.",
    "- feedback_formatif : synthèse claire de son niveau de compréhension (max 400 caractères).",
    "- conseil_suivant : indique le prochain geste recommandé (ex: consolider ou passer à un exercice guidé).",
    "",
    REGLE_VOUVOIEMENT,
    "Appelle l'outil proposer_evaluation_explication UNE SEULE FOIS.",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function evaluerExplication(
  moteur: MoteurTuteur,
  skill: Pick<Skill, "code" | "intitule" | "palier">,
  texteExplication: string,
  domaine?: Pick<Domaine, "nom" | "description">,
  signal?: AbortSignal,
  diffuser?: (evenement: string, donnees: unknown) => void,
): Promise<ResultatEvaluationExplication> {
  let propositionRecue: PropositionEvaluationExplication | null = null;
  let outilsActifs = true;
  let panne: string | null = null;

  const envoyer = (evenement: string, donnees: unknown) => {
    if (evenement !== "texte") diffuser?.(evenement, donnees);

    const actifs = lireOutilsActifs(evenement, donnees);
    if (actifs !== null) outilsActifs = actifs;
    panne = panne ?? lireErreurMoteur(evenement, donnees);

    if (evenement === "proposition") {
      const p = donnees as { genre: string; evaluation?: PropositionEvaluationExplication };
      if (p.genre === "evaluation-explication" && p.evaluation) {
        propositionRecue = p.evaluation;
      }
    }
  };

  const messages = [
    {
      role: "user" as const,
      content: `Voici mon explication du concept "${skill.intitule}" :\n\n${texteExplication.trim()}`,
    },
  ];

  await moteur.repondre({
    systemeStable: construirePromptExplication(skill, domaine),
    systemeProfil: "",
    outils: [outilEvaluationExplication()],
    messages,
    signal,
    envoyer,
  });

  if (!propositionRecue) {
    return {
      evaluation: null,
      outilsActifs,
      erreur:
        panne ??
        (outilsActifs
          ? "Le tuteur n'a pas pu évaluer l'explication sous forme structurée."
          : "Le tuteur n'est pas disponible pour évaluer votre explication."),
    };
  }

  const proposition = propositionRecue as PropositionEvaluationExplication;
  const evaluation: EvaluationExplication = {
    resultat: proposition.resultat,
    scoreComprehension: proposition.scoreComprehension,
    scoreJustification: proposition.scoreJustification,
    pointsCles: proposition.pointsCles,
    pointsManquants: proposition.pointsManquants,
    feedbackFormatif: proposition.feedbackFormatif,
    conseilSuivant: proposition.conseilSuivant,
  };

  return {
    evaluation,
    outilsActifs,
    erreur: null,
  };
}
