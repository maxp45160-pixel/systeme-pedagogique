/**
 * Moteur Anthropic — payant.
 *
 * Code déplacé tel quel depuis `app/api/tutor/route.ts` (chantier ADR-007) :
 * le comportement, le modèle et la gestion d'erreurs sont inchangés. Ce moteur
 * n'est plus le chemin nominal — voir `compatible-openai.ts` pour les paliers
 * gratuits.
 */

import Anthropic from "@anthropic-ai/sdk";
import { motifsRefusAppelOutil, validerAppelOutil } from "../outils";
import type { DemandeTuteur, MoteurTuteur } from "./types";

/** Modèle historique du projet. Surchargeable par `TUTEUR_MODELE`. */
export const MODELE_ANTHROPIC_PAR_DEFAUT = "claude-opus-4-8";

export function moteurAnthropic(cle: string, modele: string): MoteurTuteur {
  return {
    nom: "anthropic",
    modele,

    async repondre({
      systemeStable,
      systemeProfil,
      messages,
      outils,
      signal,
      envoyer,
    }: DemandeTuteur) {
      const client = new Anthropic({ apiKey: cle });

      // Déjà abandonné avant même de partir : ne rien appeler du tout.
      if (signal?.aborted) return;

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
          // Les propositions passent par un outil, plus par un gabarit markdown
          // (lot 3.2). Les définitions sont stables pour un compte donné : les
          // placer ici ne casse pas le préfixe mis en cache ci-dessus.
          tools: outils.map((o) => ({
            name: o.nom,
            description: o.description,
            input_schema: o.schema as Anthropic.Tool["input_schema"],
          })),
          /*
           * Un seul outil armé = un chemin one-shot (traduire un besoin,
           * rédiger un lot). Là, l'appel n'est pas une option
           * offerte au modèle : c'est TOUT ce que la requête attend, et une
           * réponse en prose ne produit rien d'exploitable — l'écran affichait
           * alors « aucune action exploitable » pour un modèle qui avait
           * simplement répondu à côté du canal.
           *
           * Le chat, lui, arme plusieurs outils et doit garder le droit de
           * répondre sans en appeler aucun : c'est une conversation.
           */
          ...(outils.length === 1
            ? { tool_choice: { type: "tool" as const, name: outils[0].nom } }
            : {}),
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
        });

        // L'abandon du client coupe la génération chez le fournisseur, plutôt
        // que de la laisser courir dans le vide (voir `DemandeTuteur.signal`).
        signal?.addEventListener("abort", () => stream.abort(), { once: true });

        stream.on("text", (delta) => envoyer("texte", { delta }));

        // Un bloc `tool_use` ne produit aucun texte : sans cette annonce, le
        // flux est muet pendant toute sa rédaction et l'interface reste sur
        // « le tuteur réfléchit… ». Le nom est connu dès l'ouverture du bloc.
        stream.on("streamEvent", (evenement) => {
          if (
            evenement.type === "content_block_start" &&
            evenement.content_block.type === "tool_use"
          ) {
            envoyer("proposition-en-cours", { outil: evenement.content_block.name });
          }
        });

        const finale = await stream.finalMessage();

        // Les appels d'outil sont relayés APRÈS le texte, une fois le message
        // clos : un `input` partiel n'est pas une proposition, c'est une
        // proposition en cours d'écriture. C'est exactement ce que le gabarit
        // markdown ne permettait pas de distinguer.
        let appelsOutil = 0;
        for (const bloc of finale.content) {
          if (bloc.type !== "tool_use") continue;
          appelsOutil += 1;
          // Les outils armés sont passés au validateur : `proposer_revision`
          // valide les codes désignés contre l'`enum` que ce fournisseur a
          // effectivement reçu, jamais contre une liste parallèle.
          const proposition = validerAppelOutil(bloc.name, bloc.input, outils);
          if (proposition) {
            envoyer("proposition", proposition);
          } else {
            // Même dette que dans `compatible-openai.ts` : un refus muet ne se
            // corrige pas. Les motifs viennent du même endroit, pour que les
            // deux moteurs disent la même chose du même refus.
            const motifs = motifsRefusAppelOutil(bloc.name, JSON.stringify(bloc.input), outils);
            envoyer("proposition-rejetee", {
              message:
                motifs.length > 0
                  ? `Une proposition (${bloc.name}) a été refusée : ${motifs.join(" ")}`
                  : `Une proposition (${bloc.name}) est arrivée incomplète et n'a pas été retenue. Redemande-la.`,
              motifs,
            });
          }
        }

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
          // Ce moteur ne connaît pas de repli sans outils : ils sont toujours
          // en service. Le champ existe pour que l'interface n'ait pas à savoir
          // quel moteur lui parle.
          outils: { actifs: true, appels: appelsOutil },
          usage: {
            entree: finale.usage.input_tokens,
            sortie: finale.usage.output_tokens,
            cacheEcrit: finale.usage.cache_creation_input_tokens ?? 0,
            cacheLu: finale.usage.cache_read_input_tokens ?? 0,
          },
        });
      } catch (e) {
        // Un abandon voulu n'est pas une panne : plus personne n'écoute, et
        // émettre « erreur » ferait afficher un incident là où l'utilisateur a
        // simplement cliqué « Arrêter » ou changé de page.
        if (signal?.aborted) return;
        console.error(`[anthropic] Exception API Anthropic :`, e);

        // Chaîne du plus spécifique au plus général, pour distinguer ce qui
        // vaut la peine d'être réessayé de ce qui ne l'est pas.
        let message = "Erreur inattendue lors de l'appel au tuteur.";
        if (e instanceof Anthropic.AuthenticationError) {
          message = "Clé API refusée. Vérifie la clé Anthropic enregistrée dans les réglages du tuteur.";
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
