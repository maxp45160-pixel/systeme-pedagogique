/**
 * Proposition de thème du tuteur → thème enregistrable.
 *
 * `PropositionTheme` (`outils.ts`) porte déjà des chaînes propres — la
 * validation d'outil (`validerTheme`) a fait le gros du travail : codes
 * désignés uniquement (jamais frappés), libellé et justification non vides.
 * Ce qui reste à cette couche, c'est la seule chose qu'une validation de forme
 * ne peut pas trancher : les **bornes métier** (longueur du libellé, nombre de
 * compétences), portées par `motifRefusTheme` — la même fonction que l'écran
 * de création manuelle. Calque `conversion-exercice.ts` : une valeur hors
 * bornes fait échouer la conversion, elle n'est jamais tronquée ou complétée.
 *
 * ⚠️ Un thème dont `codes` est vide n'est PAS une erreur de conversion — c'est
 * le refus demandé (« aucune compétence active ne correspond »), et il ne
 * passe jamais par ce module : l'appelant le détecte avant d'appeler
 * `convertirTheme` et affiche le renvoi vers la création de branche.
 *
 * Module **pur** : aucune entrée/sortie, aucun accès base.
 */

import { motifRefusTheme, type NouveauTheme } from "@/lib/domain/theme";
import type { PropositionTheme } from "./outils";
import type { Conversion } from "./conversion-exercice";

export function convertirTheme(p: PropositionTheme): Conversion<NouveauTheme> {
  const candidat: NouveauTheme = {
    libelle: p.libelle.trim(),
    codes: [...new Set(p.codes.map((c) => c.trim()).filter(Boolean))],
    origine: "tuteur",
  };

  const refus = motifRefusTheme(candidat);
  if (refus) return { ok: false, erreurs: [refus] };

  return { ok: true, valeur: candidat };
}
