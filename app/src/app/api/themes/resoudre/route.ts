import { chargerContexte } from "@/lib/store/context";
import { choisirConfiguration, creerMoteur } from "@/lib/tutor/moteurs";
import type { ConfigTuteurClient } from "@/lib/tutor/cle-client";
import { envTuteur } from "@/lib/tutor/env-requete";
import { resoudreTheme } from "@/lib/tutor/theme";

/**
 * Route de résolution d'une intention libre en compétences existantes — sans
 * conversation (chantier « thèmes », 10/08/2026, ADR-053).
 *
 * Calquée sur `/api/referentiel/suggerer` : même choix de moteur, même
 * abandon propagé par `request.signal`, même honnêteté (503 sans moteur).
 *
 * ⚠️ **Garde avant tout appel au tuteur** : un référentiel sans compétence
 * active n'a rien à désigner — appeler le tuteur produirait au mieux une
 * liste vide après un aller-retour complet, au pire une hallucination sur un
 * référentiel absent. Le refus est immédiat et typé, et pointe vers l'écran
 * de création de branche plutôt que de laisser l'utilisateur deviner pourquoi
 * rien ne s'est passé.
 */

export const maxDuration = 300;

interface CorpsResoudre {
  texte?: string;
  config?: ConfigTuteurClient;
}

export async function POST(request: Request) {
  let corps: CorpsResoudre;
  try {
    corps = (await request.json()) as CorpsResoudre;
  } catch {
    return Response.json({ erreur: "corps-invalide" }, { status: 400 });
  }

  const texte = (corps.texte ?? "").trim();
  if (texte.length === 0) {
    return Response.json({ erreur: "texte-vide" }, { status: 400 });
  }

  const ctx = await chargerContexte();

  if (ctx.referentiel.actifs.length === 0) {
    return Response.json(
      {
        erreur: "referentiel-vide",
        message:
          "Aucune compétence active dans ton référentiel : il n'y a rien à désigner. Crée d'abord une branche de compétences pour ce sujet.",
      },
      { status: 422 },
    );
  }

  const resolution = envTuteur(corps.config);
  if (!resolution.ok) return resolution.reponse;
  const choix = choisirConfiguration(resolution.env);
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
        // Même relais filtré que /api/referentiel/suggerer : le moteur émet
        // son propre `proposition` avec { genre, theme } ; seul l'événement
        // terminal construit ci-dessous, après validation, sort sous ce nom
        // vers le client.
        const resultat = await resoudreTheme(
          moteur,
          ctx.referentiel,
          texte,
          abandon.signal,
          (evenement, donnees) => {
            if (evenement === "proposition") return;
            envoyer(evenement, donnees);
          },
        );

        if (resultat.erreur) {
          envoyer("erreur", { message: resultat.erreur });
          return;
        }

        // Renvoyé pour prévisualisation — codes désignés pré-cochés, décochables.
        // Une liste de codes vide EST un résultat valide : c'est le refus
        // « aucune correspondance », que l'écran affiche avec le lien vers la
        // création de branche, pas comme une erreur.
        envoyer("proposition", { theme: resultat.theme });
      } catch (e) {
        if (abandon.signal.aborted) return;
        envoyer("erreur", {
          message: e instanceof Error ? e.message : "Erreur inattendue lors de la résolution.",
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
