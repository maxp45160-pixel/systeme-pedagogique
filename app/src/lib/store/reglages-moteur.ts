import "server-only";

/**
 * Le journal des réglages, lu et écrit — ADR-085.
 *
 * Append-only comme les deux autres tables du journal du moteur : aucune
 * fonction ici ne met à jour ni ne supprime, et la base le refuserait deux
 * fois de toute façon.
 *
 * L'état courant n'est jamais stocké : `reglagesEffectifs()` le reconstitue en
 * rejouant ce journal par-dessus les valeurs du code. Annuler un ajustement,
 * c'est écrire la ligne inverse.
 */

import { cache } from "react";
import { dorsaleCompte, type DorsaleCompte } from "./db";
import { ligneVersEntite, verifier } from "./supabase-backend";
import { validerAjustement, validerLignesSupabase } from "./validation-supabase";
import { mesurer } from "@/lib/profiling/server";
import {
  reglagesEffectifs,
  type AjustementInscrit,
  type PropositionAjustement,
  type Reglages,
} from "@/lib/engine/reglages";

export type { Reglages };

/* ------------------------------------------------------------------ */
/* Lecture                                                             */
/* ------------------------------------------------------------------ */

export async function lireJournalReglages(
  dorsaleFournie?: DorsaleCompte,
): Promise<AjustementInscrit[]> {
  const { supabase, userId } = dorsaleFournie ?? (await dorsaleCompte());
  const { data, error } = await mesurer("supabase:moteur_reglages", () =>
    supabase
      .from("moteur_reglages")
      .select("*")
      .eq("user_id", userId)
      .order("applique_le", { ascending: true }),
  );
  verifier("lecture du journal des réglages", error);

  return validerLignesSupabase(data, "moteurReglages").map((ligne, index) =>
    validerAjustement(ligneVersEntite(ligne), `moteurReglages[${index}]`));
}

/**
 * Les réglages effectifs du compte, mémoïsés par requête.
 *
 * Sur le chemin chaud : `chargerContexte` en a besoin pour la calibration et
 * la recommandation. Une lecture de plus, sur une table qui compte zéro ligne
 * tant qu'aucun ajustement n'a eu lieu.
 *
 * Une panne ou une ligne invalide est remontée. Remplacer un journal illisible
 * par les valeurs livrées ferait passer un état inconnu pour un compte qui n'a
 * jamais ajusté ses réglages.
 */
export const chargerReglagesMoteur = cache(async (): Promise<Reglages> =>
  reglagesEffectifs(await lireJournalReglages()));

/* ------------------------------------------------------------------ */
/* Écriture                                                            */
/* ------------------------------------------------------------------ */

/**
 * Inscrit un ajustement.
 *
 * Volontairement **sans garde-fou ici** : les bornes, le pas maximal, la
 * fenêtre d'observation et l'unicité de la proposition sont tenus par
 * `proposerAjustements()`, dans le moteur, où ils sont purs et testés. Les
 * dédoubler dans la couche de persistance créerait deux autorités pour une
 * même règle — exactement ce que CLAUDE.md interdit (« toute validation métier
 * partagée doit avoir une seule implémentation »).
 *
 * La base garde le dernier mot sur ce qu'elle seule peut tenir : une ligne
 * sans effet est refusée par `moteur_reglages_pas_effectif`.
 */
export async function inscrireAjustement(
  proposition: PropositionAjustement,
  dorsaleFournie?: DorsaleCompte,
): Promise<void> {
  const { supabase, userId } = dorsaleFournie ?? (await dorsaleCompte());
  const { error } = await supabase.from("moteur_reglages").insert({
    user_id: userId,
    parametre: proposition.parametre,
    valeur_avant: proposition.valeurAvant,
    valeur_apres: proposition.valeurApres,
    metrique: proposition.metrique,
    n: proposition.n,
    valeur_metrique: proposition.valeurMetrique,
    motif: proposition.motif,
  });
  verifier("inscription d'un ajustement du moteur", error);
}
