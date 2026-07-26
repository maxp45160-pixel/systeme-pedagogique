import { PageAVenir } from "@/components/layout/page-a-venir";

export default function PageConnaissances() {
  return (
    <PageAVenir
      titre="Connaissances"
      sousTitre="Les notions consolidées : définitions, méthodes, résultats utiles, rattachés au référentiel."
      raisonAttente="Cette section est la base documentaire personnelle du système. Elle vient en dernier parce qu'elle se remplit naturellement à partir du travail : les notes utiles émergent des exercices résolus et des erreurs corrigées, pas d'une saisie initiale à blanc."
      fonctionsPrevues={[
        "Fiches de connaissance rattachées à une ou plusieurs compétences du référentiel.",
        "Distinction explicite entre une connaissance notée et une compétence démontrée — la première n'implique jamais la seconde.",
        "Alimentation automatique depuis les corrections d'exercices et les erreurs consolidées.",
        "Recherche par concept, par domaine et par compétence.",
      ]}
      entreTemps={{
        texte:
          "En attendant, les corrections d'exercices et le registre des erreurs jouent ce rôle : ce sont eux qui conservent les méthodes et les points de vigilance.",
        href: "/erreurs",
        libelle: "Voir les erreurs suivies",
      }}
    />
  );
}
