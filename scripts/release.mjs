import { createHash, createPublicKey, verify } from 'node:crypto';

export const fingerprint = '08076b2af2eab10f1b742ec019d751da0fe81c86d8073c2030c0a93e5d68fee3';
export const releasePattern = /^testnet-v\d+\.\d+\.\d+-rc\.\d+$/;
const cidPattern = /^bafy[a-z2-7]{55}$/; // CIDv1, dag-pb, sha2-256, base32.
const nativeGenesis = '0x06d7950592aa0319de5e81bc29a7ac283010274a5ca2561f319ab1bdb8b222df';
const evmGenesis = '0x58d97c1c16a3ff988105c2bd101b2f473103cc2ef7106ade3296647de65a1663';
const requireValue = (condition, message) => { if (!condition) throw new Error(message); };

export function validateManifest(value) {
  requireValue(value?.schema === 'bdag.testnet.release.v1', 'Unsupported manifest');
  requireValue(value.status === 'published' && releasePattern.test(value.release), 'Not a published testnet release');
  requireValue(value.chainId === '1043' && value.epochSeconds === 60, 'Wrong network or reward epoch policy');
  requireValue(value.nativeGenesis === nativeGenesis && value.evmGenesis === evmGenesis, 'Wrong genesis');
  requireValue(value.architecture === 'linux-amd64', 'Unsupported architecture');
  requireValue(value.package?.filename === `bdag-${value.release}-linux-amd64.tar.gz`, 'Unexpected package filename');
  requireValue(/^[a-f0-9]{64}$/.test(value.package.sha256), 'Invalid package checksum');
  requireValue(Number.isSafeInteger(value.package.bytes) && value.package.bytes > 0, 'Invalid package size');
  requireValue(['github-only', 'github-and-ipfs'].includes(value.distribution), 'Unsupported distribution mode');
  if (value.distribution === 'github-and-ipfs') {
    requireValue(cidPattern.test(value.package.cid) && cidPattern.test(value.recordsCid), 'Expected canonical directory CIDs');
    requireValue(Array.isArray(value.providers) && value.providers.length === 2 &&
      new Set(value.providers).size === 2 && value.providers.every(v => ['pinata', 'filebase'].includes(v)), 'Two independent pinning providers required');
  } else {
    requireValue(value.package.cid === undefined && value.recordsCid === undefined && Array.isArray(value.providers) && value.providers.length === 0, 'GitHub-only release must not claim IPFS availability');
  }
  for (const check of ['cleanReplay', 'isolatedUpgrade', 'independentBuilds', 'artifactsVerified']) {
    requireValue(value.qualifications?.[check] === true, `Release qualification missing: ${check}`);
  }
  return value;
}

export function publicKeyFingerprint(key) {
  const publicKey = key?.type === 'public' ? key : createPublicKey(key);
  requireValue(publicKey.asymmetricKeyType === 'ed25519', 'Expected Ed25519 public key');
  return createHash('sha256').update(publicKey.export({ type: 'spki', format: 'der' })).digest('hex');
}

export function verifySignedManifest(bytes, signature, key) {
  requireValue(signature.length === 64 && verify(null, bytes, key, signature), 'Invalid release signature');
  return validateManifest(JSON.parse(bytes.toString('utf8')));
}

