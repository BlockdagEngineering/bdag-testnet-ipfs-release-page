# BDAG Testnet releases

Latest-only release page for the experimental **chain 1043** testnet. Never use these packages on mainnet.

## Current status

- First candidate: `testnet-v0.1.0-rc.1`, an experimental private operator trial. See the signed latest record for availability and schedule.
- GitHub Pages hosts metadata and instructions only. Francois supplies the compiled package and matching source privately to current vetted operators.
- IPFS and managed pinning accounts are deferred. No IPFS availability is claimed.
- No node, contract or application source is published in this repository. Private recipients receive matching build source and its accompanying licence rights. Source provenance review is not represented as independently complete.
- Publication is not permission to install, signal or activate. Those remain separate operator/coordinator decisions.

## Local checks

Use Node 24.19.0. No dependencies are required.

```sh
npm test
npm run build
python3 -m unittest discover -s tests -p '*_test.py' -v
```

The build requires an empty `dist` directory and copies only explicitly allowed public files. Archive a previous `dist` before rebuilding. Preview `dist/index.html` with a static HTTP server.

## Publishing trial metadata

1. Complete candidate qualification and record the immutable source revisions, package hash, byte size, chain identity and activation schedule.
2. Deliver the compiled package, matching source and signed verification files privately to vetted recipients. Publish only metadata and `OPERATOR-INSTRUCTIONS.md`. Do not upload private archives, node configuration, identities, databases or credentials. GitHub's automatic source archives contain this public page only.
3. Add the exact signed `release-auth-manifest.json` and binary Ed25519 `release-auth-manifest.sig` under `releases/<version>/`. Keep the signing private key outside the repository and CI. Share its public fingerprint through a separate trusted channel.
4. Use `distribution: "private-operator-delivery"`, omit IPFS CIDs and use an empty providers array. The explicit `experimental-operator-trial-v1` profile records historical RC2 EVM replay, native activation/restart, clean-container matching builds and artifact checks. It does not claim completed live multi-operator, browser-wallet or recovery acceptance. Qualification fields are publisher attestations, not independent review.
5. Set `latest.json` to that version. Tests and the build reject unsigned, mismatched, wrong-network or unqualified records. Push the public page only to branch `testnet`.

Never edit already-published release records. A correction needs a new release or separately signed distribution record. The page displays one latest release, while old release records and downloads remain preserved.

## Offline operator verification

The read-only `scripts/verify-package.py` requires Python 3.9+ and OpenSSL 3. Obtain this verifier from a reviewed commit of this public repository. Do not execute scripts from an unverified download. It needs no private source access, npm packages, RPC access or credentials.

Obtain the private binary and source archives, `release-auth-manifest.json`, `release-auth-manifest.sig`, `release-public-key.pem` and verifier from Francois. Follow [operator instructions](OPERATOR-INSTRUCTIONS.md) to authenticate the manifest and verifier before running it. Confirm the fingerprint below with Francois through a separate trusted channel, then run:

```sh
python3 scripts/verify-package.py /absolute/path/to/staging \
  --trusted-fingerprint 08076b2af2eab10f1b742ec019d751da0fe81c86d8073c2030c0a93e5d68fee3
```

The verifier authenticates the exact manifest bytes and package, validates chain identity and minimum schedule gates, and inspects the archive without extracting or executing it. A passing report grants **no installation or activation approval**. It does not check the live native layer, guarantee that the schedule has not been missed, or independently prove the publisher's qualification claims.

The signed binary package inventory is exactly `bin/bdag`, `activation-manifest.json`, `OPERATOR-INSTRUCTIONS.md` and `LICENSES.txt`. No symlinks, devices, duplicate paths, extra files or writable-by-group/others entries are allowed. The signed outer manifest pins both archives, binary, activation manifest, genesis identifiers and schedule. The verifier checks matching-source archive paths without extracting them. Verification never grants installation or signalling approval.

## Later IPFS setup

- Use dedicated testnet accounts with two independent providers, proposed Pinata and Filebase. Account creation, billing and provider tokens are not configured yet.
- Pin the package directory and verification records first. The records directory must not contain the manifest that refers to its own CID.
- Sign a distribution record, build and pin the immutable page, then publish its CID separately. Never put a page's own CID inside that page.
- Verify full downloads, hashes and availability from both providers before claiming IPFS distribution. A cached gateway response alone is insufficient.
- Keep old pins. A future testnet IPNS name must use its own key. Never reuse mainnet keys, accounts or mutable pointers.

The public signing-key fingerprint is SHA-256 over its DER-encoded SubjectPublicKeyInfo:

`08076b2af2eab10f1b742ec019d751da0fe81c86d8073c2030c0a93e5d68fee3`

The [existing mainnet release site](https://blockdagengineering.github.io/bdag-ipfs-release-page/) is a visual and publishing reference only. This repository does not change it.
