import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readdirSync, readFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { codeQuery, readCodeSnapshot, queryCode } from './graph-code.mjs';

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'twiny-code-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  execFileSync('git', ['init', '-q', root], { windowsHide: true });
  mkdirSync(join(root, 'app/src'), { recursive: true });
  mkdirSync(join(root, 'temporary'));
  writeFileSync(join(root, '.gitignore'), 'app/src/ignored.ts\n');
  writeFileSync(join(root, 'app/src/a.ts'), 'export function alpha() {}');
  return root;
}

test('snapshot includes pending additions, modifications and removals, excludes ignored/test/env files', t => {
  const root = fixture(t);
  const path = join(root, 'app/src/a.ts');
  const first = readCodeSnapshot(root);
  writeFileSync(path, 'export function beta() {}');
  assert.notEqual(readCodeSnapshot(root).sha256, first.sha256);
  for (const name of ['b.test.ts', 'ignored.ts', '.env', 'declaration.d.ts']) writeFileSync(join(root, 'app/src', name), 'secret');
  assert.deepEqual(readCodeSnapshot(root).files.map(([name]) => name), ['app/src/a.ts']);
  execFileSync('git', ['add', 'app/src/a.ts'], { cwd: root, windowsHide: true });
  rmSync(path);
  assert.equal(readCodeSnapshot(root).files.length, 0);
});

test('query validation refuses injection and unbounded output before any tool call', () => {
  assert.throws(() => codeQuery('callers', "x' RETURN x"));
  assert.throws(() => codeQuery('callers', 'ok', 101));
  assert.throws(() => codeQuery('delete', 'ok'));
  assert.match(codeQuery('callers', 'alpha', 2), /e.confidence LIMIT 3$/);
});

test('temporary index is isolated, bounded, refreshed each call and cleaned', t => {
  const root = fixture(t);
  let indexes = 0;
  const temporaryRoot = join(root, 'temporary');
  const run = (binary, args, context) => {
    assert.ok(context.cwd.startsWith(temporaryRoot));
    assert.equal(context.env.CBM_ALLOWED_ROOT, context.cwd);
    assert.equal(JSON.parse(readFileSync(join(context.env.CBM_CACHE_DIR, 'config.json'))).ui_enabled, false);
    if (args[0] === 'config') return {};
    if (args[1] === 'index_repository') {
      indexes++;
      assert.equal(args.at(-1), 'false');
      assert.equal(readFileSync(join(context.cwd, 'app/src/a.ts'), 'utf8'), readFileSync(join(root, 'app/src/a.ts'), 'utf8'));
      return { status: 'indexed' };
    }
    return { columns: ['name'], rows: [['one'], ['two']], total: 2 };
  };
  const first = queryCode(root, { mode: 'find', symbol: 'alpha', limit: 1 }, { run, temporaryRoot });
  assert.equal(first.truncated, true);
  assert.equal(first.rows.length, 1);
  writeFileSync(join(root, 'app/src/a.ts'), 'export function gamma() {}');
  const second = queryCode(root, { mode: 'find', symbol: 'gamma' }, { run, temporaryRoot });
  assert.notEqual(first.freshness.sourceSha256, second.freshness.sourceSha256);
  assert.equal(indexes, 2);
  assert.deepEqual(readdirSync(temporaryRoot), []);
});

test('concurrent changes and index failures reject results and clean temporary data', t => {
  const root = fixture(t);
  const temporaryRoot = join(root, 'temporary');
  const run = (_, args) => {
    if (args[0] === 'config') return {};
    if (args[1] === 'index_repository') return { status: 'indexed' };
    writeFileSync(join(root, 'app/src/new.ts'), 'export const modified = true;');
    return { columns: [], rows: [] };
  };
  assert.throws(() => queryCode(root, { mode: 'find', symbol: 'alpha' }, { run, temporaryRoot }), /Sources modifiées/);
  assert.deepEqual(readdirSync(temporaryRoot), []);
  assert.throws(() => queryCode(root, { mode: 'find', symbol: 'alpha' }, { run: () => { throw Error('index unavailable'); }, temporaryRoot }), /index unavailable/);
  assert.deepEqual(readdirSync(temporaryRoot), []);
});

test('directory aliases cannot add sources from outside the repository', t => {
  const root = fixture(t);
  const elsewhere = mkdtempSync(join(tmpdir(), 'twiny-external-test-'));
  t.after(() => rmSync(elsewhere, { recursive: true, force: true }));
  writeFileSync(join(elsewhere, 'private.ts'), 'export const secret = true;');
  const link = join(root, 'app/src/linked');
  symlinkSync(elsewhere, link, process.platform === 'win32' ? 'junction' : 'dir');
  // Git may omit a directory symlink altogether. If it lists descendants, the
  // snapshot must reject it. Either way no bytes outside the checkout enter.
  try { assert.ok(!readCodeSnapshot(root).files.some(([name]) => name.includes('private'))); }
  catch (error) { assert.match(error.message, /Alias interdit/); }
});
