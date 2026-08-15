import type { ApercuDocument } from "@/lib/documents/types-documents";
import { definitionTypeDocument } from "@/lib/documents/types-documents";
import {
  idActiviteNote,
  idActiviteRessource,
  type ActivityFamily,
  type ActivityWorkspace,
  type LearningActivity,
} from "./adaptive-learning";

export { idActiviteNote, idActiviteRessource, idDocumentDepuisActivite } from "./adaptive-learning";

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

const TRAVAIL_PAR_RESSOURCE: Record<string, {
  action: string;
  description: string;
  duree: number;
}> = {
  article: {
    action: "Lire et ficher le papier de recherche",
    description: "Lire la ressource, en extraire les idées importantes et les relier à un cas d'application.",
    duree: 30,
  },
  cours: {
    action: "Lire et structurer le cours",
    description: "Reprendre le cours, en dégager les objectifs et formaliser ce qui est à retenir.",
    duree: 30,
  },
  formule: {
    action: "Comprendre et appliquer les formules",
    description: "Reprendre les formules, expliciter leurs variables et les mettre en application.",
    duree: 25,
  },
  reference: {
    action: "Lire et ficher la référence",
    description: "Lire la ressource et conserver les passages utiles dans une fiche exploitable.",
    duree: 25,
  },
  livre: {
    action: "Lire et ficher le livre",
    description: "Parcourir les chapitres utiles et transformer la lecture en fiche de travail.",
    duree: 30,
  },
  note: {
    action: "Reprendre et formaliser la note",
    description: "Clarifier l'idée capturée et la transformer en ressource réutilisable.",
    duree: 20,
  },
  reflexion: {
    action: "Développer la réflexion",
    description: "Reprendre la question, développer l'analyse et dégager une conclusion exploitable.",
    duree: 25,
  },
};

function codesCompetencesActifs(
  apercu: ApercuDocument,
  codesActifs: ReadonlySet<string>,
): string[] {
  return [
    ...new Set(apercu.liens.map(({ cible }) => cible).filter((cible) => codesActifs.has(cible))),
  ];
}

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
  const skillCodes = codesCompetencesActifs(apercu, options.codesActifs);
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

/**
 * Expose une ressource support comme travail documentaire.
 *
 * La ressource reste la fiche canonique et son PDF reste son support. Le
 * candidat dérivé demande un geste de lecture, de structuration et
 * d'application ; il ne fabrique aucune preuve à partir de la capture.
 */
export function adaptNoteDocumentaire(
  accountId: string,
  apercu: ApercuDocument,
  options: { codesActifs: ReadonlySet<string>; documentsFiges: ReadonlySet<string> },
): LearningActivity | null {
  if (apercu.frontMatter.role !== "support") return null;
  if (options.documentsFiges.has(apercu.id)) return null;

  const travail = TRAVAIL_PAR_RESSOURCE[apercu.type];
  if (!travail) return null;

  const dateConnue = apercu.createdAt ?? apercu.updatedAt ?? "1970-01-01T00:00:00.000Z";
  return {
    id: idActiviteRessource(apercu.id),
    accountId,
    title: `${travail.action} — ${apercu.titre}`,
    description: travail.description,
    family: "entrainer",
    target: {
      skillCodes: codesCompetencesActifs(apercu, options.codesActifs),
      themeIds: [],
      goalIds: [],
      label: apercu.titre,
    },
    estimatedDurationMinutes: travail.duree,
    cognitiveDemand: "standard",
    // Le travail produit une fiche éditoriale ; une preuve n'existe qu'après
    // une validation explicite, jamais au moment de l'ajout de la ressource.
    proofMode: "support-seul",
    workspace: "exercice-trois-actes",
    requiredTools: ["editeur-markdown", "fichiers", "liens"],
    authorizedResources: [{
      id: apercu.id,
      kind: "document-interne",
      label: apercu.titre,
      ref: apercu.id,
      usage: "normale",
    }],
    evaluationContract: { scope: "aucune", criteria: [], assessableMilestoneIds: [] },
    version: 1,
    origin: "legacy-adapter",
    status: "active",
    createdAt: dateConnue,
    updatedAt: apercu.updatedAt ?? dateConnue,
  };
}

export function adaptNotesDocumentaires(
  accountId: string,
  apercus: readonly ApercuDocument[],
  options: { codesActifs: ReadonlySet<string>; documentsFiges: ReadonlySet<string> },
): LearningActivity[] {
  return apercus.flatMap((apercu) => {
    const activite = adaptNoteDocumentaire(accountId, apercu, options);
    return activite ? [activite] : [];
  });
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
