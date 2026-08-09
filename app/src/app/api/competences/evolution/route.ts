import { chargerContexte } from "@/lib/store/context";
import { choisirConfiguration, creerMoteur } from "@/lib/tutor/moteurs";
import type { ConfigTuteurClient } from "@/lib/tutor/cle-client";
import { envTuteur } from "@/lib/tutor/env-requete";
import { proposerEvolution } from "@/lib/tutor/evolution";

/**
 * Route de proposition d'évolution — sans conversation.
 *
 * Le refus qui compte est celui de la ligne « non maîtrisée » : proposer un
 * successeur à une compétence qui n'a rien démontré serait inventer une
 * progression. Le prédicat est **revérifié ici**, côté serveur, et pas
 * seulement dans l'écran qui affiche le bouton : une route qui fait confiance
 * à son appelant n'est pas un garde-fou.
 */

export const maxDuration = 300;

interface CorpsEvolution {
  /** Code de la compétence maîtrisée. */
  code?: string;
  config?: ConfigTuteurClient;
}

export async function POST(request: Request) {
  let corps: CorpsEvolution;
  try {
    corps = (await request.json()) as CorpsEvolution;
  } catch {
    return Response.json({ erreur: "corps-invalide" }, { status: 400 });
  }

  const code = (corps.code ?? "").trim().toUpperCase();
  if (!code) return Response.json({ erreur: "code-absent" }, { status: 400 });

  const ctx = await chargerContexte();

  const etat = ctx.etatsParCode.get(code);
  if (!etat) {
    return Response.json(
      {
        erreur: "competence-introuvable",
        message: "Cette compétence n'existe pas dans ton périmètre actif.",
      },
      { status: 404 },
    );
  }

  const maitrise = ctx.maitrises.get(code);
  if (!maitrise?.maitrisee) {
    return Response.json(
      {
        erreur: "non-maitrisee",
        message:
          maitrise?.manque ??
          "Cette compétence n'est pas maîtrisée : il n'y a rien à faire évoluer.",
      },
      { status: 400 },
    );
  }

  const domaine = ctx.referentiel.domaines.find((d) => d.id === etat.skill.domaine);
  if (!domaine) {
    return Response.json(
      { erreur: "domaine-introuvable", message: "Le domaine de cette compétence est introuvable." },
      { status: 404 },
    );
  }

  // Les voisines vivantes du même domaine, pour ne pas proposer un doublon.
  // Elle-même exclue : la citer inviterait à la reformuler plutôt qu'à la
  // dépasser.
  const voisines = ctx.referentiel.actifs.filter(
    (s) => s.domaine === domaine.id && s.code !== code,
  );

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
            ? `${choix.raison} Tu peux arbitrer sans lui : ajouter une compétence, ou retirer celle-ci.`
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
        const resultat = await proposerEvolution(
          moteur,
          etat,
          maitrise,
          voisines,
          domaine,
          abandon.signal,
          // Le `proposition` du moteur est filtré : l'événement terminal porte
          // le même nom et une forme différente.
          (evenement, donnees) => {
            if (evenement === "proposition") return;
            envoyer(evenement, donnees);
          },
        );

        if (resultat.erreur) {
          envoyer("erreur", { message: resultat.erreur });
          return;
        }

        envoyer("proposition", { evolution: resultat.evolution });
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
