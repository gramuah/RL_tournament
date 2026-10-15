import copy
import os
from pathlib import Path
import tempfile
import unittest

from tournament.browser_artifacts import build, load_bundle, validate_bundle, validate_model, validate_payload
from tournament.submission_policy import validate_relative_filename


class BrowserArtifactsTests(unittest.TestCase):
    def test_supported_declarative_models(self):
        validate_model({'kind': 'qtable', 'values': [[0]*6 for _ in range(500)]}, 2)
        validate_model({'kind': 'mlp', 'layers': [{'weight': [[0]*8 for _ in range(4)],
                        'bias': [0]*4, 'activation': 'linear'}]}, 1)
        self.assertEqual(validate_relative_filename('browser_policy.json'), 'browser_policy.json')

    def test_reject_invalid_dimensions_numbers_code_and_unknown_fields(self):
        for bad in [
            {'kind': 'qtable', 'values': [[0]*5 for _ in range(500)]},
            {'kind': 'qtable', 'values': [[float('nan')]*6 for _ in range(500)]},
            {'kind': 'javascript', 'code': 'alert(1)'},
            {'kind': 'random', 'actions': 4},
            {'kind': 'random', 'actions': 6, 'script': 'evil'},
            {'kind': 'mlp', 'layers': []},
        ]:
            with self.subTest(bad=bad['kind']), self.assertRaises(ValueError):
                validate_model(bad, 2)

    def test_reject_wrong_revision_paths_and_unbounded_errors(self):
        bundle = {'schema_version': 1, 'source_sha': 'a'*40, 'policies': {
            '2/alice': {'submission_sha256': 'b'*64, 'export': {'error': 'Unsupported'}}}}
        validate_bundle(bundle, 'a'*40)
        with self.assertRaises(ValueError):
            validate_bundle(bundle, 'c'*40)
        bad = copy.deepcopy(bundle)
        bad['policies']['2/../../escape'] = bad['policies'].pop('2/alice')
        with self.assertRaises(ValueError):
            validate_bundle(bad)
        with self.assertRaises(ValueError):
            validate_payload({'error': 'x'*201}, 2)
        with self.assertRaises(ValueError):
            validate_payload({'model': {'kind':'random','actions':6}, 'probes':[
                {'observation': 500, 'action':0}]}, 2)

    def test_committed_preview_is_valid(self):
        load_bundle(Path('web/data/policies.json'))

    @unittest.skipUnless(os.environ.get('RUN_SANDBOX_TESTS') == '1', 'requires Docker')
    def test_actual_models_export_and_unknown_agent_stays_unavailable(self):
        bundle = build(Path('submissions').absolute(), 'a'*40)
        for key, entry in bundle['policies'].items():
            self.assertIn('model', entry['export'], key)
        self.assertEqual(len(bundle['policies']['2/rafael_flor']['export']['probes']), 500)
        self.assertEqual(len(bundle['policies']['1/rafael_flor']['export']['probes']), 130)
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp).resolve()
            (root/'lab1').mkdir()
            folder = root/'lab2/unsupported'
            folder.mkdir(parents=True)
            (folder/'agent.py').write_text('def agent(obs): return 0\n')
            result = build(root, 'a'*40)
            self.assertIn('error', result['policies']['2/unsupported']['export'])
