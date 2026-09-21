import { createHash } from "node:crypto";
import { chargerDialogueRessource, verifierOperationRessource, preparerOperationRessource, executerOperationRessource } from "@/lib/store/dialogue-ressource";
import { lireRessourceAssistantAction } from "@/lib/store/ressource-assistant-actions";
import { comprendreRessource } from "./dialogue-ressource";
import { cleEnvoiAccueil, type EnvoiAccueil } from "./accueil-tour";
import { resoudreMoteur, repondreParFluxSse } from "./reponse-flux";
import type { ConfigTuteurClient } from "./cle-client";

/** Appelé uniquement après le contrôle du compte pilote de /api/assistant. */
export async function repondreRessource(request: Request, envoi: EnvoiAccueil, cible: unknown, config?: ConfigTuteurClient) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ message: "Origine invalide." }, { status: 403 });
  const c = cible as { id?: unknown; version?: unknown } | null;
  if (!c || typeof c.id !== "string" || !/^depot-[a-f0-9]{32}$/.test(c.id) || typeof c.version !== "string" || c.version.length > 60) return Response.json({ message: "Ressource sélectionnée invalide." }, { status: 400 });
  try {
    const id = c.id;
    const charge = await chargerDialogueRessource(id);
    const cle = createHash("sha256").update(`${cleEnvoiAccueil(envoi)}:${id}:${c.version}`).digest("hex");
    const operation = verifierOperationRessource(charge, cle);
    if (envoi.verifier) {
      const liens = operation?.terminee && (operation.choix?.action === "declarer" || (await lireRessourceAssistantAction(id)).liensVerifies);
      return Response.json({ message: liens ? operation!.recu : null });
    }
    if (!operation && charge.depot.modifieLe !== c.version) return Response.json({ message: "Cette ressource a changé. Sélectionnez à nouveau Corriger ou compléter avant de reformuler la demande." }, { status: 409 });
    // Une commande préparée survit à la coupure : ni nouvelle interprétation ni nouvel appel payant.
    if (operation) return repondreParFluxSse(request, async (envoyer) => {
      envoyer("texte", { delta: await executerOperationRessource(charge, cle) }); envoyer("fin", {});
    }, (e) => e instanceof Error ? e.message : "Reprise indisponible.");
    const resolu = await resoudreMoteur(config, { profil: "rapide" });
    if (!resolu.ok) return resolu.reponse;
    return repondreParFluxSse(request, async (envoyer, signal) => {
      const borne = AbortSignal.any([signal, AbortSignal.timeout(45000)]);
      envoyer("tronque", { message: "Je lis votre message…" });
      const choix = await comprendreRessource(resolu.moteur, envoi.messages, charge.contexte, borne);
      if (choix.action === "repondre") envoyer("texte", { delta: `${choix.reponse}\n\nAucune modification effectuée.` });
      else {
        borne.throwIfAborted();
        await preparerOperationRessource(charge, cle, choix, envoi.messages);
        envoyer("tronque", { message: "J'applique la commande enregistrée…" });
        envoyer("texte", { delta: await executerOperationRessource(await chargerDialogueRessource(id), cle) });
      }
      envoyer("fin", {});
    }, (e) => `${e instanceof Error ? e.message : "La modification n'a pas abouti."} Vérifiez l'enregistrement avant de reprendre. Les écritures déjà réussies sont conservées.`);
  } catch (e) { return Response.json({ message: e instanceof Error ? e.message : "Ressource indisponible." }, { status: 400 }); }
}
