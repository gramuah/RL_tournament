"""Build and validate browser policy data, without importing any student code.

Only the sandbox decodes checkpoints. A fresh publish job validates the bounded
JSON again; no student scripts, pickle files or paths reach the static artifact.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import re
import time
from tournament.sandbox import IsolatedAgent, SandboxError, preflight_sandbox, validate_submission

MAX_BYTES = 16_000_000


def vector(value, size):
    if not isinstance(value, list) or len(value) != size:
        raise ValueError('Invalid vector dimensions')
    if any(type(x) not in (float, int) or not math.isfinite(x) or abs(x) > 1e12 for x in value):
        raise ValueError('Invalid numeric parameter')


def validate_model(model, lab):
    if not isinstance(model, dict):
        raise ValueError('Invalid model')
    actions = 4 if lab == 1 else 6
    kind = model.get('kind')
    if kind == 'random' and model == {'kind': 'random', 'actions': actions}:
        return
    if kind == 'qtable' and lab == 2 and set(model) == {'kind', 'values'}:
        if not isinstance(model['values'], list) or len(model['values']) != 500:
            raise ValueError('Invalid Q-table')
        for row in model['values']:
            vector(row, 6)
        return
    if kind == 'mlp' and lab == 1 and set(model) == {'kind', 'layers'}:
        layers = model['layers']
        if not isinstance(layers, list) or not 1 <= len(layers) <= 8:
            raise ValueError('Invalid network depth')
        size = 8
        for layer in layers:
            if not isinstance(layer, dict) or set(layer) != {'weight', 'bias', 'activation'}:
                raise ValueError('Invalid layer')
            if layer['activation'] not in ('linear', 'tanh', 'relu'):
                raise ValueError('Invalid activation')
            weights = layer['weight']
            if not isinstance(weights, list) or not 1 <= len(weights) <= 256:
                raise ValueError('Invalid layer width')
            for row in weights:
                vector(row, size)
            size = len(weights)
            vector(layer['bias'], size)
        if size != actions:
            raise ValueError('Invalid action count')
        return
    raise ValueError('Unsupported policy format')


def validate_payload(payload, lab):
    if not isinstance(payload, dict):
        raise ValueError('Invalid export')
    if set(payload) == {'error'}:
        if not isinstance(payload['error'], str) or len(payload['error']) > 200:
            raise ValueError('Invalid error')
        return
    if set(payload) != {'model', 'probes'}:
        raise ValueError('Invalid export fields')
    validate_model(payload['model'], lab)
    probes = payload['probes']
    if not isinstance(probes, list) or len(probes) > 500:
        raise ValueError('Invalid probes')
    for probe in probes:
        if not isinstance(probe, dict) or set(probe) != {'observation', 'action'}:
            raise ValueError('Invalid probe')
        if lab == 1:
            vector(probe['observation'], 8)
        elif type(probe['observation']) is not int or not 0 <= probe['observation'] < 500:
            raise ValueError('Invalid Taxi observation')
        if type(probe['action']) is not int or not 0 <= probe['action'] < (4 if lab == 1 else 6):
            raise ValueError('Invalid action')


def digest(directory):
    result = hashlib.sha256()
    for file in sorted(directory.rglob('*')):
        if file.is_file() and '__pycache__' not in file.parts and file.suffix not in ('.pyc', '.pyo'):
            result.update(str(file.relative_to(directory)).encode() + b'\0')
            result.update(file.read_bytes())
    return result.hexdigest()


def validate_bundle(bundle, sha=None):
    if not isinstance(bundle, dict) or set(bundle) != {'schema_version', 'source_sha', 'policies'}:
        raise ValueError('Invalid policy bundle')
    if bundle['schema_version'] != 1 or not re.fullmatch('[a-f0-9]{40}', bundle['source_sha']):
        raise ValueError('Invalid policy provenance')
    if sha and bundle['source_sha'] != sha:
        raise ValueError('Policy revision mismatch')
    policies = bundle['policies']
    if not isinstance(policies, dict) or len(policies) > 200:
        raise ValueError('Too many policies')
    for key, entry in policies.items():
        if not re.fullmatch(r'[12]/[A-Za-z0-9_-]{1,80}', key):
            raise ValueError('Invalid policy identifier')
        if not isinstance(entry, dict) or set(entry) != {'submission_sha256', 'export'}:
            raise ValueError('Invalid policy entry')
        if not re.fullmatch('[a-f0-9]{64}', entry['submission_sha256']):
            raise ValueError('Invalid submission digest')
        validate_payload(entry['export'], int(key[0]))


def load_bundle(path, sha=None):
    if path.is_symlink() or path.stat().st_size > MAX_BYTES:
        raise ValueError('Invalid policy file')
    bundle = json.loads(path.read_text())
    validate_bundle(bundle, sha)
    return bundle


def build(root, sha):
    preflight_sandbox()
    bundle = {'schema_version': 1, 'source_sha': sha, 'policies': {}}
    for lab in (1, 2):
        for directory in sorted((root / f'lab{lab}').iterdir()):
            if not directory.is_dir():
                continue
            directory = validate_submission(directory)
            agent = None
            try:
                agent = IsolatedAgent(directory, 4 if lab == 1 else 6, browser_export=True)
                deadline = time.monotonic() + 60
                agent._send(json.dumps({'lab': lab}).encode() + b'\n', deadline)
                payload = agent._receive(60)
                validate_payload(payload, lab)
            except (SandboxError, ValueError):
                payload = {'error': 'Browser export unavailable or incompatible. Ask the author for browser_policy.json.'}
            finally:
                if agent:
                    agent.close()
            bundle['policies'][f'{lab}/{directory.name}'] = {
                'submission_sha256': digest(directory), 'export': payload}
    validate_bundle(bundle, sha)
    return bundle


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['build', 'validate'])
    parser.add_argument('--path', type=Path, default=Path('web/data/policies.json'))
    parser.add_argument('--submissions', type=Path, default=Path('submissions'))
    parser.add_argument('--sha', required=True)
    args = parser.parse_args()
    if args.command == 'validate':
        load_bundle(args.path, args.sha)
    else:
        data = json.dumps(build(args.submissions, args.sha), allow_nan=False, separators=(',', ':'))
        if len(data.encode()) > MAX_BYTES:
            raise ValueError('Policy bundle exceeds size limit')
        args.path.parent.mkdir(parents=True, exist_ok=True)
        args.path.write_text(data + '\n')


if __name__ == '__main__':
    main()
