import {
  choisirConfiguration,
  creerMoteur,
  type MoteurTuteur,
  type ProfilMoteur,
} from "./moteurs";
import { envTuteur } from "./env-requete";
import type { ConfigTuteurClient } from "./cle-client";

export type EnvoyerSse = (evenement: string, donnees: unknown) => void;

export type MoteurResolu =
  | {
      ok: true;
      moteur: MoteurTuteur;
      /** Modèle retenu — pour la télémétrie côté route. */
      modele: string | null;
    }
  | { ok: false; reponse: Response };

export interface OptionsMoteur {
  /** Geste proposé à la place du tuteur dans le message 503. */
  conseil?: string;
  /** Profil de choix du fournisseur (`rapide` pour les décisions courtes). */
  profil?: ProfilMoteur;
}

/**
 * Résout le moteur d'une route SSE : la config client est validée avant de
 * toucher l'environnement du serveur (SSRF, voir `url-fournisseur.ts`), puis
 * un fournisseur est choisi. Sans moteur configuré, la réponse est un 503
 * honnête et l'interface bascule d'elle-même en mode « copier le contexte » —
 * elle ne simule jamais une réponse. `options.conseil` personnalise le geste
 * proposé à la place (créer à la main, réessayer plus tard…).
 *
 * Asynchrone depuis ADR-116 : `envTuteur` décompte le quota de la clé serveur,
 * ce qui suppose un aller-retour en base. Le refus qu'elle peut rendre (402,
 * quota épuisé) remonte tel quel dans `MoteurResolu`.
 */
export async function resoudreMoteur(
  config?: ConfigTuteurClient,
  options: OptionsMoteur = {},
): Promise<MoteurResolu> {
  // La config client (si présente) prime sur `process.env` : l'utilisateur qui
  // a saisi sa clé dans les réglages n'a pas à éditer `app/.env.local`.
  const resolution = await envTuteur(config);
  if (!resolution.ok) return resolution;

  const conseil = options.conseil ?? "Utilise le mode « copier le contexte » en attendant.";
  const choix = choisirConfiguration(resolution.env, options.profil);
  const moteur = creerMoteur(choix);
  if (!moteur) {
    return {
      ok: false,
      reponse: Response.json(
        {
          erreur: "moteur-absent",
          message:
            choix.kind === "aucun"
              ? `${choix.raison} ${conseil}`
              : "Aucun moteur de tuteur disponible.",
        },
        { status: 503 },
      ),
    };
  }
  return {
    ok: true,
    moteur,
    modele: choix.kind === "aucun" ? null : choix.modele,
  };
}

/**
 * Réponse SSE partagée par toutes les routes du tuteur.
 *
 * - Abandon du client → abandon de la génération : deux sources fusionnées
 *   (`request.signal`, déconnexion TCP ; et `cancel`, lecteur relâché côté
 *   navigateur). Elles ne se déclenchent pas dans les mêmes cas.
 * - Après abandon, `envoyer` n'écrit plus : écrire dans un contrôleur fermé
 *   jette au milieu du tour.
 * - Une exception échappée de `executer` émet `erreur` (sauf abandon
 *   volontaire : ce n'est pas une panne), puis le contrôleur est fermé
 *   toléramment — fermer un contrôleur déjà annulé lève aussi.
 *
 * `formatterErreur` personnalise le message diffusé ; les routes one-shot
 * relaient le motif brut, le chat préfixe son propre contexte.
 */
export function repondreParFluxSse(
  request: Request,
  executer: (envoyer: EnvoyerSse, signal: AbortSignal) => Promise<void>,
  formatterErreur: (erreur: unknown) => string = (e) =>
    e instanceof Error ? e.message : "Erreur inattendue lors de la génération.",
): Response {
  const encodeur = new TextEncoder();
  const abandon = new AbortController();
  request.signal.addEventListener("abort", () => abandon.abort(), { once: true });

  const flux = new ReadableStream({
    async start(controller) {
      const envoyer: EnvoyerSse = (evenement, donnees) => {
        if (abandon.signal.aborted) return;
        controller.enqueue(
          encodeur.encode(`event: ${evenement}\ndata: ${JSON.stringify(donnees)}\n\n`),
        );
      };

      try {
        await executer(envoyer, abandon.signal);
      } catch (e) {
        if (!abandon.signal.aborted) {
          envoyer("erreur", { message: formatterErreur(e) });
        }
      } finally {
        try {
          controller.close();
        } catch {
          /* flux déjà annulé côté client */
        }
      }
    },
    cancel() {
      abandon.abort();
    },
  });

  return new Response(flux, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
