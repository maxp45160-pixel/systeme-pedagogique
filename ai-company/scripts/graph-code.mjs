import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, realpathSync, mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';

const configurationFiles = ['package.json', 'app/package.json', 'app/tsconfig.json'];
const inside = (root, path) => path === root || path.startsWith(root + sep);

// No ignored files, test fixtures, declarations, secrets or corpus documents.
// Untracked source files are included so unfinished work is visible too.
export function readCodeSnapshot(repoRoot) {
  const root = realpathSync(repoRoot);
  const listed = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', 'app/src', ...configurationFiles],
    { cwd: root, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 8 * 1024 * 1024 });
  const names = [...new Set(listed.split('\0').filter(Boolean))].filter(path =>
    configurationFiles.includes(path) || (path.startsWith('app/src/') && /\.tsx?$/.test(path)
      && !/\.(?:test|spec|d)\.tsx?$/.test(path) && !/(?:^|\/)(?:__tests__|__fixtures__)(?:\/|$)/.test(path))).sort();
  const files = [];
  for (const name of names) {
    let path = root;
    let missing = false;
    for (const part of name.split('/')) {
      path = resolve(path, part);
      if (!inside(root, path)) throw new Error('Chemin hors dépôt : ' + name);
      const info = lstatSync(path, { throwIfNoEntry: false });
      if (!info) { missing = true; break; } // Tracked but deleted in the checkout.
      if (info.isSymbolicLink() || !inside(root, realpathSync(path))) throw new Error('Alias interdit : ' + name);
    }
    if (!missing) files.push([name, readFileSync(path)]);
  }
  const hash = createHash('sha256');
  for (const [name, bytes] of files) hash.update(name).update('\0').update(createHash('sha256').update(bytes).digest());
  return { files, sha256: hash.digest('hex') };
}

export function codeQuery(mode, symbol, limit = 20) {
  if (!['callers', 'callees', 'find'].includes(mode)) throw new Error('Mode code : callers, callees ou find');
  if (!/^[\p{L}_$][\p{L}\p{N}_$]{0,119}$/u.test(symbol ?? '')) throw new Error('Nom simple de symbole requis (sans expression Cypher)');
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error('limit doit être entre 1 et 100');
  if (mode === 'find') return `MATCH (n:Function) WHERE n.name = '${symbol}' RETURN n.name, n.file_path, n.start_line LIMIT ${limit + 1}`;
  const target = mode === 'callers' ? 'b' : 'a';
  return `MATCH (a:Function)-[e:CALLS]->(b:Function) WHERE ${target}.name = '${symbol}' RETURN a.name, a.file_path, a.start_line, b.name, b.file_path, b.start_line, e.line, e.strategy, e.confidence LIMIT ${limit + 1}`;
}

function runLocal(binary, args, { cwd, env }) {
  const stdout = execFileSync(binary, args, { cwd, env, encoding: 'utf8', windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000, maxBuffer: 8 * 1024 * 1024 });
  if (args[0] === 'config') return stdout.trim();
  const result = JSON.parse(stdout);
  if (result.error || result.isError) throw new Error('codebase-memory : ' + JSON.stringify(result.error ?? result));
  return result;
}

// Fresh, disposable index: no daemon, stale-cache fallback or workspace write.
// run injection is only for offline tests; the CLI always uses the local binary.
export function queryCode(repoRoot, { mode, symbol, limit = 20, binary = process.env.CODEBASE_MEMORY_BIN ||
  join(homedir(), '.local', 'bin', process.platform === 'win32' ? 'codebase-memory-mcp.exe' : 'codebase-memory-mcp') } = {},
  { run = runLocal, temporaryRoot = tmpdir() } = {}) {
  const query = codeQuery(mode, symbol, limit); // Validate before any indexing.
  const before = readCodeSnapshot(repoRoot);
  if (!before.files.some(([name]) => name.startsWith('app/src/'))) throw new Error('Aucune source TypeScript à indexer');
  const temporary = mkdtempSync(join(temporaryRoot, 'twiny-agent-graph-'));
  const corpus = join(temporary, 'corpus');
  const cache = join(temporary, 'cache');
  try {
    mkdirSync(cache);
    writeFileSync(join(cache, 'config.json'), JSON.stringify({ ui_enabled: false, ui_port: 9749 }));
    for (const [name, bytes] of before.files) {
      const target = join(corpus, name);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, bytes);
    }
    const context = { cwd: corpus, env: { ...process.env, CBM_CACHE_DIR: cache,
      CBM_ALLOWED_ROOT: corpus, CBM_LOG_LEVEL: 'error', CBM_WORKERS: '2' } };
    run(binary, ['config', 'set', 'auto_watch', 'false'], context);
    const index = run(binary, ['cli', 'index_repository', '--repo-path', corpus, '--name', 'twiny-agent-context', '--persistence', 'false'], context);
    if (index.status !== 'indexed') throw new Error('Indexation non terminée : ' + JSON.stringify(index));
    const result = run(binary, ['cli', 'query_graph', '--project', 'twiny-agent-context', '--query', query, '--max-rows', String(limit + 1)], context);
    if (!Array.isArray(result.rows) || !Array.isArray(result.columns)) throw new Error('Réponse graphe invalide');
    if (readCodeSnapshot(repoRoot).sha256 !== before.sha256) throw new Error('Sources modifiées pendant la requête ; résultat rejeté. Relancer la consultation.');
    // Keep file paths in the real repository, never in a deleted temp directory.
    const normalizePath = value => typeof value === 'string' && value.startsWith(corpus) ? relative(corpus, value).split(sep).join('/') : value;
    return { format: 'twiny-code-context', version: 1, mode, symbol, limit,
      freshness: { policy: 'reindex-per-query', checkedAt: new Date().toISOString(), sourceSha256: before.sha256, files: before.files.length },
      coverage: 'app/src TypeScript courant, hors tests/déclarations/fixtures et fichiers ignorés non suivis ; pas de documents ni SQL',
      warning: 'Relations statiques parfois heuristiques ; vérifier les sources. Aucun résultat ne prouve une absence de dépendance.',
      columns: result.columns, rows: result.rows.slice(0, limit).map(row => row.map(normalizePath)),
      truncated: result.rows.length > limit || Number(result.total) > limit };
  } finally {
    // Delete only the directory created by this invocation, never a computed root.
    const base = realpathSync(temporaryRoot);
    const target = realpathSync(temporary);
    if (!inside(base, target) || dirname(target) !== base || !target.split(sep).at(-1).startsWith('twiny-agent-graph-')) {
      throw new Error('Nettoyage refusé : répertoire temporaire inattendu');
    }
    rmSync(target, { recursive: true, force: true });
  }
}
