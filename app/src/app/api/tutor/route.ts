import { chargerContexte } from "@/lib/store/context";
import { construireContexte } from "@/lib/tutor/contexte";
import { choisirConfiguration, creerMoteur, decrireChoix } from "@/lib/tutor/moteurs";
import type { MessageTuteur } from "@/lib/tutor/moteurs";

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

/* ------------------------------------------------------------------ */
/* Fenêtrage de l'historique                                           */
/*                                                                     */
/* Sans borne, le payload croît linéairement avec la longueur de la    */
/* conversation (réponses assistant ≤ 8192 tokens s'accumulent) et     */
/* finit en HTTP 413. On garde le premier message utilisateur (donne   */
/* le contexte initial) + les N derniers messages.                     */
/* ------------------------------------------------------------------ */

/**
 * Nombre maximum de messages (user + assistant) à transmettre au modèle,
 * en plus du premier message utilisateur conservé pour le contexte initial.
 *
 * 20 messages ≈ 10 échanges → ~80-100K tokens au pire, largement sous
 * la limite de 128K de Mistral tout en conservant suffisamment de contexte
 * conversationnel pour des réponses cohérentes.
 */
const MAX_MESSAGES_FENETRE = 20;

/**
 * Réduit l'historique en conservant le premier message utilisateur
 * et les derniers messages. Renvoie `{ fenetre, tronque }`.
 */
function fenêtrerHistorique(
  messages: MessageTuteur[],
): { fenetre: MessageTuteur[]; tronque: boolean } {
  if (messages.length <= MAX_MESSAGES_FENETRE) {
    return { fenetre: messages, tronque: false };
  }

  // Premier message utilisateur (contexte initial de la session).
  const premier = messages.find((m) => m.role === "user");
  // Les N-1 derniers (on réserve une place pour le premier).
  const queue = messages.slice(-(MAX_MESSAGES_FENETRE - 1));

  // Vérifier que la queue commence bien par un message user pour garder
  // la structure user/assistant cohérente. Si ce n'est pas le cas, on
  // retire le premier message assistant orphelin.
  const queueNormalisee = queue[0]?.role === "assistant" ? queue.slice(1) : queue;
  const fenetre = premier
    ? [premier, ...queueNormalisee.filter((m) => m !== premier)]
    : queueNormalisee;

  return { fenetre, tronque: true };
}

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

  const { fenetre: messages, tronque } = fenêtrerHistorique(messagesComplets);

  const ctx = await chargerContexte();
  const pedagogique = await construireContexte(ctx, messages);

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

/** Le manifeste de contexte, pour l'indicateur « contexte chargé » et le mode presse-papier. */
export async function GET() {
  const ctx = await chargerContexte();
  const pedagogique = await construireContexte(ctx);
  const choix = choisirConfiguration(process.env);

  return Response.json({
    // Conserve le nom historique du champ : l'interface s'en sert pour décider
    // d'afficher le chat ou le repli « copier le contexte ».
    cleConfiguree: choix.kind !== "aucun",
    modele: decrireChoix(choix),
    manifeste: pedagogique.manifeste,
    caracteresTotal: pedagogique.caracteresTotal,
  });
}
