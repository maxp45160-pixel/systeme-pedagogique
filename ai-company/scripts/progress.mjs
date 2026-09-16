import { lstatSync, readFileSync, realpathSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { checkMissions, inspectPath, normalizeRepoPath, verificationErrors } from "./missions.mjs";

const indexPath = "ai-company/product/plan-index.json";
const text = value => typeof value === "string" && value.trim().length > 0;
const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
const key = source => normalizeRepoPath(source)?.toLowerCase();
const requirementId = value => typeof value === "string" && /^P\d+-\d+$/.test(value);

// Read-only joins: a delivery is evidence about a mission, never a product status.
export function planProgress(repoRoot, missions) {
  const root = realpathSync(repoRoot);
  const checked = missions === undefined ? checkMissions(root) : { missions, errors: [] };
  const entries = checked.missions;
  const result = {
    configured: false, requirements: [], unlinkedMissions: [], errors: [...checked.errors],
    limitations: ["Les livraisons ne valident ni une exigence produit ni un déploiement ; aucun statut produit n'est déduit."],
  };
  const linked = new Set();
  const finish = () => {
    result.unlinkedMissions = entries.filter(mission => !linked.has(mission.id)).map(mission => ({
      id: mission.id, status: mission.status, title: mission.title, file: mission.file,
      updatedAt: mission.updatedAt, completion: mission.completion ?? null,
      handoff: mission.handoff ?? null, verification: verificationErrors(root, mission),
    }));
    return result;
  };
  const validatePath = (path, label, mustBeFile = true) => {
    const error = inspectPath(root, path, mustBeFile, true);
    if (error) result.errors.push(`${label} : ${String(path)} : ${error}`);
    return !error;
  };
  if (!validatePath(indexPath, "index", false)) return finish();
  if (!lstatSync(resolve(root, indexPath), { throwIfNoEntry: false })) {
    result.limitations.push("Continuité non configurée : index du plan absent.");
    return finish();
  }
  result.configured = true;
  if (!validatePath(indexPath, "index")) return finish();
  let index;
  try { index = JSON.parse(readFileSync(resolve(root, indexPath), "utf8")); }
  catch { result.errors.push(`${indexPath} : JSON invalide`); return finish(); }
  if (!object(index) || index.version !== 1 || !Array.isArray(index.sources) || !Array.isArray(index.legacyLinks)) {
    result.errors.push(`${indexPath} : version 1, sources et legacyLinks requis`);
    return finish();
  }
  const sources = new Map();
  const requirements = new Map();
  for (const source of index.sources) {
    if (!validatePath(source, "source")) continue;
    const sourceKey = key(source);
    if (sources.has(sourceKey)) { result.errors.push(`Source dupliquée : ${source}`); continue; }
    if (!/\.md$/i.test(source)) { result.errors.push(`Source Markdown requise : ${source}`); continue; }
    const path = normalizeRepoPath(source);
    sources.set(sourceKey, path);
    const lines = readFileSync(resolve(root, path), "utf8").split(/\r?\n/);
    let fence = null;
    lines.forEach((line, number) => {
      const marker = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
      if (fence) {
        if (marker && marker[1][0] === fence[0] && marker[1].length >= fence.length && /^[ \t]*$/.test(marker[2])) fence = null;
        return;
      }
      if (marker && (marker[1][0] !== "`" || !marker[2].includes("`"))) {
        fence = marker[1];
        return;
      }
      const match = /^\s*\|\s*(P\d+-\d+)\s*\|\s*([^|]+)\|/.exec(line);
      if (!match) return;
      const [, id, title] = match;
      const ref = sourceKey + "#" + id;
      if (requirements.has(ref)) { result.errors.push(`Exigence dupliquée : ${path}#${id}`); return; }
      const requirement = { id, title: title.trim(), source: path, line: number + 1, deliveries: [] };
      requirements.set(ref, requirement);
      result.requirements.push(requirement);
    });
  }
  const byMission = new Map(entries.map(mission => [mission.id, mission]));
  const links = new Map();
  const addLink = (mission, source, id, scope, evidence, origin) => {
    if (!byMission.has(mission)) { result.errors.push(`${origin} : mission inconnue ${String(mission)}`); return; }
    if (!validatePath(source, origin)) return;
    const sourceKey = key(source);
    if (!sources.has(sourceKey)) { result.errors.push(`${origin} : source non indexée ${source}`); return; }
    if (!requirementId(id) || !requirements.has(sourceKey + "#" + id)) {
      result.errors.push(`${origin} : exigence inconnue ${source}#${String(id)}`); return;
    }
    if (!text(scope)) { result.errors.push(`${origin} : scope non vide requis`); return; }
    if (!Array.isArray(evidence)) { result.errors.push(`${origin} : evidence doit être une liste`); return; }
    evidence.forEach(path => validatePath(path, origin + " evidence"));
    const ref = sourceKey + "#" + id;
    const linkKey = mission + "#" + ref;
    const previous = links.get(linkKey);
    if (previous?.origin === origin) { result.errors.push(`${origin} : lien dupliqué ${mission} / ${ref}`); return; }
    // Explicit mission links supersede the transitional legacy mapping.
    links.set(linkKey, { mission, ref, scope, evidence, origin });
  };
  for (const legacy of index.legacyLinks) {
    if (!object(legacy) || !Array.isArray(legacy.requirements) || legacy.requirements.length === 0) {
      result.errors.push("legacyLinks : mission, source et liste d'exigences requis"); continue;
    }
    for (const id of legacy.requirements) addLink(legacy.mission, legacy.source, id, legacy.scope, legacy.evidence, "legacyLinks");
  }
  for (const mission of entries) {
    for (const link of mission.planLinks ?? []) {
      if (!object(link)) { result.errors.push(`${mission.id} : planLink invalide`); continue; }
      addLink(mission.id, link.source, link.requirement, link.scope, [], "planLinks");
    }
  }
  for (const link of links.values()) {
    const mission = byMission.get(link.mission);
    const reportPaths = [...new Set([...(mission.completion?.evidence ?? []), ...(mission.handoff?.evidence ?? []), ...link.evidence])];
    reportPaths.forEach(path => validatePath(path, mission.id + " rapport"));
    (mission.handoff?.deployment?.evidence ?? []).forEach(path => validatePath(path, mission.id + " déploiement"));
    requirements.get(link.ref).deliveries.push({
      mission: mission.id, status: mission.status, scope: link.scope, reportPaths,
      handoff: mission.handoff ?? null, verification: verificationErrors(root, mission), updatedAt: mission.updatedAt,
    });
    linked.add(mission.id);
    if (!mission.handoff) {
      const limitation = `${mission.id} : handoff non structuré ; consulter les rapports, sans inférer le reste à faire ou le déploiement.`;
      if (!result.limitations.includes(limitation)) result.limitations.push(limitation);
    }
  }
  return finish();
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = planProgress(process.cwd());
  if (process.argv.includes("--check")) {
    if (result.errors.length) console.error(result.errors.join("\n"));
    else console.log(result.configured ? `Continuité valide : ${result.requirements.length} exigences référencées.` : "Continuité non configurée : index absent.");
  } else console.log(JSON.stringify(result, null, 2));
  if (result.errors.length) process.exitCode = 1;
}
