import "server-only";
import { randomUUID } from "node:crypto";
import { envTuteur } from "./env-requete";
import { QWEN_MODELE, QWEN_URL, coutQwen } from "./qwen-config";
import type { ConfigTuteurClient } from "./cle-client";

/** Une seule tentative réseau ; réservation conservée même sur erreur ou annulation. */
export async function appelerQwen(config: ConfigTuteurClient, contenu: Record<string, unknown>, entree: number, sortie: number, signal?: AbortSignal) {
  coutQwen(entree, sortie);
  if (Date.now() >= Date.parse("2026-10-15T00:00:00Z")) throw new Error("Les tarifs Qwen doivent être revérifiés.");
  signal?.throwIfAborted();
  const resolution = await envTuteur(config, { operation: randomUUID(), pages: 0, entreeOctets: entree, sortieMax: sortie, fournisseur: "qwen" });
  if (!resolution.ok) throw new Error((await resolution.reponse.json()).message);
  const response = await fetch(`${QWEN_URL}/chat/completions`, {
    method: "POST", redirect: "error", headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.cle}` },
    body: JSON.stringify({ ...contenu, model: QWEN_MODELE, stream: false, enable_thinking: false, max_tokens: sortie }),
    signal: AbortSignal.any([AbortSignal.timeout(90000), ...(signal ? [signal] : [])]),
  });
  if (!response.ok) {
    const corps = await response.json().catch(() => null);
    const code = corps?.error?.code ?? corps?.code;
    // Un code fournisseur est utile au diagnostic ; jamais son message libre.
    const codeSur = typeof code === "string" && /^[A-Za-z][A-Za-z0-9_.]{0,79}$/.test(code) ? code : "inconnu";
    console.warn(`[qwen] refus fournisseur HTTP ${response.status} code=${codeSur}`);
    throw new Error(response.status === 401 ? "Clé refusée par Qwen. Vérifiez la clé et sa région dans les réglages." : response.status === 429 ? "Quota ou débit Qwen atteint. Aucun réessai automatique." : `Qwen a refusé la demande (HTTP ${response.status}, code ${codeSur}). Aucun réessai automatique.`);
  }
  if (response.headers.get("x-dashscope-partialresponse") === "true") throw new Error("Réponse Qwen interrompue.");
  const resultat = await response.json();
  const choix = resultat?.choices?.[0];
  if (!choix || !["stop", "tool_calls"].includes(choix.finish_reason)) throw new Error("Réponse Qwen incomplète, aucune action retenue.");
  return resultat;
}
