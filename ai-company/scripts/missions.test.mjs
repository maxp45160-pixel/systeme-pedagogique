import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";
import { checkMissions, normalizeRepoPath, scopesOverlap, selectNextMission, validateMission, snapshotMission, sha256, updateMission, verificationErrors } from "./missions.mjs";
import { resumeContext } from "./context.mjs";

const at = "2026-09-15T20:00:00.000Z";
const passed = { command: "node --test", result: "passed", at, revision: "abc1234 + working tree" };
const mission = (overrides = {}) => ({
  id: "M-001", title: "Réparer le contrôle", status: "ready",
  authorization: { source: "approval.md", summary: "Correction confiée explicitement" },
  objective: "Détecter une entrée invalide", scope: ["lib/check.mjs"], owner: "",
  baseCommit: "abc1234", acceptance: ["Une entrée invalide échoue"],
  nextAction: "Reproduire le défaut", blocker: null, checks: [], externalActions: [],
  updatedAt: at, completion: null, ...overrides,
});

function fixture(t) {
  const temp = resolve(tmpdir());
  const root = mkdtempSync(join(temp, "ai-company-missions-"));
  t.after(() => {
    assert.equal(dirname(resolve(root)), temp);
    assert.ok(basename(root).startsWith("ai-company-missions-"));
    rmSync(root, { recursive: true, force: true });
  });
  const write = (path, content) => {
    const target = join(root, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content);
  };
  const add = (value, filename = value.id) => write(`ai-company/operations/missions/${filename}.json`, JSON.stringify(value));
  write("approval.md", "Accord humain consigné pour cette mission de test.");
  return { root, write, add };
}

test("next respects lexical priority, retains blocked ownership and never replays closed work", () => {
  const entries = [
    mission({ id: "M-001", status: "blocked", owner: "CTO", blocker: "Accès absent", scope: ["lib"] }),
    mission({ id: "M-002", scope: ["LIB/new.mjs"] }),
    mission({ id: "M-006", scope: ["docs"] }),
    mission({ id: "M-004", status: "running", owner: "QA", scope: ["tests"] }),
    mission({ id: "M-005", scope: ["tests/new.test.mjs"] }),
    mission({ id: "M-003", scope: ["docs/new.md"] }),
    mission({ id: "M-000", status: "done" }),
    mission({ id: "M-007", status: "cancelled" }),
  ];
  assert.equal(selectNextMission(entries).id, "M-003");
  assert.equal(selectNextMission(entries.filter(item => ["M-001", "M-002", "M-004", "M-005", "M-000", "M-007"].includes(item.id))), null);
});

test("future bounded paths are accepted and checking does not change a mission", t => {
  const { root, add } = fixture(t);
  add(mission());
  const path = join(root, "ai-company/operations/missions/M-001.json");
  const before = readFileSync(path, "utf8");
  assert.deepEqual(checkMissions(root).errors, []);
  assert.equal(readFileSync(path, "utf8"), before);
});

test("missing authorization, invalid types and malformed JSON cannot become ready work", t => {
  const { root, write, add } = fixture(t);
  assert.ok(validateMission(mission({ authorization: null }), "M-001").some(error => error.startsWith("authorization")));
  assert.ok(validateMission(mission({ acceptance: [3], externalActions: null, owner: false }), "M-001").length >= 3);
  add(mission({ authorization: { source: "missing.md", summary: "Accord" } }));
  write("ai-company/operations/missions/M-002.json", "{");
  const errors = checkMissions(root).errors;
  assert.ok(errors.some(error => error.includes("missing.md")));
  assert.ok(errors.some(error => error.includes("JSON invalide")));
});

