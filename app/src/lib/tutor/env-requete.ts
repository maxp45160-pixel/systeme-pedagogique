/**
 * Résolution de l'environnement du tuteur pour une requête — couche route.
 *
 * Les sept routes SSE faisaient toutes la même ligne :
 *
 *     const env = { ...process.env, ...(corps.config ? configVersEnv(corps.config) : {}) };
 *
 * Sept copies d'une même règle, dont aucune ne validait quoi que ce soit. Une
 * copie oubliée lors d'un ajout de route aurait rouvert la SSRF sans que rien
 * ne le signale — c'est la forme du défaut que ce chantier rencontre partout :
 * un garde-fou posé quelque part et non propagé ailleurs.
 *
 * Le point d'entrée est donc unique, et son type de retour force le traitement
 * du refus : `ok: false` porte la `Response` à renvoyer, on ne peut pas la
 * laisser tomber en continuant.
 *
 * C'est aussi, pour la même raison, le seul endroit où le quota est décompté
 * (ADR-116). Toute route qui appellerait `choisirConfiguration` sans passer par
 * ici générerait gratuitement sur la clé serveur.
 */

import { configVersEnv, type ConfigTuteurClient } from "./cle-client";
import { consommerQuotaTuteur } from "@/lib/store/quota-tuteur";

export type EnvTuteur =
  | { ok: true; env: NodeJS.ProcessEnv }
  | { ok: false; reponse: Response };

/**
 * Le message du refus, écrit pour être lisible tel quel.
 *
 * Les surfaces clientes font `if (!reponse.ok)` puis affichent le champ
 * `message` : il n'existe aucun écran dédié au quota, et il ne doit pas en
 * exister un par surface. La phrase porte donc à elle seule ce qui s'est passé,
 * quand ça repart, et le geste qui débloque tout de suite.
 */
export function messageQuotaEpuise(plafond: number): string {
  return (
    `Vos ${plafond} générations offertes de ce mois sont épuisées. ` +
    "Le compteur repart le 1er. Pour continuer maintenant, renseignez votre " +
    "propre clé IA dans « Compte et réglages » — elle est gratuite chez " +
    "Mistral comme chez Groq, et n'est alors plus décomptée."
  );
}

/**
 * L'environnement à passer à `choisirConfiguration`, config client fusionnée.
 *
 * Deux chemins, et la différence tient au payeur :
 *
 *  - **Config client fournie** — l'utilisateur a saisi sa propre clé. Il paie
 *    son fournisseur, rien ne lui est décompté.
 *  - **Aucune config** — la clé serveur, partagée. Une génération est
 *    consommée *avant* l'appel : compter au succès rendrait gratuit tout appel
 *    abandonné.
 *
 * `400` en cas de config invalide : la configuration reçue est fautive, ce
 * n'est pas une indisponibilité du moteur. Le motif est renvoyé tel quel —
 * l'utilisateur a saisi cette URL, il doit lire pourquoi elle est refusée
 * plutôt qu'un « échec » opaque.
 *
 * `402` en cas de quota épuisé : ni `429` (ce n'est pas une limite de débit,
 * c'est une réserve mensuelle consommée), ni `503` (le moteur va très bien).
 */
export async function envTuteur(config?: ConfigTuteurClient): Promise<EnvTuteur> {
  if (!config) {
    const quota = await consommerQuotaTuteur();
    if (!quota.autorise) {
      return {
        ok: false,
        reponse: Response.json(
          {
            erreur: "quota-epuise",
            message: messageQuotaEpuise(quota.plafond),
            restant: 0,
            plafond: quota.plafond,
          },
          { status: 402 },
        ),
      };
    }
    return { ok: true, env: process.env };
  }

  const conversion = configVersEnv(config);
  if (!conversion.ok) {
    return {
      ok: false,
      reponse: Response.json(
        { erreur: "config-invalide", message: conversion.motif },
        { status: 400 },
      ),
    };
  }

  return { ok: true, env: { ...process.env, ...conversion.env } };
}
