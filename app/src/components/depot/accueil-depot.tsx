import Link from "next/link";
import { classesLienBouton } from "@/components/ui/primitives";
import { AccueilDuJour } from "./accueil-du-jour";
import { SupprimerDepot } from "./supprimer-depot";
import { lireDepotsDocumentaires } from "@/lib/store/depot-documents";
import { estPiloteDepot } from "@/lib/store/depot-budget";
import { lire } from "@/lib/store/db";
import { statutSeance } from "@/lib/domain/seance";
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
export async function AccueilDepot({documentId,nouveau}:{documentId?:string;nouveau?:boolean}) {
  const [sessions, depots] = await Promise.all([lire("sessions"), lireDepotsDocumentaires()]);
  const enCours = sessions.filter(s=>statutSeance(s)==="en-cours");
  return <div className="mx-auto max-w-4xl space-y-6 rounded-3xl bg-fond px-2 pb-12 pt-4 sm:px-6"><header className="pb-2"><h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Un peu moins dans la tête.</h1><p className="mt-3 text-sm text-texte-attenue">Déposez votre journée. Retrouvez par où commencer.</p></header>
    {enCours.length>0&&<section aria-label="Travail en cours" className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl bg-primaire/5 px-5 py-4"><h2 className="text-xs text-texte-attenue">À reprendre</h2><ul className="flex flex-wrap gap-3">{enCours.map(s=><li key={s.id}><Link className="text-sm font-medium text-primaire hover:underline" href={`/seances?session=${encodeURIComponent(s.id)}`}>{s.interventions?.[0]?.label??"Séance en cours"}</Link></li>)}</ul></section>}
    <div className="flex justify-end"><Link className={classesLienBouton("secondaire", "petite")} href="/app?classique=1">Tableau de bord</Link></div>
    <AccueilDuJour depots={depots} documentId={documentId} nouveau={nouveau}/>
    <DepotsRecents/>
    <nav className="flex flex-wrap gap-4 text-sm text-primaire"><Link href="/atelier">Mes cours</Link><Link href="/seances">Séances</Link></nav>
  </div>;
}
