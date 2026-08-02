import { chargerContexte } from "@/lib/store/context";
import { construireContexte } from "@/lib/tutor/contexte";
import { choisirConfiguration, creerMoteur } from "@/lib/tutor/moteurs";
import { fenetrerHistorique, MAX_MESSAGES_FENETRE } from "@/lib/tutor/fenetre";
import { configVersEnv, type ConfigTuteurClient } from "@/lib/tutor/cle-client";

/**
 * Route du tuteur — réponse diffusée en flux.
 *
 * Cette route ne connaît aucun fournisseur : elle assemble le contexte, demande
 * un moteur (ADR-007) et relaie ses événements. Changer de fournisseur est une
 * variable d'environnement, ou désormais une config saisie côté client dans les
 * réglages — cette dernière prime sur `app/.env.local`.
 *
 * Sans moteur configuré, elle répond 503 et l'interface bascule d'elle-même en
 * mode « copier le contexte » — elle ne simule jamais une réponse.
 */

interface CorpsRequeteTuteur {
  messages?: { role: "user" | "assistant"; content: string }[];
  /** Config saisie côté client (réglages). Prime sur les variables serveur. */
  config?: ConfigTuteurClient;
  /** Exercice ouvert dans l'interface — son énoncé entre dans le contexte. */
  exerciceId?: string;
}

/**
 * Un tour de tuteur qui rédige un exercice complet — énoncé, indices,
 * correction, critères — dépasse largement le défaut de plateforme. Sans cette
 * borne explicite, la réponse était coupée sans qu'aucun événement `fin` ne
 * soit émis : l'interface restait sur « le tuteur réfléchit… », ce qui se lit
 * comme un plantage.
 */
export const maxDuration = 300;

export async function POST(request: Request) {
  let corps: CorpsRequeteTuteur;
  try {
    corps = (await request.json()) as CorpsRequeteTuteur;
  } catch {
    return Response.json({ erreur: "corps-invalide" }, { status: 400 });
  }

  // La config client (si présente) prime sur `process.env` : l'utilisateur qui
  // a saisi sa clé dans les réglages n'a pas à éditer `app/.env.local`.
  const env = { ...process.env, ...(corps.config ? configVersEnv(corps.config) : {}) };
  const choix = choisirConfiguration(env);
  const moteur = creerMoteur(choix);

  if (!moteur) {
    return Response.json(
      {
        erreur: "moteur-absent",
        message:
          choix.kind === "aucun"
            ? `${choix.raison} Utilise le mode « copier le contexte » en attendant.`
            : "Aucun moteur de tuteur disponible.",
      },
      { status: 503 },
    );
  }

  const messagesComplets = (corps.messages ?? []).filter((m) => m.content.trim().length > 0);
  if (messagesComplets.length === 0) {
    return Response.json({ erreur: "aucun-message" }, { status: 400 });
  }

  const { fenetre: messages, tronque } = fenetrerHistorique(messagesComplets);

  const ctx = await chargerContexte();
  // L'heuristique de chargement conditionnel (ADR-021) reçoit l'historique
  // COMPLET, pas la fenêtre : sa cadence se compte en tours réellement
  // échangés. Lui passer la fenêtre plafonnerait le compteur à la taille de
  // celle-ci, et un plafond multiple de la cadence rechargerait le protocole
  // complet à chaque message — l'inverse exact du gain visé.
  const pedagogique = await construireContexte(ctx, messagesComplets, corps.exerciceId);

  const encodeur = new TextEncoder();

  /*
   * Abandon du client → abandon de la génération.
   *
   * Rien ne le portait : le flux n'avait pas de `cancel()` et `request.signal`
   * n'était jamais consulté. Quand le navigateur coupait — bouton « Arrêter »,
   * navigation, onglet fermé, second envoi — la génération continuait chez le
   * fournisseur jusqu'au bout, facturée, pour un texte que plus personne ne
   * lisait. Et `envoyer` continuait d'appeler `enqueue` sur un contrôleur
   * fermé, ce qui jette au milieu du tour.
   *
   * Deux sources d'abandon fusionnées : celle de la plateforme
   * (`request.signal`, déconnexion TCP) et celle du flux (`cancel`, le lecteur
   * relâché côté navigateur). Elles ne se déclenchent pas dans les mêmes cas.
   */
  const abandon = new AbortController();
  request.signal.addEventListener("abort", () => abandon.abort(), { once: true });

  const flux = new ReadableStream({
    async start(controller) {
      const envoyer = (evenement: string, donnees: unknown) => {
        // Après abandon, le contrôleur est fermé : écrire dedans lèverait.
        if (abandon.signal.aborted) return;
        controller.enqueue(
          encodeur.encode(`event: ${evenement}\ndata: ${JSON.stringify(donnees)}\n\n`),
        );
      };

      if (tronque) {
        envoyer("tronque", {
          message: `Conversation longue : seuls le premier message et les ${MAX_MESSAGES_FENETRE - 1} derniers messages sont transmis au tuteur.`,
        });
      }

      try {
        await moteur.repondre({
          systemeStable: pedagogique.systemeStable,
          systemeProfil: pedagogique.systemeProfil,
          messages,
          outils: pedagogique.outils,
          signal: abandon.signal,
          envoyer,
        });
      } finally {
        // Fermer un contrôleur déjà annulé lève : le cas est normal, pas une
        // panne. On l'avale plutôt que de polluer les journaux du serveur.
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
