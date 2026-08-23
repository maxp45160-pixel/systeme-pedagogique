import type { Metadata } from "next";
import Link from "next/link";
import { Carte, classesLienBouton } from "@/components/ui/primitives";
import { IconeFleche } from "@/components/ui/icones";

export const metadata: Metadata = {
  title: "La méthode — apprendre par la pratique et mesurer ce qui reste",
  description:
    "Pourquoi la pratique vaut mieux que la relecture, comment une compétence se démontre plutôt qu'elle ne se déclare, et ce que le système peut honnêtement affirmer de votre niveau.",
  alternates: { canonical: "/methode" },
};

export default function PageMethode() {
  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-primaire">La méthode</p>
      <h1 className="mt-3 font-serif text-3xl font-medium tracking-tight text-texte sm:text-4xl">
        Apprendre par la pratique, et n&apos;affirmer que ce qui est démontré
      </h1>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-texte-attenue sm:text-base">
        <p>
          Relire ses notes donne l&apos;impression de progresser. C&apos;est
          bien documenté : la relecture crée une familiarité avec le texte, et
          cette familiarité se confond avec la maîtrise. Le jour de
          l&apos;examen — ou du projet réel — la différence apparaît : on
          reconnaît, mais on ne sait pas faire.
        </p>
        <p>
          La pratique inverse le rapport. Se confronter à un exercice sans
          regarder la réponse d&apos;abord, c&apos;est demander à sa mémoire
          quelque chose de difficile — et c&apos;est exactement cet effort qui
          fixe les connaissances durablement. C&apos;est le principe du
          « test effect », l&apos;un des résultats les plus solides de la
          recherche en sciences cognitives : récupérer l&apos;information
          apprend mieux que la revoir.
        </p>

        <h2 className="pt-4 font-serif text-xl font-medium text-texte sm:text-2xl">
          Une compétence se démontre, elle ne se déclare pas
        </h2>
        <p>
          La plupart des outils vous demandent d&apos;évaluer vous-même votre
          niveau, ou comptent vos sessions. Les deux mesurent autre chose que
          vos acquis : votre confiance, ou votre assiduité. Ici, une compétence
          n&apos;atteint un niveau que lorsqu&apos;un exercice l&apos;a mis à
          l&apos;épreuve. Ce que vous n&apos;avez pas encore travaillé reste
          explicitement ouvert — affiché comme tel, jamais transformé en zéro.
        </p>
        <p>
          Cette règle a une conséquence importante : votre niveau baisse aussi
          honnêtement qu&apos;il monte. Un acquis non entretenu est signalé
          comme à retravailler au lieu de disparaître silencieusement du suivi.
          Six mois plus tard, vous savez toujours ce que vous savez — et ce qui
          mérite une nouvelle démonstration.
        </p>

        <h2 className="pt-4 font-serif text-xl font-medium text-texte sm:text-2xl">
          La boucle, concrètement
        </h2>
        <ol className="list-decimal space-y-3 pl-5">
          <li>
            Vous déclarez un sujet et le système propose un découpage en
            compétences — que vous gardez le pouvoir de renommer, ranger ou
            retirer.
          </li>
          <li>
            À chaque session, vous indiquez le temps dont vous disposez ; le
            système choisit la prochaine action la plus utile maintenant, et
            explique pourquoi celle-là.
          </li>
          <li>
            L&apos;exercice produit une trace mesurable. Les suivantes
            s&apos;ajustent : ce qui est acquis passe au second plan, ce qui
            résiste revient.
          </li>
        </ol>

        <h2 className="pt-4 font-serif text-xl font-medium text-texte sm:text-2xl">
          L&apos;honnêteté comme fonctionnalité
        </h2>
        <p>
          Le système refuse d&apos;affirmer ce qu&apos;il ne peut pas prouver.
          Si vous n&apos;avez rien montré sur une compétence, il n&apos;affiche
          rien — pas une estimation, pas une note de départ. Vos données sont
          privées par construction : elles ne servent qu&apos;à votre propre
          suivi et ne sortent jamais de votre compte.
        </p>
      </div>

      <Carte accent className="mt-12 p-6 text-center">
        <h2 className="font-serif text-lg font-medium text-texte">
          Essayez sur votre propre sujet
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-texte-attenue">
          Gratuit et privé. Déclarez ce que vous voulez apprendre, faites un
          premier exercice, regardez ce que le système peut déjà affirmer.
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
      </Carte>
    </article>
  );
}
