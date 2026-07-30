/**
 * Moteur « compatible OpenAI » — couvre les paliers gratuits.
 *
 * Un seul module pour Groq, OpenRouter, Mistral, Cerebras et tout service
 * exposant `POST {base}/chat/completions` en streaming. Écrit en `fetch` pur :
 * **aucune dépendance ajoutée** (`CLAUDE.md` §7).
 *
 * ⚠️ Rappel ADR-007 : le critère de sélection d'un fournisseur n'est pas le
 * prix mais la fidélité au protocole. Le tuteur reçoit ~8 700 jetons de
 * protocole anti-hallucination et sa sortie entre dans la chaîne de preuves
 * (P8). Un modèle qui suit mal un préfixe long ne dégrade pas le confort : il
 * corrompt les données. Passer le test de réfutation avant d'adopter un moteur.
 */

import type { DemandeTuteur, MoteurTuteur } from "./types";

/**
 * Les paliers gratuits plafonnent la sortie bien plus bas que l'API Anthropic.
 * 8192 laisse la place à un énoncé d'exercice complet sans risquer un refus
 * de la requête pour dépassement.
 */
const MAX_JETONS_SORTIE = 8192;

interface DeltaChoix {
  delta?: { content?: string | null } | null;
  finish_reason?: string | null;
}

interface FragmentReponse {
  choices?: DeltaChoix[] | null;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    /** Mistral-specific: tokens served from prefix cache. */
    prompt_cache_hit_tokens?: number;
    /** Mistral-specific: tokens NOT in cache (freshly computed). */
    prompt_cache_miss_tokens?: number;
  } | null;
}

/** Traduit un statut HTTP en message actionnable pour l'utilisateur. */
function messageErreurHttp(statut: number, corps: string): string {
  const detail = corps.slice(0, 300).trim();
  switch (statut) {
    case 401:
    case 403:
      return "Clé refusée par le fournisseur. Vérifie TUTEUR_CLE dans app/.env.local.";
    case 404:
      return "Modèle ou URL introuvable. Vérifie TUTEUR_MODELE et TUTEUR_URL_BASE.";
    case 413:
      return "Contexte trop long pour ce modèle. Choisis un modèle à fenêtre plus large.";
    case 429:
      return "Quota du palier gratuit atteint. Réessaie plus tard ou change de fournisseur.";
    default:
      return statut >= 500
        ? `Le fournisseur est indisponible (HTTP ${statut}). Réessaie dans un instant.`
        : `Erreur HTTP ${statut}${detail ? ` : ${detail}` : ""}`;
  }
}

export function moteurCompatibleOpenAI(
  cle: string,
  urlBase: string,
  modele: string,
): MoteurTuteur {
  // Tolère une URL saisie avec ou sans barre oblique finale.
  const base = urlBase.replace(/\/+$/, "");

  return {
    nom: "compatible-openai",
    modele,

    async repondre({ systemeStable, systemeProfil, messages, envoyer }: DemandeTuteur) {
      try {
        // Clé de cache : déterministe sur le contenu stable. Mistral utilise ce
        // paramètre pour identifier un préfixe réutilisable d'une requête à
        // l'autre, réduisant latence et coût sur les ~7-8K tokens de protocole.
        //
        // djb2 suffit ici : ce n'est pas de la sécurité, c'est un identifiant
        // stable pour le même contenu textuel.
        let h = 5381;
        for (let i = 0; i < systemeStable.length; i++) {
          h = ((h << 5) + h + systemeStable.charCodeAt(i)) | 0;
        }
        const cacheKey = `sys-${(h >>> 0).toString(36)}`;

        const appeler = (corps: unknown) =>
          fetch(`${base}/chat/completions`, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              authorization: "Bearer " + cle,
            },
            body: JSON.stringify(corps),
          });

        const payloadMistral = {
          model: modele,
          stream: true,
          stream_options: { include_usage: true },
          max_tokens: MAX_JETONS_SORTIE,
          prompt_cache_key: cacheKey,
          messages: [
            // Séparer stable et profil en deux messages system : le préfixe
            // stable est identique d'un tour à l'autre, maximisant le cache
            // hit. Le profil (variable à chaque requête si une preuve change)
            // vient après et ne casse pas le préfixe caché.
            { role: "system", content: systemeStable },
            { role: "system", content: systemeProfil },
            ...messages.map((m) => ({ role: m.role, content: m.content })),
          ],
        };

        let reponse = await appeler(payloadMistral);
        if (reponse.status === 400) {
          reponse = await appeler({
            model: modele,
            stream: true,
            max_tokens: MAX_JETONS_SORTIE,
            messages: [
              { role: "system", content: `${systemeStable}\n\n${systemeProfil}` },
              ...messages.map((m) => ({ role: m.role, content: m.content })),
            ],
          });
        }

        if (!reponse.ok || !reponse.body) {
          const corps = await reponse.text().catch(() => "");
          envoyer("erreur", { message: messageErreurHttp(reponse.status, corps) });
          return;
        }

        const lecteur = reponse.body.getReader();
        const decodeur = new TextDecoder();
        let tampon = "";
        let motifArret: string | null = null;
        let usage: FragmentReponse["usage"] = null;

        for (;;) {
          const { done, value } = await lecteur.read();
          if (done) break;
          tampon += decodeur.decode(value, { stream: true });

          // Découpage ligne à ligne : la dernière ligne peut être incomplète
          // et doit rester dans le tampon jusqu'au fragment suivant.
          const lignes = tampon.split("\n");
          tampon = lignes.pop() ?? "";

          for (const ligne of lignes) {
            const nettoyee = ligne.trim();
            if (!nettoyee.startsWith("data:")) continue;

            const charge = nettoyee.slice(5).trim();
            if (charge === "" || charge === "[DONE]") continue;

            let fragment: FragmentReponse;
            try {
              fragment = JSON.parse(charge) as FragmentReponse;
            } catch {
              // Fragment illisible : on l'ignore plutôt que d'interrompre le
              // flux — le reste de la réponse peut être parfaitement valide.
              continue;
            }

            if (fragment.usage) usage = fragment.usage;

            const choix = fragment.choices?.[0];
            if (!choix) continue;

            const delta = choix.delta?.content;
            if (delta) envoyer("texte", { delta });
            if (choix.finish_reason) motifArret = choix.finish_reason;
          }
        }

        if (motifArret === "length") {
          envoyer("tronque", {
            message: "Réponse interrompue par la limite de longueur. Demande la suite si nécessaire.",
          });
        } else if (motifArret === "content_filter") {
          envoyer("refus", {
            message:
              "La demande a été déclinée par les garde-fous du fournisseur. Reformule-la ou aborde le sujet autrement.",
            categorie: null,
          });
        }

        envoyer("fin", {
          stopReason: motifArret,
          // Tous les fournisseurs ne renvoient pas l'usage en streaming.
          // L'interface le masque quand il est absent : on ne fabrique pas de
          // chiffre (protocole anti-hallucination §7).
          usage: usage
            ? {
                entree: usage.prompt_tokens ?? 0,
                sortie: usage.completion_tokens ?? 0,
                cacheEcrit: usage.prompt_cache_miss_tokens ?? 0,
                cacheLu: usage.prompt_cache_hit_tokens ?? 0,
              }
            : undefined,
        });
      } catch (e) {
        envoyer("erreur", {
          message:
            e instanceof Error
              ? `Appel au fournisseur impossible : ${e.message}`
              : "Erreur inattendue lors de l'appel au tuteur.",
        });
      }
    },
  };
}
