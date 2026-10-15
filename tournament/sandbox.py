"""Fail-closed Docker inference adapter. The caller retains environment and scores.

This is an OS container boundary, not a Python sandbox. Only a read-only agent
folder is mounted. Images must be built from the trusted tournament Dockerfile.
"""
import json
import os
from pathlib import Path
import selectors
import subprocess
import time
import uuid

DEFAULT_IMAGE = 'rl-tournament-agent:local'
MAX_MESSAGE = 4096


class SandboxError(RuntimeError):
    pass


def validate_submission(directory):
    path = Path(directory).absolute()
    # Reject symlinks in every parent as well as every entry, before resolving.
    if any(p.is_symlink() for p in (path, *path.parents)):
        raise SandboxError('Submission path must not contain symlinks')
    if not path.is_dir() or not (path / 'agent.py').is_file():
        raise SandboxError('Submission must contain agent.py')
    total = 0
    for item in path.rglob('*'):
        if item.is_symlink() or not (item.is_file() or item.is_dir()):
            raise SandboxError('Only regular submission files and directories are allowed')
        if item.is_file():
            total += item.stat().st_size
    if total > 100 * 1024 * 1024:
        raise SandboxError('Submission exceeds 100 MiB')
    if ',' in str(path):
        raise SandboxError('Submission path cannot contain commas')
    return path.resolve()


def preflight_sandbox(image=DEFAULT_IMAGE):
    """Fail the run before scoring if the trusted Docker infrastructure is missing."""
    for command in (['docker', 'info', '--format', '{{.ServerVersion}}'],
                    ['docker', 'image', 'inspect', image]):
        try:
            subprocess.run(command, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                           timeout=15, check=True)
        except (OSError, subprocess.SubprocessError) as exc:
            raise SandboxError('Docker daemon or trusted agent image is unavailable') from exc


class IsolatedAgent:
    def __init__(self, directory, action_count, image=DEFAULT_IMAGE,
                 startup_timeout=60, action_timeout=2, total_timeout=600):
        self.directory = validate_submission(directory)
        self.action_count = action_count
        self.action_timeout = action_timeout
        self.deadline = time.monotonic() + total_timeout
        self.startup_deadline = time.monotonic() + startup_timeout
        self.first_action = True
        self.name = 'rl-agent-' + uuid.uuid4().hex
        self.process = None
        self.selector = selectors.DefaultSelector()
        self.buffer = bytearray()
        self.closed = False
        command = [
            'docker', 'run', '--rm', '-i', '--name', self.name,
            '--pull=never', '--network=none', '--read-only', '--cap-drop=ALL',
            '--security-opt=no-new-privileges:true', '--user=65534:65534',
            '--cpus=2', '--memory=2g', '--memory-swap=2g', '--pids-limit=128',
            '--ulimit=nofile=128:128', '--ulimit=fsize=16777216:16777216',
            '--tmpfs=/tmp:rw,noexec,nosuid,size=128m,mode=1777',
            '--mount', f'type=bind,source={self.directory},target=/submission,readonly',
            '--env=HOME=/tmp', '--env=OMP_NUM_THREADS=1', '--env=OPENBLAS_NUM_THREADS=1',
            image,
        ]
        # No credentials or host Actions environment are passed into Docker.
        try:
            self.process = subprocess.Popen(command, stdin=subprocess.PIPE,
                                            stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
            self.selector.register(self.process.stdout, selectors.EVENT_READ)
            if self._receive(startup_timeout) != {'ready': True}:
                raise SandboxError('Agent did not complete startup handshake')
        except Exception:
            self.close()
            raise

    def _receive(self, timeout):
        deadline = min(self.deadline, time.monotonic() + timeout)
        while b'\n' not in self.buffer:
            remaining = deadline - time.monotonic()
            if remaining <= 0 or not self.selector.select(remaining):
                raise SandboxError('Agent exceeded execution deadline')
            chunk = os.read(self.process.stdout.fileno(), MAX_MESSAGE + 1)
            if not chunk:
                raise SandboxError('Agent exited or Docker isolation is unavailable')
            self.buffer.extend(chunk)
            if len(self.buffer) > MAX_MESSAGE:
                raise SandboxError('Agent response exceeds protocol limit')
        line, _, rest = self.buffer.partition(b'\n')
        self.buffer = bytearray(rest)
        try:
            return json.loads(line)
        except (ValueError, UnicodeError) as exc:
            raise SandboxError('Agent emitted invalid JSON') from exc

    def _send(self, message, deadline):
        # A malicious peer can emit actions without ever consuming stdin. Never
        # block in buffered write/flush once its input pipe fills.
        descriptor = self.process.stdin.fileno()
        os.set_blocking(descriptor, False)
        with selectors.DefaultSelector() as writable:
            writable.register(descriptor, selectors.EVENT_WRITE)
            remaining = memoryview(message)
            while remaining:
                wait = min(self.deadline, deadline) - time.monotonic()
                if wait <= 0 or not writable.select(wait):
                    raise SandboxError('Agent exceeded input deadline')
                try:
                    written = os.write(descriptor, remaining)
                except BlockingIOError:
                    continue
                if written <= 0:
                    raise SandboxError('Agent closed input channel')
                remaining = remaining[written:]

    def __call__(self, observation):
        try:
            if self.closed or time.monotonic() >= self.deadline:
                raise SandboxError('Agent is closed or total execution deadline elapsed')
            value = observation.tolist() if hasattr(observation, 'tolist') else observation
            message = json.dumps({'observation': value}, allow_nan=False).encode() + b'\n'
            if len(message) > MAX_MESSAGE:
                raise SandboxError('Observation exceeds protocol limit')
            # Existing PPO agents lazily import/load their model on first use.
            # Include that first inference in the original startup budget.
            deadline = self.startup_deadline if self.first_action else time.monotonic() + self.action_timeout
            self.first_action = False
            self._send(message, deadline)
            response = self._receive(max(0, deadline - time.monotonic()))
            if not isinstance(response, dict) or set(response) != {'action'}:
                raise SandboxError('Invalid agent action response')
            action = response['action']
            if type(action) is not int or not 0 <= action < self.action_count:
                raise SandboxError('Action must be an integer within the action space')
            return action
        except Exception:
            self.close()
            raise

    def close(self):
        if self.closed:
            return
        self.closed = True
        # Remove by unpredictable name even if docker run failed during startup.
        try:
            subprocess.run(['docker', 'rm', '-f', self.name], stdout=subprocess.DEVNULL,
                           stderr=subprocess.DEVNULL, timeout=10, check=False)
        except (OSError, subprocess.TimeoutExpired):
            pass
        if self.process is not None:
            self.process.kill() if self.process.poll() is None else None
            self.process.wait(timeout=5)
            self.process.stdin.close()
            self.process.stdout.close()
        self.selector.close()
