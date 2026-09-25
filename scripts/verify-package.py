#!/usr/bin/env python3
"""Read-only offline release verification. Requires Python 3.9+ and OpenSSL.

Obtain this verifier from the reviewed release-page repository, not an
unverified package. Authenticate the fingerprint with Francois separately.
This tool never extracts files, executes the node, accesses RPC or installs.
"""
import argparse
import hashlib
import json
import pathlib
import re
import stat
import subprocess
import tarfile

GENESIS = {
    "nativeGenesis": "0x06d7950592aa0319de5e81bc29a7ac283010274a5ca2561f319ab1bdb8b222df",
    "evmGenesis": "0x58d97c1c16a3ff988105c2bd101b2f473103cc2ef7106ade3296647de65a1663",
    "evmGenesisStateRoot": "0xba6c20f5d0f78f8f636d6f96888608b06e81398efb2f5b8163c695229d8e4488",
}
MAX_PACKAGE = 512 * 1024 * 1024
ALLOWED_FILES = {"bin/bdag", "OPERATOR-INSTRUCTIONS.md", "activation-manifest.json", "LICENSES.txt"}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def regular(path, limit):
    info = path.lstat()
    require(stat.S_ISREG(info.st_mode), "input must be a regular non-symlink file")
    require(0 < info.st_size <= limit, "input file exceeds permitted size")
    return info.st_size


def digest(stream):
    value = hashlib.sha256()
    for chunk in iter(lambda: stream.read(1024 * 1024), b""):
        value.update(chunk)
    return value.hexdigest()


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        require(key not in result, "duplicate JSON property")
        result[key] = value
    return result


def hex_digest(value):
    return isinstance(value, str) and re.fullmatch(r"[0-9a-f]{64}", value) is not None


def validate_manifest(value):
    require(isinstance(value, dict) and value.get("schema") == "bdag.testnet.release.v1", "unsupported manifest")
    release = value.get("release", "")
    require(isinstance(release, str) and re.fullmatch(r"testnet-v\d+\.\d+\.\d+-rc\.\d+", release), "invalid testnet release")
    require(value.get("status") == "published", "release is not published and qualified")
    require(value.get("chainId") == "1043" and value.get("epochSeconds") == 60, "wrong network or epoch policy")
    require(all(value.get(key) == expected for key, expected in GENESIS.items()), "wrong genesis identity")
    require(value.get("architecture") == "linux-amd64", "unsupported architecture")
    for check in ("cleanReplay", "isolatedUpgrade", "independentBuilds", "artifactsVerified"):
        require(value.get("qualifications", {}).get(check) is True, "missing release qualification: " + check)
    package = value.get("package", {})
    distribution = value.get("distribution")
    require(distribution in ("github-only", "github-and-ipfs"), "unsupported distribution")
    if distribution == "github-only":
        require("cid" not in package and "recordsCid" not in value and value.get("providers") == [], "GitHub-only release cannot claim IPFS availability")
    else:
        require(all(isinstance(cid, str) and re.fullmatch(r"bafy[a-z2-7]{55}", cid) for cid in (package.get("cid"), value.get("recordsCid"))), "invalid IPFS CIDs")
        require(value.get("providers") in (["pinata", "filebase"], ["filebase", "pinata"]), "two independent providers required")
    require(package.get("filename") == "bdag-" + release + "-linux-amd64.tar.gz", "unsafe package filename")
    require(hex_digest(package.get("sha256")), "invalid package hash")
    require(type(package.get("bytes")) is int and 0 < package["bytes"] <= MAX_PACKAGE, "invalid package size")
    require(value.get("node", {}).get("path") == "bin/bdag" and hex_digest(value["node"].get("sha256")), "missing binary hash")
    schedule = value.get("schedule", {})
    numbers = {}
    for key in ("signalStartLayer", "signalWindowLayers", "signalThresholdLayers", "activationDelayLayers", "activationLayer", "earliestEvmBlock", "noticePublishedAt", "notBeforeTimestamp"):
        raw = schedule.get(key)
        require(isinstance(raw, str) and re.fullmatch(r"0|[1-9][0-9]*", raw) and int(raw) < 2**64, "schedule requires canonical uint64: " + key)
        numbers[key] = int(raw)
    require(numbers["signalStartLayer"] > 0 and numbers["earliestEvmBlock"] > 0, "schedule cannot begin at genesis")
    require(numbers["signalWindowLayers"] == 2000 and numbers["signalThresholdLayers"] == 1500, "unsafe signalling threshold")
    require(numbers["activationDelayLayers"] >= 2000 and numbers["activationLayer"] == numbers["signalStartLayer"] + 1999 + numbers["activationDelayLayers"], "unsafe activation delay or anchor")
    require(numbers["noticePublishedAt"] > 0 and numbers["notBeforeTimestamp"] >= numbers["noticePublishedAt"] + 86400, "notice must last at least 24 hours")
    require(hex_digest(schedule.get("manifestSha256")), "activation manifest hash missing")
    return value


