import { PageAVenir } from "@/components/layout/page-a-venir";

export default function PageProjets() {
  return (
    <PageAVenir
      titre="Projets"
      sousTitre="Les travaux longs, découpés en étapes, qui mobilisent plusieurs compétences à la fois."
      raisonAttente="Le modèle de données des projets existe déjà (objectif, domaines, compétences mobilisées, huit étapes, livrables, bilan). L'interface de création et de suivi reste à construire : elle vient après les exercices, parce qu'un projet n'a de valeur d'évaluation que si les compétences qu'il mobilise ont d'abord été situées."
      fonctionsPrevues={[
        "Progression en huit étapes : définition du problème, analyse du système, modélisation, méthode, implémentation, expérimentation, analyse, conclusion.",
        "Suivi des compétences mobilisées, avec preuve de niveau fort à la clôture — un projet réussi est la seule preuve qui peut soutenir le niveau 5 (intégration).",
        "Bilan de clôture : compétences mobilisées, compétences développées, erreurs rencontrées, autonomie, transférabilité.",
        "Livrables rattachés et difficultés rencontrées, conservées comme données pédagogiques.",
      ]}
      entreTemps={{
        texte:
          "En attendant, un projet terminé peut être enregistré comme preuve depuis le tuteur, qui proposera une mise à jour structurée à valider.",
        href: "/tuteur",
        libelle: "Ouvrir le tuteur",
      }}
    />
  );
}
