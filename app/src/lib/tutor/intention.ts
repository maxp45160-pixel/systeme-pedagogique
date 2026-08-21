/**
 * Traduction d'un besoin exprimé en langage libre — le chemin du bouton `+`.
 *
 * Même mécanique que `generation-referentiel.ts` : un prompt court, un outil
 * confiné, et un `envoyer` qui collecte au lieu de diffuser. La différence est
 * dans ce qui est demandé — ici le tuteur ne rédige aucun contenu, il *choisit
 * une action parmi quatre que le système sait déjà exécuter.
 *
 * ## Pourquoi le modèle et pas des mots-clés
 *
 * Une table de mots-clés traite « génère-moi un exercice sur les stocks » et
 * échoue sur « je bloque depuis deux jours et j'ai un contrôle vendredi » —
 * exactement la phrase qu'on veut accepter. Le langage libre est le point de
 * l'exercice, pas un confort ; la contrainte est reportée sur le schéma, qui
 * n'admet que quatre genres et des codes énumérés.
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

import {
  analyserDemandeReferentiel,
  demandeSeanceSansSujet,
  type TraductionIntention,
} from "@/lib/domain/intention";
import type { Referentiel } from "@/lib/domain/types";
import type { MoteurTuteur } from "./moteurs";
import { lireErreurMoteur, lireOutilsActifs, messageSansOutils } from "./moteurs";
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
  contexte?: string,
): string {
  const consigneContexte =
    contexte === "domaine"
      ? [
          "CONTEXTE D'OUVERTURE : La personne souhaite explicitement créer ou structurer un nouveau domaine d'apprentissage.",
          "- L'action principale DOIT obligatoirement être de genre `referentiel`.",
          "- Ne propose en aucun cas un `travail` (séance d'entraînement), une `note` ou un `projet` comme action principale.",
          "- `sujet` doit contenir le nom ou la description du domaine demandé.",
          "",
        ]
      : [];

  return [
    "Tu es le moteur d'orientation du système pédagogique. Une personne exprime un besoin en une phrase ; tu le traduis en une action que le système sait exécuter.",
    "",
    "TU N'EXÉCUTES RIEN. La personne relit ta proposition et confirme.",
    "",
    ...consigneContexte,
    "COMMENT CHOISIR",
    "- Un besoin qui porte sur un savoir-faire déjà au référentiel est un `travail` : il prépare une séance d'entraînement.",
    "- Une demande comme « créer une séance » sans sujet ni compétence est aussi un `travail`, mais avec `codes` vide et le besoin recopié dans `sujet` : ne choisis aucune compétence à la place de la personne.",
    "- Un besoin qui vise un livrable — un rapport, un dossier, une maquette, une analyse à rendre — est un `projet`.",
    "- Un besoin qui apporte une ressource, un cours, un énoncé, un PDF ou un document à garder est une `note`.",
    "- Un besoin dont le sujet n'est couvert par aucune compétence de la liste ci-dessous est un `referentiel`.",
    "- Si la personne demande explicitement d'ajouter une compétence précise — surtout avec un intitulé entre guillemets — garde cet intitulé dans `sujet` et ne transforme pas la demande en nouveau domaine.",
    "- Si elle donne un nombre de domaines, de compétences ou une granularité, conserve ces contraintes dans `sujet` ; elles seront utilisées pour la proposition.",
    "- Si elle demande une séance, identifie-la comme `travail`; si elle demande un projet à produire, comme `projet`; si elle demande d'ajouter un PDF ou une ressource, comme `note`.",
    "- Dans le doute réel entre deux gestes différents (par exemple garder un PDF ou en extraire une compétence), utilise `clarification`, mets la question précise dans `sujet`, et mets au maximum deux actions possibles dans `alternatives`.",
    "- N'utilise pas `clarification` pour une demande large mais compréhensible comme « apprendre la physique » : c'est une extension de référentiel, avec une organisation de départ.",
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
  contexte?: string,
  /**
   * Budget de temps de l'appel, transmis tel quel au moteur.
   *
   * Décidé par la route et non ici : c'est elle qui sait ce que l'écran est
   * prêt à attendre. Absent, le garde-fou du moteur s'applique.
   */
  delaiMs?: number,
): Promise<ResultatIntention> {
  let traduction: TraductionIntention | null = null;
  let outilsActifs = true;
  /*
   * Le moteur émet `proposition-rejetee` quand le tuteur A appelé l'outil mais
   * que la sortie n'a pas passé `validerTraductionIntention` — typiquement un
   * `travail` sans aucune compétence désignée, ou un `projet` sans sujet.
   *
   * Sans cette capture, les deux pannes se ressemblaient à l'écran : « aucune
   * action exploitable », qu'il n'y ait eu aucun appel d'outil ou un appel
   * refusé. Ce sont pourtant deux choses différentes — la seconde se corrige en
   * reformulant, la première non.
   */
  let rejet: string | null = null;
  /** La panne annoncée par le moteur — clé refusée, quota, modèle absent. */
  let panne: string | null = null;

  const envoyer = (evenement: string, donnees: unknown) => {
    diffuser?.(evenement, donnees);
    const actifs = lireOutilsActifs(evenement, donnees);
    if (actifs !== null) outilsActifs = actifs;
    panne = panne ?? lireErreurMoteur(evenement, donnees);
    if (evenement === "proposition-rejetee") {
      const message = (donnees as { message?: unknown } | null)?.message;
      if (typeof message === "string" && message.trim()) rejet = message.trim();
    }
    if (evenement === "proposition") {
      const proposition = donnees as { genre: string; traduction?: TraductionIntention };
      if (proposition.genre === "intention" && proposition.traduction) {
        traduction = proposition.traduction;
      }
    }
  };

  const codesArmes = [...referentiel.codesActifs];

  await moteur.repondre({
    systemeStable: construirePromptIntention(candidates, codesArmes.length === 0, contexte),
    systemeProfil: profilDeclare,
    messages: [{ role: "user" as const, content: besoin }],
    outils: [outilIntention(codesArmes)],
    signal,
    delaiMs,
    envoyer,
  });

  /*
   * Repli déterministe quand le tuteur a compris qu’il n’y avait pas de code
   * local, mais a tout de même tenté un `travail` sans compétence. La demande
   * explicite « apprendre à … » ou « ajouter une compétence … » suffit à
   * ouvrir la relecture de compétence ; elle ne permet ni de fabriquer un
   * code, ni de choisir un domaine à la place de la personne.
   */
  const cadrage = analyserDemandeReferentiel(besoin, contexte);
  if (contexte !== "domaine" && traduction === null && demandeSeanceSansSujet(besoin)) {
    traduction = {
      action: {
        genre: "travail",
        titre: "Préparer une séance",
        pourquoi: "Aucun sujet n’a été imposé : tu choisiras la portée dans le compositeur.",
        codes: [],
        sujet: besoin.trim(),
      },
      alternatives: [],
    };
  }
  if (
    traduction === null &&
    (contexte === "domaine" ||
      (cadrage.explicite && (cadrage.type === "competence" || cadrage.portee === "large")))
  ) {
    const titres = cadrage.intitules;
    traduction = {
      action: {
        genre: "referentiel",
        titre:
          contexte === "domaine"
            ? `Structurer le domaine « ${besoin.trim()} »`
            : cadrage.type === "competence" && titres.length === 1
              ? `Ajouter la compétence « ${titres[0]} »`
              : cadrage.type === "competence"
                ? "Ajouter la compétence décrite dans la demande"
                : "Structurer le domaine demandé",
        pourquoi:
          contexte === "domaine"
            ? "Ce domaine sera découpé en compétences pour enrichir ton Atelier."
            : cadrage.type === "competence"
              ? "La demande décrit une compétence qui n’est pas encore disponible dans ton Atelier."
              : "La demande porte sur une vue d’ensemble qui doit être organisée avant l’apprentissage.",
        codes: [],
        sujet: besoin.trim(),
      },
      alternatives: [],
    };
  }

  // Deux pannes derrière une même absence de traduction : un modèle qui n'a
  // rien rendu d'exploitable, et un fournisseur sans outils. La seconde ne se
  // relance pas en reformulant — elle se dit.
  const erreur =
    traduction !== null
      ? null
      : // La panne du fournisseur passe AVANT tout le reste : c'est la seule
        // cause qui ne se corrige pas en reformulant.
        panne ??
        (!outilsActifs
          ? messageSansOutils("la traduction d'un besoin")
          : rejet
            ? `${rejet} Le plus souvent, l'action visait un travail sans désigner aucune compétence existante.`
            : "Aucune action exploitable n'a été produite pour ce besoin.");

  return { traduction, outilsActifs, erreur };
}
