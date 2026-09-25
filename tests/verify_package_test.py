"""Offline operator verifier tests. All signing keys are ephemeral fixtures."""
import hashlib
import importlib.util
import io
import json
import pathlib
import subprocess
import tarfile
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("verifier", ROOT / "scripts/verify-package.py")
verifier = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(verifier)


class PackageVerification(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="bdag-verifier-test-")
        self.addCleanup(self.temp.cleanup)
        self.root = pathlib.Path(self.temp.name)
        self.private = self.root / "test-only-private.pem"
        self.public = self.root / "release-public-key.pem"
        self.run_ssl("genpkey", "-algorithm", "ED25519", "-out", str(self.private))
        self.run_ssl("pkey", "-in", str(self.private), "-pubout", "-out", str(self.public))
        der = self.run_ssl("pkey", "-pubin", "-in", str(self.public), "-outform", "DER")
        self.fingerprint = hashlib.sha256(der).hexdigest()
        self.binary = b"\x7fELF" + b"test-only-not-executable"
        self.filename = "bdag-testnet-v0.1.0-rc.1-linux-amd64.tar.gz"
        self.package = self.root / self.filename
        self.write_archive()
        self.manifest = {
            "schema": "bdag.testnet.release.v1", "release": "testnet-v0.1.0-rc.1",
            "status": "published", "chainId": "1043", "epochSeconds": 60,
            "architecture": "linux-amd64", "distribution": "github-only", "providers": [],
            **verifier.GENESIS,
            "qualifications": dict.fromkeys(["cleanReplay", "isolatedUpgrade", "independentBuilds", "artifactsVerified"], True),
            "package": {"filename": self.filename},
            "node": {"path": "bin/bdag", "sha256": hashlib.sha256(self.binary).hexdigest()},
            "schedule": {
                "signalStartLayer": "30000", "signalWindowLayers": "2000", "signalThresholdLayers": "1500",
                "activationDelayLayers": "2000", "activationLayer": "33999", "earliestEvmBlock": "30000",
                "noticePublishedAt": "1800000000", "notBeforeTimestamp": "1800086400",
                "manifestSha256": hashlib.sha256(b"test-only-schedule").hexdigest(),
            },
        }
        self.sign()

    def run_ssl(self, *args):
        return subprocess.run(["openssl", *args], check=True, capture_output=True).stdout

    def write_archive(self, extra=None):
        with tarfile.open(self.package, "w:gz") as archive:
            for name, data in [("bin/bdag", self.binary), ("OPERATOR-INSTRUCTIONS.md", b"Test only"), ("activation-manifest.json", b"test-only-schedule"), ("LICENSES.txt", b"Test only")]:
                member = tarfile.TarInfo(name)
                member.size, member.mode = len(data), 0o755 if name == "bin/bdag" else 0o644
                archive.addfile(member, io.BytesIO(data))
            if extra:
                archive.addfile(extra)

    def sign(self, raw=None):
        self.manifest["package"].update(bytes=self.package.stat().st_size, sha256=hashlib.sha256(self.package.read_bytes()).hexdigest())
        path = self.root / "release-auth-manifest.json"
        path.write_bytes(raw if raw is not None else json.dumps(self.manifest).encode())
        self.run_ssl("pkeyutl", "-sign", "-rawin", "-inkey", str(self.private), "-in", str(path), "-out", str(self.root / "release-auth-manifest.sig"))

    def verify(self, fingerprint=None):
        return verifier.verify_package(self.root, fingerprint or self.fingerprint)

    def test_valid_package_is_read_only(self):
        before = sorted(p.name for p in self.root.iterdir())
        report = self.verify()
        self.assertTrue(report["verified"])
        self.assertFalse(report["installationAuthorized"])
        self.assertEqual(before, sorted(p.name for p in self.root.iterdir()))

    def test_private_trial_requires_matching_source(self):
        self.manifest['distribution'] = 'private-operator-delivery'
        self.manifest['qualifications'] = dict.fromkeys(['rc2HistoricalEvmReplay', 'nativeActivationReplay', 'persistedRestart', 'independentBuilds', 'artifactsVerified'], True)
        self.manifest['qualifications']['profile'] = 'experimental-operator-trial-v1'
        source = self.root / 'bdag-testnet-v0.1.0-rc.1-source.tar.gz'
        with tarfile.open(source, 'w:gz') as archive:
            data = b'fixture source, not executable'
            item = tarfile.TarInfo('source/core/main.go')
            item.size, item.mode = len(data), 0o644
            archive.addfile(item, io.BytesIO(data))
        self.manifest['source'] = dict(filename=source.name, bytes=source.stat().st_size, sha256=hashlib.sha256(source.read_bytes()).hexdigest(), access='vetted-recipients')
        self.sign()
        self.assertTrue(self.verify()['verified'])
        source.write_bytes(source.read_bytes() + b'tampered')
        with self.assertRaisesRegex(ValueError, 'source'): self.verify()

    def test_requires_trusted_fingerprint(self):
        with self.assertRaisesRegex(ValueError, "fingerprint"):
            self.verify("0" * 64)

    def test_private_source_rejects_unsafe_members(self):
        self.manifest['distribution'] = 'private-operator-delivery'
        source = self.root / 'bdag-testnet-v0.1.0-rc.1-source.tar.gz'
        for name, kind in [('source/../escape', tarfile.REGTYPE), ('source/link', tarfile.SYMTYPE), ('source/device', tarfile.CHRTYPE), ('source/core/nodekey', tarfile.REGTYPE), ('source/.env', tarfile.REGTYPE), ('source/core/../../escape', tarfile.REGTYPE)]:
            with self.subTest(name=name):
                with tarfile.open(source, 'w:gz') as archive:
                    item = tarfile.TarInfo(name)
                    item.type, item.mode = kind, 0o644
                    archive.addfile(item)
                self.manifest['source'] = dict(filename=source.name, bytes=source.stat().st_size, sha256=hashlib.sha256(source.read_bytes()).hexdigest(), access='vetted-recipients')
                self.sign()
                with self.assertRaises(ValueError): self.verify()

    def test_changed_signed_bytes_rejected(self):
        path = self.root / "release-auth-manifest.json"
        path.write_bytes(path.read_bytes() + b" ")
        with self.assertRaisesRegex(ValueError, "signature"):
            self.verify()

    def test_changed_archive_rejected(self):
        self.package.write_bytes(self.package.read_bytes() + b"x")
        with self.assertRaisesRegex(ValueError, "package"):
            self.verify()

    def test_bad_network_or_unqualified_release_rejected(self):
        for field, value in [("chainId", "1404"), ("status", "draft"), ("epochSeconds", 604800)]:
            with self.subTest(field=field):
                old = self.manifest[field]
                self.manifest[field] = value
                self.sign()
                with self.assertRaises(ValueError): self.verify()
                self.manifest[field] = old
        self.manifest["qualifications"]["cleanReplay"] = False
        self.sign()
        with self.assertRaises(ValueError): self.verify()

    def test_signed_duplicate_json_keys_rejected(self):
        self.sign(b'{"chainId":"1404","chainId":"1043"}')
        with self.assertRaisesRegex(ValueError, "duplicate"):
            self.verify()

    def test_unsafe_schedule_rejected(self):
        for field, value in [("signalThresholdLayers", "1"), ("activationDelayLayers", "1999"), ("notBeforeTimestamp", "1800000001"), ("activationLayer", "34000"), ("signalStartLayer", "030000")]:
            with self.subTest(field=field):
                old = self.manifest["schedule"][field]
                self.manifest["schedule"][field] = value
                self.sign()
                with self.assertRaises(ValueError): self.verify()
                self.manifest["schedule"][field] = old

    def test_archive_traversal_symlinks_devices_duplicates_and_unexpected_files_rejected(self):
        for name, kind in [("../escape", tarfile.REGTYPE), ("bin/link", tarfile.SYMTYPE), ("bin/device", tarfile.CHRTYPE), ("bin/bdag", tarfile.REGTYPE), ("private.pem", tarfile.REGTYPE)]:
            with self.subTest(name=name):
                member = tarfile.TarInfo(name)
                member.type = kind
                self.write_archive(member)
                self.sign()
                with self.assertRaises(ValueError): self.verify()

    def test_mismatched_binary_hash_rejected(self):
        self.manifest["node"]["sha256"] = "b" * 64
        self.sign()
        with self.assertRaisesRegex(ValueError, "binary"):
            self.verify()

    def test_symlinked_input_rejected(self):
        self.package.rename(self.root / "actual.tar.gz")
        self.package.symlink_to(self.root / "actual.tar.gz")
        with self.assertRaisesRegex(ValueError, "regular"):
            self.verify()


if __name__ == "__main__":
    unittest.main()
