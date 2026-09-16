import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { planProgress } from "./progress.mjs";
import { snapshotMission } from "./missions.mjs";

const at = "2026-09-16T12:00:00.000Z";
const source = "ai-company/product/plan.md";
const indexFile = "ai-company/product/plan-index.json";
const transmission = () => ({ delivered: "Partie livrée", remaining: ["Suite à construire"], evidence: ["report.md"], deployment: { status: "not-deployed", evidence: [] } });
const mission = overrides => ({
  id: "M-001", title: "Travail livré", status: "done", owner: "CTO", objective: "Construire une partie",
  authorization: { source: "approval.md", summary: "Mandat explicite" }, scope: ["lib/work.mjs"],
  baseCommit: "abc1234", acceptance: ["Partie vérifiable"], nextAction: "", blocker: null,
  checks: [{ command: "node --test", result: "passed", at, revision: "abc1234" }],
  externalActions: [], updatedAt: at, completion: { summary: "Une partie livrée", evidence: ["report.md"], at },
  ...overrides,
});

function fixture(t) {
  const temp = resolve(tmpdir());
  const root = mkdtempSync(join(temp, "ai-company-progress-"));
  t.after(() => {
    assert.equal(dirname(root), temp);
    assert.ok(basename(root).startsWith("ai-company-progress-"));
    rmSync(root, { recursive: true, force: true });
  });
  const write = (path, content) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  };
  const add = value => write(`ai-company/operations/missions/${value.id}.json`, JSON.stringify(value));
  const index = overrides => write(indexFile, JSON.stringify({ version: 1, sources: [source], legacyLinks: [], ...overrides }));
  write("approval.md", "Mandat");
  write("report.md", "Preuves");
  write("lib/work.mjs", "export const work = 1;");
  write(source, "# Plan\n\n| P01-01 | Confier | Description jamais recopiée |\n| P01-02 | Retrouver | Autre description |\n");
  return { root, write, add, index };
}

test("missing index is explicit and keeps closed missions visible", t => {
  const { root, add } = fixture(t);
  add(mission());
  const result = planProgress(root);
  assert.equal(result.configured, false);
  assert.deepEqual(result.errors, []);
  assert.equal(result.unlinkedMissions[0].status, "done");
  assert.deepEqual(result.unlinkedMissions[0].completion.evidence, ["report.md"]);
});

test("legacy delivery exposes reports without promoting requirements or inferring deployment", t => {
  const { root, add, index } = fixture(t);
  add(mission());
  index({ legacyLinks: [{ mission: "M-001", source, requirements: ["P01-01"], scope: "Première partie", evidence: ["report.md"] }] });
  const result = planProgress(root);
  assert.deepEqual(result.errors, []);
  assert.equal(result.requirements[0].line, 3);
  assert.equal(result.requirements[0].title, "Confier");
  assert.equal(result.requirements[0].deliveries[0].status, "done");
  assert.equal(result.requirements[0].deliveries[0].handoff, null);
  assert.deepEqual(result.requirements[0].deliveries[0].reportPaths, ["report.md"]);
  assert.equal(result.requirements[0].status, undefined);
  assert.equal(result.requirements[1].deliveries.length, 0);
  assert.ok(result.limitations.some(value => value.includes("handoff non structuré")));
  assert.ok(!JSON.stringify(result).includes("Description jamais recopiée"));
});

test("structured partial handoff and explicit link override legacy scope", t => {
  const { root, add, index } = fixture(t);
  const handoff = { delivered: "Dépôt construit", remaining: ["Lecture à construire"], evidence: ["report.md"], deployment: { status: "not-deployed", evidence: [] } };
  add(mission({ planLinks: [{ source, requirement: "P01-01", scope: "Dépôt seulement" }], handoff }));
  index({ legacyLinks: [{ mission: "M-001", source, requirements: ["P01-01"], scope: "Ancien périmètre", evidence: ["report.md"] }] });
  const result = planProgress(root);
  assert.deepEqual(result.errors, []);
  const [delivery] = result.requirements[0].deliveries;
  assert.equal(result.requirements[0].deliveries.length, 1);
  assert.equal(delivery.scope, "Dépôt seulement");
  assert.deepEqual(delivery.handoff, handoff);
});

test("unknown requirements, missions, missing reports and traversal are errors", t => {
  const { root, add, index } = fixture(t);
  add(mission());
  index({ sources: [source, "../outside.md"], legacyLinks: [
    { mission: "M-001", source, requirements: ["P01-99"], scope: "Scope", evidence: [] },
    { mission: "M-404", source, requirements: ["P01-01"], scope: "Scope", evidence: [] },
    { mission: "M-001", source, requirements: ["P01-01"], scope: "Scope", evidence: ["absent.md"] },
  ] });
  const errors = planProgress(root).errors.join("\n");
  for (const expected of ["../outside.md", "P01-99", "M-404", "absent.md"]) assert.ok(errors.includes(expected), errors);
});

