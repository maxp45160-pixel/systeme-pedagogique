import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../../../supabase/migrations/20260828150000_lot_5_revision_plan.sql", import.meta.url),
  "utf8",
);
const correction = readFileSync(
  new URL("../../../supabase/migrations/20260828212423_corriger_intervalle_acceptation_plan.sql", import.meta.url),
  "utf8",
);
const intervalTypes = readFileSync(
  new URL("../../../supabase/tests/accepter_plan_interval_types.sql", import.meta.url),
  "utf8",
);
const atomicityProof = readFileSync(
  new URL("../../../supabase/tests/accepter_plan_atomicite.sql", import.meta.url),
  "utf8",
);
const idempotenceMigration = readFileSync(
  new URL("../../../supabase/migrations/20260829101500_corriger_idempotence_acceptation_plan.sql", import.meta.url),
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

  it("documente la correction historique incomplète sans la réutiliser", () => {
    expect(correction).toContain("20260828212629");
    expect(correction).toContain("sum(integer)");
    expect(correction).toContain("20260829072035_corriger_somme_intervalle_acceptation_plan.sql");
    expect(correction).toContain("regexp_replace");
    expect(correction).not.toMatch(/CREATE\s+TABLE/i);
  });

  it("corrige explicitement le BIGINT de sum(integer) sans regexp", () => {
    const correctionComplete = readFileSync(
      new URL("../../../supabase/migrations/20260829072035_corriger_somme_intervalle_acceptation_plan.sql", import.meta.url),
      "utf8",
    );

    expect(correctionComplete).toContain("to_regprocedure(v_signature)");
    expect(correctionComplete).toContain("length(v_definition) - length(replace(v_definition, v_ancien, ''))");
    expect(correctionComplete).toContain("sum((intervention->>''estimatedDurationMinutes'')::INTEGER)::INTEGER");
    expect(correctionComplete).toContain("IF v_occurrences = 3 THEN");
    expect(correctionComplete).toContain("CONTINUE;");
    expect(correctionComplete).toContain("corrections partielles");
    expect(correctionComplete).toContain("EXECUTE v_definition");
    expect(correctionComplete).not.toContain("regexp_replace");
    expect(correctionComplete).not.toMatch(/CREATE\s+TABLE/i);
  });

  it("couvre les durées nulles, individuelles et agrégées côté PostgreSQL", () => {
    expect(intervalTypes).toContain("NULL::INTEGER");
    expect(intervalTypes).toContain("30::INTEGER");
    expect(intervalTypes).toContain("sum(minutes)::INTEGER");
    expect(intervalTypes).toContain("interval '45 minutes'");
    expect(intervalTypes).not.toMatch(/INSERT\s+INTO/i);
  });

  it("embarque la réfutation PostgreSQL de la sélection et de l'idempotence", () => {
    expect(atomicityProof).toContain("SET LOCAL ROLE authenticated");
    expect(atomicityProof).toContain("v_result := public.accepter_plan");
    expect(atomicityProof).toContain("v_replay := public.accepter_plan");
    expect(atomicityProof).toContain("v_invalid_rejected");
    expect(atomicityProof).toContain("blueprint IS NULL");
    expect(atomicityProof).toContain("ROLLBACK;");
    expect(atomicityProof).toContain("public.observations");
  });

  it("borne la correction RLS au verrou du reçu append-only", () => {
    expect(idempotenceMigration).toContain("public.accepter_plan_lot3_legacy(text,jsonb)");
    expect(idempotenceMigration).toContain("chr(13) || chr(10)");
    expect(idempotenceMigration).toContain("EXECUTE v_definition");
    expect(idempotenceMigration).toContain("RETURN;");
    expect(idempotenceMigration).not.toContain("regexp_replace");
    expect(idempotenceMigration).toContain("occurrence");
    expect(idempotenceMigration).toContain("littérale");
  });
});
