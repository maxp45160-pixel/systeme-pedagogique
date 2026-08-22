"use server";

/**
 * Écritures d'engagement — le fait daté déclaré par la personne.
 *
 * Même discipline que `seance-actions.ts` : `dorsaleCompte()` redirige sans
 * session, RLS reste la barrière d'autorisation, chaque écriture revalide le
 * tableau de bord (`revalidatePath`, ADR-024).
 *
 * ## Append-only
 *
 * La table ne connaît que deux gestes : créer, et clôturer (clôture posée sur
 * la ligne existante — c'est le seul champ qui lui soit jamais ajouté). Un
 * report NE réécrit NI l'échéance NI rien d'autre de l'ancien engagement : il
 * le clôture « reporte » et CRÉE un remplaçant portant la nouvelle date.
 * L'historique des reports reste lisible, et aucun chemin ici ne supprime une
 * ligne — un engagement déclaré est un fait, les faits ne s'effacent pas.
 */

import { revalidatePath } from "next/cache";
import {
  estOuvert,
  validerNouvelEngagement,
  type Engagement,
  type EntreeEngagement,
} from "@/lib/domain/engagement";
import { ajouter, dorsaleCompte, lire, modifier, nouvelId } from "./db";
import { lireReferentiel } from "./referentiel";

/**
 * Crée un engagement après validation domaine complète.
 *
 * Les codes sont relus contre le référentiel DU COMPTE au moment de
 * l'écriture — pas contre ce que le formulaire a reçu : l'interface est
 * contournable, et un code hors référentiel doit lever ici comme partout
 * (garde-fou : personne ne crée de code de compétence en déclarant une
 * échéance).
 */
export async function creerEngagement(entree: EntreeEngagement): Promise<Engagement> {
  const dorsale = await dorsaleCompte();
  const referentiel = await lireReferentiel(dorsale);

  const valide = validerNouvelEngagement(entree, referentiel.codesActifs);
  const engagement: Engagement = { id: nouvelId("eng"), ...valide };

  await ajouter("engagements", engagement, dorsale);
  revalidatePath("/", "layout");
  return engagement;
}

/**
 * Clôture un engagement : « passe » (il a eu lieu) ou « reporte » via
 * `reporterEngagement`.
 *
 * Idempotent par refus explicite plutôt que par silence : rappeler la clôture
 * sur un engagement déjà clos lève — contrairement à l'abandon de séance
 * (ADR-072), il n'existe ici aucun double-clic plausible qui porterait le même
 * geste, et une clôture accidentelle mérite d'être vue, pas avalée.
 */
export async function cloreEngagement(id: string): Promise<void> {
  const dorsale = await dorsaleCompte();
  const engagement = (await lire("engagements", dorsale)).find((e) => e.id === id);
  if (!engagement) throw new Error(`Engagement introuvable : ${id}.`);
  if (!estOuvert(engagement)) {
    throw new Error(`L'engagement « ${engagement.libelle} » est déjà clôturé.`);
  }

  await modifier(
    "engagements",
    id,
    { clotureLe: new Date().toISOString(), clotureType: "passe" },
    dorsale,
  );
  revalidatePath("/", "layout");
}

/**
 * Reporte un engagement à une nouvelle date.
 *
 * L'ancien est clôturé « reporte » — son échéance passée n'est ni réécrite ni
 * effacée — et un NOUVEL engagement porte la date remplacée, avec le même
 * type, libellé et ciblage. La validation de la nouvelle date est exactement
 * celle d'une création : une seule autorité (`validerNouvelEngagement`).
 */
export async function reporterEngagement(id: string, nouvelleEcheanceLe: string): Promise<Engagement> {
  const dorsale = await dorsaleCompte();
  const referentiel = await lireReferentiel(dorsale);

  const engagement = (await lire("engagements", dorsale)).find((e) => e.id === id);
  if (!engagement) throw new Error(`Engagement introuvable : ${id}.`);
  if (!estOuvert(engagement)) {
    throw new Error(
      `L'engagement « ${engagement.libelle} » est clôturé : créez-en un nouveau plutôt.`,
    );
  }

  const valide = validerNouvelEngagement(
    { type: engagement.type, libelle: engagement.libelle, echeanceLe: nouvelleEcheanceLe, codes: engagement.codes },
    referentiel.codesActifs,
  );

  await modifier(
    "engagements",
    id,
    { clotureLe: new Date().toISOString(), clotureType: "reporte" },
    dorsale,
  );

  const remplaçant: Engagement = { id: nouvelId("eng"), ...valide };
  await ajouter("engagements", remplaçant, dorsale);
  revalidatePath("/", "layout");
  return remplaçant;
}
