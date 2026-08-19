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

import { validerAppelOutilJson } from "../outils";
import type { DemandeTuteur, MoteurTuteur } from "./types";

/**
 * Les paliers gratuits plafonnent la sortie bien plus bas que l'API Anthropic.
 * 8192 laisse la place à un énoncé d'exercice complet sans risquer un refus
 * de la requête pour dépassement.
 */
const MAX_JETONS_SORTIE = 8192;

/**
 * Au-delà, on considère que le fournisseur ne répondra pas.
 *
 * Aucun des trois `fetch` n'était borné : un palier gratuit muet bloquait la
 * requête indéfiniment, jusqu'au timeout de plateforme, sans qu'aucun événement
 * n'atteigne l'interface — donc « le tuteur réfléchit… » sans fin. Cinq minutes
 * laissent largement le temps d'un exercice complet ; c'est un garde-fou contre
 * le silence, pas une contrainte de débit.
 */
const DELAI_MAX_MS = 300_000;

/**
 * Fragment d'appel d'outil tel qu'il arrive sur le flux.
 *
 * `function.arguments` est découpé en morceaux arbitraires — jamais du JSON
 * valide avant le dernier. D'où l'accumulation par `index` ci-dessous plutôt
 * qu'une tentative de lecture au fil de l'eau.
 */
interface DeltaAppelOutil {
  index?: number;
  id?: string | null;
  function?: { name?: string | null; arguments?: string | null } | null;
}

interface DeltaChoix {
  delta?: { content?: string | null; tool_calls?: DeltaAppelOutil[] | null } | null;
  finish_reason?: string | null;
}

interface FragmentReponse {
  choices?: DeltaChoix[] | null;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    /**
     * Forme standard (OpenAI, Mistral) : les jetons servis par le cache de
     * préfixe sont ici.
     *
     * ⚠️ Les deux champs plats ci-dessous ont longtemps été les seuls lus, sur
     * la foi d'un commentaire qui les disait « Mistral-specific ». Ils ne le
     * sont pas — ce sont ceux de DeepSeek. Sur Mistral ils sont absents, le
     * `?? 0` les rendait nuls, et l'interface annonçait « 0 lus en cache » sans
     * qu'aucune API ne l'ait jamais dit. Un zéro fabriqué, dans l'écran même où
     * le produit promet de n'en afficher aucun (P2, P3).
     */
    prompt_tokens_details?: { cached_tokens?: number } | null;
    /** DeepSeek et compatibles : jetons servis par le cache. */
    prompt_cache_hit_tokens?: number;
    /** DeepSeek et compatibles : jetons hors cache. */
    prompt_cache_miss_tokens?: number;
  } | null;
}

/**
 * Jetons servis par le cache de préfixe, ou `null` si le fournisseur n'en dit
 * rien.
 *
 * Exportée pour être testée : c'est une règle de lecture de mesure, et elle a
 * déjà été fausse une fois. Trois formes coexistent dans la nature —
 * `prompt_tokens_details.cached_tokens` (OpenAI, Mistral), les champs plats de
 * DeepSeek, et rien du tout. Les deux premières se lisent ; la troisième doit
 * rester `null` jusqu'à l'affichage.
 */
export function jetonsLusEnCache(usage: FragmentReponse["usage"]): number | null {
  if (!usage) return null;
  return usage.prompt_tokens_details?.cached_tokens ?? usage.prompt_cache_hit_tokens ?? null;
}

