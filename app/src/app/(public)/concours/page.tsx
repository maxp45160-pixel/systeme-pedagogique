import type { Metadata } from "next";
import Link from "next/link";
import { Carte, classesLienBouton } from "@/components/ui/primitives";
import { IconeFleche, IconeCalendrier, IconeMinuteur, IconePreuve } from "@/components/ui/icones";

export const metadata: Metadata = {
  title: "Préparer un concours ou un examen à date — Système pédagogique",
  description:
    "Pour les candidats aux concours et examens à date fixe : arbitrez vos révisions selon l'échéance, mesurez votre autonomie en conditions réelles et éliminez les angles morts.",
  alternates: { canonical: "/concours" },
};

export default function PageConcours() {
  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-primaire">
        Concours & Examens à date
      </p>
      <h1 className="mt-3 font-serif text-3xl font-medium tracking-tight text-texte sm:text-4xl">
        Une date fixe ne pardonne pas les révisions au hasard.
      </h1>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-texte-attenue sm:text-base">
        <p>
          Que vous prépariez un concours d&apos;entrée (IFSI, fonction publique, écoles),
          une certification professionnelle ou des partiels universitaires à date butoir,
          votre temps est compté. La question chaque matin n&apos;est pas
          « ai-je assez de chapitres à lire ? », mais{" "}
          <strong>
            « qu&apos;est-ce qui me rapproche le plus de l&apos;admission aujourd&apos;hui ? »
          </strong>
          .
        </p>

        <h2 className="pt-4 font-serif text-xl font-medium text-texte sm:text-2xl">
          Les pièges classiques de la préparation de concours
        </h2>
        <ul className="list-disc space-y-3 pl-5">
          <li>
            <strong>L&apos;illusion du surlignage</strong> : relire des annales et des fiches donne
            l&apos;impression de maîtriser, jusqu&apos;à la première question d&apos;épreuve
            posée sans aide ni modèle sous les yeux.
          </li>
          <li>
            <strong>La mauvaise répartition de l&apos;effort</strong> : on passe trop de temps sur ce qu&apos;on
            aime et qu&apos;on sait déjà faire, au détriment des points éliminatoires ou des
            matières à fort coefficient.
          </li>
          <li>
            <strong>Le stress des plannings rigides</strong> : les plannings jour par jour deviennent
            anxiogènes dès le premier imprévu et finissent abandonnés.
          </li>
        </ul>

        <h2 className="pt-4 font-serif text-xl font-medium text-texte sm:text-2xl">
          Comment le système adapte votre entraînement
        </h2>
        <p>
          Le système retient vos épreuves et la date de votre concours. À chaque séance,
          il calibre la recommandation d&apos;action selon votre temps disponible (même 20
          minutes entre deux obligations) et l&apos;état réel de vos acquis mesurés.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-bordure bg-surface p-4">
            <div className="flex items-center gap-2 text-primaire">
              <IconeCalendrier className="size-4" />
              <span className="font-serif text-sm font-medium text-texte">Échéance intégrée</span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-texte-attenue">
              Votre engagement daté oriente les priorités du moteur : consolider les points
              fragiles avant le sprint final.
            </p>
          </div>

          <div className="rounded-lg border border-bordure bg-surface p-4">
            <div className="flex items-center gap-2 text-primaire">
              <IconePreuve className="size-4" />
              <span className="font-serif text-sm font-medium text-texte">Zéro angle mort</span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-texte-attenue">
              Ce qui n&apos;a jamais été prouvé par un exercice réussi reste marqué comme non
              acquis, sans faux sentiment de sécurité.
            </p>
          </div>

          <div className="rounded-lg border border-bordure bg-surface p-4">
            <div className="flex items-center gap-2 text-primaire">
              <IconeMinuteur className="size-4" />
              <span className="font-serif text-sm font-medium text-texte">Mesure d&apos;autonomie</span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-texte-attenue">
              Le système distingue ce qui a été fait avec une formule sous les yeux de ce qui
              a été résolu en autonomie complète d&apos;examen.
            </p>
          </div>
        </div>

        <h2 className="pt-4 font-serif text-xl font-medium text-texte sm:text-2xl">
          Pas de classement, pas de distraction
        </h2>
        <p>
          Ici, aucun forum bruyant, aucune comparaison anxiogène avec d&apos;autres candidats,
          aucun jalon artificiel. Seulement un appareil sobre qui mesure vos progrès réels,
          jour après jour, et vous permet d&apos;arriver le jour de l&apos;épreuve en sachant
          exactement ce que vous valez.
        </p>
      </div>

      <Carte accent className="mt-12 p-6 text-center">
        <h2 className="font-serif text-lg font-medium text-texte">
          Calibrez vos révisions dès votre prochaine session
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-texte-attenue">
          Indiquez vos épreuves, passez votre premier exercice de calibrage et découvrez vos
          priorités réelles sans délai.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <Link href="/login?mode=inscription" className={classesLienBouton("principal")}>
            Créer mon compte
            <IconeFleche className="size-4" />
          </Link>
          <Link href="/" className={classesLienBouton("secondaire")}>
            Retour à l&apos;accueil
          </Link>
        </div>
        <p className="mt-4 font-mono text-xs text-texte-discret">
          Gratuit · 150 exercices par mois inclus · Données 100 % privées
        </p>
      </Carte>
    </article>
  );
}
