import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { compteCourant } from "@/lib/supabase/server";
import { classesLienBouton } from "@/components/ui/primitives";
import {
  IconeAmpoule,
  IconeFleche,
  IconeLivre,
  IconeRecherche,
  IconeValide,
} from "@/components/ui/icones";
import { BandeauMatieres } from "@/components/vitrine/bandeau-matieres";
import { CarteExerciceDemo } from "@/components/vitrine/carte-exercice-demo";
import { ComparaisonMoyenne } from "@/components/vitrine/comparaison-moyenne";
import { EcritureAnimee } from "@/components/vitrine/ecriture-animee";
import { Revelation } from "@/components/vitrine/revelation";

export const metadata: Metadata = {
  title: "Système pédagogique — apprenez par la pratique, sachez où vous en êtes",
  description:
    "Des exercices créés sur vos sujets, une évaluation honnête de ce que vous savez faire, et une prochaine action toujours claire. Pour étudiants et autodidactes.",
  alternates: { canonical: "/" },
};

/*
  Les chiffres de cette page (niveaux, scores, dates) sont fictifs : ce sont
  des démonstrations marketing, pas des lectures de la base. Chaque bloc qui
  en porte l'indique dans son composant.
*/

const CIRCONFERENCE_ANNEAU = 2 * Math.PI * 54;

function cibleAnneau(part: number): string {
  return (CIRCONFERENCE_ANNEAU * (1 - part)).toFixed(2);
}

const MATIERES = [
  {
    nom: "Mathématiques",
    detail: "Dérivées, second degré, démonstrations",
    part: 0.7,
    score: 70,
    activites: [
      { libelle: "Dérivation — composées", date: "hier" },
      { libelle: "Second degré — formes canoniques", date: "il y a 3 j" },
      { libelle: "Tableau de variations", date: "il y a 5 j" },
    ],
  },
  {
    nom: "Espagnol",
    detail: "Subjonctif, temps du passé, compréhension orale",
    part: 0.45,
    score: 45,
    activites: [
      { libelle: "Subjonctif — cinq phrases", date: "hier" },
      { libelle: "Repérer les temps du passé", date: "il y a 2 j" },
    ],
  },
  {
    nom: "Anglais",
    detail: "Tout juste commencé — et c'est normal",
    part: 0.2,
    score: 20,
    activites: [
      { libelle: "Present perfect vs past simple", date: "aujourd'hui" },
    ],
  },
];

const ABSENTS = [
  "Une série de jours consécutifs",
  "Des badges",
  "Un classement",
  "Un plan jour par jour",
  "Des points qui montent parce que vous revenez",
  "Une comparaison avec les autres",
];

const BULLES = [
  { texte: "Je veux réussir mon examen de maths", de: "vous", delai: "0.15s" },
  { texte: "Et progresser à l'oral en espagnol", de: "vous", delai: "0.45s" },
  { texte: "C'est noté. On commence par les dérivées ?", de: "tuteur", delai: "0.75s" },
];

