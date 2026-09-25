# BDAG Testnet releases

Latest-only release page for the experimental **chain 1043** testnet. Never use these packages on mainnet.

## Current status

- First candidate: `testnet-v0.1.0-rc.1`, not yet qualified or downloadable.
- GitHub Pages hosts the page. GitHub Releases will host qualified compiled packages.
- IPFS and managed pinning accounts are deferred. No IPFS availability is claimed.
- Node, contract and application source stays private. This repository contains only the public release page, verification tools and approved release records.
- Publication is not permission to install, signal or activate. Those remain separate operator/coordinator decisions.

## Local checks

Use Node 24.19.0. No dependencies are required.

```sh
npm test
npm run build
```

The build requires an empty `dist` directory and copies only explicitly allowed public files. Archive a previous `dist` before rebuilding. Preview `dist/index.html` with a static HTTP server.

## Publishing a qualified release

1. Complete candidate qualification and record the immutable source revisions, package hash, byte size, chain identity and activation schedule.
2. Publish compiled packages, `OPERATOR-INSTRUCTIONS.md` and `verification-records.tar.gz` as GitHub Release assets. Do not upload private source, node configuration, identities, databases or credentials. GitHub's automatic source archives contain this public page only.
3. Add the exact signed `release-auth-manifest.json` and binary Ed25519 `release-auth-manifest.sig` under `releases/<version>/`. Keep the signing private key outside the repository and CI. Share its public fingerprint through a separate trusted channel.
4. Use `distribution: "github-only"`, omit IPFS CIDs and use an empty providers array until IPFS is actually available. The signed qualification fields are publisher attestations, not substitutes for checking the underlying evidence.
5. Set `latest.json` to that version. Tests and the build reject unsigned, mismatched, wrong-network or unqualified records. Push the public page only to branch `testnet`.

Never edit already-published release records. A correction needs a new release or separately signed distribution record. The page displays one latest release, while old release records and downloads remain preserved.

## Later IPFS setup

- Use dedicated testnet accounts with two independent providers, proposed Pinata and Filebase. Account creation, billing and provider tokens are not configured yet.
- Pin the package directory and verification records first. The records directory must not contain the manifest that refers to its own CID.
- Sign a distribution record, build and pin the immutable page, then publish its CID separately. Never put a page's own CID inside that page.
- Verify full downloads, hashes and availability from both providers before claiming IPFS distribution. A cached gateway response alone is insufficient.
- Keep old pins. A future testnet IPNS name must use its own key. Never reuse mainnet keys, accounts or mutable pointers.

The public signing-key fingerprint is SHA-256 over its DER-encoded SubjectPublicKeyInfo:

`08076b2af2eab10f1b742ec019d751da0fe81c86d8073c2030c0a93e5d68fee3`

The [existing mainnet release site](https://blockdagengineering.github.io/bdag-ipfs-release-page/) is a visual and publishing reference only. This repository does not change it.
