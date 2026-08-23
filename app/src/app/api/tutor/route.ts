import { chargerContexte } from "@/lib/store/context";
import { construireContexte } from "@/lib/tutor/contexte";
import { resoudreMoteur, repondreParFluxSse } from "@/lib/tutor/reponse-flux";
import type { ConfigTuteurClient } from "@/lib/tutor/cle-client";
import { fenetrerHistorique, MAX_MESSAGES_FENETRE } from "@/lib/tutor/fenetre";

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

  const resolu = await resoudreMoteur(corps.config);
  if (!resolu.ok) return resolu.reponse;
  const { moteur } = resolu;

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

  return repondreParFluxSse(
    request,
    async (envoyer, signal) => {
      if (tronque) {
        envoyer("tronque", {
          message: `Conversation longue : seuls le premier message et les ${MAX_MESSAGES_FENETRE - 1} derniers messages sont transmis au tuteur.`,
        });
      }

      await moteur.repondre({
        systemeStable: pedagogique.systemeStable,
        systemeProfil: pedagogique.systemeProfil,
        messages,
        outils: pedagogique.outils,
        signal,
        envoyer,
      });
    },
    (e) =>
      e instanceof Error
        ? `Le tuteur n'a pas pu répondre : ${e.message}`
        : "Le tuteur n'a pas pu répondre.",
  );
}
