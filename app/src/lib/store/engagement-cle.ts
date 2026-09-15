import { createHash } from "node:crypto";

/** Identité technique d'un envoi, isolée par compte ; aucune donnée dérivée métier. */
export function idEngagementEnvoi(compteId: string, cle: string): string {
  if (!/^[a-f0-9-]{36}:[a-f0-9]{64}$/.test(cle)) throw new Error("Identifiant d'envoi invalide.");
  return `eng-envoi-${createHash("sha256").update(`${compteId}:${cle}`).digest("hex")}`;
}
