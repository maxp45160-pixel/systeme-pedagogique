/**
 * Réviser une branche existante par le dialogue — sans conversation.
 *
 * La suggestion de branche (`generation-referentiel.ts`) ne sait que **créer**.
 * Le besoin remonté à l'usage est autre : « ce référentiel ne couvre plus mes
 * besoins, change-le » — donc ajouter, reformuler et retirer, en repartant de
 * ce qui existe.
 *
 * Deux choses partent dans le prompt et méritent leur ligne :
 *
 * 1. **le code de chaque compétence vivante**, parce que la révision doit
 *    pouvoir les DÉSIGNER. Ce n'est pas les laisser en frapper : l'`enum` du
 *    schéma est fermé sur ces codes-là, et rien d'autre n'est exprimable (voir
 *    `OUTIL_REVISION`) ;
 * 2. **le nombre de preuves de chacune**, parce qu'un retrait s'annonce avant
 *    le clic (ADR-027). Le tuteur ne décide pas entre suppression et archivage
 *    — l'application le dérive — mais il doit savoir qu'une compétence à neuf
 *    preuves ne se retire pas à la légère.
 *
 * Le compte de preuves vient de `retraitsParCode`, **déjà calculé** par la page
 * du domaine : aucune requête supplémentaire.
 *
 * ⚠️ Les compétences archivées ne sont pas listées. Elles ne sont ni dans
 * l'`enum` ni dans le prompt : une archive ne se renomme pas et ne se retire
 * pas deux fois.
 */

import type { Domaine, Skill } from "@/lib/domain/types";
import type { EtatRetrait } from "@/lib/domain/referentiel-compte";
import type { MoteurTuteur } from "./moteurs";
import { lireOutilsActifs, messageSansOutils } from "./moteurs";
import { outilsRevision, type PropositionRevision } from "./outils";

export interface ResultatRevision {
  revision: PropositionRevision | null;
  outilsActifs: boolean;
  erreur: string | null;
}

export function construirePromptRevision(
  domaine: Domaine,
  vivantes: Skill[],
  retraits: Map<string, EtatRetrait>,
  demande: string,
): string {
  const lignes = vivantes.map((s) => {
    const preuves = retraits.get(s.code)?.preuves ?? 0;
    return `- ${s.code} — ${s.intitule} (palier ${s.palier}, importance ${s.importance}) — ${preuves} preuve(s)`;
  });

  return [
    "Tu es le tuteur du système pédagogique. Tu révises une branche de compétences existante, à la demande de la personne.",
    "",
    "TU N'APPLIQUES RIEN.",
    "Ta proposition s'affiche ligne à ligne ; la personne coche ce qu'elle garde. Rien n'est écrit sans son geste.",
    "",
    `BRANCHE — ${domaine.nom}`,
    domaine.description ? domaine.description : "(aucune description)",
    "",
    "COMPÉTENCES ACTUELLES",
    ...(lignes.length > 0 ? lignes : ["- aucune"]),
    "",
    "CE QUE LA PERSONNE DEMANDE",
    demande.trim(),
    "",
    "RÈGLES",
    "- Tu peux ajouter, reformuler et retirer. Ne propose pas de tout refaire quand une reformulation suffit.",
    "- Pour ajouter : chaque intitulé est un savoir-faire observable et non un sujet, notable sur au moins une dimension, testable dans deux contextes, exerçable par un type d'exercice, et prouvable en 20 à 60 minutes.",
    "- Pour reformuler : ne mets que les champs qui changent, et désigne la compétence par son code.",
    "- Pour retirer : donne toujours un motif. **L'application décide seule entre suppression et archivage, selon les preuves enregistrées** — ne le propose pas, et ne recommande pas de retirer une compétence qui porte des preuves sans raison forte.",
    "- Tu ne peux désigner que les codes ci-dessus. Les compétences que tu ajoutes n'ont pas de code : l'application les attribue.",
    "",
    "Appelle l'outil proposer_revision UNE fois. Ne recopie pas le contenu de l'appel dans ta réponse.",
  ].join("\n");
}

export async function reviserBranche(
  moteur: MoteurTuteur,
  domaine: Domaine,
  vivantes: Skill[],
  retraits: Map<string, EtatRetrait>,
  demande: string,
  signal?: AbortSignal,
  diffuser?: (evenement: string, donnees: unknown) => void,
): Promise<ResultatRevision> {
  let revision: PropositionRevision | null = null;
  let outilsActifs = true;

  const envoyer = (evenement: string, donnees: unknown) => {
    if (evenement !== "texte") diffuser?.(evenement, donnees);

    const actifs = lireOutilsActifs(evenement, donnees);
    if (actifs !== null) outilsActifs = actifs;

    if (evenement === "proposition") {
      const proposition = donnees as { genre: string; revision?: PropositionRevision };
      if (proposition.genre === "revision" && proposition.revision) {
        revision = proposition.revision;
      }
    }
  };

  await moteur.repondre({
    systemeStable: construirePromptRevision(domaine, vivantes, retraits, demande),
    systemeProfil: "",
    outils: [outilsRevision(vivantes.map((s) => s.code))],
    messages: [{ role: "user" as const, content: demande.trim() }],
    signal,
    envoyer,
  });

  const erreur =
    revision !== null
      ? null
      : outilsActifs
        ? "Le tuteur n'a proposé aucune révision exploitable."
        : messageSansOutils("la révision assistée");

  return { revision, outilsActifs, erreur };
}
