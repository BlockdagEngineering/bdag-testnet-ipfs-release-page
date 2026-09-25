import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { validateManifest, verifySignedManifest, renderPage } from '../scripts/release.mjs';

const cid = 'bafy' + 'a'.repeat(55);
const fixture = () => ({
  schema: 'bdag.testnet.release.v1', release: 'testnet-v0.1.0-rc.1', status: 'published',
  chainId: '1043', epochSeconds: 60, architecture: 'linux-amd64',
  nativeGenesis: '0x06d7950592aa0319de5e81bc29a7ac283010274a5ca2561f319ab1bdb8b222df',
  evmGenesis: '0x58d97c1c16a3ff988105c2bd101b2f473103cc2ef7106ade3296647de65a1663',
  evmGenesisStateRoot: '0xba6c20f5d0f78f8f636d6f96888608b06e81398efb2f5b8163c695229d8e4488',
  node: { path: 'bin/bdag', sha256: 'b'.repeat(64) },
  schedule: {
    signalStartLayer: '30000', signalWindowLayers: '2000', signalThresholdLayers: '1500',
    activationDelayLayers: '2000', activationLayer: '33999', earliestEvmBlock: '30000',
    noticePublishedAt: '1800000000', notBeforeTimestamp: '1800086400', manifestSha256: 'c'.repeat(64),
  },
  package: { filename: 'bdag-testnet-v0.1.0-rc.1-linux-amd64.tar.gz', sha256: 'a'.repeat(64), bytes: 12345, cid },
  recordsCid: cid, providers: ['pinata', 'filebase'],
  distribution: 'github-and-ipfs',
  qualifications: { cleanReplay: true, isolatedUpgrade: true, independentBuilds: true, artifactsVerified: true },
});
test('private operator trial has scoped evidence and no public binary or source download', () => {
  const v = fixture(); v.distribution = 'private-operator-delivery';
  delete v.package.cid; delete v.recordsCid; v.providers = [];
  v.source = { filename: `bdag-${v.release}-source.tar.gz`, sha256: 'd'.repeat(64), bytes: 200, access: 'vetted-recipients' };
  v.qualifications = { profile: 'experimental-operator-trial-v1', rc2HistoricalEvmReplay: true, nativeActivationReplay: true, persistedRestart: true, independentBuilds: true, artifactsVerified: true };
  const html = renderPage(v);
  assert.match(html, /Private operator trial/);
  assert.match(html, /matching source/);
  assert.doesNotMatch(html, /releases\/download|Download package/);
  delete v.source;
  assert.throws(() => validateManifest(v), /source/i);
});
test('trial qualification cannot be used to publish public downloads', () => {
  const v = fixture(); v.qualifications = { profile: 'experimental-operator-trial-v1', rc2HistoricalEvmReplay: true, nativeActivationReplay: true, persistedRestart: true, independentBuilds: true, artifactsVerified: true };
  assert.throws(() => validateManifest(v));
});
test('signed release must bind the binary, genesis root and safe activation schedule', () => {
  for (const mutate of [
    v => delete v.schedule, v => delete v.node, v => v.node.path = '../bdag',
    v => v.node.sha256 = 'unhashed', v => v.evmGenesisStateRoot = '0x00',
    v => v.schedule.signalThresholdLayers = '1', v => v.schedule.activationDelayLayers = '1999',
    v => v.schedule.activationLayer = '34000', v => v.schedule.signalStartLayer = '030000',
    v => v.schedule.notBeforeTimestamp = '1800000001', v => delete v.schedule.manifestSha256,
  ]) { const v = fixture(); mutate(v); assert.throws(() => validateManifest(v)); }
});

test('latest view has an honest non-installable empty state', () => {
  const html = renderPage(null);
  assert.match(html, /No testnet release is available yet/);
  assert.doesNotMatch(html, /Download package|curl |install\.sh/);
});
test('qualified release renders one latest version with immutable links', () => {
  const value = fixture(); validateManifest(value);
  const html = renderPage(value);
  assert.match(html, /testnet-v0\.1\.0-rc\.1/);
  assert.match(html, /Download package/);
  assert.match(html, /Never use on mainnet/);
  assert.doesNotMatch(html, /<select|innerHTML|onclick=/);
});
test('rejects unqualified, wrong-network, unsafe or incomplete records', () => {
  for (const mutate of [
    v => v.status = 'draft', v => v.chainId = '1404', v => v.epochSeconds = 7,
    v => v.evmGenesis = '0x00', v => v.nativeGenesis = '0x00',
    v => v.release = '<script>alert(1)</script>', v => v.package.filename = '../secret',
    v => v.package.cid = 'javascript:alert(1)', v => v.package.bytes = 0,
    v => v.providers = ['pinata', 'pinata'], v => v.qualifications.cleanReplay = false,
    v => delete v.qualifications.isolatedUpgrade,
  ]) { const v = fixture(); mutate(v); assert.throws(() => validateManifest(v)); }
});
test('signature covers the exact manifest bytes and rejects replacement keys', () => {
  const pair = generateKeyPairSync('ed25519');
  const other = generateKeyPairSync('ed25519');
  const raw = Buffer.from(JSON.stringify(fixture()));
  const signature = sign(null, raw, pair.privateKey);
  assert.deepEqual(verifySignedManifest(raw, signature, pair.publicKey), fixture());
  assert.throws(() => verifySignedManifest(Buffer.concat([raw, Buffer.from(' ')]), signature, pair.publicKey));
  assert.throws(() => verifySignedManifest(raw, signature, other.publicKey));
});
test('GitHub-only release explicitly defers IPFS without weakening qualification', () => {
  const v = fixture(); v.distribution = 'github-only';
  delete v.package.cid; delete v.recordsCid; v.providers = [];
  validateManifest(v);
  const html = renderPage(v);
  assert.match(html, /IPFS mirrors are not published yet/);
  assert.match(html, /https:\/\/github.com\/BlockdagEngineering\/bdag-testnet-ipfs-release-page\/releases\/download\/testnet-v0.1.0-rc.1/);
  assert.doesNotMatch(html, /https:\/\/ipfs.io|undefined/);
  v.qualifications.cleanReplay = false;
  assert.throws(() => validateManifest(v));
});
test('empty page shows latest candidate and does not suggest IPFS is blocking page hosting', () => {
  const html = renderPage(null);
  assert.match(html, /testnet-v0.1.0-rc.1/);
  assert.match(html, /GitHub Pages/);
  assert.match(html, /IPFS.*later/);
});
