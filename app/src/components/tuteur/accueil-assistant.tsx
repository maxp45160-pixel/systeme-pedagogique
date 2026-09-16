import Link from "next/link";
import { ChatTuteur } from "./chat";
import { chargerDonneesTuteurGlobal } from "@/lib/tutor/actions";
import { classesLienBouton } from "@/components/ui/primitives";

export async function AccueilAssistant({ ressourcesInitiales }: { ressourcesInitiales?: string[] } = {}) {
  const donnees = await chargerDonneesTuteurGlobal();
  return <section aria-labelledby="titre-accueil" className="mx-auto max-w-4xl space-y-5 pb-8">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><h1 id="titre-accueil" className="text-3xl font-semibold tracking-tight">Votre assistant</h1>
        <p className="mt-2 text-texte-attenue">Ajoutez vos cours, vos notes ou vos exercices. Twiny vous propose une synthèse, une organisation et les compétences à travailler.</p><p className="mt-1 text-sm text-texte-attenue">Vous vérifiez, vous validez, puis retrouvez vos priorités.</p></div>
      <Link href="/app?classique=1" className={classesLienBouton("secondaire")}>Voir mes priorités</Link>
    </header>
    <ChatTuteur {...donnees} modeAccueil ressourcesInitiales={ressourcesInitiales} />
  </section>;
}
