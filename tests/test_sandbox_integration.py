"""Real Linux Docker boundary tests. CI must set RUN_SANDBOX_TESTS=1."""
import os
from pathlib import Path
import sys
import tempfile
import time
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tournament'))
from sandbox import IsolatedAgent, SandboxError


@unittest.skipUnless(os.environ.get('RUN_SANDBOX_TESTS') == '1', 'Requires built Docker agent image')
class DockerBoundaryTests(unittest.TestCase):
    def agent(self, source, **kwargs):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        path = Path(directory.name).resolve()
        path.chmod(0o755)
        (path / 'agent.py').write_text(source)
        adapter = IsolatedAgent(path, 6, **kwargs)
        self.addCleanup(adapter.close)
        return adapter

    def test_numeric_numpy_and_pickle_compatibility(self):
        adapter = self.agent('import pickle, numpy as np\n'
                             'table = pickle.loads(pickle.dumps(np.zeros((500,6))))\n'
                             'def agent(obs): return np.argmax(table[obs])\n')
        self.assertEqual(adapter(42), 0)

    def test_existing_lunarlander_zip_loads_inside_container(self):
        import shutil
        import numpy as np
        root = Path(__file__).resolve().parents[1]
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory).resolve()
            path.chmod(0o755)
            shutil.copyfile(root / 'submissions/lab1/rafael_flor/ppo-LunarLander-v3.zip', path / 'model.zip')
            (path / 'agent.py').write_text('from stable_baselines3 import PPO\n'
                'model = PPO.load("/submission/model.zip")\n'
                'def agent(obs): return int(model.predict(obs, deterministic=True)[0])\n')
            adapter = IsolatedAgent(path, 4)
            self.addCleanup(adapter.close)
            self.assertIn(adapter(np.zeros(8, dtype=np.float32)), range(4))
            adapter.close()

    def test_subprocess_flood_is_capped_and_reaped(self):
        adapter = self.agent("""import subprocess
children = []
try:
    for _ in range(160):
        children.append(subprocess.Popen(['sleep', '30']))
except OSError:
    pass
else:
    raise AssertionError('PID budget not enforced')
def agent(obs): return 0
""")
        self.assertEqual(adapter(0), 0)
        adapter.close()
        self.assertTrue(adapter.closed)

    def test_container_has_no_network_credentials_or_host_write_access(self):
        adapter = self.agent('''import os, socket
assert os.getuid() == 65534
assert not any(k in os.environ for k in ('GITHUB_TOKEN','ACTIONS_RUNTIME_TOKEN','AWS_SECRET_ACCESS_KEY'))
assert not os.path.exists('/var/run/docker.sock')
try:
    open('/submission/changed', 'w')
except OSError:
    pass
else:
    raise AssertionError('submission writable')
try:
    open('/opt/changed', 'w')
except OSError:
    pass
else:
    raise AssertionError('root filesystem writable')
s = socket.socket()
s.settimeout(.3)
assert s.connect_ex(('1.1.1.1', 443)) != 0
s.close()
def agent(obs): return 1
''')
        self.assertEqual(adapter(0), 1)

    def test_host_scoring_cannot_be_patched_by_agent(self):
        from evaluate import evaluate_single_submission
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory).resolve()
            path.chmod(0o755)
            (path / 'agent.py').write_text('import gymnasium as gym\n'
                'gym.make = lambda *a, **kw: (_ for _ in ()).throw(Exception("tampered"))\n'
                'def agent(obs): return 0\n')
            result = evaluate_single_submission(path, 2, num_episodes=1, isolated=True)
            self.assertTrue(result['success'], result)
            self.assertLess(result['mean_reward'], 0)

    def test_import_hang_action_hang_and_invalid_action_fail_closed(self):
        start = time.monotonic()
        with self.assertRaises(SandboxError):
            self.agent('while True: pass\n', startup_timeout=2)
        self.assertLess(time.monotonic() - start, 20)
        adapter = self.agent('def agent(obs):\n    while True: pass\n', action_timeout=.2, startup_timeout=2)
        with self.assertRaises(SandboxError):
            adapter(0)
        self.assertTrue(adapter.closed)
        adapter = self.agent('def agent(obs): return 99\n')
        with self.assertRaises(SandboxError):
            adapter(0)


if __name__ == '__main__':
    unittest.main()
