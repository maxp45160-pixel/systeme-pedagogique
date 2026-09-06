import Link from "next/link";
import { VueDepot } from "./vue-depot";
import { lireDepotsDocumentaires } from "@/lib/store/depot-documents";
import { estPiloteDepot } from "@/lib/store/depot-budget";
import { lire } from "@/lib/store/db";
import { statutSeance } from "@/lib/domain/seance";

export async function DepotsRecents() {
  if (!await estPiloteDepot()) return null;
  const depots = await lireDepotsDocumentaires();
  if (!depots.length) return null;
  return <section className="my-8" aria-label="Dépôts récents"><h2 className="text-sm font-medium text-texte-attenue">Retrouver un dépôt</h2><ul className="mt-3 divide-y divide-bordure">{depots.map(d=><li key={d.id}><Link className="flex flex-wrap items-center justify-between gap-2 rounded-lg px-2 py-4 text-sm transition-colors hover:bg-surface" href={`/app?depot=${encodeURIComponent(d.id)}`}><span className="font-medium">{d.titre}</span><span className="text-xs text-texte-attenue">{new Date(d.creeLe).toLocaleString("fr-FR")}</span></Link></li>)}</ul></section>;
}
export async function AccueilDepot({documentId}:{documentId?:string}) {
  const sessions = await lire("sessions");
  const enCours = sessions.filter(s=>statutSeance(s)==="en-cours");
  return <div className="mx-auto max-w-4xl space-y-6 rounded-3xl bg-fond px-2 pb-12 pt-4 sm:px-6"><header className="pb-2"><h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Un peu moins dans la tête.</h1><p className="mt-3 text-sm text-texte-attenue">Déposez votre journée. Retrouvez par où commencer.</p></header>
    {enCours.length>0&&<section aria-label="Travail en cours" className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl bg-primaire/5 px-5 py-4"><h2 className="text-xs text-texte-attenue">À reprendre</h2><ul className="flex flex-wrap gap-3">{enCours.map(s=><li key={s.id}><Link className="text-sm font-medium text-primaire hover:underline" href={`/seances?session=${encodeURIComponent(s.id)}`}>{s.interventions?.[0]?.label??"Séance en cours"}</Link></li>)}</ul></section>}
    <VueDepot key={documentId??"nouveau"} documentInitial={documentId}/>
    <DepotsRecents/>
    <nav className="flex flex-wrap gap-4 text-sm text-primaire"><Link href="/app?classique=1">Autres propositions de travail</Link><Link href="/atelier">Mes cours</Link><Link href="/seances">Séances</Link></nav>
  </div>;
}