test("done requires successful checks and existing evidence; cancellation still requires an explanation", t => {
  const { root, add, write } = fixture(t);
  const done = mission({ status: "done", owner: "CTO", nextAction: "", completion: { summary: "Corrigé", evidence: ["proof.md"], at } });
  assert.ok(validateMission(done, done.id).some(error => error.startsWith("done")));
  assert.ok(validateMission({ ...done, checks: [{ ...passed, result: "blocked" }] }, done.id).some(error => error.startsWith("done")));
  add({ ...done, checks: [passed] });
  assert.ok(checkMissions(root).errors.some(error => error.includes("proof.md")));
  write("proof.md", "Résultat observé.");
  assert.deepEqual(checkMissions(root).errors, []);
  assert.ok(validateMission(mission({ status: "cancelled" }), "M-001").some(error => error.startsWith("completion")));
  assert.deepEqual(validateMission({ ...done, status: "cancelled", checks: [] }, "M-001"), []);
});

test("ownership, blocker and next action are mandatory for a blocked mission", () => {
  const errors = validateMission(mission({ status: "blocked", nextAction: "" }), "M-001");
  for (const key of ["owner", "blocker", "nextAction"]) assert.ok(errors.some(error => error.startsWith(key)));
  assert.deepEqual(validateMission(mission({ status: "blocked", owner: "CTO", blocker: "Question humaine", nextAction: "Attendre la réponse" }), "M-001"), []);
});

test("paths reject traversal, Windows aliases, absolute paths, metadata and secrets", () => {
  for (const path of ["..", ".", "lib/../elsewhere", "C:\\outside", "\\\\server\\share", "/tmp/file", ".git/config", "LIB/.ENV.local", "lib/file:stream", "lib/.. /file", "lib//file", "lib/file."]) {
    assert.equal(normalizeRepoPath(path), null, path);
  }
  assert.equal(normalizeRepoPath("lib\\future\\file.mjs"), "lib/future/file.mjs");
  assert.equal(normalizeRepoPath("docs/nouveau dossier/"), "docs/nouveau dossier");
});

test("collision checks are case insensitive, recursive and segment aware", t => {
  const { root, add } = fixture(t);
  assert.equal(scopesOverlap(["APP/src"], ["app\\SRC\\new.ts"]), true);
  assert.equal(scopesOverlap(["app/src"], ["app/src-extra"]), false);
  add(mission({ status: "running", owner: "A", scope: ["app/src"] }));
  add(mission({ id: "M-002", status: "running", owner: "B", scope: ["APP/src/new.ts"] }));
  assert.ok(checkMissions(root).errors.some(error => error.includes("Scopes réservés en conflit")));
});

test("blocked work keeps exclusive ownership against running and other blocked work", t => {
  const { root, add } = fixture(t);
  add(mission({ status: "blocked", owner: "A", blocker: "Accès manquant", scope: ["lib"] }));
  for (const status of ["running", "blocked"]) {
    add(mission({ id: "M-002", status, owner: "B", blocker: status === "blocked" ? "Question humaine" : null, scope: ["lib/new.mjs"] }));
    assert.ok(checkMissions(root).errors.some(error => error.includes("Scopes réservés en conflit")), status);
  }
});

test("internal scope aliases cannot bypass ownership for existing or future paths", t => {
  const { root, add, write } = fixture(t);
  write("lib/existing.mjs", "");
  symlinkSync(join(root, "lib"), join(root, "alias"), "junction");
  add(mission({ status: "running", owner: "A", scope: ["lib"] }));
  for (const status of ["ready", "running"]) {
    for (const scope of ["alias", "alias/existing.mjs", "alias/future/new.mjs"]) {
      add(mission({ id: "M-002", status, owner: "B", scope: [scope] }));
      assert.ok(checkMissions(root).errors.some(error => error.includes("alias de scope interdit")), `${status}: ${scope}`);
    }
  }
  add(mission({ id: "M-002", scope: ["lib/future/new.mjs"] }));
  const result = checkMissions(root);
  assert.deepEqual(result.errors, []);
  assert.equal(selectNextMission(result.missions), null);
});

test("file names bind identity and duplicate IDs fail", t => {
  const { root, add } = fixture(t);
  add(mission());
  add(mission(), "M-002");
  const errors = checkMissions(root).errors;
  assert.ok(errors.some(error => error.includes("nom du fichier")));
  assert.ok(errors.some(error => error.includes("id dupliqué")));
});

