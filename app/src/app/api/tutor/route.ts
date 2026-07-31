import { chargerContexte } from "@/lib/store/context";
import { construireContexte } from "@/lib/tutor/contexte";
import { choisirConfiguration, creerMoteur } from "@/lib/tutor/moteurs";
import { fenetrerHistorique, MAX_MESSAGES_FENETRE } from "@/lib/tutor/fenetre";

/**
 * Route du tuteur — réponse diffusée en flux.
 *
 * Cette route ne connaît aucun fournisseur : elle assemble le contexte, demande
 * un moteur (ADR-007) et relaie ses événements. Changer de fournisseur est une
 * variable d'environnement.
 *
 * Sans moteur configuré, elle répond 503 et l'interface bascule d'elle-même en
 * mode « copier le contexte » — elle ne simule jamais une réponse.
 */

export async function POST(request: Request) {
  const choix = choisirConfiguration(process.env);
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

  let corps: { messages?: { role: "user" | "assistant"; content: string }[] };
  try {
    corps = await request.json();
  } catch {
    return Response.json({ erreur: "corps-invalide" }, { status: 400 });
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
  const pedagogique = await construireContexte(ctx, messagesComplets);

  const encodeur = new TextEncoder();

  const flux = new ReadableStream({
    async start(controller) {
      const envoyer = (evenement: string, donnees: unknown) => {
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
          envoyer,
        });
      } finally {
        controller.close();
      }
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
