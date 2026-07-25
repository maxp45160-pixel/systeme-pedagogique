import { PageAVenir } from "@/components/layout/page-a-venir";

export default function PageLectures() {
  return (
    <PageAVenir
      titre="Lectures"
      sousTitre="La bibliothèque, et surtout ce que la lecture est devenue une fois mise en pratique."
      raisonAttente="Le modèle de données existe (titre, auteur, domaine, statut, progression, concepts, notes, exercices générés). L'interface reste à construire. Elle est volontairement après les exercices : une lecture ne devient une compétence qu'en passant par la pratique, et c'est cette pratique que le système doit savoir enregistrer d'abord."
      fonctionsPrevues={[
        "Cinq statuts : à lire, en cours, lu, exploité, maîtrisé par la pratique — les deux derniers exigent des preuves, pas une déclaration.",
        "Rattachement des concepts d'une lecture aux compétences du référentiel.",
        "Génération d'exercices à partir d'un concept lu, pour transformer la lecture en preuve.",
        "Un niveau de compréhension auto-déclaré, affiché comme tel et jamais compté comme preuve (instructions §12).",
      ]}
      entreTemps={{
        texte:
          "En attendant, demande au tuteur de transformer un concept lu en exercice : c'est cette conversion qui produit une preuve exploitable.",
        href: "/tuteur",
        libelle: "Ouvrir le tuteur",
      }}
    />
  );
}
