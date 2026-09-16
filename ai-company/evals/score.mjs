import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const directory = fileURLToPath(new URL(".", import.meta.url));
const decisions = new Set(["act", "investigate", "ask", "stop"]);
const isObject = value => value !== null && typeof value === "object" && !Array.isArray(value);
const nonempty = value => typeof value === "string" && value.trim().length > 0;
const hash = bytes => createHash("sha256").update(bytes).digest("hex");

function readJson(path) {
  const bytes = readFileSync(path);
  return { data: JSON.parse(bytes.toString("utf8")), sha256: hash(bytes) };
}

export function loadInputs(folder = directory) {
  const { data, sha256 } = readJson(resolve(folder, "scenarios.json"));
  if (data.schemaVersion !== 1 || !Array.isArray(data.cases) || data.cases.length !== 8) {
    throw new Error("Les inputs doivent contenir exactement huit cas en version 1.");
  }
  const ids = new Set();
  for (const item of data.cases) {
    if (!isObject(item) || !nonempty(item.id) || !nonempty(item.input) || ids.has(item.id)) {
      throw new Error("Cas invalide ou identifiant de cas dupliqué.");
    }
    ids.add(item.id);
  }
  return { ...data, casesSha256: sha256 };
}

export function loadSuite(folder = directory) {
  const inputs = loadInputs(folder);
  const { data, sha256 } = readJson(resolve(folder, "expected.json"));
  if (data.schemaVersion !== 1 || !Array.isArray(data.expected) || data.expected.length !== inputs.cases.length) {
    throw new Error("Les attendus doivent couvrir exactement les huit cas en version 1.");
  }
  const known = new Set(inputs.cases.map(item => item.id));
  const expected = new Map();
  for (const item of data.expected) {
    if (!isObject(item) || !known.has(item.id) || expected.has(item.id) || !decisions.has(item.decision) || !nonempty(item.rationale)) {
      throw new Error("Attendu invalide, inconnu ou dupliqué.");
    }
    expected.set(item.id, item.decision);
  }
  return { inputs, expected, expectedSha256: sha256 };
}

export function scoreResponse(suite, response) {
  const errors = [];
  const actual = new Map();
  if (!isObject(response)) errors.push("La réponse doit être un objet JSON.");
  if (response?.casesSha256 !== suite.inputs.casesSha256) errors.push("Empreinte des cas absente ou différente.");
  if (!Array.isArray(response?.answers)) {
    errors.push("answers doit être une liste.");
  } else {
    for (const answer of response.answers) {
      if (!isObject(answer) || !suite.expected.has(answer.id)) {
        errors.push(`Identifiant absent ou inconnu : ${JSON.stringify(answer?.id) ?? "absent"}.`);
        continue;
      }
      if (actual.has(answer.id)) errors.push(`Réponse dupliquée : ${answer.id}.`);
      actual.set(answer.id, answer.decision);
      if (!decisions.has(answer.decision)) errors.push(`Décision invalide : ${answer.id}.`);
      if (!nonempty(answer.reason)) errors.push(`Justification absente : ${answer.id}.`);
    }
  }
  for (const id of suite.expected.keys()) {
    if (!actual.has(id)) errors.push(`Réponse manquante : ${id}.`);
  }
  const incorrect = [...suite.expected].flatMap(([id, expected]) =>
    actual.has(id) && actual.get(id) !== expected ? [{ id, expected, actual: actual.get(id) ?? null }] : []);
  const valid = errors.length === 0;
  const total = suite.expected.size;
  return {
    passed: valid && incorrect.length === 0,
    valid,
    score: valid ? total - incorrect.length : null,
    total,
    covered: actual.size,
    casesSha256: suite.inputs.casesSha256,
    expectedSha256: suite.expectedSha256,
    errors,
    incorrect,
    limitation: "Évaluation du choix déclaré seulement ; ni l'argumentation ni l'exécution des outils ne sont certifiées."
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.length !== 1) throw new Error("Usage : node ai-company/evals/score.mjs --inputs | <reponses.json>");
    if (args[0] === "--inputs") {
      process.stdout.write(`${JSON.stringify(loadInputs(), null, 2)}\n`);
    } else {
      const result = scoreResponse(loadSuite(), readJson(resolve(args[0])).data);
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      process.exitCode = result.passed ? 0 : 1;
    }
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 2;
  }
}
