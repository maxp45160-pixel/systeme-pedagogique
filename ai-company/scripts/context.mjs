import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Fixed, read-only commands. No shell, network, file content or automatic report write.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
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
