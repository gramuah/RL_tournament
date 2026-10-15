import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tournament'))
import update_leaderboard


class InfrastructureReadinessTests(unittest.TestCase):
    def test_failed_baseline_aborts_before_any_publication(self):
        with patch.object(update_leaderboard, 'evaluate_single_submission', return_value={'success': False}):
            with self.assertRaisesRegex(RuntimeError, 'preserving the previous publication'):
                update_leaderboard.run_full_evaluation(2, isolated=True)

    def test_student_failure_is_retained_when_infrastructure_is_healthy(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            student = root/'submissions'/'lab2'/'student'
            student.mkdir(parents=True)
            (student/'agent.py').write_text('raise RuntimeError()')
            old = Path.cwd()
            try:
                os.chdir(root)
                with patch.object(update_leaderboard, 'assert_evaluator_ready') as readiness, patch.object(update_leaderboard, 'evaluate_single_submission', return_value={'success': False, 'participant': 'student'}):
                    results = update_leaderboard.run_full_evaluation(2, isolated=True)
                    self.assertFalse(results[0]['success'])
                    self.assertEqual(readiness.call_count, 2)
            finally:
                os.chdir(old)

    def test_midrun_infrastructure_failure_aborts(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            student = root/'submissions'/'lab2'/'student'
            student.mkdir(parents=True)
            (student/'agent.py').write_text('pass')
            old = Path.cwd()
            try:
                os.chdir(root)
                with patch.object(update_leaderboard, 'assert_evaluator_ready', side_effect=[None, RuntimeError('infrastructure failed')]), patch.object(update_leaderboard, 'evaluate_single_submission', return_value={'success': False}):
                    with self.assertRaisesRegex(RuntimeError, 'infrastructure failed'):
                        update_leaderboard.run_full_evaluation(2, isolated=True)
            finally:
                os.chdir(old)



class SnapshotTests(unittest.TestCase):
    def test_artifact_has_accurate_lab_links_and_only_failures_unranked(self):
        result = {"success": True, "participant": "baseline_random", "mean_reward": 2, "std_reward": 0, "success_rate": 100, "min_reward": 2, "max_reward": 2, "status": "PASSED"}
        failed = {"success": False, "participant": "broken"}
        student = result | {"participant": "student"}
        content = update_leaderboard.generate_leaderboard_content([], [result, failed, student], '2026-10-15 UTC')
        self.assertIn('**1st** | *baseline_random (Baseline)*', content)
        self.assertIn('| — | [broken]', content)
        self.assertIn('**2nd** | [student]', content)
        self.assertIn('tree/main/submissions/lab2', content)
        self.assertIn('tree/main/submissions/lab1', content)
        self.assertIn('Browser simulations demonstrate built-in policies', content)
        self.assertNotIn('within 2 minutes', content)
        self.assertNotIn('master.ipynb', content)

    def test_manifest_records_environment_versions_and_exact_lock_hashes(self):
        import hashlib
        from datetime import datetime
        from importlib.metadata import version
        one = [{"success": True, "env_id": "LunarLander-v3"}, {"success": False}]
        two = [{"success": True, "env_id": "Taxi-v4"}, {"success": True, "env_id": "Taxi-v4"}]
        manifest = update_leaderboard.build_manifest(one, two, 30, 42, 'a' * 40)
        self.assertEqual(manifest['source_sha'], 'a' * 40)
        self.assertEqual(manifest['environments'], {'1': ['LunarLander-v3'], '2': ['Taxi-v4']})
        self.assertEqual(manifest['dependencies']['gymnasium'], version('gymnasium'))
        self.assertEqual(manifest['dependencies']['numpy'], version('numpy'))
        self.assertTrue(datetime.fromisoformat(manifest['generated_at']).tzinfo)
        for key, filename in [('controller_sha256', 'requirements-ci.lock'), ('agent_sha256', 'requirements-agent.lock')]:
            expected = hashlib.sha256((update_leaderboard.REPO_ROOT / 'tournament' / filename).read_bytes()).hexdigest()
            self.assertEqual(manifest['dependency_locks'][key], expected)


if __name__ == '__main__':
    unittest.main()
