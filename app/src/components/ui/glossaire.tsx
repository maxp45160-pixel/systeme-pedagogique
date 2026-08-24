import { Depliant } from "@/components/ui/explication";

/**
 * Le vocabulaire du modèle, défini une fois (audit §1.5).
 *
 * « Preuve », « Observation », « robustesse », « autonomie A0–A4 »,
 * « confiance », « dimension »
 * sont le cœur du produit et n'étaient expliqués **nulle part**.
 * Les panneaux d'explication justifient les *calculs* — d'où vient ce 2,7 —
 * mais jamais les *termes*. Un nouvel arrivant lisait « robustesse 0,42 » sans
 * avoir de quoi savoir si c'est bien.
 *
 * Le vocabulaire de structure — référentiel, compétence, séance, tuteur — l'a
 * rejoint le 24/08/2026 : `/aide` en tenait sa propre liste, qui définissait
 * « Observation » une seconde fois, en d'autres mots. Deux glossaires qui ne se
 * recouvrent qu'à un terme ne valent pas mieux qu'aucun.
 *
 * Replié par défaut : c'est un rappel pour qui en a besoin, pas un cours à
 * traverser à chaque visite. Et volontairement court — un glossaire qu'on ne
 * finit pas de lire ne sert personne.
 */

const ENTREES: { terme: string; definition: string }[] = [
  {
    terme: "Carte d'apprentissage",
    definition:
      "L’ensemble de vos sujets et des savoir-faire qu’ils contiennent. Elle vous appartient : vous l’étendez, la corrigez et la réduisez à tout moment depuis Mes cours.",
  },
  {
    terme: "Compétence",
    definition:
      "Un savoir-faire observable, porté par un code (ex. LOG-01). Elle ne stocke aucune note : son niveau est recalculé depuis vos observations à chaque affichage.",
  },
  {
    terme: "Séance",
    definition:
      "Un épisode de travail cadré dans le temps, contenant un ou plusieurs exercices. Une seule séance est active à la fois.",
  },
  {
    terme: "Tuteur IA",
    definition:
      "Le moteur qui rédige vos exercices, vos corrections et vos explications. Il produit du contenu — jamais une mesure sur vous, jamais un code de compétence qu’il aurait inventé.",
  },
  {
    terme: "Preuve",
    definition:
      "La trace durable et vérifiable d’une activité : votre réponse, votre production ou la version figée qui la conserve. Elle précède toute mesure.",
  },
  {
    terme: "Résultat observé",
    definition:
      "Ce que votre réponse permet réellement de constater : réussite, aide utilisée et qualité du raisonnement. Vos repères sont recalculés à partir de ces résultats.",
  },
  {
    terme: "Niveau (0 à 5)",
    definition:
      "Ce que les observations permettent d'affirmer, pas ce que vous pensez savoir. Il ne monte que si les observations le justifient : une réussite isolée ne dépasse jamais le niveau 2.",
  },
  {
    terme: "Dimension",
    definition:
      "Les cinq façons dont une compétence se manifeste : comprendre, appliquer, transférer à un contexte neuf, intégrer à d'autres compétences, justifier ses choix. Un même niveau peut cacher des dimensions très inégales.",
  },
  {
    terme: "Autonomie (A0 à A4)",
    definition:
      "Avec quelle aide vous y êtes arrivé — A0 solution fournie, A1 fortement guidé, A2 quelques indices, A3 en autonomie, A4 avec initiative méthodologique. Elle est déduite des indices consultés et de l'aide extérieure déclarée, jamais choisie.",
  },
  {
    terme: "Bilan à confirmer ou solide",
    definition:
      "À quel point le niveau affiché est bien étayé. « À confirmer » ne veut pas dire faible : cela signifie simplement qu’il faut encore vous voir réussir.",
  },
  {
    terme: "Ancrage",
    definition:
      "La solidité de l'acquis dans le temps : plusieurs réussites, dans plusieurs contextes, espacées dans le temps. Refaire trois fois le même exercice le même jour ne suffit pas.",
  },
  {
    terme: "—",
    definition:
      "Un tiret n'est pas un zéro. Il veut dire « pas encore mesuré ». Le système refuse d'afficher un chiffre là où il n'a rien observé.",
  },
];

export function Glossaire({
  resume = "Comprendre mes repères",
}: {
  resume?: string;
}) {
  return (
    <Depliant resume={resume}>
      <dl className="space-y-2.5">
        {ENTREES.map((e) => (
          <div key={e.terme}>
            <dt className="text-xs font-medium">{e.terme}</dt>
            <dd className="mt-0.5 text-xs text-texte-attenue">{e.definition}</dd>
          </div>
        ))}
      </dl>
    </Depliant>
  );
}
