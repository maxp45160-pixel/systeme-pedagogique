/**
 * Extraction des blocs « PROPOSITION DE MISE À JOUR » émis par le tuteur.
 *
 * Le gabarit est fixé côté serveur dans `CONSIGNES_INTERFACE`
 * (`lib/tutor/contexte.ts`). Ce parseur, purement local et testable, permet
 * de transformer une proposition en formulaire pré-rempli — sans jamais
 * donner d'accès en écriture au tuteur : seul l'utilisateur, en validant le
 * formulaire, déclenche l'écriture.
 *
 * Parsing volontairement tolérant : si le modèle dévie du gabarit, un champ
 * manque simplement (chaîne vide) plutôt que de lever une erreur. Le texte
 * brut reste de toute façon lisible dans le chat.
 */

export interface PropositionTuteur {
  competence: string;
  niveauActuel: string;
  niveauPropose: string;
  preuve: string;
  autonomieObservee: string;
  qualitePreuve: string;
  reserve: string;
}

const CHAMPS: { cle: keyof PropositionTuteur; etiquette: string }[] = [
  { cle: "competence", etiquette: "Compétence" },
  { cle: "niveauActuel", etiquette: "Niveau actuel" },
  { cle: "niveauPropose", etiquette: "Niveau proposé" },
  { cle: "preuve", etiquette: "Preuve" },
  { cle: "autonomieObservee", etiquette: "Autonomie observée" },
  { cle: "qualitePreuve", etiquette: "Qualité de la preuve" },
  { cle: "reserve", etiquette: "Réserve" },
];

export function extrairePropositions(texte: string): PropositionTuteur[] {
  const blocs = texte.split(/PROPOSITION DE MISE À JOUR/).slice(1);
  return blocs
    .map((bloc) => {
      const valeurs = {} as PropositionTuteur;
      for (const { cle, etiquette } of CHAMPS) {
        const m = bloc.match(new RegExp(`${etiquette}\\s*:\\s*(.+)`));
        valeurs[cle] = m?.[1]?.trim() ?? "";
      }
      return valeurs;
    })
    .filter((p) => p.competence.length > 0);
}
