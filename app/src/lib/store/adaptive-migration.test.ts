import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase", "migrations", "20260813150000_adaptive_learning_loop.sql"),
  "utf8",
);

describe("contrat statique de la migration adaptative", () => {
  it("impose un état métier valide aux événements de jalon", () => {
    expect(migration).toContain("p_payload #>> '{event,state}'");
    expect(migration).toContain("NOT IN ('atteint', 'soumis')");
  });

  it("garde les commandes critiques SECURITY INVOKER", () => {
    for (const name of [
      "enregistrer_evenement_activite",
      "enregistrer_artefact_activite",
      "planifier_execution_activite",
      "enregistrer_objectif_apprentissage",
      "accepter_activite_generee",
      "cloturer_exercice",
      "cloturer_execution_activite",
      "abandonner_execution_activite",
      "rectifier_preuve",
    ]) {
      expect(migration).toMatch(new RegExp(
        `CREATE OR REPLACE FUNCTION public\\.${name}\\([\\s\\S]*?SECURITY INVOKER`,
      ));
    }
  });

  it("protège les journaux et snapshots en append-only", () => {
    for (const table of [
      "evidence",
      "document_snapshots",
      "artifact_snapshots",
      "activity_events",
      "evidence_status_events",
      "learning_command_receipts",
    ]) {
      expect(migration).toContain(`BEFORE UPDATE OR DELETE ON public.${table}`);
    }
  });

  it("exige une provenance exacte pour toute nouvelle preuve", () => {
    expect(migration).toContain("provenance_version = 2");
    expect(migration).toContain("num_nonnulls(attempt_id, activity_run_id) = 1");
    expect(migration).toContain("artifact_snapshot_id IS NOT NULL");
  });

  it("retire les mutations directes sur les données probantes", () => {
    expect(migration).toMatch(/REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER[\s\S]*?ON public\.evidence,/);
    expect(migration).toContain("REVOKE UPDATE, DELETE ON public.activity_assessments FROM authenticated");
  });

  it("garantit une seule séance active par compte", () => {
    expect(migration).toContain("CREATE UNIQUE INDEX sessions_one_active_per_account_uidx");
    expect(migration).toContain("ON public.sessions(user_id) WHERE statut = 'en-cours'");
    expect(migration).toContain("v_uid::TEXT || ':active-learning-session'");
    expect(migration).toContain("IF FOUND THEN v_session_id := v_existing_session_id; END IF");
  });

  it("utilise un reçu et un verrou pour l'idempotence des commandes", () => {
    expect(migration).toContain("CREATE TABLE public.learning_command_receipts");
    expect(migration).toContain("pg_catalog.pg_advisory_xact_lock");
    expect(migration).toContain("WHERE user_id = v_uid AND request_id = p_request_id");
  });

  it("interdit les transitions d'exécution hors commande", () => {
    expect(migration).toContain("NEW.status IS DISTINCT FROM OLD.status");
    expect(migration).toContain("NEW.active_milestone_id IS DISTINCT FROM OLD.active_milestone_id");
    expect(migration).toContain("Les transitions d’exécution passent par une commande transactionnelle");
  });

  it("réserve toutes les évaluations à une commande transactionnelle", () => {
    expect(migration).toContain("CREATE POLICY activity_assessments_command_insert");
    expect(migration).not.toContain("kind = 'proposition-tuteur'\n      OR");
  });

  it("sauvegarde contenu et pointeur d'artefact dans une même commande", () => {
    expect(migration).toMatch(
      /CREATE OR REPLACE FUNCTION public\.enregistrer_artefact_activite\([\s\S]*?UPDATE public\.activity_artifacts[\s\S]*?UPDATE public\.activity_runs/,
    );
    expect(migration).toContain("Conflit de version de l’artefact");
  });

  it("refuse qu'un support externe modifiable devienne une preuve", () => {
    expect(migration).toContain("v_run.current_artifact ->> 'kind' = 'lien-externe'");
    expect(migration).toContain("Un support externe modifiable ou vide ne peut pas devenir une preuve");
  });
});
