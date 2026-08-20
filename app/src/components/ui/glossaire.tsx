import { Depliant } from "@/components/ui/explication";

/**
 * Le vocabulaire du modèle, défini une fois (audit §1.5).
 *
 * « Preuve », « Observation », « robustesse », « autonomie A0–A4 »,
 * « confiance », « dimension »
 * sont le cœur du produit et n'étaient expliqués **nulle part**.
 * `PanneauExplication` justifie les *calculs* — d'où vient ce 2,7 — mais jamais
 * les *termes*. Un nouvel arrivant lisait « robustesse 0,42 » sans avoir de
 * quoi savoir si c'est bien.
 *
 * Replié par défaut : c'est un rappel pour qui en a besoin, pas un cours à
 * traverser à chaque visite. Et volontairement court — un glossaire qu'on ne
 * finit pas de lire ne sert personne.
 */

const ENTREES: { terme: string; definition: string }[] = [
  {
    terme: "Preuve",
    definition:
      "La trace durable et vérifiable d’une activité : ta réponse, ta production ou le snapshot qui la conserve. Elle précède toute mesure.",
  },
  {
    terme: "Observation",
    definition:
      "Un constat structuré, daté et sourcé tiré d’une preuve : résultat, autonomie, qualité et dimensions observées. Les niveaux et tendances sont recalculés à partir de ces constats.",
  },
  {
    terme: "Niveau (0 à 5)",
    definition:
      "Ce que les observations permettent d'affirmer, pas ce que tu penses savoir. Il ne monte que si les observations le justifient : une réussite isolée ne dépasse jamais le niveau 2.",
  },
  {
    terme: "Dimension",
    definition:
      "Les cinq façons dont une compétence se manifeste : comprendre, appliquer, transférer à un contexte neuf, intégrer à d'autres compétences, justifier ses choix. Un même niveau peut cacher des dimensions très inégales.",
  },
  {
    terme: "Autonomie (A0 à A4)",
    definition:
      "Avec quelle aide tu y es arrivé — A0 solution fournie, A1 fortement guidé, A2 quelques indices, A3 en autonomie, A4 avec initiative méthodologique. Elle est déduite des indices consultés et de l'aide extérieure déclarée, jamais choisie.",
  },
  {
    terme: "Confiance",
    definition:
      "À quel point le niveau affiché est fiable. Elle dépend du nombre d’observations, de leur fraîcheur et de leur cohérence entre elles. Faible ne veut pas dire mauvais : cela veut dire « pas encore assez pour conclure ».",
  },
  {
    terme: "Robustesse (0 à 1)",
    definition:
      "La solidité de l'acquis dans le temps : plusieurs observations, dans plusieurs contextes, étalées sur plusieurs semaines. Réussir trois fois le même exercice le même jour ne la fait pas monter.",
  },
  {
    terme: "—",
    definition:
      "Un tiret n'est pas un zéro. Il veut dire « pas encore mesuré ». Le système refuse d'afficher un chiffre là où il n'a rien observé.",
  },
];

export function Glossaire({
  resume = "Que veulent dire ces mots ?",
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
