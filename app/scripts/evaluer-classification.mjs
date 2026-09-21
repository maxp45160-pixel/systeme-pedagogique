/** Node >=22.18 (TypeScript natif). Aucun fournisseur, aucune écriture.
 * node app/scripts/evaluer-classification.mjs corpus.json
 * node app/scripts/evaluer-classification.mjs --exemple | node app/scripts/evaluer-classification.mjs -
 */
import { readFileSync } from "node:fs";
import { evaluerClassification } from "../src/lib/documents/evaluation-classification.ts";

const argument = process.argv[2];
if (argument === "--exemple") {
  console.log(JSON.stringify([{
    id: "exemple-synthetique-non-evalue",
    format: "pdf",
    fonction: "competences",
    reference: {
      origine: "synthetique",
      source: "Gabarit uniquement : remplacer par une référence humaine réelle.",
      couverture: "entiere",
      attendus: [{ id: "competence-attendue", optionnel: false }],
    },
    sortie: {
      source: "Sortie synthétique de gabarit : remplacer par la sortie réelle complète.",
      couverture: "inconnue",
      inventaireComplet: false,
      annotationHumaine: null,
      propositions: [{ id: "proposition-1", jugement: "UNKNOWN", attendusCouverts: [] }],
    },
  }], null, 2));
} else if (!argument || process.argv.length !== 3) {
  console.error("Usage : node app/scripts/evaluer-classification.mjs <corpus.json | - | --exemple>");
  process.exitCode = 1;
} else {
  try {
    const corpus = JSON.parse(readFileSync(argument === "-" ? 0 : argument, "utf8"));
    console.log(JSON.stringify({
      notice: "Calcul descriptif sur annotations humaines déclarées ; aucune validation humaine du produit ni garantie de généralisation. UNKNOWN signifie preuve insuffisante. Aucun seuil numérique sur le contexte/intention.",
      seuil: "Strictement moins de 5 % de propositions incorrectes et, séparément, de compétences obligatoires omises.",
      resultats: evaluerClassification(corpus),
    }, null, 2));
  } catch (erreur) {
    console.error(erreur instanceof Error ? erreur.message : "Corpus invalide.");
    process.exitCode = 1;
  }
}
