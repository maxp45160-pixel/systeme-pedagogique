import type { MoteurTuteur } from "./types";
import { appelerQwen } from "../qwen-appel";
import { QWEN_MODELE, QWEN_SORTIE, QWEN_URL } from "../qwen-config";
import { validerAppelOutilJson } from "../outils";

export function moteurQwen(cle: string): MoteurTuteur {
  return { nom: "qwen", modele: QWEN_MODELE, async repondre({ systemeStable, systemeProfil, messages, outils, signal, envoyer, delaiMs }) {
    try {
      const corps = { messages: [{ role: "system", content: `${systemeStable}\n\n${systemeProfil}` }, ...messages],
        ...(outils.length ? { tools: outils.map((o) => ({ type: "function", function: { name: o.nom, description: o.description, parameters: o.schema } })), tool_choice: outils.length === 1 ? { type: "function", function: { name: outils[0].nom } } : "auto" } : {}) };
      const borne = AbortSignal.any([AbortSignal.timeout(delaiMs ?? 90000), ...(signal ? [signal] : [])]);
      envoyer("tronque", { message: "Qwen prépare la réponse…" });
      const resultat = await appelerQwen({ fournisseur: "qwen", cle, urlBase: QWEN_URL, modele: QWEN_MODELE }, corps, Buffer.byteLength(JSON.stringify(corps), "utf8") + 2048, QWEN_SORTIE, borne);
      const message = resultat.choices[0].message;
      const appels = message?.tool_calls ?? [];
      if (!Array.isArray(appels)) throw new Error("Appels d’outils Qwen invalides.");
      const propositions = appels.map((a: { function?: { name: string; arguments: string } }) => a.function && validerAppelOutilJson(a.function.name, a.function.arguments, outils));
      if (propositions.some((p) => !p)) throw new Error("Une commande Qwen a été refusée par la validation. Aucune commande de cette réponse n’est retenue.");
      if (typeof message?.content === "string" && message.content) envoyer("texte", { delta: message.content });
      for (const proposition of propositions) envoyer("proposition", proposition);
      envoyer("fin", { stopReason: resultat.choices[0].finish_reason, outils: { actifs: true }, usage: resultat.usage });
    } catch (e) {
      // Diagnostic sans clé, prompt ni corps de réponse fournisseur.
      const message = e instanceof Error ? e.message : "Appel Qwen interrompu.";
      const diagnostic = /HTTP \d{3}/.exec(message)?.[0]
        ?? (/réservation|enveloppe|Budget/i.test(message) ? "budget-refuse"
          : /Clé refusée/.test(message) ? "cle-refusee"
          : /commande|outils/.test(message) ? "commande-invalide"
          : /incomplète|interrompue/.test(message) ? "reponse-incomplete"
          : e instanceof Error ? e.name : "inconnu");
      console.warn("[qwen] appel échoué", diagnostic);
      envoyer("erreur", { message });
    }
  } };
}
