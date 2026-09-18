import { readFileSync, readdirSync, lstatSync, realpathSync, statSync, openSync, closeSync, writeFileSync, renameSync, unlinkSync } from "node:fs";
import { createHash } from "node:crypto";
import { basename, dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const directory = "ai-company/operations/missions";
const text = value => typeof value === "string" && value.trim().length > 0;
const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
const texts = (value, nonempty = false) => Array.isArray(value) && (!nonempty || value.length > 0) && value.every(text);
const active = status => ["ready", "running", "blocked"].includes(status);
const reserved = status => ["running", "blocked"].includes(status);
const closed = status => ["done", "cancelled"].includes(status);

function timestamp(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return false;
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return month >= 1 && month <= 12 && day >= 1 && day <= new Date(Date.UTC(year, month, 0)).getUTCDate() && Number.isFinite(Date.parse(value));
}

// Conservative, portable repository paths; this is validation, not a sandbox.
export function normalizeRepoPath(value) {
  if (!text(value)) return null;
  const path = value.replaceAll("\\", "/").replace(/\/$/, "");
  const parts = path.split("/");
  if (parts.some(part => !part || part === "." || part === ".." || /[<>:"|?*\u0000-\u001f]/.test(part) || /[. ]$/.test(part) || /^\.git$/i.test(part) || /^\.env/i.test(part))) return null;
  return path;
}

export function scopesOverlap(left, right) {
  return left.some(a => right.some(b => {
    const x = normalizeRepoPath(a)?.toLowerCase();
    const y = normalizeRepoPath(b)?.toLowerCase();
    return Boolean(x && y && (x === y || x.startsWith(y + "/") || y.startsWith(x + "/")));
  }));
}

// Pure structural validation. File existence and real paths are checked separately.
export function validateMission(mission, expectedId) {
  const errors = [];
  const require = (condition, message) => { if (!condition) errors.push(message); };
  if (!object(mission)) return ["mission : objet JSON requis"];
  require(text(mission.id) && mission.id === expectedId, "id : doit correspondre au nom du fichier");
  for (const key of ["title", "objective"]) require(text(mission[key]), key + " : texte non vide requis");
  require(["ready", "running", "blocked", "done", "cancelled"].includes(mission.status), "status : valeur inconnue");
  require(object(mission.authorization) && text(mission.authorization.summary) && normalizeRepoPath(mission.authorization.source), "authorization : source locale et résumé requis");
  require(texts(mission.scope, true) && mission.scope.every(normalizeRepoPath), "scope : chemins relatifs bornés requis (.git, .env, chemins absolus et traversées interdits)");
  if (mission.inputs !== undefined) require(texts(mission.inputs) && mission.inputs.every(normalizeRepoPath), "inputs : dépendances de lecture relatives bornées requises");
  if (mission.planLinks !== undefined) {
    require(Array.isArray(mission.planLinks), "planLinks : liste requise");
    if (Array.isArray(mission.planLinks)) {
      const keys = new Set();
      for (const link of mission.planLinks) {
        require(object(link) && normalizeRepoPath(link.source) && /^P\d+-\d+$/.test(link.requirement ?? "") && text(link.scope), "planLinks : source locale, identifiant Pxx-xx et contribution bornée requis");
        const key = `${link?.source}#${link?.requirement}`;
        require(!keys.has(key), "planLinks : lien dupliqué"); keys.add(key);
      }
    }
  }
  if (mission.handoff !== undefined) {
    const handoff = mission.handoff;
    require(object(handoff) && text(handoff.delivered) && texts(handoff.remaining) && texts(handoff.evidence, true)
      && handoff.evidence.every(normalizeRepoPath), "handoff : contribution, reste et preuves locales requis");
    require(object(handoff?.deployment) && ["not-deployed", "unknown", "verified"].includes(handoff.deployment.status)
      && texts(handoff.deployment.evidence) && handoff.deployment.evidence.every(normalizeRepoPath)
      && (handoff.deployment.status !== "verified" || handoff.deployment.evidence.length > 0), "handoff : déploiement distinct et preuve obligatoire si déclaré verified");
  }
  if (mission.status === "done" && Array.isArray(mission.planLinks) && mission.planLinks.length > 0) {
    require(object(mission.handoff), "done : transmission handoff requise pour une mission liée au plan");
  }
  require(typeof mission.owner === "string" && (!["running", "blocked", "done"].includes(mission.status) || text(mission.owner)), "owner : responsable requis pour running, blocked et done");
  require(typeof mission.baseCommit === "string" && /^[a-f0-9]{7,40}$/i.test(mission.baseCommit), "baseCommit : hash Git de 7 à 40 caractères requis");
  require(texts(mission.acceptance, true), "acceptance : critères non vides requis");
  require(typeof mission.nextAction === "string" && (!active(mission.status) || text(mission.nextAction)), "nextAction : prochaine action requise pour une mission active");
  require(mission.status === "blocked" ? text(mission.blocker) : mission.blocker === null, "blocker : texte requis pour blocked, null sinon");
  require(texts(mission.externalActions), "externalActions : liste de textes requise");
  require(timestamp(mission.updatedAt), "updatedAt : date ISO avec fuseau requise");
  require(Array.isArray(mission.checks), "checks : liste requise");
  if (mission.verificationVersion !== undefined) {
    require(mission.verificationVersion === 1, "verificationVersion : seule la version 1 est supportée");
    require(texts(mission.requiredChecks, true) && new Set(mission.requiredChecks).size === mission.requiredChecks.length, "requiredChecks : commandes obligatoires distinctes requises");
  }
  if (Array.isArray(mission.checks)) {
    mission.checks.forEach((check, index) => require(object(check) && text(check.command) && ["passed", "failed", "blocked"].includes(check.result) && timestamp(check.at) && text(check.revision), `checks[${index}] : commande, résultat, date ISO et révision requis`));
  }
  errors.push(...snapshotReferenceErrors(mission));
  if (closed(mission.status)) {
    const completion = mission.completion;
    require(object(completion) && text(completion.summary) && texts(completion.evidence, true) && completion.evidence.every(normalizeRepoPath) && timestamp(completion.at), "completion : résumé, preuves locales et date ISO requis");
    if (mission.status === "done") require(Array.isArray(mission.checks) && mission.checks.length > 0 && mission.checks.every(check => object(check) && check.result === "passed"), "done : contrôles non vides et tous réussis requis");
  } else require(mission.completion === null, "completion : null avant clôture");
  return errors;
}

function within(root, path) {
  const fromRoot = relative(root, path);
  return fromRoot === "" || (!fromRoot.startsWith(".." + sep) && fromRoot !== ".." && !/^(?:[A-Za-z]:|[\\/])/.test(fromRoot));
}

export function inspectPath(root, path, mustBeFile = false, rejectAlias = false) {
  const normalized = normalizeRepoPath(path);
  if (!normalized) return "chemin relatif non autorisé";
  try {
    const target = resolve(root, normalized);
    let ancestor = target;
    while (!lstatSync(ancestor, { throwIfNoEntry: false })) ancestor = dirname(ancestor);
    const actual = realpathSync(ancestor);
    if (!within(root, actual)) return "chemin réel hors dépôt (lien symbolique)";
    if (relative(root, actual) && !normalizeRepoPath(relative(root, actual))) return "chemin réel non autorisé";
    // Scope collisions use declared paths: aliases must not bypass ownership.
    if (rejectAlias && actual.toLowerCase() !== ancestor.toLowerCase()) return "alias de scope interdit : utiliser le chemin réel dans le dépôt";
    if (mustBeFile && !statSync(target).isFile()) return "fichier requis";
    return null;
  } catch (error) {
    return "chemin inaccessible : " + error.code;
  }
}

export function selectNextMission(missions) {
  const owned = missions.filter(mission => reserved(mission.status));
  return missions.filter(mission => mission.status === "ready" && !owned.some(other => scopesOverlap(mission.scope, other.scope)))
    .sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)[0] ?? null;
}

export function checkMissions(repoRoot, replacement = null) {
  const root = realpathSync(repoRoot);
  const folder = resolve(root, directory);
  const errors = [];
  const missions = [];
  const warnings = [];
  const ids = new Set();
  const directoryError = inspectPath(root, directory);
  if (directoryError) return { missions, errors: [directory + " : " + directoryError] };
  if (!lstatSync(folder, { throwIfNoEntry: false })) return { missions, errors };
  for (const filename of readdirSync(folder).filter(name => /\.json$/i.test(name)).sort()) {
    const file = directory + "/" + filename;
    const issue = message => errors.push(file + " : " + message);
    const pathError = inspectPath(root, file, true);
    if (pathError) { issue(pathError); continue; }
    let mission;
    try { mission = replacement?.id === basename(filename).slice(0, -5) ? replacement : JSON.parse(readFileSync(resolve(root, file), "utf8")); }
    catch { issue("JSON invalide"); continue; }
    const structural = validateMission(mission, basename(filename).slice(0, -5));
    structural.forEach(issue);
    if (text(mission?.id)) {
      const id = mission.id.toLowerCase();
      if (ids.has(id)) issue("id dupliqué : " + mission.id);
      ids.add(id);
    }
    if (structural.length) continue;
    for (const [path, mustBeFile, rejectAlias] of [[mission.authorization.source, true], ...mission.scope.map(path => [path, false, true]), ...(mission.inputs ?? []).map(path => [path, false, true]), ...(mission.completion?.evidence ?? []).map(path => [path, true]), ...(mission.planLinks ?? []).map(link => [link.source, true, true]), ...(mission.handoff?.evidence ?? []).map(path => [path, true, true]), ...(mission.handoff?.deployment?.evidence ?? []).map(path => [path, true, true])]) {
      const error = inspectPath(root, path, mustBeFile, rejectAlias);
      if (error) issue(path + " : " + error);
    }
    missions.push({ ...mission, file });
    if (mission.verificationVersion === 1 && mission.status === "done") {
      // A historical completion remains historical when later work changes inputs.
      // Freshness is enforced at update/closure, and exposed at every later read.
      verificationErrors(root, mission).forEach(error => warnings.push(file + " : " + error));
    }
  }
  const owned = missions.filter(mission => reserved(mission.status));
  for (let i = 0; i < owned.length; i++) {
    for (let j = i + 1; j < owned.length; j++) {
      if (scopesOverlap(owned[i].scope, owned[j].scope)) errors.push(`Scopes réservés en conflit (running/blocked) : ${owned[i].id} / ${owned[j].id}`);
    }
  }
  return { missions, errors, ...(warnings.length ? { warnings } : {}) };
}

export const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");

// An optional pool changes storage only; hashes bind the exact serialized snapshot.
function snapshotReferenceErrors(mission) {
  const errors = [];
  const pool = mission.snapshots;
  if (pool !== undefined) {
    if (mission.verificationVersion !== 1) errors.push("snapshots : verificationVersion 1 requise");
    if (!object(pool)) errors.push("snapshots : objet requis");
    else for (const [ref, snapshot] of Object.entries(pool)) {
      if (!/^[a-f0-9]{64}$/.test(ref) || !object(snapshot) || sha256(JSON.stringify(snapshot)) !== ref) {
        errors.push("snapshots : empreinte invalide : " + ref);
      }
    }
  }
  for (const [index, check] of (Array.isArray(mission.checks) ? mission.checks : []).entries()) {
    if (!object(check) || !Object.hasOwn(check, "snapshotRef")) continue;
    if (mission.verificationVersion !== 1 || Object.hasOwn(check, "snapshot")) errors.push(`checks[${index}] : snapshotRef exige la version 1 et exclut snapshot`);
    if (typeof check.snapshotRef !== "string" || !/^[a-f0-9]{64}$/.test(check.snapshotRef)
      || !object(pool) || !Object.hasOwn(pool, check.snapshotRef)) errors.push(`checks[${index}] : snapshotRef absent du pool ou invalide`);
  }
  return errors;
}

// Use after structural validation; presence never implies freshness or test execution.
export function checkSnapshot(mission, check) {
  return Object.hasOwn(check, "snapshotRef") ? mission.snapshots?.[check.snapshotRef] : check.snapshot;
}

// Pure representation conversion: no checkout reads, timestamps, results or proofs added.
export function compactMissionSnapshots(mission) {
  if (mission.verificationVersion !== 1) throw new Error("Déduplication réservée aux preuves verificationVersion 1");
  const errors = snapshotReferenceErrors(mission);
  if (errors.length) throw new Error(errors.join("\n"));
  const candidate = structuredClone(mission);
  for (const check of candidate.checks) {
    if (!Object.hasOwn(check, "snapshot")) continue;
    if (!object(check.snapshot)) throw new Error("snapshot : objet requis pour la déduplication");
    const ref = sha256(JSON.stringify(check.snapshot));
    (candidate.snapshots ??= {})[ref] = check.snapshot;
    delete check.snapshot;
    check.snapshotRef = ref;
  }
  return candidate;
}

// Evidence freshness, not proof that a command ran or that a human approved it.
export function snapshotMission(repoRoot, mission) {
  const root = realpathSync(repoRoot);
  const files = new Map();
  const ownFile = `${directory}/${mission.id}.json`.toLowerCase();
  function visit(path) {
    const normalized = normalizeRepoPath(path);
    const error = inspectPath(root, path, false, true);
    if (error) throw new Error(`${path} : ${error}`);
    if (normalized.toLowerCase() === ownFile || normalized.startsWith(directory + "/.")) return;
    const target = resolve(root, normalized);
    const stat = lstatSync(target, { throwIfNoEntry: false });
    if (!stat) { files.set(normalized, null); return; }
    if (stat.isSymbolicLink()) throw new Error("Lien interdit : " + path);
    if (stat.isDirectory()) {
      files.set(normalized + "/", "directory");
      for (const child of readdirSync(target).sort()) visit(normalized + "/" + child);
    } else if (stat.isFile()) files.set(normalized, sha256(readFileSync(target)));
    else throw new Error("Type de fichier interdit : " + path);
  }
  for (const path of [...mission.scope, ...(mission.inputs ?? []), mission.authorization.source,
    ...(mission.planLinks ?? []).map(link => link.source), ...(mission.handoff?.evidence ?? []), ...(mission.handoff?.deployment?.evidence ?? [])]) visit(path);
  const contract = {
    id: mission.id, objective: mission.objective, authorization: mission.authorization,
    scope: mission.scope, inputs: mission.inputs, acceptance: mission.acceptance, requiredChecks: mission.requiredChecks,
    planLinks: mission.planLinks, handoff: mission.handoff,
  };
  return { contractSha256: sha256(JSON.stringify(contract)), files: [...files].sort(([a], [b]) => a.localeCompare(b, "en")) };
}

export function verificationErrors(root, mission) {
  if (mission.verificationVersion !== 1) return ["Preuves historiques déclaratives : fraîcheur non contrôlée"];
  const errors = snapshotReferenceErrors(mission);
  if (!texts(mission.requiredChecks, true) || new Set(mission.requiredChecks).size !== mission.requiredChecks.length) {
    return ["requiredChecks : commandes obligatoires distinctes requises"];
  }
  let current;
  try { current = JSON.stringify(snapshotMission(root, mission)); }
  catch (error) { return [error.message]; }
  for (const command of mission.requiredChecks) {
    const checks = mission.checks.filter(check => check.command === command);
    if (checks.length !== 1 || checks[0].result !== "passed") errors.push("Contrôle requis non réussi : " + command);
  }
  for (const check of mission.checks) {
    if (JSON.stringify(checkSnapshot(mission, check)) !== current) errors.push("Preuve absente ou périmée : " + check.command);
  }
  return errors;
}

// One cooperative writer per checkout. Runtime permissions remain the trust boundary.
// No command execution, model call, decision promotion or retry is performed here.
export function updateMission(repoRoot, id, expectedSha256, candidate) {
  const root = realpathSync(repoRoot);
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(id) || !/^[a-f0-9]{64}$/.test(expectedSha256)) throw new Error("Identité ou empreinte attendue invalide");
  const file = `${directory}/${id}.json`;
  const lock = `${directory}/.update.lock`;
  // wx refuses any existing lock (including a symlink); inspecting that transient
  // path first races another writer removing its lock.
  for (const path of [directory, file]) {
    const error = inspectPath(root, path, path === file, true);
    if (error) throw new Error(error);
  }
  const lockPath = resolve(root, lock);
  const fd = openSync(lockPath, "wx");
  let temporary;
  try {
    writeFileSync(fd, JSON.stringify({ id, pid: process.pid, at: new Date().toISOString() }));
    const target = resolve(root, file);
    const before = readFileSync(target);
    const previous = JSON.parse(before.toString("utf8"));
    const bytes = Buffer.from(JSON.stringify(candidate, null, 2) + "\n");
    if (before.equals(bytes)) return { changed: false, sha256: sha256(before) };
    if (sha256(before) !== expectedSha256) throw new Error("Conflit de révision : relire la fiche avant de reprendre");
    if (candidate.id !== id) throw new Error("Identité de mission modifiée");
    if (previous.verificationVersion === 1 && candidate.verificationVersion !== 1) throw new Error("Retrait du contrôle de preuves interdit");
    // Authorizations/criteria are not granted by a candidate JSON, including imported text.
    for (const key of ["authorization", "scope", "inputs", "acceptance", "requiredChecks", "objective", "planLinks"]) {
      if (JSON.stringify(candidate[key]) !== JSON.stringify(previous[key])) throw new Error("Contrat modifié : réexaminer l'accord avant édition explicite de " + key);
    }
    const errors = validateMission(candidate, id);
    if (errors.length) throw new Error(errors.join("\n"));
    const checked = checkMissions(root, candidate);
    if (checked.errors.length) throw new Error(checked.errors.join("\n"));
    if (candidate.verificationVersion === 1 && candidate.status === "done") {
      const stale = verificationErrors(root, candidate);
      if (stale.length) throw new Error(stale.join("\n"));
    }
    // A direct editor can still bypass the lock. Recheck before the atomic replacement.
    if (sha256(readFileSync(target)) !== expectedSha256) throw new Error("Conflit de révision pendant le contrôle");
    const candidatePath = resolve(root, `${directory}/.${id}.${process.pid}.tmp`);
    const candidateFd = openSync(candidatePath, "wx");
    // Only clean up a temporary file created by this attempt.
    temporary = candidatePath;
    try { writeFileSync(candidateFd, bytes); }
    finally { closeSync(candidateFd); }
    renameSync(temporary, target);
    temporary = null;
    return { changed: true, sha256: sha256(bytes) };
  } finally {
    if (temporary) unlinkSync(temporary);
    closeSync(fd);
    unlinkSync(lockPath);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const command = process.argv[2];
    const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
    const args = process.argv.slice(3);
    if (!(command === "update" && args.length === 2 || command === "snapshot" && args.length === 1 || ["check", "next"].includes(command) && args.length === 0)) throw new Error("Usage : missions.mjs check|next|snapshot ID|update ID SHA256 (JSON sur stdin)");
    if (command === "update") {
      console.log(JSON.stringify(updateMission(root, args[0], args[1], JSON.parse(readFileSync(0, "utf8")))));
    } else {
    const { missions, errors, warnings = [] } = checkMissions(root);
    if (errors.length) {
      errors.forEach(error => console.error(error));
      process.exitCode = 1;
    } else if (command === "snapshot") {
      const mission = missions.find(item => item.id === args[0]);
      if (!mission) throw new Error("Mission inconnue");
      console.log(JSON.stringify(snapshotMission(root, mission), null, 2));
    } else if (command === "check") {
      console.log(`${missions.length} mission(s) cohérente(s). L'accord humain et les preuves déclarées restent à vérifier.`);
      warnings.forEach(warning => console.warn("Historique, à revérifier pour le checkout courant : " + warning));
    } else {
      const next = selectNextMission(missions);
      console.log(next ? `${next.id} — ${next.title}\nObjectif : ${next.objective}\nAccord déclaré : ${next.authorization.source}\nFiche : ${next.file}\nProchaine action : ${next.nextAction}\nSélection en lecture seule ; aucune réservation ni exécution.` : "Aucun travail admissible : aucune mission ready libre de scopes running/blocked.");
    }
    }
  } catch (error) {
    console.error("Contrôle des missions impossible : " + error.message);
    process.exitCode = 1;
  }
}
