import json
import os
from pathlib import Path
import selectors
import subprocess
import sys
import tempfile
import time
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tournament'))
from sandbox import IsolatedAgent, SandboxError, validate_submission


class SubmissionTests(unittest.TestCase):
    def test_missing_and_symlink_submission_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory).resolve()
            with self.assertRaises(SandboxError):
                validate_submission(path)
            (path / 'agent.py').write_text('def agent(obs): return 0')
            (path / 'secret').symlink_to('/etc/passwd')
            with self.assertRaises(SandboxError):
                validate_submission(path)

    def test_container_uses_only_readonly_submission_mount(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory).resolve()
            (path / 'agent.py').write_text('raise RuntimeError("NEVER LOAD ON HOST")')
            with patch('sandbox.subprocess.Popen', side_effect=FileNotFoundError) as popen, \
                 patch('sandbox.subprocess.run'):
                with self.assertRaises(FileNotFoundError):
                    IsolatedAgent(path, 6)
                command = popen.call_args.args[0]
                for option in ['--network=none', '--read-only', '--cap-drop=ALL',
                               '--security-opt=no-new-privileges:true', '--user=65534:65534',
                               '--memory=2g', '--memory-swap=2g', '--cpus=2',
                               '--pids-limit=128', '--tmpfs=/tmp:rw,noexec,nosuid,size=128m,mode=1777', '--pull=never']:
                    self.assertIn(option, command)
                self.assertEqual(command.count('--mount'), 1)
                self.assertEqual(command[command.index('--mount') + 1],
                                 f'type=bind,source={path},target=/submission,readonly')
                self.assertNotIn('-v', command)


class ProtocolTests(unittest.TestCase):
    def adapter(self, response, reads=True):
        adapter = IsolatedAgent.__new__(IsolatedAgent)
        adapter.closed = False
        adapter.action_count = 6
        adapter.action_timeout = .05
        adapter.deadline = time.monotonic() + 2
        adapter.first_action = False
        adapter.startup_deadline = adapter.deadline
        adapter.name = 'test-protocol-only'
        adapter.buffer = bytearray()
        adapter.selector = selectors.DefaultSelector()
        # Harmless synthetic peer, not student code. Exercises real pipe deadlines.
        code = 'import sys,time;' + ('sys.stdin.readline();' if reads else '') + response
        adapter.process = subprocess.Popen([sys.executable, '-c', code], stdin=subprocess.PIPE,
                                            stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
        adapter.selector.register(adapter.process.stdout, selectors.EVENT_READ)
        self.addCleanup(adapter.close)
        return adapter

    @patch('sandbox.subprocess.run')
    def test_valid_action(self, cleanup):
        self.assertEqual(self.adapter('print(\'{"action":2}\',flush=True)')(4), 2)

    @patch('sandbox.subprocess.run')
    def test_invalid_actions_and_messages_close_agent(self, cleanup):
        for payload in ['{"action":true}', '{"action":6}', '{"action":1.5}',
                        '{"action":2,"score":999}', 'not json']:
            with self.subTest(payload=payload):
                adapter = self.adapter(f'print({payload!r},flush=True)')
                with self.assertRaises(SandboxError):
                    adapter(4)
                self.assertTrue(adapter.closed)

    @patch('sandbox.subprocess.run')
    def test_full_input_pipe_has_a_deadline(self, cleanup):
        adapter = self.adapter('time.sleep(5)', reads=False)
        descriptor = adapter.process.stdin.fileno()
        os.set_blocking(descriptor, False)
        while True:
            try:
                os.write(descriptor, b'x' * 4096)
            except BlockingIOError:
                break
        start = time.monotonic()
        with self.assertRaisesRegex(SandboxError, 'input deadline'):
            adapter(4)
        self.assertLess(time.monotonic() - start, 1)
        self.assertTrue(adapter.closed)

    @patch('sandbox.subprocess.run')
    def test_unterminated_flood_and_hang_are_bounded(self, cleanup):
        for code in ['sys.stdout.write("x"*5000);sys.stdout.flush();time.sleep(5)',
                     'time.sleep(5)']:
            adapter = self.adapter(code)
            start = time.monotonic()
            with self.assertRaises(SandboxError):
                adapter(4)
            self.assertLess(time.monotonic() - start, 1)
            self.assertTrue(adapter.closed)


if __name__ == '__main__':
    unittest.main()
