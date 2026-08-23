import type { Metadata } from "next";
import Link from "next/link";
import { Carte, classesLienBouton } from "@/components/ui/primitives";
import { IconeFleche } from "@/components/ui/icones";

export const metadata: Metadata = {
  title: "Réviser efficacement — pour les étudiants",
  description:
    "Savoir quelle matière est réellement acquise avant l'examen, répartir vos révisions là où ça compte, et arrêter de relire pour illusion de maîtrise.",
  alternates: { canonical: "/etudiants" },
};

export default function PageEtudiants() {
  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-primaire">
        Pour les étudiants
      </p>
      <h1 className="mt-3 font-serif text-3xl font-medium tracking-tight text-texte sm:text-4xl">
        Vos fiches ne vous disent pas ce que vous savez. Les exercices, si.
      </h1>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-texte-attenue sm:text-base">
        <p>
          Trois semaines avant les partiels, la question n&apos;est pas
          « ai-je assez travaillé ? » mais « où est-ce que je perdrai des
          points ? ». La relecture ne répond pas à cette question : elle
          entretient l&apos;impression que tout est connu, jusqu&apos;au moment
          où le sujet d&apos;examen prouve le contraire.
        </p>

        <h2 className="pt-4 font-serif text-xl font-medium text-texte sm:text-2xl">
          Le problème des révisions classiques
        </h2>
        <ul className="list-disc space-y-3 pl-5">
          <li>
            On révise ce qui est agréable à relire, pas ce qui est fragile.
          </li>
          <li>
            Les matières « faites en début d&apos;année » sortent du radar,
            alors qu&apos;elles se sont effacées.
          </li>
          <li>
            Impossible de savoir si un chapitre est acquis ou simplement
            familier sans se tester — et se tester tout seul, sans barème ni
            suivi, décourage vite.
          </li>
        </ul>

        <h2 className="pt-4 font-serif text-xl font-medium text-texte sm:text-2xl">
          Ce que le système change
        </h2>
        <p>
          Vous déclarez vos matières et vos chapitres une fois. Ensuite, à
          chaque session — même trente minutes entre deux cours — le système
          vous donne un exercice sur le point qui en a le plus besoin, et
          mesure honnêtement le résultat.
        </p>
        <ul className="list-disc space-y-3 pl-5">
          <li>
            Une matière n&apos;est « acquise » que si vos derniers exercices le
            démontrent — pas si vous l&apos;avez surlignée en novembre.
          </li>
          <li>
            Ce qui s&apos;efface remonte seul dans la file : plus de chapitre
            oublié découvert la veille de l&apos;examen.
          </li>
          <li>
            À l&apos;approche des partiels, votre tableau de bord montre les
            priorités réelles : ce qui est solide, ce qui vacille, ce qui n&apos;a
            jamais été démontré.
          </li>
        </ul>
        <p>
          Vos données restent privées : vos faiblesses ne sont visibles ni de
          vos camarades, ni de vos professeurs, ni de personne.
        </p>
      </div>

      <Carte accent className="mt-12 p-6 text-center">
        <h2 className="font-serif text-lg font-medium text-texte">
          Commencez dès cette session de travail
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-texte-attenue">
          Gratuit et privé. Déclarez une matière, faites un premier exercice,
          et voyez ce que le système peut déjà affirmer sur votre niveau.
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
