import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { compteCourant } from "@/lib/supabase/server";
import { Carte, classesLienBouton } from "@/components/ui/primitives";
import { IconeAmpoule, IconeCle, IconeExercices, IconeFleche } from "@/components/ui/icones";

export const metadata: Metadata = {
  title: "Système pédagogique — apprenez par la pratique, sachez où vous en êtes",
  description:
    "Des exercices créés sur vos sujets, une évaluation honnête de ce que vous savez faire, et une prochaine action toujours claire. Pour étudiants et autodidactes.",
  alternates: { canonical: "/" },
};

const ETAPES = [
  {
    titre: "Déclarez ce que vous voulez apprendre",
    texte:
      "Un sujet, un examen, une compétence professionnelle : le système le découpe en compétences concrètes et vérifiables.",
    icone: IconeAmpoule,
  },
  {
    titre: "Travaillez sur des exercices sur mesure",
    texte:
      "Pas de cours générique à suivre : des exercices écrits pour votre sujet, à votre niveau du moment, dans le temps dont vous disposez.",
    icone: IconeExercices,
  },
  {
    titre: "Voyez ce que vous savez vraiment faire",
    texte:
      "Chaque exercice réalisé laisse une trace mesurable. Votre niveau reflète ce que vous avez démontré — rien d'inventé.",
    icone: IconeCle,
  },
];

const GARANTIES = [
  {
    titre: "Privé par construction",
    texte:
      "Vos résultats n'appartiennent qu'à vous. Personne d'autre ne peut les lire, ils ne sont partagés avec personne.",
  },
  {
    titre: "Pas de note inventée",
    texte:
      "Tant que vous n'avez rien démontré, le système affiche un tiret, pas un zéro. L'absence de preuve n'est pas un échec.",
  },
  {
    titre: "Rien ne se perd",
    texte:
      "Ce que vous avez acquis il y a six mois reste visible. Une faiblesse ne disparaît pas parce qu'elle est oubliée : elle reste suivie jusqu'à nouvelle démonstration.",
  },
];

export default async function PageAccueil() {
  const compte = await compteCourant();
  if (compte && !compte.estAnonyme) redirect("/app");

  return (
    <>
      {/* Héros */}
      <section className="mx-auto w-full max-w-6xl px-4 pb-16 pt-20 text-center sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-primaire">
          Pour étudiants et autodidactes
        </p>
        <h1 className="mx-auto mt-4 max-w-3xl font-serif text-3xl font-medium leading-tight tracking-tight text-texte sm:text-5xl">
          Apprenez par la pratique.
          <br />
          Sachez où vous en êtes vraiment.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-texte-attenue sm:text-lg">
          La plupart des outils mesurent votre assiduité, pas vos acquis. Ici,
          chaque niveau affiché vient d&apos;un exercice que vous avez réellement
          fait — et la prochaine action à faire est toujours claire.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/login" className={classesLienBouton("principal")}>
            Créer mon compte gratuitement
            <IconeFleche className="size-4" />
          </Link>
          <Link href="/methode" className={classesLienBouton("secondaire")}>
            Comprendre la méthode
          </Link>
        </div>
      </section>

      {/* Les trois temps de la boucle */}
      <section aria-labelledby="boucle" className="border-y border-bordure bg-surface">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
          <h2 id="boucle" className="text-center font-serif text-2xl font-medium tracking-tight text-texte">
            Une boucle simple : faire, mesurer, avancer
          </h2>
          <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-3">
            {ETAPES.map((etape, index) => (
              <Carte key={etape.titre} className="p-6">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-primaire-faible text-primaire">
                    <etape.icone className="size-4" />
                  </span>
                  <span className="text-xs font-semibold uppercase tracking-wide text-texte-discret">
                    Étape {index + 1}
                  </span>
                </div>
                <h3 className="mt-4 text-sm font-semibold text-texte">{etape.titre}</h3>
                <p className="mt-2 text-sm leading-relaxed text-texte-attenue">{etape.texte}</p>
              </Carte>
            ))}
          </div>
        </div>
      </section>

      {/* Deux publics */}
      <section aria-labelledby="publics" className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
        <h2 id="publics" className="text-center font-serif text-2xl font-medium tracking-tight text-texte">
          Pensé pour ceux qui apprennent seuls — ou presque
        </h2>
        <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2">
          <Link href="/etudiants" className="group block">
            <Carte interactive className="h-full p-6">
              <h3 className="font-serif text-lg font-medium text-texte">Vous êtes étudiant</h3>
              <p className="mt-2 text-sm leading-relaxed text-texte-attenue">
                Répartir vos révisions, savoir quelle matière est réellement
                acquise et laquelle fait illusion avant l&apos;examen. Vos fiches
                ne disent pas ça ; les exercices, si.
              </p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primaire group-hover:underline">
                Voir ce que ça change pour vos révisions
                <IconeFleche className="size-4" />
              </span>
            </Carte>
          </Link>

          <Link href="/autodidactes" className="group block">
            <Carte interactive className="h-full p-6">
              <h3 className="font-serif text-lg font-medium text-texte">Vous apprenez seul</h3>
              <p className="mt-2 text-sm leading-relaxed text-texte-attenue">
                Tutoriels après tutoriels, difficile de savoir si vous progressez
                vraiment. Ici, ce que vous maîtrisez est mesuré par ce que vous
                produisez, pas par ce que vous avez regardé.
              </p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primaire group-hover:underline">
                Apprendre seul, sans naviguer à l&apos;aveugle
                <IconeFleche className="size-4" />
              </span>
            </Carte>
          </Link>
        </div>
      </section>

      {/* Garanties */}
      <section aria-labelledby="garanties" className="border-y border-bordure bg-surface">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
          <h2 id="garanties" className="text-center font-serif text-2xl font-medium tracking-tight text-texte">
            Ce sur quoi on ne transige pas
          </h2>
          <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-3">
            {GARANTIES.map((garantie) => (
              <div key={garantie.titre} className="rounded-xl border border-bordure bg-fond p-5">
                <h3 className="text-sm font-semibold text-texte">{garantie.titre}</h3>
                <p className="mt-2 text-sm leading-relaxed text-texte-attenue">{garantie.texte}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Appel final */}
      <section className="mx-auto w-full max-w-6xl px-4 py-20 text-center sm:px-6">
        <h2 className="mx-auto max-w-2xl font-serif text-2xl font-medium tracking-tight text-texte sm:text-3xl">
          Votre prochain exercice est déjà prêt
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-texte-attenue sm:text-base">
          Gratuit, privé, et sans engagement. Déclarez un sujet, faites un
          premier exercice, voyez ce que le système peut déjà affirmer sur vous.
        </p>
        <div className="mt-8">
          <Link href="/login" className={classesLienBouton("principal")}>
            Commencer maintenant
            <IconeFleche className="size-4" />
          </Link>
        </div>
      </section>
    </>
  );
}
