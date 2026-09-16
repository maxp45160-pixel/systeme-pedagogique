import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const lire = (chemin: string) => readFileSync(resolve(process.cwd(), "supabase", chemin), "utf8").replace(/\r\n/g, "\n");
const schema = lire("schema.sql");
const migration = lire("migrations/20260916183000_domaines_organisation_vides.sql");
const precedente = lire("migrations/20260831105740_creer_domaine_continu_depuis_competences_existantes.sql");
const ancien = migration.match(/\$ancien\$([\s\S]*?)\$ancien\$/)![1];
const nouveau = migration.match(/\$nouveau\$([\s\S]*?)\$nouveau\$/)![1];

describe("migration des domaines d'organisation vides", () => {
  it("cible exactement la garde de la version précédente et aligne la référence", () => {
    expect(precedente.split(ancien)).toHaveLength(2);
    expect(schema.split(nouveau)).toHaveLength(2);
    expect(schema).not.toContain(ancien);
    expect(nouveau).toContain("AND v_usage_type = 'continu' THEN");
    expect(nouveau).toContain("'rattachementsExistants'");
  });

  it("préserve le contrat module, la signature et les permissions", () => {
    expect(schema).toContain("IF v_usage_type = 'module' AND v_annee_academique IS NULL THEN");
    expect(schema).toContain("IF v_usage_type IS NOT NULL AND v_usage_type NOT IN ('continu', 'module') THEN");
    expect(migration).toContain("public.appliquer_commande_referentiel(text,integer,text,text,jsonb)");
    expect(migration).toContain("pg_get_functiondef(to_regprocedure(v_signature))");
    expect(migration).not.toMatch(/\b(?:GRANT|REVOKE|DROP|CREATE TABLE)\b/);
    expect(migration).toContain("IF v_occurrences <> 1 OR v_corrigees <> 0 THEN");
    expect(migration).toContain("IF v_occurrences = 0 AND v_corrigees = 1 THEN");
  });
});