/** Traduit un statut HTTP en message actionnable pour l'utilisateur. */
function messageErreurHttp(statut: number, corps: string): string {
  const detail = corps.slice(0, 300).trim();
  switch (statut) {
    case 401:
    case 403:
      return "Clé refusée par le fournisseur. Vérifie la clé API enregistrée dans les réglages du tuteur.";
    case 404:
      return "Modèle ou URL introuvable. Vérifie le modèle et l'URL du fournisseur dans les réglages du tuteur.";
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

    async repondre({
      systemeStable,
      systemeProfil,
      messages,
      outils,
      signal,
      envoyer,
    }: DemandeTuteur) {
      if (signal?.aborted) return;

      /*
       * Deux causes d'arrêt, une seule poignée passée à `fetch`.
       *
       * `signal` — l'utilisateur a coupé. `AbortSignal.timeout` — le
       * fournisseur ne répond plus : aucun des trois appels n'était borné, et
       * un palier gratuit muet bloquait la requête jusqu'au timeout de
       * plateforme, sans qu'aucun événement n'atteigne l'interface.
       */
      const bornes = [AbortSignal.timeout(DELAI_MAX_MS)];
      if (signal) bornes.push(signal);
      const arret = AbortSignal.any(bornes);

      try {
        // Clé de cache : déterministe sur le contenu stable, pour que les
        // fournisseurs sachant réutiliser un préfixe d'une requête à l'autre
        // puissent le faire sur les ~8 K jetons de protocole.
        //
        // 🔬 Le gain effectif n'est pas vérifié : il se lit dans le décompte
        // `cacheLu` affiché sous le chat. S'il reste à zéro, le fournisseur
        // ignore ce paramètre et cette clé ne coûte rien de plus qu'un champ
        // inutilisé — le repli 400 ci-dessous couvre le cas d'un refus.
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
            signal: arret,
          });

        // Traduction des outils au format « function calling » OpenAI. Le
        // schéma lui-même est écrit une seule fois, dans `lib/tutor/outils.ts` :
        // les deux moteurs proposent exactement la même chose au modèle.
        const fonctions = outils.map((o) => ({
          type: "function",
          function: { name: o.nom, description: o.description, parameters: o.schema },
        }));

        /*
         * Un seul outil armé = un chemin one-shot (traduire un besoin, résoudre
         * un thème, rédiger un lot d'exercices). L'appel n'y est pas une option
         * offerte au modèle : c'est tout ce que la requête attend. En `auto`, un
         * modèle qui répond « voici une séance sur la logistique… » en prose
         * produit zéro proposition, et l'écran ne peut rien dire de mieux que
         * « aucune action exploitable » — la panne la plus opaque du produit.
         *
         * Le chat arme plusieurs outils et garde `auto` : il doit pouvoir
         * répondre sans rien proposer, sinon chaque message forcerait une carte.
         */
        const choixOutil =
          outils.length === 1
            ? { type: "function", function: { name: outils[0].nom } }
            : "auto";

        const messagesConversation = messages.map((m) => ({ role: m.role, content: m.content }));

        const payloadMistral = {
          model: modele,
          stream: true,
          stream_options: { include_usage: true },
          max_tokens: MAX_JETONS_SORTIE,
          prompt_cache_key: cacheKey,
          tools: fonctions,
          tool_choice: choixOutil,
          messages: [
            // Séparer stable et profil en deux messages system : le préfixe
            // stable est identique d'un tour à l'autre, maximisant le cache
            // hit. Le profil (variable à chaque requête si une preuve change)
            // vient après et ne casse pas le préfixe caché.
            { role: "system", content: systemeStable },
            { role: "system", content: systemeProfil },
            ...messagesConversation,
          ],
        };

        // Repli en deux marches, du plus riche au plus pauvre. Chacune retire
        // ce que la précédente peut avoir de refusable, et rien d'autre :
        // un 400 ne dit pas QUEL champ a déplu.
        const systemeUnique = [
          { role: "system", content: `${systemeStable}\n\n${systemeProfil}` },
          ...messagesConversation,
        ];

        /**
         * Le fournisseur a-t-il accepté les outils ?
         *
         * Sans cette trace, le repli 2 ci-dessous est une panne muette : le
         * tuteur répond, l'interface n'affiche aucune carte, et rien ne dit si
         * c'est parce qu'il n'avait rien à proposer ou parce que la sortie
         * structurée n'a jamais été en service. C'est exactement le genre de
         * silence que ce lot existe pour supprimer — il ne pouvait pas rester
         * dans le moteur qui le porte.
         */
        let outilsActifs = true;

        let reponse = await appeler(payloadMistral);
        if (reponse.status === 400) {
          // 1. Fournisseurs qui refusent `prompt_cache_key` ou le double bloc
          //    système : un seul message système concaténé, outils conservés.
          //    `stream_options` est conservé — sans lui, le décompte de jetons
          //    disparaîtrait de l'interface sans que rien ne le signale, et
          //    c'est précisément ce décompte qui permet de vérifier si le cache
          //    de préfixe sert à quelque chose.
          reponse = await appeler({
            model: modele,
            stream: true,
            stream_options: { include_usage: true },
            max_tokens: MAX_JETONS_SORTIE,
            tools: fonctions,
            tool_choice: choixOutil,
            messages: systemeUnique,
          });
        }
        if (reponse.status === 400) {
          // 2. Fournisseurs sans appel d'outil du tout. On ne perd pas la
          //    conversation pour autant : le tuteur répond en texte et les
          //    parseurs de `proposition.ts` restent le filet, comme avant le
          //    lot 3.2. Ce qui se perd est la *rejetabilité* d'une proposition
          //    tronquée — d'où le repli en dernier recours seulement.
          outilsActifs = false;
          reponse = await appeler({
            model: modele,
            stream: true,
            stream_options: { include_usage: true },
            max_tokens: MAX_JETONS_SORTIE,
            messages: systemeUnique,
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
        /**
         * Appels d'outil en cours d'assemblage, par `index` du flux.
         *
         * `annonce` retient si l'interface a déjà été prévenue. Un appel d'outil
         * n'émet AUCUN `content` : pendant toute sa rédaction — la partie la
         * plus longue du tour — le flux est muet et l'écran reste sur « le
         * tuteur réfléchit… ». Il faut donc dire ce qui se passe dès le premier
         * fragment, sans quoi la sortie structurée se paie d'un écran figé.
         */
        const appelsOutil = new Map<
          number,
          { nom: string; arguments: string; annonce: boolean }
        >();

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

            for (const appel of choix.delta?.tool_calls ?? []) {
              // `index` absent chez certains fournisseurs qui n'émettent
              // qu'un appel à la fois : le rabattre sur 0 vaut mieux que de
              // perdre la proposition.
              const rang = appel.index ?? 0;
              const courant =
                appelsOutil.get(rang) ?? { nom: "", arguments: "", annonce: false };
              // Le nom n'arrive qu'au premier fragment ; les suivants ne
              // portent que des morceaux d'arguments.
              if (appel.function?.name) courant.nom = appel.function.name;
              if (appel.function?.arguments) courant.arguments += appel.function.arguments;

              // Dès que l'outil est nommé, l'interface peut le dire. Attendre
              // la fin reviendrait à laisser l'écran muet pendant les dizaines
              // de secondes que dure la rédaction d'un exercice.
              if (!courant.annonce && courant.nom) {
                courant.annonce = true;
                envoyer("proposition-en-cours", { outil: courant.nom });
              }

              appelsOutil.set(rang, courant);
            }

            if (choix.finish_reason) motifArret = choix.finish_reason;
          }
        }

        // Le flux est clos : les arguments sont complets, ou ils ne le seront
        // jamais. Un JSON coupé par la limite de jetons ne parse pas — il est
        // rejeté et annoncé, là où le gabarit markdown livrait un demi-exercice
        // sans le dire.
        for (const appel of appelsOutil.values()) {
          // Voir `anthropic.ts` : les outils armés servent au validateur.
          const proposition = validerAppelOutilJson(appel.nom, appel.arguments, outils);
          if (proposition) {
            envoyer("proposition", proposition);
          } else {
            envoyer("proposition-rejetee", {
              message: `Une proposition (${appel.nom || "outil inconnu"}) est arrivée incomplète et n'a pas été retenue. Redemande-la.`,
            });
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
          outils: { actifs: outilsActifs, appels: appelsOutil.size },
          // Tous les fournisseurs ne renvoient pas l'usage en streaming.
          // L'interface le masque quand il est absent : on ne fabrique pas de
          // chiffre (protocole anti-hallucination §7).
          // `null` et non `0` quand le fournisseur ne dit rien du cache :
          // l'interface affiche alors « non renseigné » au lieu d'un zéro que
          // personne n'a mesuré. C'est la même règle qu'ADR-030 appliquée à
          // l'indicateur de coût — l'absence de mesure n'est pas un zéro.
          usage: usage
            ? {
                entree: usage.prompt_tokens ?? 0,
                sortie: usage.completion_tokens ?? 0,
                cacheEcrit: usage.prompt_cache_miss_tokens ?? null,
                cacheLu: jetonsLusEnCache(usage),
              }
            : undefined,
        });
      } catch (e) {
        // Abandon voulu : plus personne n'écoute, et afficher « erreur »
        // signalerait un incident là où l'utilisateur a coupé lui-même.
        if (signal?.aborted) return;

        const expire = e instanceof DOMException && e.name === "TimeoutError";
        envoyer("erreur", {
          message: expire
            ? `Le fournisseur n'a rien renvoyé en ${Math.round(DELAI_MAX_MS / 1000)} s. Réessaie, ou bascule sur « copier le contexte ».`
            : e instanceof Error
              ? `Appel au fournisseur impossible : ${e.message}`
              : "Erreur inattendue lors de l'appel au tuteur.",
        });
      }
    },
  };
}
