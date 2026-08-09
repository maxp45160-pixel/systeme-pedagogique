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
 */

import { configVersEnv, type ConfigTuteurClient } from "./cle-client";

export type EnvTuteur =
  | { ok: true; env: NodeJS.ProcessEnv }
  | { ok: false; reponse: Response };

/**
 * L'environnement à passer à `choisirConfiguration`, config client fusionnée.
 *
 * `400` et non `503` en cas de refus : la configuration reçue est invalide, ce
 * n'est pas une indisponibilité du moteur. Le motif est renvoyé tel quel —
 * l'utilisateur a saisi cette URL, il doit lire pourquoi elle est refusée
 * plutôt qu'un « échec » opaque.
 */
export function envTuteur(config?: ConfigTuteurClient): EnvTuteur {
  if (!config) return { ok: true, env: process.env };

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
