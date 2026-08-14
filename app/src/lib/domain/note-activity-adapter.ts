import type { ApercuDocument } from "@/lib/documents/types-documents";
import { definitionTypeDocument } from "@/lib/documents/types-documents";
import {
  idActiviteNote,
  type ActivityFamily,
  type ActivityWorkspace,
  type LearningActivity,
} from "./adaptive-learning";

export { idActiviteNote, idDocumentDepuisActivite } from "./adaptive-learning";

/**
 * Une note opérationnelle ouverte, vue comme une action possible.
 *
 * ## Pourquoi dérivé plutôt que stocké
 *
 * Une note opérationnelle **est** un travail engagé : on l'a capturée pour
 * faire quelque chose. La file d'actions doit donc pouvoir la proposer, au même
 * titre qu'un exercice. Mais rien n'a besoin d'être écrit pour cela : tout ce
 * qui définit le candidat — sa famille, ses compétences visées, son état — se
 * relit de son front-matter et de ses liens.
 *
 * C'est le même procédé que `legacy-activity-adapter.ts` pour les exercices, et
 * que les demandes de génération de `lib/store/adaptive-learning.ts` : exposer
 * dans le contrat commun sans recopier. Aucune table, aucune migration.
 *
 * ## Ce que l'adaptateur ne sait pas
 *
 * Il ne connaît pas le référentiel : les codes de compétence lui sont donnés en
 * paramètre. Un wikilien vers une cible qui n'est pas un code actif n'est pas
 * une compétence visée — le supposer fabriquerait une cible à partir d'un lien
 * quelconque.
 *
 * Il ne fabrique aucune mesure. La durée annoncée est une **convention par
 * famille**, pas une observation : une note ne déclare pas sa durée, et
 * inventer une estimation individuelle donnerait à un chiffre arbitraire
 * l'apparence d'un calcul.
 */

/** Durées conventionnelles, en minutes. Voir la réserve ci-dessus. */
const DUREE_PAR_FAMILLE: Record<ActivityFamily, number> = {
  explorer: 20,
  entrainer: 30,
  produire: 45,
};

const ESPACE_PAR_FAMILLE: Record<ActivityFamily, ActivityWorkspace> = {
  explorer: "exploration-guidee",
  entrainer: "exercice-trois-actes",
  produire: "mini-projet",
};

/**
 * La famille d'une branche opérationnelle.
 *
 * Une séance entraîne, une expérimentation explore, tout le reste produit. Un
 * format inconnu ne reçoit pas de famille par défaut : il ne devient pas un
 * candidat, plutôt que d'entrer dans la file sous une étiquette inventée.
 */
const FAMILLE_PAR_TYPE: Record<string, ActivityFamily> = {
  seance: "entrainer",
  experimentation: "explorer",
  projet: "produire",
  "etude-de-cas": "produire",
  redaction: "produire",
  schema: "produire",
};

/**
 * Adapte une note opérationnelle, ou rend `null` si elle n'en est pas une.
 *
 * `null` couvre trois cas, tous volontaires : le rôle n'est pas opérationnel,
 * le format n'appartient à aucune famille connue, ou la note porte déjà une
 * version figée. Ce dernier point mérite d'être dit : figer une révision est le
 * geste par lequel une production est rendue. Une note figée a donc livré
 * quelque chose et n'a plus à être proposée — c'est le seul signal
 * d'achèvement dont on dispose sans ouvrir le corps de la fiche.
 */
export function adaptNoteOperationnelle(
  accountId: string,
  apercu: ApercuDocument,
  options: { codesActifs: ReadonlySet<string>; documentsFiges: ReadonlySet<string> },
): LearningActivity | null {
  if (apercu.frontMatter.role !== "operationnel") return null;
  if (options.documentsFiges.has(apercu.id)) return null;

  const famille = FAMILLE_PAR_TYPE[apercu.type];
  if (!famille) return null;

  const definition = definitionTypeDocument(apercu.type);
  const skillCodes = [
    ...new Set(apercu.liens.map(({ cible }) => cible).filter((cible) => options.codesActifs.has(cible))),
  ];
  const contexte = typeof apercu.frontMatter.contexte === "string" ? apercu.frontMatter.contexte : "";
  const dateConnue = apercu.createdAt ?? apercu.updatedAt ?? "1970-01-01T00:00:00.000Z";

  return {
    id: idActiviteNote(apercu.id),
    accountId,
    title: apercu.titre,
    description: contexte || definition?.libelle || apercu.titre,
    family: famille,
    target: { skillCodes, themeIds: [], goalIds: [], label: apercu.titre },
    estimatedDurationMinutes: DUREE_PAR_FAMILLE[famille],
    cognitiveDemand: "standard",
    proofMode: famille === "explorer" ? "support-seul" : "soumission-finale",
    workspace: ESPACE_PAR_FAMILLE[famille],
    requiredTools: ["editeur-markdown", "liens"],
    authorizedResources: [],
    evaluationContract:
      famille === "explorer"
        ? { scope: "aucune", criteria: [], assessableMilestoneIds: [] }
        : { scope: "soumission-finale", criteria: [], assessableMilestoneIds: [] },
    // Un travail durable peut se mener par morceaux. Le moteur ne segmente que
    // la famille « produire » ; l'annoncer ailleurs serait sans effet.
    minimumSegmentMinutes: famille === "produire" ? 20 : undefined,
    version: 1,
    origin: "utilisateur",
    status: "active",
    createdAt: dateConnue,
    updatedAt: apercu.updatedAt ?? dateConnue,
  };
}

export function adaptNotesOperationnelles(
  accountId: string,
  apercus: readonly ApercuDocument[],
  options: { codesActifs: ReadonlySet<string>; documentsFiges: ReadonlySet<string> },
): LearningActivity[] {
  return apercus.flatMap((apercu) => {
    const activite = adaptNoteOperationnelle(accountId, apercu, options);
    return activite ? [activite] : [];
  });
}