test("symlink escapes fail for authorization, evidence, future scopes and the mission registry", t => {
  const inside = fixture(t);
  const outside = fixture(t);
  symlinkSync(outside.root, join(inside.root, "escape"), "junction");
  inside.add(mission({ authorization: { source: "escape/approval.md", summary: "Accord" } }));
  assert.ok(checkMissions(inside.root).errors.some(error => error.includes("hors dépôt")));
  inside.add(mission({ scope: ["escape/not-created/file.mjs"] }));
  assert.ok(checkMissions(inside.root).errors.some(error => error.includes("hors dépôt")));
  inside.add(mission({ status: "done", owner: "CTO", checks: [passed], completion: { summary: "Fini", evidence: ["escape/approval.md"], at } }));
  assert.ok(checkMissions(inside.root).errors.some(error => error.includes("hors dépôt")));
  const linked = fixture(t);
  linked.write("ai-company/operations/.keep", "");
  outside.write("M-001.json", JSON.stringify(mission()));
  symlinkSync(outside.root, join(linked.root, "ai-company/operations/missions"), "junction");
  assert.ok(checkMissions(linked.root).errors.some(error => error.includes("hors dépôt")));
});

test("dates and revision metadata must be usable, including calendar validity", () => {
  for (const updatedAt of ["tomorrow", "2026-09-15", "2026-02-30T12:00:00Z", "2026-09-15T24:00:00Z"]) {
    assert.ok(validateMission(mission({ updatedAt }), "M-001").some(error => error.startsWith("updatedAt")));
  }
  assert.ok(validateMission(mission({ checks: [{ ...passed, revision: "" }] }), "M-001").some(error => error.startsWith("checks[")));
  assert.deepEqual(validateMission(mission({ updatedAt: "2026-09-15T22:00:00+02:00" }), "M-001"), []);
});

test("an empty registry is valid and cannot invent work", t => {
  const { root } = fixture(t);
  assert.deepEqual(checkMissions(root), { missions: [], errors: [] });
  assert.equal(selectNextMission([]), null);
});

test("CLI rejects an unknown command with a nonzero exit status", () => {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL("./missions.mjs", import.meta.url)), "run"], { encoding: "utf8" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Usage/);
});

test("CLI next prints actionable work, then fails closed when any mission JSON is invalid", t => {
  const { root, write, add } = fixture(t);
  write("ai-company/scripts/missions.mjs", readFileSync(fileURLToPath(new URL("./missions.mjs", import.meta.url)), "utf8"));
  add(mission());
  const run = () => spawnSync(process.execPath, [join(root, "ai-company/scripts/missions.mjs"), "next"], { encoding: "utf8" });
  const result = run();
  assert.equal(result.status, 0);
  for (const expected of ["M-001", "Détecter une entrée invalide", "approval.md", "ai-company/operations/missions/M-001.json", "aucune réservation"]) assert.ok(result.stdout.includes(expected));
  write("ai-company/operations/missions/M-002.json", "broken");
  const invalid = run();
  assert.equal(invalid.status, 1);
  assert.equal(invalid.stdout, "");
  assert.match(invalid.stderr, /JSON invalide/);
});

test("T1/T2: required checks and changed, added or removed inputs prevent verified completion", t => {
  const { root, add, write } = fixture(t);
  write("lib/check.mjs", "version 1");
  write("proof.md", "Fixture, not a real execution.");
  const value = mission({ verificationVersion: 1, requiredChecks: [passed.command], scope: ["lib"], status: "done", owner: "test", nextAction: "", completion: { summary: "Fixture", evidence: ["proof.md"], at } });
  value.checks = [{ ...passed, snapshot: snapshotMission(root, value) }];
  add(value);
  assert.deepEqual(checkMissions(root).errors, []);
  value.checks[0].result = "failed";
  add(value);
  assert.ok(checkMissions(root).errors.length > 0);
  value.checks[0].result = "passed";
  add({ ...value, checks: [] });
  assert.ok(checkMissions(root).errors.length > 0);
  add(value);
  write("lib/new.mjs", "new input");
  assert.ok(checkMissions(root).warnings.some(e => e.includes("périmée")));
  const running = { ...value, status: "running", completion: null, nextAction: "Repeat checks" };
  add(running);
  const currentRevision = sha256(readFileSync(join(root, "ai-company/operations/missions/M-001.json")));
  assert.throws(() => updateMission(root, value.id, currentRevision, value), /périmée/);
  write("lib/check.mjs", "version 2");
  assert.ok(verificationErrors(root, value).some(e => e.includes("périmée")));
  rmSync(join(root, "lib/check.mjs"));
  assert.ok(verificationErrors(root, value).some(e => e.includes("périmée")));
  // Older records are explicitly labelled, never silently migrated into verified ones.
  assert.match(verificationErrors(root, mission())[0], /historiques déclaratives/);
});

