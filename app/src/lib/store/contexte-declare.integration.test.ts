import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const schema = readFileSync(
  new URL("../../../supabase/schema.sql", import.meta.url),
  "utf8",
);
const migrationRetrait = readFileSync(
  new URL(
    "../../../supabase/migrations/20260829155409_retirer_periode_declaree_inutile.sql",
    import.meta.url,
  ),
  "utf8",
);
const migrationRefusPlan = readFileSync(
  new URL(
    "../../../supabase/migrations/20260829163836_memoriser_refus_proposition_plan.sql",
    import.meta.url,
  ),
  "utf8",
);
const pageTableauBord = readFileSync(
  new URL("../../app/(app)/app/page.tsx", import.meta.url),
  "utf8",
);
const pageSeances = readFileSync(
  new URL("../../app/(app)/seances/page.tsx", import.meta.url),
  "utf8",
);

describe("retrait de la configuration abstraite de période", () => {
  it("retire la période du schéma de référence par une migration additive", () => {
    expect(schema).not.toContain("periode_declaree");
    expect(migrationRetrait).toContain(
      "DROP CONSTRAINT IF EXISTS profiles_periode_declaree_non_vide",
    );
    expect(migrationRetrait).toContain(
      "DROP COLUMN IF EXISTS periode_declaree",
    );
    expect(migrationRetrait).not.toMatch(/CREATE TABLE/i);
  });

  it("décrit le refus entier dans le schéma et dans la migration additive", () => {
    expect(schema).toContain("proposition_ref TEXT");
    expect(migrationRefusPlan).toContain("ADD COLUMN IF NOT EXISTS proposition_ref TEXT");
    expect(migrationRefusPlan).toContain("refus_recommandations_proposition_ref_non_vide");
    expect(migrationRefusPlan).not.toMatch(/CREATE TABLE/i);
  });

  it("conserve les compositions actives du tableau de bord et des séances", () => {
    expect(pageTableauBord).toContain("CarteProchaineAction");
    expect(pageTableauBord).not.toContain("CarteEcheances");
    expect(pageSeances).toContain("CarteEcheances");
    expect(pageTableauBord).not.toContain("TableauBordOrchestration");
    expect(pageTableauBord).not.toContain("referenceStableProposition");
    expect(pageTableauBord).not.toContain("crypto.randomUUID");
  });
});
