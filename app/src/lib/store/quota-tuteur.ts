/**
 * Quota mensuel du tuteur — côté serveur uniquement (ADR-116).
 *
 * La clé du tuteur est désormais posée sur le serveur : un compte neuf génère
 * sans avoir à ouvrir un compte chez un fournisseur d'IA. Ce qui rendait cette
 * clé impossible à partager, c'est qu'elle n'avait aucun plafond — un seul
 * compte pouvait en vider le crédit. Le quota est ce plafond.
 *
 * Deux fonctions, et la différence entre elles est le point important :
 *
 *  - `consommerQuotaTuteur` **écrit**. Elle passe par une RPC
 *    `SECURITY DEFINER` parce que la politique UPDATE de `comptes_acces` est
 *    réservée aux administrateurs — c'est précisément ce qu'on veut garder :
 *    un compte ne remet pas son propre compteur à zéro.
 *  - `lireQuotaTuteur` **n'écrit rien**. Elle sert l'affichage, et lit la table
 *    directement : la politique SELECT « soi ou admin » l'autorise déjà.
 *
 * Ne jamais appeler `consommerQuotaTuteur` pour afficher quelque chose : elle
 * décompte.
 *
 * Le calcul du solde lui-même vit dans `lib/domain/quota-tuteur.ts` : ce
 * module-ci porte `server-only`, et une règle pure n'a aucune raison d'être
 * enfermée derrière cette barrière.
 */

import "server-only";

import { cache } from "react";
import { dorsaleCompte } from "./db";
import { verifier } from "./supabase-backend";
import { soldeQuota, type QuotaTuteur } from "@/lib/domain/quota-tuteur";

export type { QuotaTuteur } from "@/lib/domain/quota-tuteur";

export interface ConsommationQuota extends QuotaTuteur {
  autorise: boolean;
}

/**
 * Décompte une génération sur la clé serveur, et dit si elle est autorisée.
 *
 * **Appelée avant la génération, pas après.** Compter au succès rendrait
 * gratuit tout appel abandonné, et une boucle d'abandons côté client viderait
 * la clé sans jamais incrémenter. Le prix de ce choix est une génération perdue
 * quand le fournisseur échoue ; c'est le moindre des deux.
 *
 * Un administrateur n'est jamais décompté — la RPC le tranche, pas cet appel.
 */
export async function consommerQuotaTuteur(): Promise<ConsommationQuota> {
  const { supabase } = await dorsaleCompte();

  const { data, error } = await supabase.rpc("consommer_quota_tuteur");
  verifier("consommation du quota du tuteur", error);

  const ligne = (Array.isArray(data) ? data[0] : data) as
    | { autorise: boolean; restant: number; plafond: number }
    | undefined;

  /*
   * Pas de ligne rendue : la fonction est censée en rendre toujours une. Plutôt
   * que d'inventer un solde, on refuse — un quota qui s'ouvre quand on ne sait
   * pas où il en est n'est pas un quota (invariant 6 : ne jamais fabriquer une
   * valeur à partir d'une donnée absente).
   */
  if (!ligne) return { autorise: false, restant: 0, plafond: 0 };

  return {
    autorise: Boolean(ligne.autorise),
    restant: Number(ligne.restant ?? 0),
    plafond: Number(ligne.plafond ?? 0),
  };
}

/**
 * Le solde du compte connecté, pour l'affichage. N'écrit rien.
 *
 * Mémoïsée par requête comme `lireAccesCourant` : plusieurs surfaces d'une même
 * page peuvent l'appeler sans multiplier les allers-retours.
 */
export const lireQuotaTuteur = cache(async (): Promise<QuotaTuteur | null> => {
  const { supabase, userId } = await dorsaleCompte();

  const { data, error } = await supabase
    .from("comptes_acces")
    .select("role, quota_mensuel, quota_periode, quota_appels")
    .eq("user_id", userId)
    .maybeSingle();
  verifier("lecture du quota du tuteur", error);
  if (!data) return null;

  // Un administrateur n'est pas décompté : lui afficher un solde serait
  // annoncer une limite qui n'existe pas pour lui.
  if (data.role === "admin") return null;

  return soldeQuota({
    quotaMensuel: Number(data.quota_mensuel ?? 0),
    quotaPeriode: (data.quota_periode as string | null) ?? null,
    quotaAppels: Number(data.quota_appels ?? 0),
  });
});
