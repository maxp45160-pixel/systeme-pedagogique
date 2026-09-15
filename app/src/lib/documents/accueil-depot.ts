import { cleJour } from "@/lib/engine/dates";

/** Les ressources du jour se dérivent des faits conservés, dans le jour du navigateur. */
export function depotsDuJour<T extends { id: string; creeLe: string }>(depots: readonly T[], jour: string): T[] {
  return depots.filter(d => Number.isFinite(Date.parse(d.creeLe)) && cleJour(new Date(d.creeLe)) === jour)
    .sort((a, b) => Date.parse(b.creeLe) - Date.parse(a.creeLe));
}

/** Le dépôt du jour se dérive des faits conservés, dans le jour du navigateur. */
export function dernierDepotDuJour(depots: readonly { id: string; creeLe: string }[], jour: string): string | undefined {
  return depotsDuJour(depots,jour)[0]?.id;
}
