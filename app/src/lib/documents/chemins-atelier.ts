import type { CategorieDocument, DefinitionTypeDocument } from "./types-documents";

export interface MetadonneesCheminAtelier {
  categorie: CategorieDocument;
  dossierParDefaut: string;
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
  const categorieTransversale = role === "operationnel"
    ? "Notes opérationnelles"
    : role === "support"
      ? "Notes de support"
      : metadonnees.categorie === "preuve"
        ? "Preuves"
        : "Documents";
  const transversal = `Transversal/${categorieTransversale}`;
  if (metadonnees.categorie === "preuve") return { dossier: transversal, dossiersSecondaires: [] };
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
    frontMatter,
  });
}
