/**
 * Le lanceur de campagne complète — hors navigateur.
 *
 * La matrice entière (six archétypes × cinq graines × huit bras = 240 parcours)
 * demande deux à trois minutes : c'est hors de portée d'un onglet, qui garderait
 * le fil principal bloqué. Elle tourne donc ici, en ligne de commande :
 *
 * ```bash
 * npm run simulation:campagne
 * ```
 *
 * Le rapport est écrit dans `app/.simulation/`, prêt à être lu par un modèle —
 * même notice, mêmes unités et mêmes réserves que l'export d'un parcours seul.
 *
 * ## Pourquoi un fichier exécuté par Vitest, et pas un script Node
 *
 * Le projet n'embarque ni `tsx` ni `vite-node`, et les modules du moteur
 * utilisent l'alias `@/`. Vitest sait déjà résoudre les deux ; ajouter une
 * dépendance pour lancer un script serait le prix le plus cher pour le plus
 * petit service. Ce fichier n'est PAS un test (`*.run.ts`, hors du `include` de
 * `vitest.config.ts`) : il n'est atteint que par `vitest.campagne.config.ts`.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { test } from "vitest";
import { deroulerCampagne, planComplet, planRapide } from "./campagne";
import { ecrireRapportCampagne } from "./export";

const SORTIE = resolve(process.cwd(), ".simulation");

test("campagne", () => {
  const complet = process.env.CAMPAGNE !== "rapide";
  const plan = complet ? planComplet() : planRapide();

  console.log(
    `Campagne ${complet ? "complète" : "rapide"} : ${plan.runs.length} parcours ` +
      `(${plan.archetypes.length} archétypes × ${plan.graines.length} graines × ${plan.bras.length} bras).`,
  );

  let dernierPourcent = -1;
  const rapport = deroulerCampagne(plan, (fait, total) => {
    const pourcent = Math.floor((fait / total) * 100);
    if (pourcent >= dernierPourcent + 10) {
      dernierPourcent = pourcent;
      console.log(`  ${pourcent} % — ${fait}/${total}`);
    }
  });

  const chemin = resolve(SORTIE, `campagne-${plan.runs.length}-parcours.json`);
  mkdirSync(dirname(chemin), { recursive: true });
  writeFileSync(chemin, ecrireRapportCampagne(rapport), "utf8");

  console.log(`\nRapport écrit : ${chemin}`);
  for (const mesure of rapport.mesures.filter((m) => m.externe)) {
    const moteur = mesure.moteur;
    const temoin = mesure.meilleurTemoin;
    console.log(
      `  ${mesure.libelle} : moteur ${moteur?.mediane ?? "—"} ` +
        `[${moteur?.q1 ?? "—"} ; ${moteur?.q3 ?? "—"}] · ` +
        `témoin ${temoin?.libelle ?? "aucun"} ${temoin?.serie?.mediane ?? "—"} → ${mesure.face}`,
    );
  }
  const retenus = rapport.stabilite.filter((s) => s.retenu).map((s) => s.cle);
  console.log(`  Constats retenus (≥ 4 archétypes) : ${retenus.join(", ") || "aucun"}`);
}, 900_000);
