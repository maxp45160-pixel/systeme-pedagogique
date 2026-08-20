import { chargerContexte } from "@/lib/store/context";
import { choisirConfiguration, creerMoteur } from "@/lib/tutor/moteurs";
import type { ConfigTuteurClient } from "@/lib/tutor/cle-client";
import { envTuteur } from "@/lib/tutor/env-requete";
import { evaluerExplication } from "@/lib/tutor/explication";
import { verifierTexteExplication } from "@/lib/domain/explication";

export const maxDuration = 120;

interface CorpsEvaluerExplication {
  skillCode?: string;
  texteExplication?: string;
  config?: ConfigTuteurClient;
}

export async function POST(request: Request) {
  let corps: CorpsEvaluerExplication;
  try {
    corps = (await request.json()) as CorpsEvaluerExplication;
  } catch {
    return Response.json({ erreur: "corps-invalide" }, { status: 400 });
  }

  const skillCode = (corps.skillCode ?? "").trim();
  const texteExplication = (corps.texteExplication ?? "").trim();

  if (!skillCode) {
    return Response.json({ erreur: "competence-absente" }, { status: 400 });
  }

  const verif = verifierTexteExplication(texteExplication);
  if (!verif.valide) {
    return Response.json({ erreur: "texte-invalide", message: verif.erreur }, { status: 400 });
  }

  const ctx = await chargerContexte();
  const skill = ctx.referentiel.parCode.get(skillCode);
  if (!skill) {
    return Response.json(
      { erreur: "competence-introuvable", message: "Cette compétence n'existe pas dans votre référentiel." },
      { status: 404 },
    );
  }

  const domaine = ctx.referentiel.domainesParId.get(skill.domaine);

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
            ? `${choix.raison} Configurez une clé d'API dans les réglages pour utiliser le tuteur.`
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
        const resultat = await evaluerExplication(
          moteur,
          skill,
          texteExplication,
          domaine,
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

        envoyer("proposition", { evaluation: resultat.evaluation });
      } catch (e) {
        if (abandon.signal.aborted) return;
        envoyer("erreur", {
          message: e instanceof Error ? e.message : "Erreur pendant l'évaluation.",
        });
      } finally {
        try {
          controller.close();
        } catch {
          /* flux déjà fermé */
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
