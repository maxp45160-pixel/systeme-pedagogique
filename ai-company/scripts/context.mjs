import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { checkMissions, inspectPath, sha256, verificationErrors } from "./missions.mjs";

// Fixed local reads, no shell, network, execution or automatic report write.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

export function resumeContext(repoRoot, id = null) {
  const { missions, errors } = checkMissions(repoRoot);
  if (errors.length) throw new Error(errors.join("\n"));
  if (id && !missions.some(mission => mission.id === id)) throw new Error("Mission inconnue : " + id);
  const decisionFolder = "ai-company/decisions";
  const folderError = inspectPath(repoRoot, decisionFolder, false, true);
  if (folderError) throw new Error(folderError);
  const decisions = readdirSync(resolve(repoRoot, decisionFolder)).filter(name => /^DEC-\d{4}-.+\.md$/.test(name)).sort().map(name => {
    const source = `${decisionFolder}/${name}`;
    const error = inspectPath(repoRoot, source, true, true);
    if (error) throw new Error(error);
    const bytes = readFileSync(resolve(repoRoot, source));
    const content = bytes.toString("utf8");
    const field = label => content.split(/\r?\n/).find(line => line.startsWith(`- ${label} : `))?.slice(label.length + 5) ?? null;
    return {
      id: field("Identifiant"), title: content.split(/\r?\n/)[0].replace(/^# /, ""),
      declaredStatus: field("Statut"), date: field("Date"), source, sha256: sha256(bytes),
      validationSource: field("Source de la validation"), replacedBy: field("Remplacée par"),
    };
  });
  return {
    limitation: "Vue dérivée. Statuts et accords déclarés à confronter aux sources humaines ; aucune autorisation créée. Aucun test relancé. Aucun effet externe rejoué.",
    sources: ["AGENTS.md", "PRODUCT.md", "ARCHITECTURE_DECISIONS.md", "ai-company/company/current-state.md", "ai-company/company/priorities.md", "ai-company/operations/autonomy.md", "ai-company/workflows/copil.md"],
    decisions,
    missions: missions.filter(mission => !["done", "cancelled"].includes(mission.status) || mission.id === id).map(mission => ({
      id: mission.id, title: mission.title, status: mission.status, owner: mission.owner,
      file: mission.file, fileSha256: sha256(readFileSync(resolve(repoRoot, mission.file))),
      objective: mission.objective, authorization: mission.authorization,
      scope: mission.scope, nextAction: mission.nextAction, blocker: mission.blocker,
      externalActions: mission.externalActions, completion: mission.completion,
      verification: verificationErrors(repoRoot, mission),
      checks: mission.checks.map(({ snapshot, ...check }) => ({ ...check, snapshotPresent: Boolean(snapshot) })),
      consumption: mission.consumption ?? { codexTokens: null, codexCost: null, apiCost: null, note: "Usage attribuable non disponible" },
    })),
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
if (process.argv[2] === "--resume" && process.argv.length <= 4) {
  try {
    const result = resumeContext(root, process.argv[3]);
    result.git = execFileSync("git", ["--no-optional-locks", "status", "--short"], { cwd: root, encoding: "utf8", timeout: 15000, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] }).trim();
    result.head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8", timeout: 15000, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] }).trim();
    console.log(JSON.stringify(result, null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
} else if (process.argv.length !== 2) {
  console.error("Usage : context.mjs [--resume [ID]]"); process.exitCode = 1;
} else {
const queries = [
  ["Branche", ["branch", "--show-current"]],
  ["HEAD", ["rev-parse", "HEAD"]],
  ["État local (inclut les non-suivis)", ["status", "--short", "--untracked-files=normal"]],
  ["Commits récents", ["log", "-8", "--date=short", "--format=%h %ad %s"]],
  ["Diff non indexé", ["diff", "--stat"]],
  ["Diff indexé", ["diff", "--cached", "--stat"]],
];
console.log("# Contexte Git — " + new Date().toISOString());
console.log("\nConstats locaux uniquement. Ni bilan sémantique, ni preuve de déploiement ou de tests.");
for (const [title, args] of queries) {
  console.log("\n## " + title + "\n");
  try {
    const output = execFileSync("git", ["--no-optional-locks", "-c", "core.quotePath=false", ...args], {
      cwd: root, encoding: "utf8", timeout: 15000, maxBuffer: 1024 * 1024,
      windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
    }).trimEnd();
    console.log(output || (title === "Branche" ? "(HEAD détachée)" : "(aucun changement)"));
  } catch (error) {
    console.error("Collecte Git impossible : " + (error.code ?? error.status ?? "erreur"));
    process.exitCode = 1;
    break;
  }
}
}
}
