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


if __name__ == '__main__':
    unittest.main()
