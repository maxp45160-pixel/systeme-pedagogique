import { chargerContexte } from "@/lib/store/context";
import { construireContexte } from "@/lib/tutor/contexte";
import { choisirConfiguration, creerMoteur, decrireChoix } from "@/lib/tutor/moteurs";

/**
 * Route du tuteur — réponse diffusée en flux.
 *
 * Cette route ne connaît aucun fournisseur : elle assemble le contexte, demande
 * un moteur (ADR-007) et relaie ses événements. Changer de fournisseur est une
 * variable d'environnement.
 *
 * Sans moteur configuré, elle répond 503 et l'interface bascule d'elle-même en
 * mode « copier le contexte » — elle ne simule jamais une réponse.
 */

export async function POST(request: Request) {
  const choix = choisirConfiguration(process.env);
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

  let corps: { messages?: { role: "user" | "assistant"; content: string }[] };
  try {
    corps = await request.json();
  } catch {
    return Response.json({ erreur: "corps-invalide" }, { status: 400 });
  }

  const messages = (corps.messages ?? []).filter((m) => m.content.trim().length > 0);
  if (messages.length === 0) {
    return Response.json({ erreur: "aucun-message" }, { status: 400 });
  }

  const ctx = await chargerContexte();
  const pedagogique = await construireContexte(ctx);

  const encodeur = new TextEncoder();

  const flux = new ReadableStream({
    async start(controller) {
      const envoyer = (evenement: string, donnees: unknown) => {
        controller.enqueue(
          encodeur.encode(`event: ${evenement}\ndata: ${JSON.stringify(donnees)}\n\n`),
        );
      };

      try {
        await moteur.repondre({
          systemeStable: pedagogique.systemeStable,
          systemeProfil: pedagogique.systemeProfil,
          messages,
          envoyer,
        });
      } finally {
        controller.close();
      }
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

/** Le manifeste de contexte, pour l'indicateur « contexte chargé » et le mode presse-papier. */
export async function GET() {
  const ctx = await chargerContexte();
  const pedagogique = await construireContexte(ctx);
  const choix = choisirConfiguration(process.env);

  return Response.json({
    // Conserve le nom historique du champ : l'interface s'en sert pour décider
    // d'afficher le chat ou le repli « copier le contexte ».
    cleConfiguree: choix.kind !== "aucun",
    modele: decrireChoix(choix),
    manifeste: pedagogique.manifeste,
    caracteresTotal: pedagogique.caracteresTotal,
  });
}