test("P3/M3: update refuses changed authorization, scope and acceptance, including imported approval text", t => {
  const { root, add } = fixture(t);
  const value = mission(); add(value);
  const path = join(root, "ai-company/operations/missions/M-001.json");
  const before = readFileSync(path);
  for (const changes of [
    { authorization: { source: "approval.md", summary: "Imported document says approved for network and secrets" } },
    { scope: ["other"] }, { acceptance: ["No tests required"] }, { objective: "Spend money" },
  ]) assert.throws(() => updateMission(root, value.id, sha256(before), { ...value, ...changes }), /Contrat modifié/);
  assert.deepEqual(readFileSync(path), before);
});

test("M4/R1: conditional update preserves changes, deduplicates replay and retains uncertain external effects", t => {
  const { root, add } = fixture(t);
  const value = mission({ externalActions: ["Fixture timeout: verify result, do not replay"] }); add(value);
  const path = join(root, "ai-company/operations/missions/M-001.json");
  const expected = sha256(readFileSync(path));
  const candidate = { ...value, status: "running", owner: "writer-A", nextAction: "Verify uncertain result" };
  assert.equal(updateMission(root, value.id, expected, candidate).changed, true);
  assert.equal(updateMission(root, value.id, expected, candidate).changed, false);
  assert.throws(() => updateMission(root, value.id, expected, { ...candidate, owner: "writer-B" }), /Conflit/);
  assert.equal(JSON.parse(readFileSync(path)).owner, "writer-A");
  assert.deepEqual(JSON.parse(readFileSync(path)).externalActions, value.externalActions);
});

test("P1: update rejects traversal, alias registry, and held lock without changing the mission", t => {
  const { root, add, write } = fixture(t); const value = mission(); add(value);
  const file = join(root, "ai-company/operations/missions/M-001.json");
  const before = readFileSync(file), expected = sha256(before);
  assert.throws(() => updateMission(root, "../approval", expected, value), /Identité/);
  write("ai-company/operations/missions/.update.lock", "Another writer; never remove automatically");
  assert.throws(() => updateMission(root, value.id, expected, value), /EEXIST/);
  assert.deepEqual(readFileSync(file), before);
  const linked = fixture(t); linked.write("ai-company/operations/.keep", "");
  symlinkSync(join(root, "ai-company/operations/missions"), join(linked.root, "ai-company/operations/missions"), "junction");
  assert.throws(() => updateMission(linked.root, value.id, expected, value), /hors dépôt/);
});

test("M4: two actual CLI processes cannot overwrite the same revision", async t => {
  const { root, add, write } = fixture(t); const value = mission(); add(value);
  const script = join(root, "ai-company/scripts/missions.mjs");
  write("ai-company/scripts/missions.mjs", readFileSync(fileURLToPath(new URL("./missions.mjs", import.meta.url))));
  const expected = sha256(readFileSync(join(root, "ai-company/operations/missions/M-001.json")));
  const run = owner => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, "update", value.id, expected], { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    let stderr = ""; child.stderr.on("data", bytes => { stderr += bytes; }); child.stdout.resume();
    child.on("error", reject); child.on("close", code => resolve({ code, stderr }));
    child.stdin.end(JSON.stringify({ ...value, owner, status: "running" }));
  });
  const results = await Promise.all([run("A"), run("B")]);
  assert.deepEqual(results.map(r => r.code).sort(), [0, 1]);
  assert.match(results.find(r => r.code === 1).stderr, /Conflit|EEXIST/);
});

