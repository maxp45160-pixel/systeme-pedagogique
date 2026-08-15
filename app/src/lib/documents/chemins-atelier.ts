import type { CategorieDocument, DefinitionTypeDocument } from "./types-documents";

export interface MetadonneesCheminAtelier {
  categorie: CategorieDocument;
  dossierParDefaut: string;
  /** Libellé du type, qui devient le sous-dossier de branche d'une note. */
  libelle?: string;
  frontMatter: Record<string, unknown>;
}

/**
 * Résout une seule fois les chemins documentaires affichés par l'Atelier.
 * Une preuve documentaire n'a qu'un chemin canonique : `Transversal/Preuves`.
 */
export function resoudreCheminsDocumentAtelier(
  metadonnees: MetadonneesCheminAtelier,
): { dossier: string; dossiersSecondaires: string[] } {
  const role = metadonnees.frontMatter.role;
  /*
   * Une note opérationnelle n'a plus de catégorie intermédiaire.
   *
   * « Notes opérationnelles » ajoutait un palier qui ne disait rien : on
   * cherchait un projet, on trouvait d'abord une catégorie qui parle du rôle du
   * document plutôt que de ce qu'il est. Le libellé du type devient donc la
   * branche directe — `Transversal/Projets`, `Transversal/Séances`.
   */
  const categorieTransversale = role === "operationnel"
    ? ""
    : role === "support"
      ? "Notes de support"
      : metadonnees.categorie === "preuve"
        ? "Preuves"
        : "Documents";
  const transversal = categorieTransversale
    ? `Transversal/${categorieTransversale}`
    : "Transversal";
  if (metadonnees.categorie === "preuve") return { dossier: transversal, dossiersSecondaires: [] };

  /*
   * Un rôle déclaré l'emporte sur le dossier par défaut du type.
   *
   * Sans cette priorité, une note opérationnelle de type « Projet » suivait le
   * repli ci-dessous et atterrissait dans `Transversal/Preuves/Projets` : rangée
   * parmi les preuves alors qu'elle n'en est pas une — une note opérationnelle
   * ne le devient qu'après une évaluation validée (ADR-064). Le rôle est aussi
   * ce qui rassemble les branches : sans lui, séances, projets et
   * expérimentations partaient chacun dans un dossier différent.
   *
   * Le libellé du type donne la sous-catégorie, pour que chaque branche reste
   * distincte à l'intérieur de sa racine.
   */
  if (role === "operationnel" || role === "support") {
    const branche = metadonnees.libelle?.trim();
    if (!branche) return { dossier: transversal || "Transversal", dossiersSecondaires: [] };
    // Un type au pluriel se lit mieux comme dossier : « Projets », pas « Projet ».
    const dossierBranche = branche.endsWith("s") ? branche : `${branche}s`;
    return {
      dossier: transversal ? `${transversal}/${dossierBranche}` : `Transversal/${dossierBranche}`,
      dossiersSecondaires: [],
    };
  }

  const dossier = metadonnees.dossierParDefaut || "Documents";
  // Les productions historiquement rangées sous `Preuves/…` (projets,
  // études de cas) sont elles aussi des traces documentaires : une seule
  // racine canonique sous Transversal, sans doublon à la racine.
  if (dossier === "Preuves" || dossier.startsWith("Preuves/")) {
    return { dossier: `Transversal/${dossier}`, dossiersSecondaires: [] };
  }
  return { dossier, dossiersSecondaires: dossier === transversal ? [] : [transversal] };
}

export function cheminsDepuisDefinition(
  definition: DefinitionTypeDocument | null,
  frontMatter: Record<string, unknown>,
): { dossier: string; dossiersSecondaires: string[] } {
  return resoudreCheminsDocumentAtelier({
    categorie: definition?.categorie ?? "connaissance",
    dossierParDefaut: definition?.dossierParDefaut ?? "Documents",
    libelle: definition?.libelle,
    frontMatter,
  });
}