test("duplicate source and duplicate requirement in a source are errors", t => {
  const { root, write, index } = fixture(t);
  write(source, "| P01-01 | A | x |\n| P01-01 | B | x |");
  index({ sources: [source, source] });
  const errors = planProgress(root).errors.join("\n");
  assert.match(errors, /Source dupliquée/);
  assert.match(errors, /Exigence dupliquée/);
});

test("fenced examples never add requirements or duplicates and preserve source line numbers", t => {
  const { root, write, index } = fixture(t);
  index();
  for (const marker of ["`", "~"]) {
    const other = marker === "`" ? "~" : "`";
    const lines = [
      "| P01-01 | Exigence réelle | Description |",
      marker.repeat(4) + "text",
      "| P99-99 | Exemple uniquement | Description |",
      "| P01-01 | Copie illustrative | Description |",
      marker.repeat(3),
      "| P99-98 | Toujours dans le bloc après clôture trop courte | Description |",
      other.repeat(4),
      "| P99-97 | Toujours dans le bloc après mauvais caractère | Description |",
      marker.repeat(4) + " suffixe",
      "| P99-96 | Toujours dans le bloc après clôture avec suffixe | Description |",
      "   " + marker.repeat(5) + " \t",
      "| P01-02 | Seconde exigence réelle | Description |",
      marker.repeat(3),
      "| P99-95 | Bloc non fermé | Description |",
    ];
    write(source, lines.join("\n"));
    const result = planProgress(root);
    assert.deepEqual(result.errors, [], marker);
    assert.deepEqual(result.requirements.map(({ id, line }) => ({ id, line })), [
      { id: "P01-01", line: 1 }, { id: "P01-02", line: 12 },
    ], marker);
  }
});

test("directory aliases cannot supply sources or legacy evidence", t => {
  const { root, add, index, write } = fixture(t);
  mkdirSync(join(root, "real"));
  write("real/plan.md", "| P01-01 | A | Description |");
  symlinkSync(join(root, "real"), join(root, "alias"), "junction");
  add(mission());
  index({ sources: [source, "alias/plan.md"], legacyLinks: [{ mission: "M-001", source, requirements: ["P01-01"], scope: "Scope", evidence: ["alias/plan.md"] }] });
  assert.ok(planProgress(root).errors.filter(error => error.includes("alias")).length >= 2);
});

test("each read reflects source edits, new requirements and changed mission state", t => {
  const { root, add, index, write } = fixture(t);
  index();
  const entry = mission({ planLinks: [{ source, requirement: "P01-01", scope: "Scope" }], handoff: transmission() });
  add(entry);
  assert.equal(planProgress(root).requirements[0].deliveries[0].status, "done");
  add({ ...entry, status: "cancelled" });
  write(source, "\n| P01-01 | Renommé | Nouveau |\n| P01-03 | Ajout | Nouveau |");
  const next = planProgress(root);
  assert.equal(next.requirements[0].title, "Renommé");
  assert.equal(next.requirements[0].line, 2);
  assert.equal(next.requirements[0].deliveries[0].status, "cancelled");
  assert.equal(next.requirements[1].id, "P01-03");
});

test("stale verification on a closed mission remains visible after changing inputs", t => {
  const { root, add, index, write } = fixture(t);
  index();
  const entry = mission({ verificationVersion: 1, requiredChecks: ["node --test"], planLinks: [{ source, requirement: "P01-01", scope: "Scope" }], handoff: transmission() });
  entry.checks[0].snapshot = snapshotMission(root, entry);
  add(entry);
  assert.deepEqual(planProgress(root).requirements[0].deliveries[0].verification, []);
  write("lib/work.mjs", "export const work = 2;");
  assert.match(planProgress(root).requirements[0].deliveries[0].verification.join("\n"), /périmée/);
});

test("progress is read-only and CLI check fails only on invalid references", t => {
  const { root, add, index } = fixture(t);
  add(mission({ planLinks: [{ source, requirement: "P01-01", scope: "Scope" }], handoff: transmission() }));
  index();
  const snapshot = () => readdirSync(root, { recursive: true, withFileTypes: true }).filter(entry => entry.isFile())
    .map(entry => { const path = join(entry.parentPath ?? entry.path, entry.name); return [path, readFileSync(path, "utf8")]; });
  const before = snapshot();
  planProgress(root);
  const cli = fileURLToPath(new URL("./progress.mjs", import.meta.url));
  const good = spawnSync(process.execPath, [cli, "--check"], { cwd: root, encoding: "utf8" });
  assert.equal(good.status, 0, good.stderr);
  assert.deepEqual(snapshot(), before);
  index({ legacyLinks: [{ mission: "M-404", source, requirements: ["P01-01"], scope: "Scope", evidence: [] }] });
  const bad = spawnSync(process.execPath, [cli, "--check"], { cwd: root, encoding: "utf8" });
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /M-404/);
});
