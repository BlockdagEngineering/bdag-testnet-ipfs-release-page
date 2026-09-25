import { readFile, mkdir, writeFile, copyFile, readdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fingerprint, publicKeyFingerprint, releasePattern, verifySignedManifest, renderPage } from './release.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const latest = JSON.parse(await readFile(resolve(root, 'latest.json'), 'utf8'));
if (latest.schema !== 'bdag.testnet.latest.v1' || !(latest.release === null || releasePattern.test(latest.release))) {
  throw new Error('Invalid latest pointer');
}
const key = await readFile(resolve(root, 'release-public-key.pem'));
if (publicKeyFingerprint(key) !== fingerprint) throw new Error('Signing key fingerprint mismatch');
let manifest = null;
let raw, signature;
if (latest.release !== null) {
  const records = resolve(root, 'releases', latest.release);
  raw = await readFile(resolve(records, 'release-auth-manifest.json'));
  signature = await readFile(resolve(records, 'release-auth-manifest.sig'));
  manifest = verifySignedManifest(raw, signature, key);
  if (manifest.release !== latest.release) throw new Error('Release pointer mismatch');
}
const output = resolve(root, 'dist');
await mkdir(output, { recursive: true });
// Never upload the repository or arbitrary record files. Fail rather than leave stale files.
if ((await readdir(output)).length) throw new Error('dist must be empty. Archive the previous output before rebuilding.');
await writeFile(resolve(output, 'index.html'), renderPage(manifest));
await copyFile(resolve(root, 'styles.css'), resolve(output, 'styles.css'));
await writeFile(resolve(output, 'release-public-key.pem'), key);
if (manifest) {
  await writeFile(resolve(output, 'release-auth-manifest.json'), raw);
  await writeFile(resolve(output, 'release-auth-manifest.sig'), signature);
}
console.log(manifest ? `Built latest release: ${manifest.release}` : 'Built non-installable preparation page');
