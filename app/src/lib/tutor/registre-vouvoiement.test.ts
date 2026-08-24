import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { REGLE_VOUVOIEMENT } from "./prompt";

/**
 * Le registre du texte généré (ADR-119), vérifié sur les fichiers eux-mêmes.
 *
 * ## Pourquoi lire les sources et non appeler les constructeurs
 *
 * Les douze constructeurs de prompt ne partagent ni signature, ni fixtures : les
 * appeler un par un demanderait douze jeux de données à tenir à jour, et un
 * treizième constructeur ajouté demain n'aurait aucune raison d'être ajouté ici.
 * Lire le répertoire attrape le treizième sans qu'on y pense — c'est le seul
 * point de ce test.
 *
 * ## Les deux choses qu'il empêche
 *
 * 1. **Un prompt de rédaction sans consigne de registre.** C'était l'état du
 *    dépôt avant ADR-119 : onze des douze n'en portaient aucune.
 * 2. **Une consigne qui contredit la règle dans le même prompt.** Constaté le
 *    24/08/2026, deux fois, une heure après l'ajout de la règle :
 *    `explication.ts` disait « Tutoie l'apprenant » deux lignes au-dessus
 *    d'elle, et `correction.ts` « Tutoie, et parle de sa réponse à elle ».
 *    Un modèle qui lit les deux suit la plus concrète.
 */

const RACINE = join(__dirname);

/**
 * Les fichiers qui construisent un prompt de rédaction — ceux dont la sortie
 * s'affiche telle quelle. Dérivée du répertoire, pas recopiée : une liste
 * écrite à la main est exactement ce que ce test existe pour ne pas dépendre.
 */
function fichiersDePrompt(): string[] {
  return readdirSync(RACINE)
    .filter((nom) => nom.endsWith(".ts") && !nom.endsWith(".test.ts"))
    .filter((nom) => {
      const source = readFileSync(join(RACINE, nom), "utf8");
      return /export function construirePrompt/.test(source);
    });
}

describe("le registre du texte généré", () => {
  it("recense bien les constructeurs de prompt", () => {
    /*
     * Un garde-fou sur le garde-fou : si un renommage fait tomber la détection
     * à zéro, les deux tests suivants passeraient sur une liste vide.
     */
    expect(fichiersDePrompt().length).toBeGreaterThanOrEqual(10);
  });

  it("impose la règle de vouvoiement dans chaque constructeur de prompt", () => {
    const sans = fichiersDePrompt().filter(
      (nom) => !readFileSync(join(RACINE, nom), "utf8").includes("REGLE_VOUVOIEMENT"),
    );
    expect(sans).toEqual([]);
  });

  it("n'autorise aucune consigne de tutoiement dans un prompt", () => {
    /*
     * Les commentaires sont retirés avant la recherche : ce qui compte est ce
     * que le MODÈLE lit, pas ce qu'un relecteur lit. `relecture-referentiel.ts`
     * explique en commentaire pourquoi le prompt le tutoie tout en vouvoyant la
     * personne — c'est exactement la doctrine, et l'interdire serait interdire
     * de la documenter.
     *
     * La règle elle-même contient « te tutoie » ; elle est retirée aussi,
     * plutôt qu'exclue par une exception nommée qui deviendrait fausse à la
     * première reformulation.
     */
    const coupables = fichiersDePrompt().filter((nom) => {
      const source = readFileSync(join(RACINE, nom), "utf8")
        .replace(REGLE_VOUVOIEMENT, "")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^[ \t]*\/\/.*$/gm, "");
      return /[Tt]utoie/.test(source);
    });
    expect(coupables).toEqual([]);
  });
});
