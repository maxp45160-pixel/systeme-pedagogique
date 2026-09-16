import test from 'node:test';
import assert from 'node:assert/strict';
import { parseGraphArgs, runGraph } from './graph.mjs';

test('graph CLI validates options before accessing sources or running an indexer', async () => {
  assert.match(await runGraph(['--help'], '/nonexistent'), /recalculés/);
  for (const args of [['ux', '--depth', '-1'], ['ux', '--depth', '1e2'], ['ux', '--max-nodes', '201'],
    ['ux', '--include-frame', '--include-frame'], ['code', 'callers', 'x', '--limit', '0'], ['unknown'], ['ux', 'page:/a', 'page:/b']]) {
    await assert.rejects(runGraph(args, '/nonexistent'));
  }
  assert.deepEqual(parseGraphArgs(['ux', 'page:/seances', '--depth', '2', '--include-frame']),
    { kind: 'workflow', view: 'ux-atomique', options: { root: 'page:/seances', depth: 2, includeFrame: true } });
  assert.deepEqual(parseGraphArgs(['code', 'callers', 'envTuteur', '--limit', '3']),
    { kind: 'code', options: { mode: 'callers', symbol: 'envTuteur', limit: 3 } });
});
