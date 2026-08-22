import type { Metadata } from "next";
import Link from "next/link";
import { Carte, classesLienBouton } from "@/components/ui/primitives";
import { IconeFleche } from "@/components/ui/icones";

export const metadata: Metadata = {
  title: "Apprendre seul sans naviguer à l'aveugle — pour les autodidactes",
  description:
    "Tutoriels, cours en ligne, livres : apprendre seul est facile. Savoir si vous progressez vraiment ne l'est pas. Une boucle d'exercices qui mesure vos acquis réels.",
  alternates: { canonical: "/autodidactes" },
};

export default function PageAutodidactes() {
  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-primaire">
        Pour les autodidactes
      </p>
      <h1 className="mt-3 font-serif text-3xl font-medium tracking-tight text-texte sm:text-4xl">
        Apprendre seul est facile. Savoir si vous progressez ne l&apos;est pas.
      </h1>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-texte-attenue sm:text-base">
        <p>
          Vous avez des tutoriels en pagaille, des cours en ligne, des livres.
          Le vrai problème de l&apos;autodidaxie n&apos;est plus l&apos;accès au
          savoir — c&apos;est le retour d&apos;information. Personne pour
          corriger vos exercices, personne pour vous dire que ce chapitre que
          vous avez « terminé » ne tient pas devant une application concrète,
          personne pour vous empêcher de rebâtir chaque semaine sur des bases
          fragiles.
        </p>

        <h2 className="pt-4 font-serif text-xl font-medium text-texte sm:text-2xl">
          Le mur invisible de l&apos;autodidaxie
        </h2>
        <ul className="list-disc space-y-3 pl-5">
          <li>
            On enchaîne les tutoriels où tout marche, puis on reste bloqué des
            heures sur son propre projet — parce qu&apos;aucun n&apos;a mis à
            l&apos;épreuve ce qu&apos;on croyait acquis.
          </li>
          <li>
            Sans programme ni examen, « je suis arrivé au chapitre 9 » remplace
            la mesure du niveau réel.
          </li>
          <li>
            Les trous se paient plus tard : on décroche non pas parce que c&apos;est
            trop dur, mais parce qu&apos;une base jamais vérifiée s&apos;est
            effondrée en silence.
          </li>
        </ul>

        <h2 className="pt-4 font-serif text-xl font-medium text-texte sm:text-2xl">
          Un prof particulier dans la boucle, pas un catalogue de plus
        </h2>
        <p>
          Ici, vous n&apos;avez pas un énième catalogue de cours à suivre. Vous
          déclarez ce que vous voulez maîtriser ; le système le découpe en
          compétences et vous confronte, à chaque session, à un exercice écrit
          pour votre niveau du moment. Chaque résultat laisse une trace : votre
          tableau de bord devient la carte honnête de ce que vous savez faire —
          pas de ce que vous avez regardé.
        </p>
        <ul className="list-disc space-y-3 pl-5">
          <li>
            Vingt minutes disponibles ? La prochaine action utile est déjà
            choisie, avec sa raison.
          </li>
          <li>
            Ce qui résiste revient jusqu&apos;à être démontré ; ce qui est solide
            passe au second plan mais reste surveillé.
          </li>
          <li>
            Dans six mois, vous saurez exactement ce que votre autodidaxie a
            réellement construit.
          </li>
        </ul>
        <p>
          Tout ça reste privé : vos lacunes sont un outil de progression pour
          vous, jamais une vitrine pour les autres.
        </p>
      </div>

      <Carte accent className="mt-12 p-6 text-center">
        <h2 className="font-serif text-lg font-medium text-texte">
          Faites passer votre prochain projet par la pratique
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-texte-attenue">
          Gratuit et privé. Déclarez votre sujet, faites un premier exercice,
          voyez où vous en êtes vraiment.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <Link href="/login" className={classesLienBouton("principal")}>
            Créer mon compte
            <IconeFleche className="size-4" />
          </Link>
          <Link href="/" className={classesLienBouton("secondaire")}>
            Retour à l&apos;accueil
          </Link>
        </div>
      </Carte>
    </article>
  );
}
