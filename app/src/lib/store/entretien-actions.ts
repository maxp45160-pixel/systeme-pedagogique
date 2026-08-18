"use server";

/**
 * L'application d'un candidat d'entretien du référentiel — ADR-086.
 *
 * Une seule écriture est exposée pour l'instant : la déclaration d'une arête.
 * C'est la seule dont le geste est **non destructif et réversible en un clic**
 * (`delierCompetences` existe déjà). Les quatre autres familles de candidats —
 * reformulation, scission, dormance, rangement — passent par les écrans qui
 * portent déjà leur validation ligne à ligne, parce qu'elles engagent
 * respectivement un changement de sens, une succession (ADR-087), un archivage
 * et une gouvernance de domaine. Leur donner un bouton ici doublerait la règle
 * au lieu de la réutiliser.
 *
 * Aucune validation n'est réimplémentée : `relierCompetences` refuse déjà le
 * cycle, l'auto-référence, et fait passer l'écriture par
 * `preparerRevisionDomaine` — donc par `validerCompetence` et par le journal
 * `referentiel_changes`.
 */

import { revalidatePath } from "next/cache";
import { relierCompetences } from "./referentiel-actions";

export async function relierCompetencesAction(
  amont: string,
  aval: string,
): Promise<void> {
  await relierCompetences(amont, aval);
  revalidatePath("/", "layout");
}
