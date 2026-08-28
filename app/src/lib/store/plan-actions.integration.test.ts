import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../../../supabase/migrations/20260828120000_lot_3_acceptation_plan.sql", import.meta.url),
  "utf8",
);

describe("contrat SQL de l'acceptation de plan", () => {
  it("porte une seule transaction idempotente et isolée par compte", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.accepter_plan");
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("orchestration_command_receipts");
    expect(migration).toContain("md5(p_payload::TEXT)");
    expect(migration).toContain("v_stored_hash IS DISTINCT FROM v_payload_hash");
    expect(migration).toContain("public.compte_actif(v_uid)");
    expect(migration).toContain("SECURITY INVOKER");
    expect(migration).toContain("auth.uid()");
    expect(migration).toContain("app.orchestration_command");
  });

  it("protège les séances déjà commencées et ne fabrique aucune observation", () => {
    expect(migration).toContain("v_statut IS DISTINCT FROM 'planifiee'");
    expect(migration).toContain("statut = 'abandonnee'");
    expect(migration).not.toMatch(/INSERT\s+INTO\s+public\.observations/i);
    expect(migration).not.toContain("p_observations");
    expect(migration).toContain("v_statut IS DISTINCT FROM 'planifiee'");
  });
});