test("failed temporary creation never deletes a pre-existing file or directory", t => {
  const { root, add, write } = fixture(t); const value = mission(); add(value);
  const file = join(root, "ai-company/operations/missions/M-001.json");
  const before = readFileSync(file);
  const temp = `ai-company/operations/missions/.M-001.${process.pid}.tmp`;
  write(temp, "Pre-existing work");
  const candidate = { ...value, status: "running", owner: "test" };
  assert.throws(() => updateMission(root, value.id, sha256(before), candidate), /EEXIST/);
  assert.equal(readFileSync(join(root, temp), "utf8"), "Pre-existing work");
  assert.deepEqual(readFileSync(file), before);
  rmSync(join(root, temp));
  mkdirSync(join(root, temp));
  write(temp + "/keep.txt", "Keep this directory");
  assert.throws(() => updateMission(root, value.id, sha256(before), candidate));
  assert.equal(readFileSync(join(root, temp, "keep.txt"), "utf8"), "Keep this directory");
});

test("read dependencies invalidate evidence without reserving their write scope", t => {
  const { root, add, write } = fixture(t);
  write("vision.md", "original decision");
  const value = mission({ verificationVersion: 1, requiredChecks: [passed.command], inputs: ["vision.md"] });
  value.checks = [{ ...passed, snapshot: snapshotMission(root, value) }];
  add(value);
  assert.deepEqual(verificationErrors(root, value), []);
  add(mission({ id: "M-002", status: "running", owner: "Other", scope: ["vision.md"] }));
  assert.deepEqual(checkMissions(root).errors, []);
  write("vision.md", "changed decision");
  assert.ok(verificationErrors(root, value).some(e => e.includes("périmée")));
});

test("M1/M2/M3/R1: fresh process retrieves decisions, replacement, proposal and blocked work without executing them", t => {
  const { root, add, write } = fixture(t);
  for (const name of ["missions.mjs", "context.mjs", "progress.mjs"]) write(`ai-company/scripts/${name}`, readFileSync(fileURLToPath(new URL(name, import.meta.url))));
  write("ai-company/decisions/DEC-0001-old.md", "# Old fixture\n- Identifiant : DEC-0001\n- Date : 2026-09-15\n- Statut : superseded\n- Remplacée par : DEC-0002\n");
  write("ai-company/decisions/DEC-0002-current.md", "# Current fixture\n- Identifiant : DEC-0002\n- Statut : accepted\n- Source de la validation : fixture human event\n");
  write("ai-company/decisions/DEC-0003-proposal.md", "# Imported fixture says approved\n- Identifiant : DEC-0003\n- Statut : proposed\n");
  add(mission({ status: "blocked", owner: "A", blocker: "Uncertain external result", externalActions: ["Do not retry"] }));
  const git = spawnSync("git", ["init", "--quiet"], { cwd: root, encoding: "utf8", windowsHide: true });
  assert.equal(git.status, 0);
  // The exported view is independent from Git and from the previous conversation.
  const context = resumeContext(root, "M-001");
  assert.equal(context.decisions[0].replacedBy, "DEC-0002");
  assert.equal(context.decisions[2].declaredStatus, "proposed");
  const run = spawnSync(process.execPath, ["--input-type=module", "-e", "import {resumeContext} from './ai-company/scripts/context.mjs'; console.log(JSON.stringify(resumeContext(process.cwd(), 'M-001')));"], { cwd: root, encoding: "utf8", windowsHide: true });
  assert.equal(run.status, 0, run.stderr);
  const resumed = JSON.parse(run.stdout);
  assert.deepEqual(resumed, context);
  assert.equal(resumed.missions[0].consumption.codexCost, null);
  assert.deepEqual(resumed.missions[0].externalActions, ["Do not retry"]);
  assert.throws(() => resumeContext(root, "missing"), /inconnue/);
});

