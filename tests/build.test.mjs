import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, cp, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const source = resolve(dirname(fileURLToPath(import.meta.url)), '..');

async function fixture(fn) {
  const dir = await mkdtemp(resolve(tmpdir(), 'bdag-public-page-test-'));
  try {
    for (const name of ['scripts', 'styles.css', 'release-public-key.pem']) await cp(resolve(source, name), resolve(dir, name), { recursive: true });
    await writeFile(resolve(dir, 'latest.json'), JSON.stringify({ schema: 'bdag.testnet.latest.v1', release: null }));
    await fn(dir);
  } finally { await rm(dir, { recursive: true, force: true }); }
}
const build = dir => spawnSync(process.execPath, [resolve(dir, 'scripts/build.mjs')], { encoding: 'utf8' });

test('build publishes only allowlisted files and refuses stale output', async () => fixture(async dir => {
  await writeFile(resolve(dir, 'DO-NOT-PUBLISH.txt'), 'private test marker');
  assert.equal(build(dir).status, 0);
  assert.deepEqual((await readdir(resolve(dir, 'dist'))).sort(), ['index.html', 'release-public-key.pem', 'styles.css']);
  assert.notEqual(build(dir).status, 0);
}));
test('build rejects path traversal in latest pointer', async () => fixture(async dir => {
  await writeFile(resolve(dir, 'latest.json'), JSON.stringify({ schema: 'bdag.testnet.latest.v1', release: '../../private' }));
  assert.notEqual(build(dir).status, 0);
}));
test('build rejects substituted public signing key', async () => fixture(async dir => {
  await writeFile(resolve(dir, 'release-public-key.pem'), 'not the expected key');
  assert.notEqual(build(dir).status, 0);
}));

test('signed private release build never includes private delivery archives', async t => {
  const latest = JSON.parse(await readFile(resolve(source, 'latest.json'), 'utf8'));
  if (!latest.release) return t.skip('No signed release record selected yet');
  const record = JSON.parse(await readFile(resolve(source, 'releases', latest.release, 'release-auth-manifest.json'), 'utf8'));
  if (record.distribution !== 'private-operator-delivery') return t.skip('Not a private release');
  await fixture(async dir => {
    for (const name of ['latest.json', 'releases', 'OPERATOR-INSTRUCTIONS.md']) await cp(resolve(source, name), resolve(dir, name), { recursive: true });
    await writeFile(resolve(dir, record.package.filename), 'private binary marker');
    await writeFile(resolve(dir, record.source.filename), 'private source marker');
    assert.equal(build(dir).status, 0);
    assert.deepEqual((await readdir(resolve(dir, 'dist'))).sort(), ['OPERATOR-INSTRUCTIONS.md', 'index.html', 'release-auth-manifest.json', 'release-auth-manifest.sig', 'release-public-key.pem', 'styles.css']);
  });
});
