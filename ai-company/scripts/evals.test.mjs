import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadInputs, loadSuite, scoreResponse } from "../evals/score.mjs";

const suite = loadSuite();
const cli = fileURLToPath(new URL("../evals/score.mjs", import.meta.url));
const fixtures = fileURLToPath(new URL("../evals/", import.meta.url));

function completeResponse() {
  return {
    casesSha256: suite.inputs.casesSha256,
    answers: [...suite.expected].map(([id, decision]) => ({ id, decision, reason: "Justification synthétique du test, sans action exécutée." }))
  };
}

function temporaryDirectory(t) {
  const root = resolve(tmpdir());
  const folder = mkdtempSync(join(root, "twiny-evals-"));
  t.after(() => {
    const child = relative(root, folder);
    assert.ok(child && !isAbsolute(child) && !child.startsWith(".."));
    rmSync(folder, { recursive: true, force: true });
  });
  return folder;
}

test("eight distinct correct choices pass; order has no meaning", () => {
  const response = completeResponse();
  response.answers.reverse();
  const result = scoreResponse(suite, response);
  assert.equal(result.passed, true);
  assert.equal(result.score, 8);
  assert.equal(result.covered, 8);
  assert.deepEqual(result.incorrect, []);
  assert.match(result.casesSha256, /^[a-f0-9]{64}$/);
  assert.match(result.expectedSha256, /^[a-f0-9]{64}$/);
});

test("each wrong choice is reported; a parseable JSON answer does not imply success", () => {
  const response = completeResponse();
  response.answers[0].decision = "ask";
  response.answers[2].decision = "act";
  const result = scoreResponse(suite, response);
  assert.equal(result.valid, true);
  assert.equal(result.passed, false);
  assert.equal(result.score, 6);
  assert.deepEqual(result.incorrect.map(item => item.id), ["C01", "C03"]);
});

test("duplicate answers cannot hide a missing case or manufacture an eight out of eight", () => {
  const response = completeResponse();
  response.answers[7] = { ...response.answers[0] };
  const result = scoreResponse(suite, response);
  assert.equal(result.valid, false);
  assert.equal(result.passed, false);
  assert.equal(result.score, null);
  assert.equal(result.covered, 7);
  assert.ok(result.errors.some(error => error.includes("dupliquée : C01")));
  assert.ok(result.errors.some(error => error.includes("manquante : C08")));
});

test("unknown ids, missing ids, unknown decisions and missing reasons are rejected", () => {
  const changes = [
    response => { response.answers.push({ id: "C99", decision: "act", reason: "extra" }); },
    response => { delete response.answers[0].id; },
    response => { response.answers.pop(); },
    response => { response.answers[0].decision = "approved"; },
    response => { response.answers[0].reason = "  "; },
    response => { response.answers[0] = null; }
  ];
  for (const change of changes) {
    const response = completeResponse();
    change(response);
    const result = scoreResponse(suite, response);
    assert.equal(result.valid, false);
    assert.equal(result.passed, false);
    assert.equal(result.score, null);
  }
});

test("missing or changed case fingerprints and malformed response containers are rejected", () => {
  for (const response of [null, [], {}, { answers: [] }, { ...completeResponse(), casesSha256: "0".repeat(64) }, { ...completeResponse(), answers: {} }]) {
    const result = scoreResponse(suite, response);
    assert.equal(result.valid, false);
    assert.equal(result.passed, false);
  }
});

test("blind inputs need no expected file; case and criteria fingerprints are separate", t => {
  const folder = temporaryDirectory(t);
  const caseBytes = readFileSync(join(fixtures, "scenarios.json"));
  writeFileSync(join(folder, "scenarios.json"), caseBytes);
  const inputs = loadInputs(folder);
  assert.equal(inputs.casesSha256, suite.inputs.casesSha256);
  assert.equal(Object.hasOwn(inputs, "expected"), false);
  assert.throws(() => loadSuite(folder));
  writeFileSync(join(folder, "expected.json"), readFileSync(join(fixtures, "expected.json")));
  writeFileSync(join(folder, "scenarios.json"), Buffer.concat([caseBytes, Buffer.from("\n")]));
  const changedCases = loadSuite(folder);
  assert.notEqual(changedCases.inputs.casesSha256, suite.inputs.casesSha256);
  assert.equal(changedCases.expectedSha256, suite.expectedSha256);
  assert.equal(scoreResponse(changedCases, completeResponse()).passed, false);
  const expected = JSON.parse(readFileSync(join(folder, "expected.json"), "utf8"));
  expected.expected[0].rationale += " Texte modifié.";
  writeFileSync(join(folder, "expected.json"), JSON.stringify(expected));
  assert.notEqual(loadSuite(folder).expectedSha256, changedCases.expectedSha256);
});

test("invalid benchmark files fail closed instead of reducing the denominator", t => {
  const folder = temporaryDirectory(t);
  const cases = JSON.parse(readFileSync(join(fixtures, "scenarios.json"), "utf8"));
  const expected = JSON.parse(readFileSync(join(fixtures, "expected.json"), "utf8"));
  writeFileSync(join(folder, "expected.json"), JSON.stringify(expected));
  writeFileSync(join(folder, "scenarios.json"), JSON.stringify({ ...cases, cases: cases.cases.slice(0, 7) }));
  assert.throws(() => loadSuite(folder), /huit/);
  writeFileSync(join(folder, "scenarios.json"), JSON.stringify(cases));
  expected.expected[7] = expected.expected[0];
  writeFileSync(join(folder, "expected.json"), JSON.stringify(expected));
  assert.throws(() => loadSuite(folder), /dupliqué/);
});

test("CLI distinguishes complete success, incorrect choices and unreadable JSON", t => {
  const folder = temporaryDirectory(t);
  const path = join(folder, "responses.json");
  const response = completeResponse();
  writeFileSync(path, JSON.stringify(response));
  let execution = spawnSync(process.execPath, [cli, path], { encoding: "utf8" });
  assert.equal(execution.status, 0, execution.stderr);
  assert.equal(JSON.parse(execution.stdout).score, 8);
  response.answers[0].decision = "stop";
  writeFileSync(path, JSON.stringify(response));
  execution = spawnSync(process.execPath, [cli, path], { encoding: "utf8" });
  assert.equal(execution.status, 1);
  assert.equal(JSON.parse(execution.stdout).incorrect[0].id, "C01");
  writeFileSync(path, "{");
  execution = spawnSync(process.execPath, [cli, path], { encoding: "utf8" });
  assert.equal(execution.status, 2);
  execution = spawnSync(process.execPath, [cli, "--inputs"], { encoding: "utf8" });
  assert.equal(execution.status, 0, execution.stderr);
  assert.equal(JSON.parse(execution.stdout).cases.length, 8);
  assert.equal(Object.hasOwn(JSON.parse(execution.stdout), "expected"), false);
});
