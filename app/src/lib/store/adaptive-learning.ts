import "server-only";

import type { Contexte } from "./context";
import type { LearningActivity } from "@/lib/domain/adaptive-learning";
import { adaptNotesDocumentaires, adaptNotesOperationnelles } from "@/lib/domain/note-activity-adapter";
import { lireApercusDocuments, lireApercusSnapshots } from "./documents";
import {
  choisirActionUnifiee,
  type ActionUnifiee,
  type ContexteInstant,
} from "@/lib/engine/action-unifiee";

/**
 * L'arbitrage de la prochaine action, côté serveur.
 *
 * Ce module ne lit **aucune table d'activité** : elles ont été retirées le
 * 15/08/2026 avec la famille « Produire » (ADR-070). Ce qui reste est le pont
 * décrit par l'amendement d'ADR-066 du 14/08 — le moteur d'action reçoit les
 * exercices existants et les notes opérationnelles comme candidats, arbitre
 * selon le temps déclaré et la capacité annoncée, et rend la file que la carte
 * du tableau de bord sait déjà afficher.
 */

/**
 * Les notes opérationnelles ouvertes, vues comme des candidats.
 *
 * Chargées ici et non dans `chargerContexte` : seul le tableau de bord arbitre
 * une action, alors que le contexte sert toutes les pages. Élargir le contexte
 * ferait payer ces deux lectures à des écrans qui n'en font rien — et ADR-064
 * demande justement que le chargement documentaire ne dégrade pas le chemin
 * chaud des recommandations.
 *
 * Les deux lectures ne portent que des métadonnées : ni corps de fiche, ni
 * contenu de snapshot.
 */
async function candidatsNotes(ctx: Contexte): Promise<LearningActivity[]> {
  const [apercus, snapshots] = await Promise.all([
    lireApercusDocuments(),
    lireApercusSnapshots(),
  ]);
  const options = {
    codesActifs: ctx.referentiel.codesActifs,
    documentsFiges: new Set(snapshots.map(({ documentId }) => documentId)),
  };
  return [
    ...adaptNotesOperationnelles(ctx.donnees.user.id, apercus, options),
    ...adaptNotesDocumentaires(ctx.donnees.user.id, apercus, options),
  ];
}

const OUTILS_DISPONIBLES = [
  "annotations", "ressources", "indices", "tuteur", "editeur-markdown",
  "fichiers", "liens", "calculatrice",
] as const;

function rankedStates(ctx: Contexte) {
  const byCode = new Map(ctx.etats.map((state) => [state.skill.code, state]));
  const ordered = ctx.recommandations.flatMap((recommendation) => {
    const code = recommendation.etat.skill.code;
    const state = byCode.get(code);
    if (!state) return [];
    byCode.delete(code);
    return [state];
  });
  return [...ordered, ...byCode.values()];
}

/**
 * L'action à proposer maintenant, pour la carte du tableau de bord.
 *
 * L'arbitrage porte sur les exercices et les tentatives existants, exposés par
 * `adaptLegacyActivities`, et sur les notes opérationnelles ouvertes. Le
 * contexte d'instant vient de l'URL, n'est pas persisté, et ne devient jamais un
 * trait de profil.
 */
export async function chargerActionProposee(
  ctx: Contexte,
  instant: ContexteInstant,
): Promise<ActionUnifiee | null> {
  const declaredAt = ctx.now.toISOString();
  // Un exercice écarté (R1) ne doit pas réapparaître par la porte de
  // l'arbitrage : le moteur d'action voit tout le corpus, là où le classement
  // ne voit que la file déjà filtrée.
  const activitesLegacy = ctx.adaptiveLegacy.activities.filter((activity) =>
    !ctx.refus.exercices.has(activity.id.replace(/^legacy-exercise:/, ""))
    && !activity.target.skillCodes.some((code) => ctx.refus.codes.has(code)),
  );
  const activitesNotes = await candidatsNotes(ctx);

  return choisirActionUnifiee({
    accountId: ctx.donnees.user.id,
    instant,
    declaredAt,
    recommandations: ctx.recommandations,
    rankedSkillStates: rankedStates(ctx),
    availableTools: OUTILS_DISPONIBLES,
    activities: [...activitesLegacy, ...activitesNotes],
    openRuns: ctx.adaptiveLegacy.openRuns,
  });
}
