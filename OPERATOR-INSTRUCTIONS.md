# BDAG Testnet: testnet-v0.1.0-rc.1

**Experimental private operator trial. Never use on mainnet. Downloading or verifying does not authorize installation or signalling.**

Give this document to your installing agent. Existing vetted operators keep their current ZeroTier approval, blockchain peer approval, configuration, wallet, databases and node identity. Do not reset or re-onboard.

## What you receive from Francois

- `bdag-testnet-v0.1.0-rc.1-linux-amd64.tar.gz`: node binary and instructions.
- `bdag-testnet-v0.1.0-rc.1-source.tar.gz`: matching source, dependency sources and rebuild instructions.
- `release-auth-manifest.json`, `release-auth-manifest.sig`, `release-public-key.pem` and `verify-package.py`.

Receive both archives. Source is supplied privately to the current vetted recipients with its applicable licence rights and notices. Do not confuse the public release-page repository with the node's source. No private keys, configuration files or databases should be in this delivery.

## 1. Verify first, without stopping your node

Use Linux AMD64, Python 3.9+ and OpenSSL 3. Put the files in a new private staging directory. Obtain this signing fingerprint from Francois through a separate trusted channel:

`08076b2af2eab10f1b742ec019d751da0fe81c86d8073c2030c0a93e5d68fee3`

From that directory, inspect the public key fingerprint and verify the manifest with OpenSSL before running any downloaded script:

```sh
openssl pkey -pubin -in release-public-key.pem -outform DER | sha256sum
openssl pkeyutl -verify -pubin -inkey release-public-key.pem -rawin \
  -in release-auth-manifest.json -sigfile release-auth-manifest.sig
sha256sum verify-package.py
```

Stop unless the key fingerprint matches the independently confirmed value, the signature passes, and the script hash matches `verifier.sha256` inside the authenticated manifest. Then run:

```sh
python3 verify-package.py . \
  --trusted-fingerprint 08076b2af2eab10f1b742ec019d751da0fe81c86d8073c2030c0a93e5d68fee3
```

This authenticates and inspects both archives without extracting, installing or executing the node. Stop on any failure. Do not substitute files from another candidate.

## 2. Check your existing node and report readiness

- Supported baseline: unchanged RC2 binary `b2a64347b57dc60fc56b545d0ca6882ccb054189ec0fa486be8475e1109b0bef`, or OIN01 handshake-trial binary `e4429b272e67cf9457c09d0f33eed7dc4f48152bf0170ea6611fd1c6e0de08e6`.
- Resolve the actual service/container, runtime user, executable, arguments, configuration, identity and **both native and EVM database paths**. Inspect locally without printing secrets.
- Confirm chain ID `1043` (`0x413`) and all genesis identities against the signed manifest. Both approved seed peers must be connected on the same native fork. Compare one recent same-numbered EVM block/hash/state root with Francois. `eth_syncing=false` alone is insufficient.
- Keep existing ZeroTier-only P2P restrictions. Native RPC, EVM RPC, health and databases remain private. Preserve Fedora SELinux/Firewalld and Ubuntu firewall settings. No profiler is required. Do not enable mining or synchronization bypasses.
- Report available backup disk space, current binary hash, unchanged peer ID and checkpoint. **Stop here until Francois approves installation.** Keep your current node running.

## Immutable schedule

- Distribution and notice deadline: **25 September 2026, 18:00 UTC (20:00 SAST)**. These compiled timestamps are conservative latest-allowed distribution/notice bounds, not a claim that publication happened at those exact times. Francois must record actual delivery and notice by this deadline.
- Signal window: native layers **26,000–27,999**, requiring **1,500 of 2,000** main-chain layer signals.
- Activation anchor: native layer **29,999**, after the full 2,000-layer delay.
- Earliest activation time: **26 September 2026, 18:00 UTC (20:00 SAST)**. Both the persisted layer anchor and time gate must pass. The EVM must also have reached block 26,000.
- A missed deadline/window means a new candidate. Never edit the manifest, clock, threshold or schedule locally. Operators who receive the release late must contact Francois, not start a late installation.

## 3. Install only after separate approval

1. Pause **every miner consuming templates from this node** before changing its executable. The candidate automatically signals its governance bit during the scheduled window. Keep miners stopped until Francois separately approves signalling. A non-mining node does not itself cast a signal.
2. Stop the node gracefully and confirm no process writes either database. Create a new root-only cold backup of both databases, identity, configuration, old binary/image and service/drop-ins. Hash the inventory. Verify restoration into an isolated location with no peers or mining. Do not upload backups or secrets.
3. Extract only the verified binary archive to a new version-specific directory. Verify extracted `bin/bdag` against `node.sha256` and `activation-manifest.json` against `schedule.manifestSha256`. Preserve the old executable unchanged.
4. **Ubuntu/Fedora systemd:** create a dedicated upgrade drop-in changing only the executable path, preserving the complete original argument vector, user and directories. On OIN01 preserve the existing handshake-trial drop-in as rollback evidence. Inspect the effective `ExecStart`, run `systemd-analyze verify`, keep correct executable permissions/SELinux labels, then start only the node. Do not overwrite the existing configuration with a template.
5. **Coordinator Docker:** use the separately verified coordinator image/digest in the private evidence pack. Preserve volumes, paths, user, resource limits and network restrictions. Do not rebuild an improvised image on a live coordinator or change its miner/nodeworker package. If the coordinator image is not supplied, stop this Docker path and contact Francois.
6. Verify the **running** executable hash/version and unchanged peer ID/configuration. Confirm both seeds reconnect on the same fork and a fresh common EVM checkpoint matches. Observe ten minutes with 30-second samples: peers, head progression, restarts and validation errors. Perform a graceful restart and repeat the checks.

Send the report below. Do not resume mining or signalling without separate approval.

## Recovery and remaining tests

- On identity change, fork/root mismatch, repeated disconnects or validation failure: stop local mining, preserve logs and report. Never reset data or weaken validation to make the node run.
- Before activation, rollback only to a coordinator-confirmed compatible binary and cold state. Preserve failed candidate state for investigation.
- **After activation, never run RC2 against upgraded databases.** Stop mining and follow the coordinated recovery procedure. Restoring old state onto the continuing upgraded network is not a safe downgrade.
- Physical AC-loss recovery is a separate outstanding check, not proven by graceful restart. Group switchover also needs verified backups and operator readiness.
- This trial has historical RC2 EVM replay and isolated native activation/restart evidence. Full multi-operator upgrade, stale-node rejection and browser-wallet journeys remain rehearsal acceptance work. It is not audited or mainnet-ready.
- DAO reward-voting and new user staking use 60-second epochs **after activation**. Existing financial locks/pending exits retain their original entitlements. DAO execution delays remain 72 hours ordinary and seven days critical. Shared RC2 has no legacy staking runtime, so legacy migration is tested separately on an isolated fixture.

## Send this to Francois

```text
BDAG Testnet candidate readiness
Device/operator:
ZeroTier member/IP and unchanged public peer ID:
Current baseline binary hash:
Candidate verification: PASS/FAIL
Binary/source archive SHA-256:
Confirmed signing fingerprint:
Received package and notice at (UTC):
Current native layer and EVM head:
Common EVM block/hash/state root:
Both expected seed peers / same native fork:
Cold backup and isolated restore status:
Physical AC-loss test status:
After approved installation only: running hash, config unchanged, soak, restart, head progression:
Miner state and synchronization bypasses:
Issues:
Status: ready for installation approval / installed awaiting signalling approval / blocked
```

Never include private keys, seed phrases, credentials, complete configurations or backups.
