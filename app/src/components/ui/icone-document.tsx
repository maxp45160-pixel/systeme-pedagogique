/**
 * Frontière entre le registre documentaire et React.
 *
 * `TYPES_DOCUMENTS` déclare un `NomIcone` — une chaîne, pas un composant —
 * pour que `lib/` reste sans JSX. C'est le seul endroit qui traduit ce nom en
 * tracé. Ajouter un type documentaire ne demande donc pas de dessiner : il
 * suffit de réutiliser un nom déjà présent dans la table ci-dessous.
 *
 * La forme porte le type, la couleur porte le domaine. L'icône est toujours
 * `aria-hidden` : le libellé texte reste la seule source accessible.
 */

import { definitionTypeDocument, type NomIcone } from "@/lib/documents/types-documents";
import {
  IconeAmpoule,
  IconeArticle,
  IconeCompetences,
  IconeCours,
  IconeDocuments,
  IconeDomaine,
  IconeDossier,
  IconeEtudeDeCas,
  IconeExercices,
  IconeExperimentation,
  IconeFormule,
  IconeLivre,
  IconeNote,
  IconePreuve,
  IconeProjet,
  IconeRedaction,
  IconeReference,
  IconeSchema,
} from "./icones";

type ComposantIcone = (props: { className?: string }) => React.ReactElement;

const COMPOSANTS: Record<NomIcone, ComposantIcone> = {
  document: IconeDocuments,
  dossier: IconeDossier,
  domaine: IconeDomaine,
  competence: IconeCompetences,
  note: IconeNote,
  reference: IconeReference,
  article: IconeArticle,
  cours: IconeCours,
  livre: IconeLivre,
  formule: IconeFormule,
  reflexion: IconeAmpoule,
  exercice: IconeExercices,
  projet: IconeProjet,
  "etude-de-cas": IconeEtudeDeCas,
  redaction: IconeRedaction,
  schema: IconeSchema,
  experimentation: IconeExperimentation,
  preuve: IconePreuve,
};

/** Un type inconnu reste affichable : il retombe sur la feuille générique. */
export function nomIconeDuType(type: string): NomIcone {
  return definitionTypeDocument(type)?.icone ?? "document";
}

export function IconeDocument({
  type,
  couleur,
  className,
}: {
  type: string;
  /** Teinte du domaine. Absente, l'icône hérite de la couleur du texte. */
  couleur?: string;
  className?: string;
}) {
  const Composant = COMPOSANTS[nomIconeDuType(type)];
  return (
    <span className="inline-flex shrink-0" style={couleur ? { color: couleur } : undefined}>
      <Composant className={className} />
    </span>
  );
}
