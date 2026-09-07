"use client";
import { useSyncExternalStore } from "react";
import { cleJour } from "@/lib/engine/dates";
import { dernierDepotDuJour } from "@/lib/documents/accueil-depot";
import { VueDepot } from "./vue-depot";

function suivreJour(notifier: () => void) {
  const timer = setInterval(notifier, 60_000);
  window.addEventListener("focus", notifier);
  return () => { clearInterval(timer); window.removeEventListener("focus", notifier); };
}
const jourLocal = () => cleJour(new Date());
const jourServeur = () => "";

export function AccueilDuJour({ depots, documentId, nouveau }: {
  depots: { id: string; creeLe: string }[]; documentId?: string; nouveau?: boolean;
}) {
  const jour = useSyncExternalStore(suivreJour, jourLocal, jourServeur);
  if (!jour && !documentId && !nouveau) return <p role="status" className="text-sm text-texte-attenue">Ouverture de votre journée…</p>;
  const id = documentId ?? (nouveau ? undefined : dernierDepotDuJour(depots, jour));
  return <VueDepot key={id ?? "nouveau"} documentInitial={id}/>;
}
