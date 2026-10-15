import inspect
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from tournament import submit
from tournament.submission_policy import load_policy


class SubmitTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.agent = Path(self.temporary.name) / "agent.py"
        self.agent.write_text("def agent(observation): return 0\n")
        self.files = {"agent.py": self.agent}
        self.calls = []
        self.login = "Alice"
        self.existing_branch = False
        self.fork_parent = "gramuah/RL_tournament"

    def fake_github(self, url, method="GET", data=None, token=None):
        self.calls.append((url, method, data))
        if url.endswith("/user"):
            return 200, {"login": self.login}
        if url.endswith("/RL_tournament"):
            return 200, {"fork": True, "parent": {"full_name": self.fork_parent}}
        if url.endswith("/git/ref/heads/main"):
            return 200, {"object": {"sha": "upstream-sha"}}
        if url.endswith("/git/commits/upstream-sha"):
            return 200, {"tree": {"sha": "upstream-tree"}}
        if url.endswith("/git/blobs"):
            return 201, {"sha": "new-blob"}
        if url.endswith("/git/trees"):
            return 201, {"sha": "new-tree"}
        if url.endswith("/git/commits"):
            return 201, {"sha": "new-commit"}
        if "/git/refs/heads/submission-" in url:
            return (200 if self.existing_branch or method == "PATCH" else 404), {}
        if url.endswith("/git/refs"):
            return 201, {}
        if url.endswith("/pulls"):
            return 201, {"html_url": "https://github.com/gramuah/RL_tournament/pull/123"}
        raise AssertionError((url, method, data))

    def test_atomic_submission_based_on_upstream_main(self):
        with patch.object(submit, "_github_request", self.fake_github):
            url = submit.submit_lab(2, self.files, "private-token", "aLiCe")
        self.assertTrue(url.endswith("/123"))
        tree = next(data for url, _, data in self.calls if url.endswith("/git/trees"))
        self.assertEqual(tree["base_tree"], "upstream-tree")
        self.assertEqual(tree["tree"][0]["path"], "submissions/lab2/alice/agent.py")
        commit = next(data for url, _, data in self.calls if url.endswith("/git/commits"))
        self.assertEqual(commit["parents"], ["upstream-sha"])
        self.assertFalse(any("/contents/" in url for url, _, _ in self.calls))

    def test_repeated_submission_replaces_only_helper_branch(self):
        self.existing_branch = True
        with patch.object(submit, "_github_request", self.fake_github):
            submit.submit_lab(2, self.files, "private-token")
        updates = [(url, data) for url, method, data in self.calls if method == "PATCH"]
        self.assertEqual(len(updates), 1)
        self.assertTrue(updates[0][0].endswith("/git/refs/heads/submission-lab2-alice"))
        self.assertEqual(updates[0][1], {"sha": "new-commit", "force": True})

    def test_alias_and_legacy_notebook_api(self):
        self.login = "rflor01"
        with patch.object(submit, "_github_request", self.fake_github):
            submit.submit_practical(practical_id=1, files_to_submit=self.files, github_token="private-token")
        tree = next(data for url, _, data in self.calls if url.endswith("/git/trees"))
        self.assertEqual(tree["tree"][0]["path"], "submissions/lab1/rafael_flor/agent.py")
        self.assertIn("lab_id", inspect.signature(submit.submit_lab).parameters)
        with self.assertRaises(TypeError):
            submit.submit_lab(1, self.files, "private-token", practical_id=1)

    def test_authenticated_username_cannot_be_overridden(self):
        with patch.object(submit, "_github_request", self.fake_github), self.assertRaises(ValueError):
            submit.submit_lab(2, self.files, "private-token", "bob")
        self.assertEqual(len(self.calls), 1)

    def test_non_course_repository_rejected_before_writes(self):
        self.fork_parent = "attacker/unrelated"
        with patch.object(submit, "_github_request", self.fake_github), self.assertRaises(ValueError):
            submit.submit_lab(2, self.files, "private-token")
        self.assertTrue(all(method == "GET" for _, method, _ in self.calls))

    def test_invalid_inputs_rejected_before_any_network_calls(self):
        cases = [(0, self.files), ("2", self.files), (True, self.files), (2, {}),
                 (2, {"agent.py": self.agent, "../../evil.py": self.agent}),
                 (2, {"agent.py": self.agent, "weights.txt": self.agent}),
                 (2, {"agent.py": self.agent, "a\\b.py": self.agent})]
        for lab, files in cases:
            with self.subTest(lab=lab, files=files), patch.object(submit, "_github_request") as request, self.assertRaises(ValueError):
                submit.submit_lab(lab, files, "private-token")
            request.assert_not_called()

    def test_symlink_and_size_limits(self):
        link = self.agent.with_name("link.py")
        link.symlink_to(self.agent)
        with self.assertRaises(ValueError):
            submit._validate_uploads(2, {"agent.py": link})
        with patch.object(submit, "_MAX_FILE_BYTES", 2), self.assertRaises(ValueError):
            submit._validate_uploads(2, self.files)
        with patch.object(submit, "_MAX_TOTAL_BYTES", 2), self.assertRaises(ValueError):
            submit._validate_uploads(2, self.files)
        with patch.object(submit, "_MAX_FILES", 0), self.assertRaises(ValueError):
            submit._validate_uploads(2, self.files)

    def test_standalone_helper_constants_match_trusted_policy(self):
        policy = load_policy()
        self.assertEqual(submit._ALLOWED_EXTENSIONS, set(policy["allowed_extensions"]))
        self.assertEqual(submit._MAX_FILE_BYTES, policy["max_file_bytes"])
        self.assertEqual(submit._MAX_TOTAL_BYTES, policy["max_total_bytes"])
        self.assertEqual(submit._MAX_FILES, policy["max_files"])
        for owner, alias in submit._OWNER_ALIASES.items():
            for lab in (1, 2):
                self.assertEqual(policy["owners"][f"submissions/lab{lab}/{alias}"], owner)


if __name__ == "__main__":
    unittest.main()
