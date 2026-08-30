import type { ApercuDocument } from "./types-documents";

export interface DocumentAssocieCours {
  id: string;
  titre: string;
  type: string;
  raison: "même domaine" | "compétence commune";
}

function valeurTexte(valeur: unknown): string | undefined {
  return typeof valeur === "string" && valeur.trim() ? valeur.trim() : undefined;
}

function domaineDuDocument(document: ApercuDocument): string | undefined {
  return valeurTexte(document.frontMatter.domaine ?? document.frontMatter.domain);
}

function support(document: ApercuDocument): boolean {
  return document.frontMatter.archive !== true
    && document.frontMatter.role === "support"
    && !["preuve", "exercice", "seance"].includes(document.type);
}

/**
 * Documents lisibles depuis la fiche d'un cours.
 *
 * Le lien est une projection : un même domaine déclaré ou une compétence
 * explicitement citée suffit, mais aucune relation n'est écrite et aucun
 * document n'est deviné à partir de son contenu non chargé.
 */
export function documentsAssociesAuCours(
  cours: ApercuDocument,
  documents: readonly ApercuDocument[],
): DocumentAssocieCours[] {
  const domaineCours = domaineDuDocument(cours);
  const competencesCours = new Set(cours.liens.map((lien) => lien.cible));

  return documents
    .filter((document) => document.id !== cours.id && support(document))
    .map((document) => {
      const memeDomaine = domaineCours !== undefined && domaineDuDocument(document) === domaineCours;
      const competenceCommune = document.liens.some((lien) => competencesCours.has(lien.cible));
      if (!memeDomaine && !competenceCommune) return null;
      return {
        id: document.id,
        titre: document.titre || document.id,
        type: document.type,
        raison: memeDomaine ? "même domaine" : "compétence commune",
      } satisfies DocumentAssocieCours;
    })
    .filter((document): document is DocumentAssocieCours => document !== null)
    .sort((a, b) => a.titre.localeCompare(b.titre, "fr") || a.id.localeCompare(b.id));
}
