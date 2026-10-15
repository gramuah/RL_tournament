import copy
import io
import json
import math
import tempfile
import unittest
import urllib.request
import zipfile
from pathlib import Path

from tournament.result_artifacts import MAX_JSON_BYTES, clean_result, validate_report, validate_site
from tournament.publish_pr_result import SafeRedirect, unpack_report


def valid_result():
    return {"participant": "student", "success": True, "lab_id": 2, "env_id": "Taxi-v4", "num_episodes": 30, "base_seed": 42, "mean_reward": 7, "std_reward": 2, "min_reward": 3, "max_reward": 12, "median_reward": 7, "success_rate": 100, "avg_steps": 14, "avg_step_ms": .1}


def valid_report():
    return {"schema_version": 1, "pr_number": 1, "run_id": 2, "run_attempt": 1, "base_sha": "a" * 40, "head_sha": "b" * 40, "author": "student", "lab_id": 2, "result": valid_result()}


class ResultContractTests(unittest.TestCase):
    def test_result_drops_agent_text_paths_and_html(self):
        result = valid_result() | {"error": "<script>steal()</script>", "status": "<img src=x>", "submission_path": "/secret", "unexpected": "ignored"}
        clean = clean_result(result, 2)
        self.assertEqual(clean["status"], "MASTERY")
        self.assertNotIn("submission_path", clean)
        self.assertNotIn("error", clean)
        self.assertNotIn("unexpected", clean)

    def test_malformed_numeric_and_identity_values_fail_closed(self):
        for field, value in [("mean_reward", float('nan')), ("mean_reward", float('inf')), ("mean_reward", True), ("success_rate", 101), ("avg_steps", 201), ("num_episodes", 50), ("base_seed", 1), ("env_id", "FakeEnv"), ("participant", "<script>")]:
            with self.subTest(field=field, value=value), self.assertRaises(ValueError):
                clean_result(valid_result() | {field: value}, 2)
        for field, value in [("pr_number", True), ("run_attempt", 0), ("head_sha", "../main"), ("schema_version", 8), ("author", "@bad"), ("lab_id", 3)]:
            with self.subTest(field=field), self.assertRaises(ValueError):
                validate_report(valid_report() | {field: value})

    def test_failed_agent_has_generic_public_error(self):
        result = clean_result({"success": False, "participant": "student", "error": "attacker controlled"}, 2)
        self.assertNotIn("attacker", result["error"])
        self.assertEqual(result["status_code"], "error")

    def test_report_archive_rejects_paths_extra_members_and_bombs(self):
        for filename, size, extra in [("../report.json", 1, False), ("report.json", 1, True), ("report.json", MAX_JSON_BYTES + 1, False)]:
            stream = io.BytesIO()
            with zipfile.ZipFile(stream, 'w', zipfile.ZIP_DEFLATED) as archive:
                archive.writestr(filename, b'x' * size)
                if extra:
                    archive.writestr('runner.py', 'print(1)')
            with self.assertRaises(ValueError):
                unpack_report(stream.getvalue())
        stream = io.BytesIO()
        with zipfile.ZipFile(stream, 'w') as archive:
            archive.writestr('report.json', json.dumps(valid_report()))
        self.assertEqual(unpack_report(stream.getvalue())["author"], "student")

    def test_artifact_redirect_does_not_forward_github_token(self):
        request = urllib.request.Request('https://api.github.com/artifact', headers={'Authorization': 'Bearer secret'})
        redirected = SafeRedirect().redirect_request(request, None, 302, 'Found', {}, 'https://blob.example/artifact')
        self.assertIsNone(redirected.get_header('Authorization'))
        same_origin = SafeRedirect().redirect_request(request, None, 302, 'Found', {}, 'https://api.github.com/new')
        self.assertEqual(same_origin.get_header('Authorization'), 'Bearer secret')

    def test_site_requires_matching_provenance_and_unique_participants(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            manifest = {"schema_version": 1, "source_sha": "a" * 40, "generated_at": "2026-10-15T12:00:00+00:00", "episodes": 30, "base_seed": 42}
            (root/'manifest.json').write_text(json.dumps(manifest))
            (root/'leaderboard_p1.json').write_text('[]')
            (root/'leaderboard_p2.json').write_text(json.dumps([valid_result()]))
            with self.assertRaises(ValueError):
                validate_site(root, 'b' * 40)
            validate_site(root, 'a' * 40)
            (root/'leaderboard_p2.json').write_text(json.dumps([valid_result(), valid_result()]))
            with self.assertRaises(ValueError):
                validate_site(root, 'a' * 40)


if __name__ == '__main__':
    unittest.main()
