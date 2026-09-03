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
const carte = readFileSync(
  new URL(
    "../../components/dashboard/carte-preparation-periode.tsx",
    import.meta.url,
  ),
  "utf8",
);
const cartePlan = readFileSync(
  new URL(
    "../../components/dashboard/carte-proposition-plan.tsx",
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
const actionsPlan = readFileSync(
  new URL("./plan-actions.ts", import.meta.url),
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

  it("ne réintroduit ni assistant local ni champs date-heure bruts", () => {
    expect(carte).not.toContain("localStorage");
    expect(carte).not.toContain('type="datetime-local"');
    expect(carte).toContain("Ajouter un créneau");
    expect(carte).toContain("Modifier");
    expect(carte).toContain("Supprimer");
    expect(carte).toContain('type="date"');
    expect(carte).toContain('type="time"');
    expect(carte).toContain('aria-labelledby="titre-creneaux"');
    expect(carte).toContain("onSubmit");
    expect(carte).toContain("sm:grid-cols-3");
    expect(carte).toContain("Ajouter une échéance");
  });

  it("décrit le refus entier dans le schéma et dans la migration additive", () => {
    expect(schema).toContain("proposition_ref TEXT");
    expect(migrationRefusPlan).toContain("ADD COLUMN IF NOT EXISTS proposition_ref TEXT");
    expect(migrationRefusPlan).toContain("refus_recommandations_proposition_ref_non_vide");
    expect(migrationRefusPlan).not.toMatch(/CREATE TABLE/i);
  });

  it("garde les composants de fond sans remplacer le tableau de bord historique", () => {
    expect(cartePlan).toContain("Tout sélectionner");
    expect(cartePlan).toContain("Tout désélectionner");
    expect(cartePlan).toContain("Ignorer cette proposition");
    expect(cartePlan).toContain("Aucune séance à confirmer pour le moment");
    expect(cartePlan).toContain("traduireErreurProposition");
    expect(cartePlan).toContain("commandeLancee.current");
    expect(pageTableauBord).toContain("CarteProchaineAction");
    expect(pageTableauBord).not.toContain("CarteEcheances");
    expect(pageSeances).toContain("CarteEcheances");
    expect(pageTableauBord).not.toContain("TableauBordOrchestration");
    expect(pageTableauBord).not.toContain("referenceStableProposition");
    expect(pageTableauBord).not.toContain("crypto.randomUUID");
    expect(actionsPlan).toContain("refuserPropositionPlan");
    expect(actionsPlan).toContain("plan-refus:");
  });
});
