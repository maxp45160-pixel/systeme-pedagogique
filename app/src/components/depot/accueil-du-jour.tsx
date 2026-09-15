"use client";
import { useSyncExternalStore } from "react";
import Link from "next/link";
import { cleJour } from "@/lib/engine/dates";
import { dernierDepotDuJour, depotsDuJour } from "@/lib/documents/accueil-depot";
import type { ResumeDepotDocumentaire } from "@/lib/documents/depot";
import { OrganisationJour } from "./organisation-jour";
import { VueDepot } from "./vue-depot";

function suivreJour(notifier: () => void) {
  const timer = setInterval(notifier, 60_000);
  window.addEventListener("focus", notifier);
  return () => { clearInterval(timer); window.removeEventListener("focus", notifier); };
}
const jourLocal = () => cleJour(new Date());
const jourServeur = () => "";
function libelleEtat(depot: ResumeDepotDocumentaire) {
  if (depot.rangementRevuLe) return depot.rangementStatut === "a-trier" ? "À trier" : "Rangée";
  if (depot.referentielRevuLe) return "À ranger";
  if (depot.analyseStatut === "terminee") return "Référentiel à relire";
  if (depot.analyseStatut === "en-cours") return "Analyse en cours";
  if (depot.analyseStatut === "echec" || depot.analyseStatut === "interrompue") return "Analyse à reprendre";
  return "À analyser";
}

export function AccueilDuJour({ depots, documentId, nouveau }: {
  depots: ResumeDepotDocumentaire[]; documentId?: string; nouveau?: boolean;
}) {
  const jour = useSyncExternalStore(suivreJour, jourLocal, jourServeur);
  if (!jour && !documentId && !nouveau) return <p role="status" className="text-sm text-texte-attenue">Ouverture de votre journée…</p>;
  if (documentId) return <><VueDepot key={documentId} documentInitial={documentId}/><OrganisationJour documentIds={[documentId]}/></>;
  const aujourdhui=depotsDuJour(depots,jour);
  const ressources=aujourdhui.filter((depot)=>depot.version===2);
  const ancien=nouveau||ressources.length ? undefined : dernierDepotDuJour(aujourdhui.filter((depot)=>depot.version===1),jour);
  if (ancien) return <VueDepot key={ancien} documentInitial={ancien}/>;
  return <div className="space-y-8">
    <VueDepot key="nouveau"/>
    {ressources.length>0&&<section className="space-y-3" aria-label="Ressources du jour">
      <div><p className="text-xs font-medium uppercase tracking-widest text-primaire">Aujourd’hui</p><h2 className="mt-2 text-2xl font-semibold tracking-tight">Vos ressources conservées</h2></div>
      <ul className="grid gap-3 md:grid-cols-2">{ressources.map((ressource)=><li key={ressource.id}><Link href={`/app?depot=${encodeURIComponent(ressource.id)}`} className="block rounded-2xl border border-bordure bg-surface p-5 transition-colors hover:border-primaire/40">
        <span className="block font-medium">{ressource.titre}</span>
        <span className="mt-2 block text-xs text-texte-attenue">{libelleEtat(ressource)}</span>
      </Link></li>)}</ul>
    </section>}
    <OrganisationJour documentIds={ressources.map((ressource)=>ressource.id)}/>
  </div>;
}
