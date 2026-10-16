"""Exercise the privileged publisher with all network and subprocess work mocked."""
import copy
import io
import json
import os
import subprocess
import unittest
import zipfile
from unittest.mock import patch

from tournament import publish_pr_result as publisher
from test_result_artifacts import valid_report


class PublisherBoundaryTests(unittest.TestCase):
    def setUp(self):
        self.report = valid_report()
        self.run = {"event": "pull_request", "status": "completed", "conclusion": "success", "path": ".github/workflows/evaluate_pr.yml", "run_attempt": 1, "head_sha": "b" * 40, "head_branch": "submission", "head_repository": {"full_name": "student/RL_tournament"}, "pull_requests": []}
        self.pr = {"number": 1, "state": "open", "head": {"sha": "b" * 40, "ref": "submission", "repo": {"full_name": "student/RL_tournament"}}, "base": {"sha": "a" * 40, "ref": "main", "repo": {"full_name": "gramuah/RL_tournament"}}, "user": {"login": "Student"}}
        self.writes = []
        self.associated = [{"number": 1}]

    def api(self, path, method="GET", payload=None, binary=False):
        if method in ("POST", "PATCH"):
            self.writes.append((path, payload))
            return {}
        if path.endswith('/actions/runs/2'):
            return self.run
        if path.endswith('/actions/runs/2/artifacts'):
            return {"artifacts": [{"name": "evaluation-report", "id": 3, "expired": False, "size_in_bytes": 1000}]}
        if path.endswith('/actions/artifacts/3/zip'):
            stream = io.BytesIO()
            with zipfile.ZipFile(stream, 'w') as archive:
                archive.writestr('report.json', json.dumps(self.report))
            return stream.getvalue()
        if path.endswith('/pulls/1'):
            return self.pr
        if '/commits/' in path:
            return self.associated
        if '/comments?' in path:
            return []
        raise AssertionError(path)

    def invoke(self, git_error=None, policy=None):
        with patch.dict(os.environ, {"GITHUB_REPOSITORY": "gramuah/RL_tournament", "SOURCE_RUN_ID": "2"}), patch.object(publisher, 'api', side_effect=self.api), patch.object(publisher.subprocess, 'run', side_effect=git_error), patch.object(publisher, 'validate_submission', return_value=policy or {"route": "submission", "lab_id": 2}):
            publisher.main()

    def test_verified_fork_run_without_pr_array_publishes_numeric_report(self):
        self.invoke()
        self.assertEqual(len(self.writes), 1)
        self.assertIn('Mean reward', self.writes[0][1]['body'])

    def test_untrusted_workflow_path_or_event_is_rejected(self):
        for field, value in [('event', 'workflow_dispatch'), ('path', '.github/workflows/attacker.yml'), ('conclusion', 'failure')]:
            previous = self.run[field]
            self.run[field] = value
            with self.subTest(field=field), self.assertRaises(ValueError):
                self.invoke()
            self.run[field] = previous
        self.assertEqual(self.writes, [])

    def test_stale_or_closed_pr_never_updates_comment(self):
        self.pr['head']['sha'] = 'c' * 40
        self.invoke()
        self.pr['head']['sha'] = 'b' * 40
        self.pr['state'] = 'closed'
        self.invoke()
        self.assertEqual(self.writes, [])

    def test_forged_historical_base_cannot_hide_infrastructure_revert(self):
        # Empty run association is the GitHub fork fallback. Even if git would
        # accept this as an ancestor and policy would accept its reduced diff,
        # only the actual current API base may be used for admission.
        self.report['base_sha'] = 'c' * 40
        self.invoke()
        self.assertEqual(self.writes, [])

    def test_base_advancing_before_comment_prevents_publication(self):
        original_api = self.api
        reads = 0
        def racing_api(path, method="GET", payload=None, binary=False):
            nonlocal reads
            if path.endswith('/pulls/1'):
                reads += 1
                if reads == 2:
                    self.pr['base']['sha'] = 'c' * 40
            return original_api(path, method, payload, binary)
        with patch.object(self, 'api', side_effect=racing_api):
            self.invoke()
        self.assertEqual(self.writes, [])

    def test_wrong_author_run_attempt_or_source_repository_is_rejected(self):
        for target, key, value in [(self.report, 'author', 'someoneelse'), (self.report, 'run_attempt', 2), (self.run['head_repository'], 'full_name', 'attacker/repository')]:
            previous = target[key]
            target[key] = value
            with self.subTest(key=key), self.assertRaises(ValueError):
                self.invoke()
            target[key] = previous
        self.assertEqual(self.writes, [])

    def test_unassociated_commit_or_policy_mismatch_never_publishes(self):
        self.associated = []
        with self.assertRaises(ValueError):
            self.invoke()
        self.associated = [{'number': 1}]
        with self.assertRaises(ValueError):
            self.invoke(policy={'route': 'infrastructure', 'lab_id': 2})
        self.assertEqual(self.writes, [])

    def test_git_verification_failure_prevents_publication(self):
        with self.assertRaises(subprocess.CalledProcessError):
            self.invoke(git_error=subprocess.CalledProcessError(1, 'git'))
        self.assertEqual(self.writes, [])


if __name__ == '__main__':
    unittest.main()
