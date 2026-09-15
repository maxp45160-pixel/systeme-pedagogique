import { readFileSync, readdirSync, existsSync, realpathSync, statSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const roles = ["chief-of-staff", "product", "cto", "qa", "research"];
const sections = ["MISSION", "RESPONSABILITÉS", "SOURCES DE VÉRITÉ",
  "ENTRÉES", "SORTIES", "INTERDICTIONS", "CONDITIONS D'ESCALADE"];
const decisionSections = ["Contexte", "Problème", "Options étudiées",
  "Décision", "Justification", "Conséquences", "Éléments de remise en cause", "Historique"];

function within(root, path) {
  const rel = relative(root, path);
  return rel !== ".." && !rel.startsWith(".." + sep) && !isAbsolute(rel);
}

function markdownFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = resolve(dir, entry.name);
    // Do not follow directory links into private or unrelated folders.
    return entry.isDirectory() ? markdownFiles(path)
      : entry.isFile() && entry.name.endsWith(".md") ? [path] : [];
  });
}

function prose(text) {
  let fenced = false;
  return text.split(/\r?\n/).filter(line => {
    if (/^\s*[\x60]{3}/.test(line)) { fenced = !fenced; return false; }
    return !fenced;
  }).join("\n");
}

function anchors(text) {
  const ids = new Set([...text.matchAll(/<a\s+(?:name|id)=["']([^"']+)["']/g)].map(m => m[1]));
  const counts = new Map();
  for (const match of prose(text).matchAll(/^#{1,6}\s+(.+)$/gm)) {
    const slug = match[1].trim().toLowerCase().replace(/<[^>]*>/g, "")
      .replace(/[^\p{L}\p{N}_ -]/gu, "").replace(/ /g, "-");
    const n = counts.get(slug) ?? 0;
    counts.set(slug, n + 1);
    ids.add(n ? slug + "-" + n : slug);
  }
  return ids;
}

export function checkCompany(repoRoot) {
  const root = realpathSync(repoRoot);
  const company = resolve(root, "ai-company");
  const errors = [];
  if (!existsSync(company)) return { files: 0, links: 0, errors: ["ai-company absent"] };
  const files = markdownFiles(company);
  const texts = new Map();
  let links = 0;
  const issue = (file, message) => errors.push(relative(root, file) + ": " + message);

  for (const file of files) {
    const text = readFileSync(file, "utf8");
    texts.set(file, text);
    if ((text.match(/^\s*[\x60]{3}/gm) ?? []).length % 2) issue(file, "bloc Markdown non fermé");
    if (text.includes("\uFFFD")) issue(file, "caractère de remplacement Unicode");
    for (const match of prose(text).matchAll(/\[[^\]\n]*\]\(([^)\n]+)\)/g)) {
      const href = match[1].trim().replace(/^<|>$/g, "");
      if (/^(https?:|mailto:)/i.test(href)) continue;
      links++;
      if (/^[a-z][a-z0-9+.-]*:/i.test(href)) { issue(file, "lien non portable : " + href); continue; }
      let pathPart, fragment;
      try {
        const hash = href.indexOf("#");
        pathPart = decodeURIComponent(hash < 0 ? href : href.slice(0, hash));
        fragment = hash < 0 ? "" : decodeURIComponent(href.slice(hash + 1));
      } catch {
        issue(file, "lien mal encodé : " + href); continue;
      }
      const target = pathPart ? resolve(dirname(file), pathPart) : file;
      if (!within(root, target)) { issue(file, "lien hors dépôt : " + href); continue; }
      if (!existsSync(target)) { issue(file, "cible absente : " + href); continue; }
      if (!within(root, realpathSync(target))) { issue(file, "lien réel hors dépôt : " + href); continue; }
      if (fragment && statSync(target).isFile() && target.endsWith(".md")) {
        if (!anchors(readFileSync(target, "utf8")).has(fragment)) issue(file, "ancre absente : " + href);
      }
    }
  }
  for (const role of roles) {
    const file = resolve(company, "agents", role + ".md");
    const text = texts.get(file);
    if (!text) { issue(file, "contrat absent"); continue; }
    for (const section of sections) {
      if (!text.split(/\r?\n/).includes("## " + section)) issue(file, "rubrique absente : " + section);
    }
  }

  const indexFile = resolve(company, "decisions", "README.md");
  const index = texts.get(indexFile) ?? "";
  const ids = new Set();
  for (const [file, text] of texts) {
    const name = relative(resolve(company, "decisions"), file);
    const match = /^DEC-(\d{4})-[^/\\]+\.md$/.exec(name);
    if (!match) continue;
    const id = "DEC-" + match[1];
    if (ids.has(id)) issue(file, "identifiant dupliqué : " + id);
    ids.add(id);
    if (!text.includes("- Identifiant : " + id)) issue(file, "identifiant incohérent");
    const date = /^- Date : (\d{4}-\d{2}-\d{2})$/m.exec(text)?.[1];
    const parsed = date ? new Date(date) : new Date(NaN);
    if (!date || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date)
      issue(file, "date invalide");
    const status = /^- Statut : (\w+)$/m.exec(text)?.[1];
    if (!["proposed", "accepted", "rejected", "superseded"].includes(status)) issue(file, "statut invalide");
    for (const section of decisionSections) {
      if (!text.split(/\r?\n/).includes("## " + section)) issue(file, "rubrique décision absente : " + section);
    }
    const row = index.split(/\r?\n/).find(line => line.includes("[" + id + "]"));
    if (!row || !row.includes("| " + status + " |")) issue(file, "index absent ou statut différent");
    if (status && status !== "proposed") {
      for (const field of ["Validation humaine", "Source de la validation"]) {
        const value = text.split(/\r?\n/).find(line => line.startsWith("- " + field + " :"))?.split(" : ").slice(1).join(" : ");
        if (!value || /aucun|unknown|à valider|à renseigner/i.test(value)) issue(file, "provenance humaine manquante : " + field);
      }
      if (status === "superseded" && !/^.*Remplacée par :.*DEC-\d{4}/m.test(text))
        issue(file, "remplacement sans référence");
    }
  }
  return { files: files.length, links, errors };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = checkCompany(resolve(dirname(fileURLToPath(import.meta.url)), "../.."));
    console.log(result.files + " documents ; " + result.links + " liens locaux contrôlés.");
    if (result.errors.length) {
      result.errors.forEach(error => console.error(error));
      process.exitCode = 1;
    } else {
      console.log("Contrats, décisions et liens cohérents. Le sens et les validations humaines restent à relire.");
    }
  } catch (error) {
    console.error("Contrôle impossible : " + error.message);
    process.exitCode = 1;
  }
}
