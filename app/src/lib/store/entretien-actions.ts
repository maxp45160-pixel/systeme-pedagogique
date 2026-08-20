"use server";

/**
 * L'application d'un candidat d'entretien du référentiel — ADR-086, ADR-087.
 *
 * Deux gestes seulement, et ce sont les deux que le lot d'entretien découvre :
 * tisser une relation, et retravailler une compétence mal formée.
 *
 * Aucune validation n'est réimplémentée ici. `relierCompetences` refuse déjà le
 * cycle et l'auto-référence ; `preparerRevisionDomaine` fait passer toute
 * écriture par `validerCompetence` et par le journal `referentiel_changes`.
 */

import { revalidatePath } from "next/cache";
import { dorsaleCompte } from "./db";
import { verifier } from "./supabase-backend";
import { lireReferentiel } from "./referentiel";
import { appliquerRevision, relierCompetences } from "./referentiel-actions";
import {
  composerIntitule,
  motifsNonAtomique,
  motifsRefusStructure,
  type IntituleStructure,
} from "@/lib/domain/atomicite";
import { modeRetrait } from "@/lib/domain/referentiel-compte";

export async function relierCompetencesAction(
  amont: string,
  aval: string,
): Promise<void> {
  await relierCompetences(amont, aval);
  revalidatePath("/", "layout");
}

/** Ce que l'écran renvoie : une ou plusieurs compétences pour en remplacer une. */
export interface RemplacanteProposee extends IntituleStructure {
  palier: string;
  importance: number;
}

export interface ResultatRetravail {
  mode: "reecriture" | "scission";
  /** Intitulés effectivement écrits, assemblés par l'application. */
  intitules: string[];
  /** Vrai quand l'ancienne compétence a été archivée avec ses observations. */
  ancienneArchivee: boolean;
}

/**
 * Retravaille une compétence gelée par les règles d'atomicité.
 *
 * Deux chemins, et c'est le NOMBRE de remplaçantes qui les sépare, pas la
 * présence d'observations :
 *
 * - **une seule** → réécriture. L'intitulé change, le code reste, les observations
 *   restent attachées. C'est le cas d'une formulation maladroite d'un
 *   savoir-faire unique ;
 * - **plusieurs** → scission (ADR-087). L'ancienne est retirée — archivée si
 *   elle porte des observations, supprimée sinon (ADR-027, la règle est dérivée du
 *   nombre d'observations, pas choisie ici) — et les remplaçantes sont créées.
 *
 * ⚠️ **Les observations ne bougent pas.** Après une scission, les remplaçantes
 * démarrent à zéro observation, niveau `null`, et l'ancienne garde tout son
 * historique sous son code archivé. Le tableau de bord recule le jour où on
 * scinde la compétence la mieux mesurée : c'est P2 appliqué, pas une
 * régression, et l'écran l'annonce avant d'appliquer.
 *
 * Tout se fait en **une seule commande** `reviser_domaine` : ajouts et retrait
 * dans la même transaction, donc une seule entrée au journal. Une commande par
 * geste laisserait une fenêtre où l'ancienne serait retirée sans que les
 * nouvelles existent.
 */
export async function retravaillerCompetence(
  code: string,
  remplacantes: RemplacanteProposee[],
): Promise<ResultatRetravail> {
  if (remplacantes.length === 0) {
    throw new Error("Il faut au moins une compétence pour en remplacer une.");
  }

  const referentiel = await lireReferentiel();
  const ancienne = referentiel.parCode.get(code);
  if (!ancienne) throw new Error(`Compétence inconnue : ${code}`);

  // Les intitulés sont assemblés ICI, jamais reçus tout faits : c'est ce qui
  // garantit que la sortie de cet écran passe les mêmes règles que la sortie du
  // tuteur (ADR-086).
  const intitules = remplacantes.map((r) => {
    const refus = motifsRefusStructure(r);
    if (refus.length > 0) throw new Error(refus.join(" "));
    const intitule = composerIntitule(r);
    const motifs = motifsNonAtomique(intitule);
    if (motifs.length > 0) throw new Error(motifs.map((m) => m.message).join(" "));
    return intitule;
  });

  const reecriture = remplacantes.length === 1;

  if (reecriture) {
    await appliquerRevision({
      domaineId: ancienne.domaine,
      ajouts: [],
      modifications: [
        {
          code,
          intitule: intitules[0],
          palier: remplacantes[0].palier,
          importance: String(remplacantes[0].importance),
        },
      ],
      retraits: [],
    });
    revalidatePath("/", "layout");
    return { mode: "reecriture", intitules, ancienneArchivee: false };
  }

  // `modeRetrait` dérive archivage ou suppression du nombre d'observations : on ne
  // choisit pas, on lit (ADR-027). Sans ce comptage, une compétence mesurée
  // pourrait être annoncée comme supprimée alors qu'elle a été archivée.
  const observations = await compterObservations(code);

  const resultat = await appliquerRevision({
    domaineId: ancienne.domaine,
    ajouts: remplacantes.map((r, index) => ({
      intitule: intitules[index],
      palier: r.palier,
      importance: String(r.importance),
      ordre: ancienne.ordre + index,
    })),
    modifications: [],
    retraits: [code],
  });

  // Les codes créés viennent de la COMMANDE, pas d'une relecture :
  // `lireReferentiel` est mémoïsé par requête et rendrait l'état d'avant.
  await inscrireSuccession(code, resultat.ajoutes);
  revalidatePath("/", "layout");

  return {
    mode: "scission",
    intitules,
    ancienneArchivee: modeRetrait(observations) === "archivage",
  };
}

/** Le nombre d'observations d'une compétence — la seule donnée qui décide du retrait. */
async function compterObservations(code: string): Promise<number> {
  const { supabase, userId } = await dorsaleCompte();
  const { count, error } = await supabase
    .from("observations")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("skill_code", code);
  verifier("comptage des observations d'une compétence", error);
  return count ?? 0;
}

/**
 * Inscrit la succession 1 → N — ADR-087.
 *
 * Après la commande, et non dedans : la RPC `appliquer_commande_referentiel` ne
 * connaît pas cette table. La traçabilité ne repose pas sur cette écriture — la
 * scission est déjà au journal `referentiel_changes` — mais sur elle repose la
 * question « qu'est devenue LOG-01 ? », à laquelle `remplace_par` ne sait pas
 * répondre quand il y a plusieurs successeurs.
 *
 * Une panne ici ne défait pas la scission : elle est signalée dans les logs, et
 * la relation de succession pourra être reconstituée depuis le journal.
 */
async function inscrireSuccession(
  ancienCode: string,
  nouveaux: string[],
): Promise<void> {
  if (nouveaux.length === 0) return;
  try {
    const { supabase, userId } = await dorsaleCompte();

    const { error } = await supabase.from("competence_succession").insert(
      nouveaux.map((nouveauCode) => ({
        user_id: userId,
        ancien_code: ancienCode,
        nouveau_code: nouveauCode,
        motif: `Scission de ${ancienCode} en ${nouveaux.length} compétences atomiques (ADR-086).`,
      })),
    );
    verifier("inscription d'une succession", error);
  } catch (erreur) {
    console.error("[entretien] succession non inscrite :", erreur);
  }
}
