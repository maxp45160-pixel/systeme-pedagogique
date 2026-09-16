import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { queryCode } from './graph-code.mjs';

export const usage = `Graphes locaux recalculés à la demande :
  npm run agents:graph -- ux [page:/seances] [--depth 1] [--max-nodes 40] [--max-edges 100] [--include-frame]
  npm run agents:graph -- architecture [page:/seances]
  npm run agents:graph -- macro [page:/seances]
  npm run agents:graph -- code callers|callees|find nomDuSymbole [--limit 20]
Sans racine, les vues parcours listent les pages disponibles.
Limites et heuristiques sont annoncées ; vérifier les sources avant de conclure.
Le mode code requiert codebase-memory-mcp déjà installé (CODEBASE_MEMORY_BIN facultatif).`;

export function parseGraphArgs(args) {
  if (!args.length || (args.length === 1 && args[0] === '--help')) return { kind: 'help' };
  const [view, ...rest] = args;
  if (view === 'code') {
    const [mode, symbol, ...flags] = rest;
    if (!['callers', 'callees', 'find'].includes(mode) || !symbol ||
      (flags.length !== 0 && (flags.length !== 2 || flags[0] !== '--limit'))) throw new Error(usage);
    const limit = flags.length ? integer(flags[1], 1, 100, 'limit') : 20;
    return { kind: 'code', options: { mode, symbol, limit } };
  }
  const views = { ux: 'ux-atomique', macro: 'ux-macro', architecture: 'architecture' };
  if (!Object.hasOwn(views, view)) throw new Error(usage);
  const options = {};
  if (rest.length && !rest[0].startsWith('--')) options.root = rest.shift();
  const seen = new Set();
  while (rest.length) {
    const flag = rest.shift();
    if (seen.has(flag)) throw new Error('Option répétée : ' + flag);
    seen.add(flag);
    if (flag === '--include-frame') { options.includeFrame = true; continue; }
    const definitions = { '--depth': ['depth', 0, 10], '--max-nodes': ['maxNodes', 1, 200], '--max-edges': ['maxEdges', 0, 500] };
    if (!Object.hasOwn(definitions, flag)) throw new Error('Option inconnue : ' + flag);
    const [key, min, max] = definitions[flag];
    options[key] = integer(rest.shift(), min, max, flag);
  }
  return { kind: 'workflow', view: views[view], options };
}

function integer(value, min, max, name) {
  if (!/^\d+$/.test(value ?? '') || Number(value) < min || Number(value) > max) throw new Error(`${name} doit être entre ${min} et ${max}`);
  return Number(value);
}

export async function runGraph(args, repoRoot) {
  const parsed = parseGraphArgs(args);
  if (parsed.kind === 'help') return usage;
  if (parsed.kind === 'code') return queryCode(repoRoot, parsed.options);
  const { scanWorkflowView, projectWorkflow } = await import('./graph-workflow.mjs');
  const graph = await scanWorkflowView(parsed.view, { appRoot: resolve(repoRoot, 'app') });
  return { ...projectWorkflow(graph, parsed.options), view: parsed.view,
    freshness: { policy: 'rescan-per-query', checkedAt: new Date().toISOString() },
    warning: 'Parcours détectés avec conventions et heuristiques ; macro partiellement manuelle. Vérifier les sources ; sortie tronquée non exhaustive.' };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await runGraph(process.argv.slice(2), resolve(dirname(fileURLToPath(import.meta.url)), '../..'));
    process.stdout.write((typeof result === 'string' ? result : JSON.stringify(result)) + '\n');
    if (result.status === 'root-not-found') process.exitCode = 1;
  } catch (error) {
    process.stderr.write('Consultation impossible : ' + error.message + '\n');
    process.exitCode = 1;
  }
}
