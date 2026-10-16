"""Verify isolation routing cannot accidentally fall back to student imports."""
from pathlib import Path
import sys
import unittest
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tournament'))
import evaluate
import compare
from sandbox import SandboxError


class EvaluationRoutingTests(unittest.TestCase):
    def test_isolated_failure_never_imports_student_on_host(self):
        with patch('sandbox.IsolatedAgent', side_effect=SandboxError('no Docker')), \
             patch.object(evaluate, 'load_agent_function') as unsafe:
            result = evaluate.evaluate_single_submission('/missing/alice', 2, isolated=True)
        self.assertFalse(result['success'])
        self.assertIn('no Docker', result['error'])
        unsafe.assert_not_called()

    def test_isolated_controller_scores_and_closes_on_failure(self):
        adapter = Mock()
        with patch('sandbox.IsolatedAgent', return_value=adapter), \
             patch.object(evaluate, 'evaluate_agent', side_effect=RuntimeError('bad action')) as score:
            result = evaluate.evaluate_single_submission('/missing/alice', practical_id=2, isolated=True)
        score.assert_called_once_with(adapter, 2, 30, 42)
        adapter.close.assert_called_once()
        self.assertFalse(result['success'])

    def test_trusted_notebook_api_retains_legacy_alias(self):
        agent = Mock()
        with patch.object(evaluate, 'load_agent_function', return_value=agent), \
             patch.object(evaluate, 'evaluate_agent', return_value={'mean_reward': 7.0}):
            result = evaluate.evaluate_single_submission('/missing/alice', practical_id=2)
        self.assertTrue(result['success'])
        self.assertEqual(result['mean_reward'], 7.0)
        with self.assertRaises(TypeError):
            evaluate.evaluate_single_submission('/missing/alice', lab_id=2, practical_id=2)

    def test_failed_second_duel_agent_closes_first(self):
        cleanup = Mock()
        with patch.object(compare, 'resolve_agent', side_effect=[(Mock(), 'alice', cleanup),
                                                                SandboxError('Bob failed')]):
            with self.assertRaises(SandboxError):
                compare.run_head_to_head(lab_id=2, isolated=True)
        cleanup.assert_called_once()


if __name__ == '__main__':
    unittest.main()
