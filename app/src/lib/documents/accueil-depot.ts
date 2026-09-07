import { cleJour } from "@/lib/engine/dates";

/** Le dépôt du jour se dérive des faits conservés, dans le jour du navigateur. */
export function dernierDepotDuJour(depots: readonly { id: string; creeLe: string }[], jour: string): string | undefined {
  return depots.filter(d => Number.isFinite(Date.parse(d.creeLe)) && cleJour(new Date(d.creeLe)) === jour)
    .sort((a, b) => Date.parse(b.creeLe) - Date.parse(a.creeLe))[0]?.id;
}
