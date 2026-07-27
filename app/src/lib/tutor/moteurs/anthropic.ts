/**
 * Moteur Anthropic — payant.
 *
 * Code déplacé tel quel depuis `app/api/tutor/route.ts` (chantier ADR-007) :
 * le comportement, le modèle et la gestion d'erreurs sont inchangés. Ce moteur
 * n'est plus le chemin nominal — voir `compatible-openai.ts` pour les paliers
 * gratuits.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { DemandeTuteur, MoteurTuteur } from "./types";

/** Modèle historique du projet. Surchargeable par `TUTEUR_MODELE`. */
export const MODELE_ANTHROPIC_PAR_DEFAUT = "claude-opus-4-8";

export function moteurAnthropic(cle: string, modele: string): MoteurTuteur {
  return {
    nom: "anthropic",
    modele,

    async repondre({ systemeStable, systemeProfil, messages, envoyer }: DemandeTuteur) {
      const client = new Anthropic({ apiKey: cle });

      try {
        const stream = client.messages.stream({
          model: modele,
          max_tokens: 16000,
          // Le raisonnement n'est pas diffusé à l'utilisateur : un tuteur qui
          // expose sa démarche complète avant la tentative révèle la solution.
          thinking: { type: "adaptive" },
          output_config: { effort: "high" },
          system: [
            {
              type: "text",
              text: systemeStable,
              // Les protocoles ne changent jamais : ils constituent le préfixe
              // mis en cache. Le profil, variable, est placé après.
              cache_control: { type: "ephemeral" },
            },
            { type: "text", text: systemeProfil },
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
          message = "Clé API refusée. Vérifie la clé du moteur Anthropic dans app/.env.local.";
        } else if (e instanceof Anthropic.NotFoundError) {
          message = `Modèle introuvable (${modele}). Vérifie que ton compte y a accès.`;
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
      }
    },
  };
}
