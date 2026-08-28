import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../../../supabase/migrations/20260828150000_lot_5_revision_plan.sql", import.meta.url),
  "utf8",
);

describe("contrat SQL de la revue groupée du plan", () => {
  it("reste additif, transactionnel et idempotent", () => {
    expect(migration).toContain("accepter_plan_lot3_legacy");
    expect(migration).toContain("duree_planifiee_min");
    expect(migration).toContain("jsonb_set(p_payload, '{adjustments}'");
    expect(migration).toContain("public.accepter_plan_lot3_legacy");
    expect(migration).toContain("v_duration > v_current_duration");
    expect(migration).toContain("duree_planifiee_min,");
    expect(migration).toContain("v_replayed");
    expect(migration).toContain("WITH cibles AS");
    expect(migration).toContain("cible.duree_planifiee_min");
    expect(migration).not.toContain("SET duree_min = v_duration");
    expect(migration).toContain("FOR UPDATE");
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.accepter_plan");
  });

  it("ne fabrique aucune observation et ne crée aucune table", () => {
    expect(migration).not.toMatch(/INSERT\s+INTO\s+public\.observations/i);
    expect(migration).not.toMatch(/CREATE\s+TABLE/i);
    expect(migration).toContain("NON appliquée");
  });
});
