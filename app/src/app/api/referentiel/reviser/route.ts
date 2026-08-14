import { chargerContexte } from "@/lib/store/context";
import { choisirConfiguration, creerMoteur } from "@/lib/tutor/moteurs";
import type { ConfigTuteurClient } from "@/lib/tutor/cle-client";
import { envTuteur } from "@/lib/tutor/env-requete";
import { reviserBranche } from "@/lib/tutor/revision-referentiel";
import { retraitsParCode } from "@/lib/domain/referentiel-compte";

/**
 * Route de révision d'une branche — sans conversation.
 *
 * Route **distincte** de `/api/referentiel/suggerer`, et non un drapeau sur
 * elle : l'événement terminal ne porte pas la même forme (`revision` contre
 * `branche`). Surcharger un événement terminal est la façon dont on casse en
 * silence — le lecteur SSE déréférencerait un champ absent.
 *
 * Le corps ne porte que `domaineId` et la demande : les compétences, leurs
 * codes et leurs comptes de preuves sont relus côté serveur, sous RLS. C'est ce
 * qui fait que l'`enum` du schéma ne peut contenir que des codes réellement
 * attribués à ce compte, dans ce domaine.
 */

export const maxDuration = 300;

interface CorpsReviser {
  domaineId?: string;
  /** Ce que la personne demande, dans ses mots. */
  demande?: string;
  config?: ConfigTuteurClient;
}

export async function POST(request: Request) {
  let corps: CorpsReviser;
  try {
    corps = (await request.json()) as CorpsReviser;
  } catch {
    return Response.json({ erreur: "corps-invalide" }, { status: 400 });
  }

  const domaineId = (corps.domaineId ?? "").trim();
  const demande = (corps.demande ?? "").trim();
  if (!domaineId) return Response.json({ erreur: "domaine-absent" }, { status: 400 });
  if (!demande) return Response.json({ erreur: "demande-vide" }, { status: 400 });

  const ctx = await chargerContexte();

  const domaine = ctx.referentiel.domaines.find((d) => d.id === domaineId);
  if (!domaine) {
    return Response.json(
      { erreur: "domaine-introuvable", message: "Ce domaine n'existe pas dans ton référentiel." },
      { status: 404 },
    );
  }

  // Les compétences vivantes du domaine : ni archivées, ni d'ailleurs. C'est
  // exactement l'ensemble que l'`enum` du schéma énumérera.
  const vivantes = ctx.referentiel.skills.filter((s) => s.domaine === domaineId && !s.archive);
  const retraits = retraitsParCode(vivantes, ctx.preuvesEffectives);

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
            ? `${choix.raison} Tu peux modifier les compétences à la main sur cette page.`
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
        const resultat = await reviserBranche(
          moteur,
          domaine,
          vivantes,
          retraits,
          demande,
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

        // La proposition part au client pour relecture ligne à ligne.
        // L'écriture n'a lieu qu'après `appliquerRevision`, sur clic.
        envoyer("proposition", { revision: resultat.revision });
      } catch (e) {
        if (abandon.signal.aborted) return;
        envoyer("erreur", {
          message: e instanceof Error ? e.message : "Erreur inattendue pendant la révision.",
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