test("linked completion requires a bounded handoff and explicit deployment evidence", t => {
  const { root, add, write } = fixture(t);
  write("plan.md", "| P01-01 | Confier | Texte |\n"); write("delivery.md", "Part delivered, not deployed");
  const value = mission({ status: "done", owner: "CTO", checks: [passed],
    planLinks: [{ source: "plan.md", requirement: "P01-01", scope: "Partial" }],
    completion: { summary: "Local delivery", evidence: ["delivery.md"], at } });
  assert.ok(validateMission(value, value.id).some(error => error.includes("handoff")));
  value.handoff = { delivered: "Local part", remaining: ["Real usage"], evidence: ["delivery.md"], deployment: { status: "not-deployed", evidence: [] } };
  add(value); assert.deepEqual(checkMissions(root).errors, []);
  value.handoff.deployment.status = "verified";
  assert.ok(validateMission(value, value.id).some(error => error.includes("déploiement")));
  value.handoff.deployment.evidence = ["missing.md"]; add(value);
  assert.ok(checkMissions(root).errors.some(error => error.includes("missing.md")));
});

test("plan and delivery changes invalidate proofs; conditional update cannot replace requirement links", t => {
  const { root, add, write } = fixture(t);
  write("plan.md", "| P01-01 | Confier | initial |\n"); write("delivery.md", "Evidence");
  const value = mission({ verificationVersion: 1, requiredChecks: [passed.command],
    planLinks: [{ source: "plan.md", requirement: "P01-01", scope: "First part" }],
    handoff: { delivered: "Partial", remaining: ["Usage"], evidence: ["delivery.md"], deployment: { status: "unknown", evidence: [] } } });
  value.checks = [{ ...passed, snapshot: snapshotMission(root, value) }]; add(value);
  assert.deepEqual(verificationErrors(root, value), []);
  const file = join(root, "ai-company/operations/missions/M-001.json");
  assert.throws(() => updateMission(root, value.id, sha256(readFileSync(file)), { ...value, planLinks: [] }), /Contrat modifié/);
  assert.ok(verificationErrors(root, { ...value, handoff: { ...value.handoff, remaining: [] } }).length);
  write("plan.md", "| P01-01 | Confier | amended |\n");
  assert.ok(verificationErrors(root, value).length);
});

test("fresh management session recovers completed work and partial requirement coverage", t => {
  const { root, add, write } = fixture(t);
  for (const name of ["missions.mjs", "context.mjs", "progress.mjs"]) write(`ai-company/scripts/${name}`, readFileSync(fileURLToPath(new URL(name, import.meta.url))));
  write("ai-company/decisions/DEC-0001.md", "# Decision\n- Identifiant : DEC-0001\n- Statut : proposed\n");
  write("plan.md", "| P01-01 | Confier | Description |\n| P01-02 | Relire | Other |\n");
  write("delivery.md", "Only one local part delivered; no deployment");
  write("ai-company/product/plan-index.json", JSON.stringify({ version: 1, sources: ["plan.md"], legacyLinks: [] }));
  add(mission({ status: "done", owner: "CTO", checks: [passed],
    planLinks: [{ source: "plan.md", requirement: "P01-01", scope: "Local part" }],
    handoff: { delivered: "Local part", remaining: ["Usage acceptance"], evidence: ["delivery.md"], deployment: { status: "not-deployed", evidence: [] } },
    completion: { summary: "Partial delivery", evidence: ["delivery.md"], at } }));
  const run = spawnSync(process.execPath, ["--input-type=module", "-e", "import {resumeContext} from './ai-company/scripts/context.mjs'; console.log(JSON.stringify(resumeContext(process.cwd())));"], { cwd: root, encoding: "utf8", windowsHide: true });
  assert.equal(run.status, 0, run.stderr);
  const resumed = JSON.parse(run.stdout);
  assert.equal(resumed.closedMissions[0].id, "M-001");
  const linked = resumed.progress.requirements.find(item => item.id === "P01-01");
  assert.deepEqual(linked.deliveries[0].handoff.remaining, ["Usage acceptance"]);
  assert.equal(linked.deliveries[0].handoff.deployment.status, "not-deployed");
  assert.equal(resumed.progress.requirements.find(item => item.id === "P01-02").deliveries.length, 0);
  assert.equal(resumed.missions.length, 0);
});