export default async function PageAccueil() {
  const compte = await compteCourant();
  if (compte && !compte.estAnonyme) redirect("/app");

  return (
    <>
      {/* Héros */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-32 size-[28rem] rounded-full bg-primaire-faible opacity-60 blur-3xl"
        />
        <div className="relative mx-auto grid w-full max-w-6xl items-center gap-12 px-4 pb-16 pt-16 sm:px-6 lg:grid-cols-2 lg:pt-20">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-primaire">
              Maths · langues · sciences · à vous de voir
            </p>
            <h1 className="mt-4 font-serif text-4xl font-medium leading-[1.05] tracking-tight text-texte sm:text-5xl lg:text-6xl">
              Ouvrez.
              <br />
              Faites l&apos;exercice qui est là.
              <br />
              <em className="font-normal italic text-primaire">Refermez.</em>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-texte-attenue sm:text-lg">
              Pas de planning, pas de retard à rattraper. Chaque fois que vous
              ouvrez, un exercice vous attend — en maths, en langues, ou sur le
              sujet que vous avez choisi — calibré pour le temps que vous avez
              là, tout de suite.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/login?mode=inscription" className={classesLienBouton("principal")}>
                Créer mon compte
                <IconeFleche className="size-4" />
              </Link>
              <Link href="#boucle" className={classesLienBouton("secondaire")}>
                Voir comment ça marche
              </Link>
            </div>
            <p className="mt-5 font-mono text-xs text-texte-discret">
              Gratuit. <b className="font-medium text-texte-attenue">150 exercices par mois</b> inclus,
              rien à installer. Vos résultats ne sont partagés avec personne.
            </p>
          </div>

          <CarteExerciceDemo />
        </div>
      </section>

      <BandeauMatieres />

      {/* Le geste quotidien */}
      <section id="boucle" aria-labelledby="titre-boucle" className="border-y border-bordure bg-surface">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-primaire">Le geste quotidien</p>
            <h2 id="titre-boucle" className="mt-3 font-serif text-2xl font-medium tracking-tight text-texte sm:text-3xl">
              Trois temps, et rien à planifier
            </h2>
            <p className="mt-4 text-base leading-relaxed text-texte-attenue">
              Dix minutes et un sujet suffisent. Tout le reste se construit à
              partir de ce que vous faites.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-3">
            <Revelation className="rounded-carte border border-bordure bg-fond p-6 transition-shadow hover:shadow-levee">
              <div className="mb-5 flex h-28 items-center justify-center rounded-lg border border-bordure bg-surface">
                <div className="grid w-4/5 gap-2" aria-hidden>
                  {BULLES.map((bulle) => (
                    <span
                      key={bulle.texte}
                      className={
                        bulle.de === "vous"
                          ? "bulle-demo max-w-[92%] justify-self-end rounded-lg rounded-br-sm bg-primaire px-3 py-1.5 text-xs leading-snug text-primaire-contraste"
                          : "bulle-demo max-w-[92%] justify-self-start rounded-lg rounded-bl-sm border border-bordure bg-surface px-3 py-1.5 text-xs leading-snug text-texte-attenue"
                      }
                      style={{ transitionDelay: bulle.delai }}
                    >
                      {bulle.texte}
                    </span>
                  ))}
                </div>
              </div>
              <p className="font-mono text-[0.6875rem] uppercase tracking-wide text-texte-discret">Étape 1</p>
              <h3 className="mt-1 font-serif text-lg font-medium text-texte">Dites ce que vous visez</h3>
              <p className="mt-2 text-sm leading-relaxed text-texte-attenue">
                Un examen, un chapitre, une langue. Votre sujet est découpé en
                choses précises : « écrire au subjonctif », pas « être bon en
                espagnol ».
              </p>
            </Revelation>

            <Revelation className="rounded-carte border border-bordure bg-fond p-6 transition-shadow hover:shadow-levee">
              <div className="mb-5 flex h-28 items-center justify-center rounded-lg border border-bordure bg-surface">
                <EcritureAnimee />
              </div>
              <p className="font-mono text-[0.6875rem] uppercase tracking-wide text-texte-discret">Étape 2</p>
              <h3 className="mt-1 font-serif text-lg font-medium text-texte">Faites l&apos;exercice du moment</h3>
              <p className="mt-2 text-sm leading-relaxed text-texte-attenue">
                À votre niveau, dans votre temps, sur votre sujet. Terminez-le
                ou laissez-le : seul un exercice terminé dit quelque chose de
                vous.
              </p>
            </Revelation>

            <Revelation className="rounded-carte border border-bordure bg-fond p-6 transition-shadow hover:shadow-levee">
              <div className="mb-5 flex h-28 items-center justify-center rounded-lg border border-bordure bg-surface">
                <div className="grid w-3/4 gap-3" aria-hidden>
                  {[
                    { largeur: 0.86, delai: "0.2s" },
                    { largeur: 0.62, delai: "0.4s" },
                    { largeur: 0.4, delai: "0.6s" },
                  ].map((barre) => (
                    <div key={barre.delai} className="grid grid-cols-[3rem_1fr] items-center gap-2">
                      <span className="text-right font-mono text-[0.625rem] text-texte-discret">
                        {Math.round(barre.largeur * 100)} %
                      </span>
                      <span className="h-2 overflow-hidden rounded-sm border border-bordure bg-surface-3">
                        <span
                          className="barre-demo block h-full bg-primaire"
                          style={{ "--largeur": barre.largeur, transitionDelay: barre.delai } as React.CSSProperties}
                        />
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <p className="font-mono text-[0.6875rem] uppercase tracking-wide text-texte-discret">Étape 3</p>
              <h3 className="mt-1 font-serif text-lg font-medium text-texte">Voyez où vous en êtes</h3>
              <p className="mt-2 text-sm leading-relaxed text-texte-attenue">
                Ce que vous venez de faire rejoint votre historique, avec sa
                date. Votre niveau bouge à partir de ça — et de rien d&apos;autre.
              </p>
            </Revelation>
          </div>
        </div>
      </section>

      {/* La fin des moyennes qui punissent */}
      <section id="mesure" aria-labelledby="titre-mesure">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-widest text-primaire">
              La fin des moyennes qui punissent
            </p>
            <h2 id="titre-mesure" className="mt-3 font-serif text-2xl font-medium tracking-tight text-texte sm:text-3xl">
              Apprendre quelque chose de nouveau ne devrait jamais faire baisser
              votre moyenne
            </h2>
            <p className="mt-4 text-base leading-relaxed text-texte-attenue">
              Vous connaissez le piège : dès que vous ajoutez un chapitre au
              programme, votre moyenne plonge — comme si vouloir apprendre était
              une faute. Ici, votre niveau ne mesure que vos réussites. Jamais
              ce que vous n&apos;avez pas encore eu le temps d&apos;aborder.
            </p>
          </div>

          <ComparaisonMoyenne />
        </div>
      </section>

      {/* Tableau de bord par matière */}
      <section id="matieres" aria-labelledby="titre-matieres" className="border-y border-bordure bg-surface">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-primaire">Votre tableau de bord</p>
            <h2 id="titre-matieres" className="mt-3 font-serif text-2xl font-medium tracking-tight text-texte sm:text-3xl">
              Chaque matière, en un coup d&apos;œil
            </h2>
            <p className="mt-4 text-base leading-relaxed text-texte-attenue">
              Pas de note mystère : chaque progression repose sur des exercices
              datés, et seulement sur eux.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-3">
            {MATIERES.map((matiere) => (
              <Revelation
                key={matiere.nom}
                className="rounded-carte border border-bordure bg-fond p-6 text-center transition-shadow hover:shadow-levee"
              >
                <div className="relative mx-auto size-32">
                  <svg viewBox="0 0 132 132" className="size-32 -rotate-90" aria-hidden>
                    <circle cx="66" cy="66" r="54" fill="none" stroke="var(--surface-3)" strokeWidth="9" />
                    <circle
                      className="anneau-valeur"
                      cx="66"
                      cy="66"
                      r="54"
                      fill="none"
                      stroke="var(--primaire)"
                      strokeWidth="9"
                      strokeLinecap="round"
                      strokeDasharray={CIRCONFERENCE_ANNEAU.toFixed(2)}
                      strokeDashoffset={CIRCONFERENCE_ANNEAU.toFixed(2)}
                      style={{ "--anneau-cible": cibleAnneau(matiere.part) } as React.CSSProperties}
                    />
                  </svg>
                  <div className="absolute inset-0 grid place-items-center">
                    <div>
                      <p className="chiffres font-serif text-3xl tracking-tight text-texte">{matiere.score}</p>
                      <p className="font-mono text-[0.625rem] uppercase tracking-wide text-texte-discret">/ 100</p>
                    </div>
                  </div>
                </div>
                <h3 className="mt-4 font-serif text-lg font-medium text-texte">{matiere.nom}</h3>
                <p className="mt-1 text-[0.8125rem] text-texte-attenue">{matiere.detail}</p>
                <ul className="mt-4 grid gap-1.5 text-left">
                  {matiere.activites.map((activite) => (
                    <li key={activite.libelle} className="flex items-center gap-2 text-xs text-texte-attenue">
                      <IconeValide className="size-3.5 shrink-0 text-primaire" />
                      <span className="min-w-0 truncate">{activite.libelle}</span>
                      <span className="chiffres ml-auto shrink-0 font-mono text-[0.625rem] text-texte-discret">
                        {activite.date}
                      </span>
                    </li>
                  ))}
                  {matiere.nom === "Anglais" && (
                    <li className="flex items-center gap-2 text-xs text-texte-discret">
                      <IconeAmpoule className="size-3.5 shrink-0" />
                      Pas encore assez d&apos;exercices pour conclure
                    </li>
                  )}
                </ul>
              </Revelation>
            ))}
          </div>
        </div>
      </section>

      {/* Absents volontairement */}
      <section aria-labelledby="titre-absents">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-primaire">Absents volontairement</p>
            <h2 id="titre-absents" className="mt-3 font-serif text-2xl font-medium tracking-tight text-texte sm:text-3xl">
              Ce que vous ne trouverez pas ici
            </h2>
          </div>

          <Revelation className="mx-auto mt-8 flex max-w-3xl flex-wrap justify-center gap-2.5">
            {ABSENTS.map((absent) => (
              <span
                key={absent}
                className="rature rounded-full border border-bordure bg-surface px-4 py-1.5 font-serif text-lg text-texte-discret"
              >
                {absent}
              </span>
            ))}
          </Revelation>

          <blockquote className="mx-auto mt-9 max-w-2xl border-l-2 border-primaire pl-5 text-left">
            <p className="font-serif text-lg leading-relaxed text-texte sm:text-xl">
              Ils récompensaient le fait de revenir, pas le fait de progresser.
              Un chiffre bas après trois jours de travail sérieux, c&apos;est une
              information utile — pas quelque chose à masquer derrière une
              animation.
            </p>
          </blockquote>
        </div>
      </section>

      {/* Deux publics */}
      <section aria-labelledby="titre-publics" className="border-y border-bordure bg-surface">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-primaire">Deux façons d&apos;arriver ici</p>
            <h2 id="titre-publics" className="mt-3 font-serif text-2xl font-medium tracking-tight text-texte sm:text-3xl">
              Vous apprenez seul, ou presque
            </h2>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2">
            <Link href="/etudiants" className="group block">
              <section className="h-full rounded-carte border border-bordure bg-fond p-6 transition-all hover:-translate-y-0.5 hover:border-bordure-forte hover:shadow-levee">
                <span className="flex size-11 items-center justify-center rounded-lg bg-primaire-faible text-primaire">
                  <IconeLivre className="size-5" />
                </span>
                <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-texte-discret">
                  Vous êtes étudiant
                </p>
                <h3 className="mt-1 font-serif text-xl font-medium text-texte">
                  Savoir quel chapitre fait illusion
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-texte-attenue">
                  Trois semaines avant l&apos;examen, la vraie question n&apos;est
                  pas « est-ce que j&apos;ai tout relu » mais « qu&apos;est-ce que
                  je sais faire sans regarder ». Une fiche relue quatre fois ne
                  répond pas à ça. Un exercice, oui.
                </p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primaire">
                  Ce que ça change pour vos révisions
                  <IconeFleche className="size-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </section>
            </Link>

            <Link href="/autodidactes" className="group block">
              <section className="h-full rounded-carte border border-bordure bg-fond p-6 transition-all hover:-translate-y-0.5 hover:border-bordure-forte hover:shadow-levee">
                <span className="flex size-11 items-center justify-center rounded-lg bg-primaire-faible text-primaire">
                  <IconeRecherche className="size-5" />
                </span>
                <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-texte-discret">
                  Vous apprenez seul
                </p>
                <h3 className="mt-1 font-serif text-xl font-medium text-texte">Sortir de la pile de tutos</h3>
                <p className="mt-3 text-sm leading-relaxed text-texte-attenue">
                  Au quinzième tuto, impossible de dire ce qui est acquis et ce
                  qui a seulement été regardé. Ici, ce que vous savez faire se
                  mesure à ce que vous faites — maths, langues, ou n&apos;importe
                  quel sujet que vous choisissez.
                </p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primaire">
                  Apprendre sans avancer à l&apos;aveugle
                  <IconeFleche className="size-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </section>
            </Link>
          </div>
        </div>
      </section>

      {/* Appel final */}
      <section id="inscription" className="relative overflow-hidden text-center">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-0 -z-10 h-full w-full max-w-4xl -translate-x-1/2"
          style={{ background: "radial-gradient(ellipse 70% 90% at 50% 0%, var(--primaire-faible), transparent 70%)" }}
        />
        <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
          <h2 className="mx-auto max-w-2xl font-serif text-3xl font-medium tracking-tight text-texte sm:text-4xl">
            Votre premier exercice n&apos;attend qu&apos;un sujet
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-texte-attenue">
            Dites ce que vous voulez savoir faire, faites un premier exercice,
            et regardez votre niveau prendre forme. Ce sera peu, la première
            fois. Ce sera vrai.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/login?mode=inscription" className={classesLienBouton("principal")}>
              Créer mon compte
              <IconeFleche className="size-4" />
            </Link>
            <Link href="/methode" className={classesLienBouton("secondaire")}>
              Lire la méthode
            </Link>
          </div>
          <p className="mt-5 font-mono text-xs text-texte-discret">
            Gratuit · sans engagement · vos résultats restent les vôtres
          </p>
        </div>
      </section>
    </>
  );
}
