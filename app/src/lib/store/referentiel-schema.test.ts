import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Garde de non-dérive entre `schema.sql` (référence) et la dernière migration
 * qui réécrit la commande de référentiel.
 *
 * Le défaut que cette migration corrige était précisément un défaut de dérive :
 * la lecture du référentiel s'était déplacée vers `competence_domaines`
 * (ADR-107) sans que le chemin transactionnel d'écriture ne pose jamais la
 * moindre ligne dans cette table. Aucun test TS ne pouvait le voir — il vit
 * dans le corps SQL. Ce test ne peut pas exécuter PostgreSQL ; il vérifie
 * l'invariant textuel qui l'exprime : toute version de
 * `appliquer_commande_referentiel` doit insérer dans `competence_domaines`,
 * dans `schema.sql` comme dans sa dernière migration.
 *
 * Si ce test échoue après une réécriture légitime de la RPC, mettez à jour la
 * constante : c'est le signal qu'une source de vérité a bougé et qu'il faut
 * relire l'autre.
 */
const FUNCTION = "public.appliquer_commande_referentiel";
const INSERT_TAG = "INSERT INTO public.competence_domaines";
const MIGRATION = "20260831105740_creer_domaine_continu_depuis_competences_existantes.sql";
const AMENDEMENT = "20260916183000_domaines_organisation_vides.sql";

function corpsFonction(contenu: string): string {
  const debut = contenu.indexOf(`FUNCTION ${FUNCTION}(`);
  expect(debut, `${FUNCTION} introuvable`).toBeGreaterThanOrEqual(0);
  const fin = contenu.indexOf("$$;", debut);
  expect(fin, "corps de fonction non terminé par $$;").toBeGreaterThan(debut);
  return contenu.slice(debut, fin);
}

describe("appliquer_commande_referentiel — la dernière migration reste alignée", () => {
  const racine = join(__dirname, "../../../supabase");

  it("schema.sql insère le tag initial dans competence_domaines", () => {
    const schema = readFileSync(join(racine, "schema.sql"), "utf8");
    expect(corpsFonction(schema)).toContain(INSERT_TAG);
  });

  it("la dernière migration reste alignée sur schema.sql", () => {
    const schema = corpsFonction(
      readFileSync(join(racine, "schema.sql"), "utf8"),
    );
    const precedente = readFileSync(join(racine, "migrations", MIGRATION), "utf8").replace(/\r/g, "");
    const amendement = readFileSync(join(racine, "migrations", AMENDEMENT), "utf8").replace(/\r/g, "");
    const ancienneGarde = amendement.match(/\$ancien\$([\s\S]*?)\$ancien\$/)?.[1];
    const nouvelleGarde = amendement.match(/\$nouveau\$([\s\S]*?)\$nouveau\$/)?.[1];
    expect(ancienneGarde).toBeTruthy();
    expect(nouvelleGarde).toBeTruthy();
    expect(precedente.split(ancienneGarde!)).toHaveLength(2);
    // Reconstitue la RPC après le patch ciblé : le reste du contrat SQL
    // doit toujours coïncider avec le schéma de référence.
    const migration = precedente.replace(ancienneGarde!, nouvelleGarde!);
    expect(corpsFonction(migration)).toContain(INSERT_TAG);

    // Les deux sources décrivent la même fonction : à espacement près, les
    // corps coïncident. Toute divergence est soit une migration oubliée,
    // soit un schema.sql oublié — les deux sont des défauts documentés.
    const normaliser = (texte: string) =>
      texte
        .replace(/--[^\n]*/g, "")
        .replace(/\s+/g, " ")
        .trim();
    expect(normaliser(corpsFonction(migration))).toBe(normaliser(schema));
  });
});
