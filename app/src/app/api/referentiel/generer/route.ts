import { chargerContexte } from "@/lib/store/context";
import { choisirConfiguration, creerMoteur } from "@/lib/tutor/moteurs";
import { configVersEnv, type ConfigTuteurClient } from "@/lib/tutor/cle-client";
import { genererBranche } from "@/lib/tutor/generation";

/**
 * Route de génération de branche référentiel — sans conversation (lot 2).
 *
 * Calquée sur `/api/exercices/generer` : même choix de moteur, même abandon
 * propagé par `request.signal`, même honnêteté (503 sans moteur). La modale
 * `ModaleCompetence` l'appelle quand l'utilisateur clique « Suggérer avec le
 * tuteur ».
 *
 * **Route et non Server Function** : seule la requête client peut porter la
 * config `localStorage` (`cle-client.ts`).
 */

export const maxDuration = 300;

interface CorpsGenerer {
  /** Sujet demandé — un thème, pas un sélecteur d'objet. */
  theme?: string;
  /** Config saisie côté client (réglages). Prime sur les variables serveur. */
  config?: ConfigTuteurClient;
}

export async function POST(request: Request) {
  let corps: CorpsGenerer;
  try {
    corps = (await request.json()) as CorpsGenerer;
  } catch {
    return Response.json({ erreur: "corps-invalide" }, { status: 400 });
  }

  const theme = (corps.theme ?? "").trim();
  if (theme.length < 3) {
    return Response.json({ erreur: "theme-trop-court" }, { status: 400 });
  }

  // La config client (si présente) prime sur `process.env`.
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

  const ctx = await chargerContexte();

  const encodeur = new TextEncoder();
  const abandon = new AbortController();
  request.signal.addEventListener("abort", () => abandon.abort(), { once: true });

  const flux = new ReadableStream({
    async start(controller) {
      const envoyer = (evenement: string, donnees: unknown) => {
        if (abandon.signal.aborted) return;
        controller.enqueue(
          encodeur.encode(`event: ${evenement}\ndata: ${JSON.stringify(donnees)}\n\n`),
        );
      };

      try {
        const resultat = await genererBranche(
          moteur,
          ctx.referentiel,
          theme,
          abandon.signal,
          envoyer,
        );

        if (resultat.erreur) {
          envoyer("erreur", { message: resultat.erreur });
          return;
        }

        // Les propositions sont renvoyées au client pour prévisualisation.
        // L'écriture n'a lieu qu'après validation explicite de l'utilisateur.
        envoyer("propositions", { branches: resultat.branches });
      } catch (e) {
        if (abandon.signal.aborted) return;
        envoyer("erreur", {
          message: e instanceof Error ? e.message : "Erreur inattendue lors de la génération.",
        });
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