/**
 * Génération du protocole de traitement d'un cours — chemin one-shot, sans
 * conversation et sans écriture (ADR-130).
 *
 * Même mécanique que `generation-referentiel.ts` : un prompt court, un outil
 * fermé (`proposer_protocole_cours`), un `envoyer` qui collecte au lieu de
 * diffuser. Le serveur fixe l'intention déclarée, le texte du cours et
 * l'enum des codes actifs ; le tuteur ne remplit que les champs éditoriaux du
 * plan, et le validateur du domaine (`motifRefusProtocole`) revérifie tout —
 * y compris l'appartenance des codes, quoi qu'en ait dit le schéma.
 *
 * Le protocole est du contenu (ADR-037, ADR-069) : la sortie ne porte aucune
 * note, aucun niveau, aucun verdict. Les séances qu'il décrit ne deviennent
 * des objets que si la personne les relit case par case.
 */

import type { MoteurTuteur } from "./moteurs";
import { lireErreurMoteur, lireOutilsActifs, messageSansOutils } from "./moteurs";
import { outilProtocoleCours } from "./outils";
import { REGLE_VOUVOIEMENT, type PromptTuteur } from "./prompt";
import { objet } from "./conversion";
import {
  CODES_SEANCE_PROTOCOLE_MAX,
  LIBELLES_INTENTION_COURS,
  SEANCES_PROTOCOLE_MAX,
  estDimensionSeance,
  motifRefusProtocole,
  type IntentionCours,
  type ProtocoleCours,
  type SeanceProtocole,
} from "@/lib/domain/protocole-cours";

/* ------------------------------------------------------------------ */
/* Entrée du chemin — fixée par le serveur, jamais par le tuteur        */
/* ------------------------------------------------------------------ */

export interface DemandeProtocole {
  /** Titre de la fiche cours. */
  titre: string;
  /** Texte extrait du PDF (cache borné à 20 000 caractères, ADR-113). */
  extrait: string;
  /** L'intention déclarée par la personne au dépôt — jamais déduite. */
  intention: IntentionCours;
  /** La phrase libre qui l'accompagne, si écrite. */
  intentionLibre: string;
  /** Les compétences actives du compte — l'enum fermé des codes désignables. */
  competences: { code: string; intitule: string }[];
}

/* ------------------------------------------------------------------ */
/* Prompt                                                               */
/* ------------------------------------------------------------------ */

const MAX_COMPETENCES_PROMPT = 60;

/**
 * La liste fermée des codes désignables, dans le prompt.
 *
 * Plafonnée pour rester courte : un référentiel très dense n'empêche pas la
 * désignation — le schéma de l'outil porte l'enum complet, la liste du prompt
 * est là pour qu'on choisisse en connaissance de cause.
 */
export function listerCompetencesPrompt(
  competences: { code: string; intitule: string }[],
  plafond = MAX_COMPETENCES_PROMPT,
): string {
  const retenues = competences.slice(0, plafond);
  const lignes = retenues.map((c) => `- ${c.code} — ${c.intitule}`);
  if (competences.length > plafond) {
    lignes.push(`… (+${competences.length - plafond} autres, toutes désignables par leur code)`);
  }
  return lignes.length > 0 ? lignes.join("\n") : "- Aucune — le référentiel est vide.";
}

export function construirePromptProtocole(demande: DemandeProtocole): PromptTuteur {
  const stable = [
    "Tu es le concepteur de parcours du système pédagogique. Tu proposes un plan de séances pour travailler un cours.",
    "",
    "TU N'ENREGISTRES RIEN ET TU N'ÉVALUES RIEN.",
    "Tu produis un plan de contenu. La personne relit séance par séance et coche ce qu'elle garde. Tu n'écris aucune note, aucun niveau, aucun verdict sur qui que ce soit.",
    "",
    "PROTOCOLE DE CONCEPTION",
    `- De 1 à ${SEANCES_PROTOCOLE_MAX} séances, du plus fondamental au plus avancé.`,
    `- Chaque séance vise de 1 à ${CODES_SEANCE_PROTOCOLE_MAX} compétences de la liste fournie. Tu n'inventes aucun code.`,
    "- Chaque dimension est utilisée à bon escient : comprehension pour vérifier que les notions sont comprises, application pour les appliquer à des exercices typiques, contextualisation pour les transposer à des cas nouveaux, memorisation pour fixer les points clés.",
    "- L'ordre des séances suit la dimension : comprendre d'abord, appliquer ensuite, contextualiser puis mémoriser — sauf si l'intention déclarée justifie un autre ordre.",
    "- Chaque consigne est ancrée dans le contenu réel du cours : cite les notions, pas des généralités.",
    "- La durée cible tient au moins 5 minutes par compétence visée.",
    "",
    "COMPÉTENCES ACTIVES DU COMPTE — les seules que tu peux désigner :",
    listerCompetencesPrompt(demande.competences),
  ].join("\n");

  // Ce qui dépend du cours et de l'intention sort du préfixe mis en cache.
  const variable = [
    `Cours : « ${demande.titre} »`,
    `Intention déclarée par la personne : ${LIBELLES_INTENTION_COURS[demande.intention]}`,
    demande.intentionLibre.trim()
      ? `Précision de la personne : ${demande.intentionLibre.trim()}`
      : "",
    "",
    "Texte du cours :",
    demande.extrait,
    "",
    REGLE_VOUVOIEMENT,
    "Appelle l'outil proposer_protocole_cours UNE fois. Ne recopie pas le contenu de l'appel dans ta réponse.",
  ]
    .filter((ligne) => ligne !== "")
    .join("\n");

  return { stable, variable };
}

