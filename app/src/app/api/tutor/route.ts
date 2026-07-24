import Anthropic from "@anthropic-ai/sdk";
import { chargerContexte } from "@/lib/store/context";
import { construireContexte } from "@/lib/tutor/contexte";

/**
 * Route du tuteur — appel à l'API Anthropic, réponse diffusée en flux.
 *
 * Application locale mono-utilisateur : la clé reste côté serveur, dans
 * `.env.local` (déjà couvert par `.gitignore`). Sans clé configurée, la route
 * répond 503 et l'interface bascule d'elle-même en mode « copier le contexte »
 * — elle ne simule jamais une réponse.
 */

const MODELE = "claude-opus-4-8";

export async function POST(request: Request) {
  const cle = process.env.ANTHROPIC_API_KEY;
  if (!cle) {
    return Response.json(
      {
        erreur: "cle-absente",
        message:
          "Aucune clé ANTHROPIC_API_KEY n'est configurée. Utilise le mode « copier le contexte » ou ajoute la clé dans app/.env.local.",
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

  const messages = (corps.messages ?? []).filter((m) => m.content.trim().length > 0);
  if (messages.length === 0) {
    return Response.json({ erreur: "aucun-message" }, { status: 400 });
  }

  const ctx = await chargerContexte();
  const pedagogique = await construireContexte(ctx);
  const client = new Anthropic({ apiKey: cle });

  const encodeur = new TextEncoder();

  const flux = new ReadableStream({
    async start(controller) {
      const envoyer = (evenement: string, donnees: unknown) => {
        controller.enqueue(
          encodeur.encode(`event: ${evenement}\ndata: ${JSON.stringify(donnees)}\n\n`),
        );
      };

      try {
        const stream = client.messages.stream({
          model: MODELE,
          max_tokens: 16000,
          // Le raisonnement n'est pas diffusé à l'utilisateur : un tuteur qui
          // expose sa démarche complète avant la tentative révèle la solution.
          thinking: { type: "adaptive" },
          output_config: { effort: "high" },
          system: [
            {
              type: "text",
              text: pedagogique.systemeStable,
              // Les protocoles ne changent jamais : ils constituent le préfixe
              // mis en cache. Le profil, variable, est placé après.
              cache_control: { type: "ephemeral" },
            },
            { type: "text", text: pedagogique.systemeProfil },
          ],
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
        });

        stream.on("text", (delta) => envoyer("texte", { delta }));

        const finale = await stream.finalMessage();

        if (finale.stop_reason === "refusal") {
          envoyer("refus", {
            message:
              "La demande a été déclinée par les garde-fous du modèle. Reformule-la ou aborde le sujet autrement.",
            categorie: finale.stop_details?.category ?? null,
          });
        } else if (finale.stop_reason === "max_tokens") {
          envoyer("tronque", {
            message: "Réponse interrompue par la limite de longueur. Demande la suite si nécessaire.",
          });
        }

        envoyer("fin", {
          stopReason: finale.stop_reason,
          usage: {
            entree: finale.usage.input_tokens,
            sortie: finale.usage.output_tokens,
            cacheEcrit: finale.usage.cache_creation_input_tokens ?? 0,
            cacheLu: finale.usage.cache_read_input_tokens ?? 0,
          },
        });
      } catch (e) {
        // Chaîne du plus spécifique au plus général, pour distinguer ce qui
        // vaut la peine d'être réessayé de ce qui ne l'est pas.
        let message = "Erreur inattendue lors de l'appel au tuteur.";
        if (e instanceof Anthropic.AuthenticationError) {
          message = "Clé API refusée. Vérifie ANTHROPIC_API_KEY dans app/.env.local.";
        } else if (e instanceof Anthropic.NotFoundError) {
          message = `Modèle introuvable (${MODELE}). Vérifie que ton compte y a accès.`;
        } else if (e instanceof Anthropic.RateLimitError) {
          message = "Limite de débit atteinte. Réessaie dans quelques instants.";
        } else if (e instanceof Anthropic.APIConnectionError) {
          message = "Connexion à l'API impossible. Vérifie ta connexion réseau.";
        } else if (e instanceof Anthropic.APIError) {
          message = `Erreur API ${e.status ?? ""} : ${e.message}`;
        } else if (e instanceof Error) {
          message = e.message;
        }
        envoyer("erreur", { message });
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
  return Response.json({
    cleConfiguree: Boolean(process.env.ANTHROPIC_API_KEY),
    modele: MODELE,
    manifeste: pedagogique.manifeste,
    caracteresTotal: pedagogique.caracteresTotal,
  });
}
