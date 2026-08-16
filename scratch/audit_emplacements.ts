import fs from "fs";
import path from "path";
import { analyserTousLesFichiersAst, groupePourChemin, resoudreImportsComposants } from "../app/src/lib/domain/workflow-ast-parser";

async function main() {
  const analyses = await analyserTousLesFichiersAst();
  const composantsPage = resoudreImportsComposants(analyses);

  console.log("=== ANALYSE DES EMPLACEMENTS ET USAGES ===");
  const anomalies: string[] = [];

  for (const [rel, a] of analyses.entries()) {
    if (!rel.startsWith("components/")) continue;
    const groupeActuel = groupePourChemin(rel);

    // Trouver quelles pages importent ce composant
    const pagesQuiImportent: string[] = [];
    for (const [route, comps] of composantsPage.entries()) {
      if (comps.has(rel)) {
        pagesQuiImportent.push(route);
      }
    }

    // Analyser si le groupe du composant correspond aux pages qui l'utilisent
    console.log(`${rel} -> Groupe: [${groupeActuel}] | Pages: [${pagesQuiImportent.join(", ") || "NON MONTE"}]`);

    if (rel.includes("pomodoro") && !pagesQuiImportent.includes("/") && pagesQuiImportent.includes("/seances")) {
      anomalies.push(`POMODORO: ${rel} est dans [${groupeActuel}] mais utilisé dans [${pagesQuiImportent.join(", ")}]`);
    }

    if (rel.startsWith("components/projets/") && groupeActuel !== "atelier") {
      anomalies.push(`PROJETS: ${rel} est dans groupe [${groupeActuel}] au lieu de [atelier]`);
    }

    if (rel.startsWith("components/intention/") && groupeActuel !== "dashboard") {
      anomalies.push(`INTENTION: ${rel} est dans groupe [${groupeActuel}]`);
    }
  }

  console.log("\n=== ANOMALIES DETECTEES ===");
  anomalies.forEach((anom) => console.log("- " + anom));
}

main().catch(console.error);