/* ------------------------------------------------------------------ */
/* Collecte de la proposition                                           */
/* ------------------------------------------------------------------ */

export interface ResultatProtocole {
  /** Proposition validée par le domaine, prête à être relue case par case. */
  protocole: ProtocoleCours | null;
  outilsActifs: boolean;
  erreur: string | null;
}

/** Relit la charge d'un appel d'outil en proposition de protocole, ou `null`. */
export function lireProtocolePropose(donnees: unknown): ProtocoleCours | null {
  const charge = objet(donnees);
  if (!charge || charge.genre !== "protocole-cours") return null;
  const brut = objet(charge.protocole);
  if (!brut) return null;
  const seancesBrutes = Array.isArray(brut.seances) ? brut.seances : [];
  const seances: SeanceProtocole[] = [];
  for (const item of seancesBrutes) {
    const s = objet(item);
    if (!s) return null;
    const dimension: unknown = s.dimension;
    if (!estDimensionSeance(dimension)) return null;
    seances.push({
      titre: typeof s.titre === "string" ? s.titre : "",
      dimension,
      codes: Array.isArray(s.codes)
        ? s.codes.filter((code): code is string => typeof code === "string")
        : [],
      consigne: typeof s.consigne === "string" ? s.consigne : "",
      dureeCibleMin: typeof s.dureeCibleMin === "number" ? s.dureeCibleMin : Number.NaN,
    });
  }
  return {
    resume: typeof brut.resume === "string" ? brut.resume : "",
    seances,
  };
}

/**
 * Propose le protocole, sans conversation.
 *
 * La proposition est validée par `motifRefusProtocole` avant d'être rendue :
 * un plan qui désignerait un code hors référentiel est refusé ici, avec le
 * motif — jamais accepté à moitié.
 */
export async function genererProtocole(
  moteur: MoteurTuteur,
  demande: DemandeProtocole,
  signal?: AbortSignal,
  diffuser?: (evenement: string, donnees: unknown) => void,
): Promise<ResultatProtocole> {
  let protocole: ProtocoleCours | null = null;
  let outilsActifs = true;
  /** La panne annoncée par le moteur — clé refusée, quota, modèle absent. */
  let panne: string | null = null;
  let rejet: string | null = null;

  const envoyer = (evenement: string, donnees: unknown) => {
    if (evenement !== "texte") diffuser?.(evenement, donnees);
    if (evenement === "proposition-rejetee") {
      const message = (donnees as { message?: unknown } | null)?.message;
      if (typeof message === "string" && message.trim()) rejet = message.trim();
    }
    const actifs = lireOutilsActifs(evenement, donnees);
    if (actifs !== null) outilsActifs = actifs;
    panne = panne ?? lireErreurMoteur(evenement, donnees);
    if (evenement === "proposition") {
      const lu = lireProtocolePropose(donnees);
      if (lu) protocole = lu;
    }
  };

  const prompt = construirePromptProtocole(demande);

  await moteur.repondre({
    systemeStable: prompt.stable,
    systemeProfil: prompt.variable,
    messages: [
      {
        role: "user" as const,
        content: `Propose un plan de séances pour le cours « ${demande.titre} ».`,
      },
    ],
    outils: [
      outilProtocoleCours(demande.competences.map((competence) => competence.code)),
    ],
    signal,
    envoyer,
  });

  if (!protocole) {
    return {
      protocole: null,
      outilsActifs,
      erreur:
        panne ??
        (!outilsActifs
          ? messageSansOutils("la conception du protocole")
          : (rejet ?? "Aucun protocole exploitable n'a été produit.")),
    };
  }

  const refus = motifRefusProtocole(
    protocole,
    new Set(demande.competences.map((competence) => competence.code)),
  );
  if (refus) {
    return { protocole: null, outilsActifs, erreur: `Le plan proposé a été refusé : ${refus}` };
  }

  return { protocole, outilsActifs, erreur: null };
}
