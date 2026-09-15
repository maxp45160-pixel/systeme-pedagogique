import Link from "next/link";
import { ChatTuteur } from "./chat";
import { chargerDonneesTuteurGlobal } from "@/lib/tutor/actions";
import { classesLienBouton } from "@/components/ui/primitives";

export async function AccueilAssistant() {
  const donnees = await chargerDonneesTuteurGlobal();
  return <section aria-labelledby="titre-accueil" className="mx-auto max-w-4xl space-y-5 pb-8">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><h1 id="titre-accueil" className="text-3xl font-semibold tracking-tight">Par où commencer ?</h1>
        <p className="mt-2 text-texte-attenue">Racontez votre journée, posez une question ou passez directement au travail.</p></div>
      <Link href="/app?classique=1" className={classesLienBouton("principal")}>Commencer à travailler</Link>
    </header>
    <ChatTuteur {...donnees} modeAccueil />
  </section>;
}
