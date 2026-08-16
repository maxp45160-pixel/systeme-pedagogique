/**
 * Traduction d'un besoin exprimé en langage libre — le chemin du bouton `+`.
 *
 * Même mécanique que `generation-referentiel.ts` : un prompt court, un outil
 * confiné, et un `envoyer` qui collecte au lieu de diffuser. La différence est
 * dans ce qui est demandé — ici le tuteur ne rédige aucun contenu, il *choisit
 * une action* parmi trois que le système sait déjà exécuter.
 *
 * ## Pourquoi le modèle et pas des mots-clés
 *
 * Une table de mots-clés traite « génère-moi un exercice sur les stocks » et
 * échoue sur « je bloque depuis deux jours et j'ai un contrôle vendredi » —
 * exactement la phrase qu'on veut accepter. Le langage libre est le point de
 * l'exercice, pas un confort ; la contrainte est reportée sur le schéma, qui
 * n'admet que trois genres et des codes énumérés.
 *
 * ## Ce que le tuteur ne fait pas ici
 *
 * Il ne lit aucun état du compte et n'en affirme aucun. Les compétences les
 * plus en retard, le travail déjà ouvert, la dernière séance : tout cela est
 * calculé par le moteur et posé dans le prompt en tant que *faits*, jamais
 * demandé au modèle. P5 tient — le tuteur produit du contenu, pas des mesures.
 *
 * ⚠️ Dépendance à l'outillage. Comme les autres chemins assistés, la traduction
 * exige un fournisseur qui sait appeler un outil. Sans support, l'écran le dit
 * et propose les destinations manuelles.
 */

import type { TraductionIntention } from "@/lib/domain/intention";
import type { Referentiel } from "@/lib/domain/types";
import type { MoteurTuteur } from "./moteurs";
import { lireOutilsActifs, messageSansOutils } from "./moteurs";
import { outilIntention } from "./outils";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

/**
 * Une compétence telle que le prompt la présente : le code, l'intitulé, et la
 * raison pour laquelle le moteur la met en avant. Rien de plus — un profil
 * complet dans le prompt coûterait à chaque ouverture du `+` pour une décision
 * qui ne s'appuie que sur ces trois champs.
 */
export interface CompetenceCandidate {
  code: string;
  intitule: string;
  domaine: string;
  /** Pourquoi le moteur la propose. Calculée, jamais demandée au modèle. */
  raison: string;
}

export interface ResultatIntention {
  traduction: TraductionIntention | null;
  /** Le fournisseur a-t-il servi les outils ? `true` par défaut (P2). */
  outilsActifs: boolean;
  erreur: string | null;
}

/* ------------------------------------------------------------------ */
/* Prompt                                                              */
/* ------------------------------------------------------------------ */

/**
 * Le prompt de traduction.
 *
 * Court par construction : le cadrage tient dans le schéma de l'outil, pas
 * dans des consignes en prose. Ce que le prompt apporte et que le schéma ne
 * peut pas porter, c'est l'**état réel du compte** — les compétences que le
 * moteur met en avant, et le fait qu'un référentiel existe ou non.
 *
 * Les candidates sont plafonnées par l'appelant, pas ici : la longueur du
 * prompt est une décision de la route, qui sait combien elle veut payer.
 */
export function construirePromptIntention(
  candidates: CompetenceCandidate[],
  referentielVide: boolean,
): string {
  return [
    "Tu es le moteur d'orientation du système pédagogique. Une personne exprime un besoin en une phrase ; tu le traduis en une action que le système sait exécuter.",
    "",
    "TU N'EXÉCUTES RIEN. La personne relit ta proposition et confirme.",
    "",
    "COMMENT CHOISIR",
    "- Un besoin qui porte sur un savoir-faire déjà au référentiel est un `travail`.",
    "- Un besoin qui vise un livrable — un rapport, un dossier, une maquette, une analyse à rendre — est un `projet`.",
    "- Un besoin qui apporte une ressource, un cours, un énoncé, un document à garder est une `note`.",
    "- Un besoin dont le sujet n'est couvert par aucune compétence de la liste ci-dessous est un `referentiel`.",
    "- Dans le doute entre deux lectures, choisis la plus probable et mets l'autre en alternative.",
    "",
    "CE QUE TU NE FAIS PAS",
    "- Tu ne rapproches pas de force : deux compétences qui « ont l'air proches » du sujet ne le couvrent pas.",
    "- Tu n'affirmes aucun niveau, aucune progression, aucune mesure. Tu orientes.",
    "- Tu n'écris aucun code de compétence : tu ne peux désigner que ceux de la liste.",
    "",
    referentielVide
      ? "ÉTAT DU COMPTE : le référentiel est vide. Aucune compétence n'existe encore — seuls `note` et `referentiel` sont possibles, un projet n'aurait rien à mobiliser."
      : "COMPÉTENCES ACTIVES QUE LE MOTEUR MET EN AVANT (code — intitulé — domaine — pourquoi elle remonte) :",
    ...(referentielVide
      ? []
      : candidates.map(
          (c) => `- ${c.code} — ${c.intitule} — ${c.domaine} — ${c.raison}`,
        )),
    "",
    "Appelle l'outil traduire_intention UNE fois. Ne recopie pas le contenu de l'appel dans ta réponse.",
  ].join("\n");
}

/* ------------------------------------------------------------------ */
/* Traduction                                                          */
/* ------------------------------------------------------------------ */

/**
 * Traduit un besoin en action, sans conversation.
 *
 * `codesArmes` est l'ensemble fermé passé au schéma : c'est lui, et lui seul,
 * qui décide de ce qu'une action peut désigner. Il est volontairement plus
 * large que `candidates` — le moteur met en avant une poignée de compétences,
 * mais la personne a le droit de viser n'importe laquelle des siennes.
 */
export async function traduireIntention(
  moteur: MoteurTuteur,
  referentiel: Referentiel,
  besoin: string,
  candidates: CompetenceCandidate[],
  signal?: AbortSignal,
  diffuser?: (evenement: string, donnees: unknown) => void,
  profilDeclare = "",
): Promise<ResultatIntention> {
  let traduction: TraductionIntention | null = null;
  let outilsActifs = true;

  const envoyer = (evenement: string, donnees: unknown) => {
    diffuser?.(evenement, donnees);
    const actifs = lireOutilsActifs(evenement, donnees);
    if (actifs !== null) outilsActifs = actifs;
    if (evenement === "proposition") {
      const proposition = donnees as { genre: string; traduction?: TraductionIntention };
      if (proposition.genre === "intention" && proposition.traduction) {
        traduction = proposition.traduction;
      }
    }
  };

  const codesArmes = [...referentiel.codesActifs];

  await moteur.repondre({
    systemeStable: construirePromptIntention(candidates, codesArmes.length === 0),
    systemeProfil: profilDeclare,
    messages: [{ role: "user" as const, content: besoin }],
    outils: [outilIntention(codesArmes)],
    signal,
    envoyer,
  });

  // Deux pannes derrière une même absence de traduction : un modèle qui n'a
  // rien rendu d'exploitable, et un fournisseur sans outils. La seconde ne se
  // relance pas en reformulant — elle se dit.
  const erreur =
    traduction !== null
      ? null
      : outilsActifs
        ? "Aucune action exploitable n'a été produite pour ce besoin."
        : messageSansOutils("la traduction d'un besoin");

  return { traduction, outilsActifs, erreur };
}