def verify_package(directory, trusted_fingerprint):
    require(hex_digest(trusted_fingerprint), "supply independently authenticated signing fingerprint")
    directory = pathlib.Path(directory)
    public = directory / "release-public-key.pem"
    manifest_path = directory / "release-auth-manifest.json"
    signature = directory / "release-auth-manifest.sig"
    regular(public, 4096)
    regular(manifest_path, 65536)
    require(regular(signature, 64) == 64, "invalid signature size")
    key_result = subprocess.run(["openssl", "pkey", "-pubin", "-in", str(public), "-outform", "DER"], capture_output=True, timeout=15)
    # Ed25519 SubjectPublicKeyInfo has this fixed ASN.1 prefix and 32-byte key.
    der = key_result.stdout
    require(key_result.returncode == 0 and len(der) == 44 and der[:12].hex() == "302a300506032b6570032100", "expected Ed25519 public key")
    require(hashlib.sha256(der).hexdigest() == trusted_fingerprint, "signing fingerprint mismatch")
    result = subprocess.run(["openssl", "pkeyutl", "-verify", "-pubin", "-inkey", str(public), "-rawin", "-in", str(manifest_path), "-sigfile", str(signature)], capture_output=True, timeout=15)
    require(result.returncode == 0, "release signature verification failed")
    value = validate_manifest(json.loads(manifest_path.read_bytes(), object_pairs_hook=unique_object))
    package = directory / value["package"]["filename"]
    require(regular(package, MAX_PACKAGE) == value["package"]["bytes"], "package size mismatch")
    with package.open("rb") as stream:
        require(digest(stream) == value["package"]["sha256"], "package checksum mismatch")
    seen = set()
    expanded = 0
    with tarfile.open(package, "r:gz") as archive:
        for member in archive:
            require(member.name in ALLOWED_FILES and member.name not in seen, "unexpected or duplicate archive path")
            require(member.isfile() and not member.issparse() and not member.mode & 0o7022, "unsafe archive member type or permissions")
            expanded += member.size
            require(expanded <= MAX_PACKAGE and member.size > 0, "invalid expanded package size")
            seen.add(member.name)
            with archive.extractfile(member) as stream:
                actual = digest(stream)
            if member.name == "bin/bdag":
                require(actual == value["node"]["sha256"], "binary hash mismatch")
            if member.name == "activation-manifest.json":
                require(actual == value["schedule"]["manifestSha256"], "activation manifest hash mismatch")
    require(seen == ALLOWED_FILES, "package file inventory incomplete")
    return {"verified": True, "release": value["release"], "packageSha256": value["package"]["sha256"],
            "nodeSha256": value["node"]["sha256"], "chainId": "1043", "installationAuthorized": False,
            "next": "Confirm the live chain, schedule and installation approval with Francois. No files were extracted or installed."}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", type=pathlib.Path, help="directory containing the four downloaded verification files and package")
    parser.add_argument("--trusted-fingerprint", required=True, help="SPKI DER SHA-256 authenticated separately with Francois")
    args = parser.parse_args()
    try:
        print(json.dumps(verify_package(args.directory, args.trusted_fingerprint), indent=2))
    except (ValueError, OSError, KeyError, TypeError, AttributeError, tarfile.TarError, subprocess.SubprocessError):
        parser.exit(1, "Verification FAILED. Do not extract, install or change the node. Check the downloads and trusted fingerprint.\n")
