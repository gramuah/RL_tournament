"""Admission tests operate on real Git trees, including adversarial index entries."""
import copy
from pathlib import Path
import subprocess
import tempfile
import unittest

from tournament.submission_policy import (
    PolicyError, extract_submission, load_policy, validate_relative_filename, validate_submission,
)


class SubmissionPolicyTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.repo = Path(self.temporary.name) / "repo"
        self.repo.mkdir()
        self.git("init", "-q")
        self.git("config", "commit.gpgsign", "false")
        self.git("config", "core.hooksPath", "/dev/null")
        self.git("config", "user.name", "Test Instructor")
        self.git("config", "user.email", "instructor@example.invalid")
        self.write("README.md", "Trusted repository\n")
        self.base = self.commit()

    def git(self, *arguments):
        return subprocess.check_output(["git", "-C", str(self.repo), *arguments], stderr=subprocess.PIPE).decode().strip()

    def write(self, name, content="def agent(observation): return 0\n"):
        path = self.repo / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content)
        return path

    def commit(self, stage=True):
        if stage:
            self.git("add", "-A")
        self.git("commit", "-qm", "Test fixture")
        return self.git("rev-parse", "HEAD")

    def validate(self, author="alice", policy=None):
        return validate_submission(self.repo, self.base, self.commit(), author, policy)

    def test_valid_submission_and_extract_ignore_hostile_git_attributes(self):
        self.write(".gitattributes", "*.py filter=untrusted\n")
        self.base = self.commit()
        self.write("submissions/lab2/alice/agent.py")
        self.write("submissions/lab2/alice/helpers/policy.py", "VALUE = 1\n")
        self.write("submissions/lab2/alice/model.pkl", "not deserialized")
        report = self.validate("ALICE")
        self.assertEqual(report["route"], "submission")
        self.assertEqual(report["lab_id"], 2)
        output = Path(self.temporary.name) / "output"
        extract_submission(self.repo, report, output)
        self.assertEqual((output / "model.pkl").read_text(), "not deserialized")
        self.assertEqual(sorted(str(p.relative_to(output)) for p in output.rglob("*") if p.is_file()),
                         ["agent.py", "helpers/policy.py", "model.pkl"])
        self.assertFalse((output / ".git").exists())
        with self.assertRaises(PolicyError):
            extract_submission(self.repo, report, output)

    def test_extraction_rejects_tampered_report(self):
        self.write("submissions/lab2/alice/agent.py")
        report = self.validate()
        report["files"][0]["path"] = "submissions/lab2/alice/../../escape.py"
        with self.assertRaises(PolicyError):
            extract_submission(self.repo, report, Path(self.temporary.name) / "output")

    def test_existing_submission_update(self):
        self.write("submissions/lab1/alice/agent.py")
        self.write("submissions/lab1/alice/model.npy", "old")
        self.base = self.commit()
        self.write("submissions/lab1/alice/model.npy", "new")
        self.assertEqual(len(self.validate()["files"]), 2)

    def test_alias_owner_is_preserved(self):
        self.write("submissions/lab2/rafael_flor/agent.py")
        self.assertEqual(self.validate("rflor01")["submission_dir"], "submissions/lab2/rafael_flor")

    def test_reject_other_participant(self):
        self.write("submissions/lab2/bob/agent.py")
        with self.assertRaises(PolicyError):
            self.validate()

    def test_case_variant_cannot_create_second_identity(self):
        self.write("submissions/lab2/Alice/agent.py")
        with self.assertRaises(PolicyError):
            self.validate("Alice")

    def test_reject_alias_hijack(self):
        self.write("submissions/lab2/rafael_flor/agent.py")
        with self.assertRaises(PolicyError):
            self.validate("rafael-flor")

    def test_student_cannot_change_policy_or_workflows(self):
        self.write("submissions/lab2/alice/agent.py")
        self.write("tournament/policy.json", '{"maintainers": ["alice"]}')
        self.write(".github/workflows/evil.yml", "malicious")
        with self.assertRaises(PolicyError):
            self.validate()

    def test_instructor_infrastructure_route(self):
        self.write("web/index.html", "site")
        report = self.validate("CarlosGual")
        self.assertEqual(report["route"], "infrastructure")
        self.assertEqual(report["files"], [])

    def test_baseline_is_protected(self):
        self.write("submissions/lab2/baseline_random/agent.py")
        with self.assertRaises(PolicyError):
            self.validate()

    def test_multiple_labs_rejected(self):
        self.write("submissions/lab1/alice/agent.py")
        self.write("submissions/lab2/alice/agent.py")
        with self.assertRaises(PolicyError):
            self.validate()

    def test_rename_cannot_hide_original_owner(self):
        self.write("submissions/lab2/bob/agent.py")
        self.base = self.commit()
        self.git("mv", "submissions/lab2/bob", "submissions/lab2/alice")
        with self.assertRaises(PolicyError):
            self.validate()

    def test_rename_cannot_hide_infrastructure_deletion(self):
        self.write("submissions/lab2/alice/agent.py")
        self.git("mv", "README.md", "submissions/lab2/alice/weights.npy")
        with self.assertRaises(PolicyError):
            self.validate()

    def test_missing_or_deleted_agent_rejected(self):
        self.write("submissions/lab2/alice/model.npy", "weights")
        with self.assertRaises(PolicyError):
            self.validate()

    def test_symlink_rejected(self):
        self.write("submissions/lab2/alice/agent.py")
        (self.repo / "submissions/lab2/alice/model.pkl").symlink_to("/etc/passwd")
        with self.assertRaises(PolicyError):
            self.validate()

    def test_gitlink_rejected(self):
        self.write("submissions/lab2/alice/agent.py")
        self.git("add", "-A")
        self.git("update-index", "--add", "--cacheinfo", f"160000,{self.base},submissions/lab2/alice/vendor.py")
        head = self.commit(stage=False)
        with self.assertRaises(PolicyError):
            validate_submission(self.repo, self.base, head, "alice")

    def test_unsupported_file_rejected(self):
        self.write("submissions/lab2/alice/agent.py")
        self.write("submissions/lab2/alice/requirements.txt", "evil")
        with self.assertRaises(PolicyError):
            self.validate()

    def test_unsafe_paths(self):
        for name in ("../agent.py", "/agent.py", "a/../../agent.py", "a\\agent.py", "a//agent.py", "./agent.py",
                     ".github.py", "agent.py\n", "$(evil).py", "foo?x.py", "foo#x.py", "foo:bar.py"):
            with self.subTest(name=name), self.assertRaises(PolicyError):
                validate_relative_filename(name)

    def test_limit_includes_unchanged_files(self):
        self.write("submissions/lab2/alice/agent.py", "1234")
        self.write("submissions/lab2/alice/model.npy", "1234")
        self.base = self.commit()
        self.write("submissions/lab2/alice/helper.py", "1")
        head = self.commit()
        for changes in ({"max_files": 2}, {"max_file_bytes": 3}, {"max_total_bytes": 8}):
            policy = copy.deepcopy(load_policy())
            policy.update(changes)
            with self.subTest(changes=changes), self.assertRaises(PolicyError):
                validate_submission(self.repo, self.base, head, "alice", policy)

    def test_limit_boundaries_allowed(self):
        self.write("submissions/lab2/alice/agent.py", "1234")
        policy = load_policy()
        policy.update(max_files=1, max_file_bytes=4, max_total_bytes=4)
        self.assertEqual(self.validate(policy=policy)["files"][0]["size"], 4)

    def test_symbolic_and_option_revisions_rejected(self):
        for revision in ("HEAD", "main", "--help", self.base[:10]):
            with self.subTest(revision=revision), self.assertRaises(PolicyError):
                validate_submission(self.repo, revision, self.base, "alice")

    def test_empty_diff_rejected(self):
        with self.assertRaises(PolicyError):
            validate_submission(self.repo, self.base, self.base, "alice")

    def test_invalid_author_rejected(self):
        for author in ("../alice", "a;b", "alice\n", "-alice", ""):
            with self.subTest(author=author), self.assertRaises(PolicyError):
                validate_submission(self.repo, self.base, self.base, author)


if __name__ == "__main__":
    unittest.main()