const escape = v => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function renderPage(manifest) {
  if (manifest) validateManifest(manifest);
  const release = manifest && escape(manifest.release);
  const github = `https://github.com/BlockdagEngineering/bdag-testnet-ipfs-release-page/releases/download/${release}`;
  const ipfs = manifest?.distribution === 'github-and-ipfs';
  const instructions = ipfs ? `https://ipfs.io/ipfs/${manifest.recordsCid}/OPERATOR-INSTRUCTIONS.md` : `${github}/OPERATOR-INSTRUCTIONS.md`;
  const section = manifest ? `
    <p class="eyebrow">Latest release · Linux AMD64</p>
    <h1>${release}</h1>
    <p class="intro">A coordinated testnet rehearsal for DAO governance and Staking V2. Verify the package, then wait for the agreed installation window.</p>
    <div class="actions">
      <a class="button" href="${github}/${manifest.package.filename}">Download package <span aria-hidden="true">↗</span></a>
      ${ipfs ? `<a class="secondary" href="https://ipfs.io/ipfs/${manifest.package.cid}/${manifest.package.filename}">IPFS mirror</a>` : ''}
    </div>
    <p><a href="${instructions}">Read operator instructions</a> before changing your node.</p>
    ${ipfs ? '' : '<p class="small">IPFS mirrors are not published yet. Downloads use GitHub Releases.</p>'}
    <section id="verify" class="panel" aria-labelledby="verify-title">
      <h2 id="verify-title">Verify before installing</h2>
      <p>Check the signature and checksum. Confirm the signing fingerprint with Francois through a separate trusted channel.</p>
      <dl><dt>Package SHA-256</dt><dd><code>${manifest.package.sha256}</code></dd>
      <dt>Signing key fingerprint (SHA-256)</dt><dd><code>${fingerprint}</code></dd>
      <dt>Downloads</dt><dd><a href="release-auth-manifest.json">Signed manifest</a> · <a href="release-auth-manifest.sig">Signature</a> · <a href="release-public-key.pem">Public key</a></dd>
      <dt>Verification evidence</dt><dd><a href="${ipfs ? `https://ipfs.io/ipfs/${manifest.recordsCid}/` : `${github}/verification-records.tar.gz`}">Release records</a></dd></dl>
    </section>` : `
    <section class="hero" aria-labelledby="release-title"><div>
      <p class="eyebrow">Chain ID 1043 · Linux AMD64 · Testnet only</p>
      <h1 id="release-title">BlockDAG<br><span>Testnet release</span></h1>
      <p class="intro">The next step for community governance and Staking V2. One release, clear instructions, and a coordinated upgrade rehearsal.</p>
      <div class="actions"><a class="button" href="#status">View release status</a><a class="secondary" href="#safety">Operator safeguards</a></div>
      <p class="small">Hosted on GitHub Pages. IPFS mirrors will be added later.</p>
    </div><section class="panel release-status" aria-labelledby="status-title">
      <p class="eyebrow">Latest candidate</p><h2 id="status-title">In preparation</h2>
      <p>No testnet release is available yet.</p>
      <dl><dt>Version</dt><dd><code>testnet-v0.1.0-rc.1</code></dd><dt>Upgrade</dt><dd>RC2 → DAO + Staking V2</dd><dt>Voting epochs</dt><dd>60 seconds after activation</dd><dt>Downloads</dt><dd>Awaiting qualification</dd></dl>
    </section></section>
    <section id="status" class="panel" aria-labelledby="next-title">
      <h2 id="next-title">What happens next</h2>
      <ol><li>The candidate passes upgrade and replay checks.</li><li>Verified packages and instructions are signed and published on GitHub.</li><li>Operators agree an installation window. Activation requires separate approval.</li></ol>
      <p class="status-note">Keep your current node running. This page does not install software or change your node.</p>
    </section>`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer"><meta name="color-scheme" content="dark">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'">
<title>BDAG Testnet | Latest release</title>
<meta name="description" content="The latest signed BDAG Community testnet release. Experimental software, never for mainnet.">
<link rel="stylesheet" href="styles.css"></head><body>
<a class="skip" href="#main">Skip to content</a>
<header><a class="brand" href="./" aria-label="BDAG Testnet home">BDAG <span>TESTNET RELEASE</span></a><nav aria-label="Release navigation"><a href="${manifest ? '#verify' : '#status'}">${manifest ? 'Verification' : 'Release status'}</a><span class="tag">Experimental</span></nav></header>
<main id="main">${section}
    <aside id="safety" aria-labelledby="safety-title"><h2 id="safety-title">Never use on mainnet</h2>
      <p>Test-BDAG has no monetary value. Participation requires ZeroTier approval and blockchain peer approval. Downloads do not authorize installation or activation.</p>
      <p>Chain ID <strong>1043</strong>. After activation, reward voting uses <strong>60-second epochs</strong>. Existing staking locks and pending exits keep their original entitlements.</p>
      <p>Always keep a verified cold backup. Never run RC2 against an upgraded database.</p>
    </aside>
</main><footer>BDAG Community · Private-network rehearsal · Latest release only</footer>
</body></html>\n`;
}
