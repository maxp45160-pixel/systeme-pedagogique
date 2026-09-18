import Link from "next/link";
import { SupprimerDepot } from "./supprimer-depot";
import { lireDepotsDocumentaires } from "@/lib/store/depot-documents";
import { estPiloteDepot } from "@/lib/store/depot-budget";
import type { ResumeDepotDocumentaire } from "@/lib/documents/depot";

function etatRessource(depot: ResumeDepotDocumentaire) {
  if (depot.version === 1) return "Dépôt historique";
  if (depot.rangementRevuLe) return depot.rangementStatut === "a-trier" ? "À trier" : "Rangée";
  if (depot.referentielRevuLe) return "À ranger";
  if (depot.analyseStatut === "terminee") return "Référentiel à relire";
  if (depot.analyseStatut === "en-cours") return "Analyse en cours";
  if (depot.analyseStatut === "echec" || depot.analyseStatut === "interrompue") return "Analyse à reprendre";
  return "À analyser";
}

export async function DepotsRecents() {
  if (!await estPiloteDepot()) return null;
  const depots = await lireDepotsDocumentaires();
  if (!depots.length) return null;
  return <section className="my-8" aria-label="Ressources récentes"><h2 className="text-sm font-medium text-texte-attenue">Ressources récentes</h2><ul className="mt-3 divide-y divide-bordure">{depots.map(d=><li key={d.id} className="flex flex-wrap items-center gap-x-3"><Link className="min-w-0 flex-1 flex flex-wrap items-center justify-between gap-2 rounded-lg px-2 py-4 text-sm transition-colors hover:bg-surface" href={`/app?depot=${encodeURIComponent(d.id)}`}><span className="font-medium">{d.titre}</span><span className="text-right text-xs text-texte-attenue">{etatRessource(d)}<span className="block">{new Date(d.creeLe).toLocaleString("fr-FR")}</span></span></Link><SupprimerDepot id={d.id} titre={d.titre}/></li>)}</ul></section>;
}
