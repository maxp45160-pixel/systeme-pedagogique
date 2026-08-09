import { chargerContexte } from "@/lib/store/context";
import { choisirConfiguration, creerMoteur } from "@/lib/tutor/moteurs";
import type { ConfigTuteurClient } from "@/lib/tutor/cle-client";
import { envTuteur } from "@/lib/tutor/env-requete";
import { proposerReferentiel } from "@/lib/tutor/generation-referentiel";
import { prefixesDistincts } from "@/lib/domain/referentiel-compte";

/**
 * Route de proposition d'un référentiel complet — plusieurs branches.
 *
 * **Route distincte** de `/api/referentiel/suggerer`, et non un drapeau
 * `complet?` sur elle : l'événement terminal change de forme (`branches` au
 * pluriel contre `branche`). Surcharger un événement terminal est la façon dont
 * on casse en silence — le lecteur SSE déréférencerait un champ absent.
 *
 * Les préfixes sont résolus **ici**, côté serveur, par `prefixesDistincts` :
 * « Stoïcisme antique » et « Stoïcisme moderne » donnent tous deux `STO`, et
 * `validerDomaine` refuse un préfixe déjà pris. Sans ce départage, la création
 * multi-branches échouerait sur son entrée la plus probable. Ils restent
 * éditables à l'écran.
 */

export const maxDuration = 300;

interface CorpsProposer {
  sujet?: string;
  config?: ConfigTuteurClient;
}

export async function POST(request: Request) {
  let corps: CorpsProposer;
  try {
    corps = (await request.json()) as CorpsProposer;
  } catch {
    return Response.json({ erreur: "corps-invalide" }, { status: 400 });
  }

  const sujet = (corps.sujet ?? "").trim();
  if (!sujet) return Response.json({ erreur: "sujet-vide" }, { status: 400 });

  // Point d'entree unique : la config client est validee avant de toucher
  // l'environnement du serveur (SSRF, voir lib/tutor/url-fournisseur.ts).
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
            ? `${choix.raison} Tu peux créer une branche à la main depuis un domaine existant.`
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
        const resultat = await proposerReferentiel(
          moteur,
          ctx.referentiel,
          sujet,
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

        // Préfixes départagés contre ceux du compte ET entre eux.
        const prefixes = prefixesDistincts(
          resultat.branches.map((b) => ({ nom: b.domaine, prefixe: b.prefixe })),
          ctx.referentiel.domaines.map((d) => d.prefixe),
        );

        envoyer("propositions", {
          resume: resultat.resume,
          ecartees: resultat.ecartees,
          branches: resultat.branches.map((b, i) => ({ ...b, prefixe: prefixes[i] })),
        });
      } catch (e) {
        if (abandon.signal.aborted) return;
        envoyer("erreur", {
          message: e instanceof Error ? e.message : "Erreur inattendue pendant la proposition.",
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
