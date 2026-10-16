# Lab 1 submissions · LunarLander

Submit a Python policy for `LunarLander-v3` through a pull request from your fork.
Your PR may change **one folder in one lab**: `submissions/lab1/<your-github-login>/`.
Use your GitHub login in lowercase. The existing `rafael_flor` folder belongs to
`rflor01`; other ownership exceptions require an instructor policy change.

```text
submissions/lab1/your-github-login/
├── agent.py
└── ppo-LunarLander-v3.zip
```

`agent.py` must expose `agent(observation)`. The observation is an eight-element
vector; return a Python integer action from 0 through 3. Load files relative to
`__file__`, and use deterministic inference:

```python
from pathlib import Path
from stable_baselines3 import PPO

model = PPO.load(Path(__file__).with_name("ppo-LunarLander-v3.zip"))


def agent(observation):
    action, _ = model.predict(observation, deterministic=True)
    return int(action)
```

The submission can include Python helpers and model files ending in `.npy`,
`.npz`, `.pkl`, `.pickle`, or `.zip`. `agent.py` is required. Use simple relative
filenames with letters, numbers, underscores, hyphens, and dots; helper
subdirectories are supported. Limits apply to the complete resulting folder:
100 files, 50 MiB per file, 100 MiB total. Symlinks, submodules, notebooks,
dependency lists, and changes to another participant, the baseline, workflows,
or website are rejected.

The evaluator provides the pinned libraries in
[`tournament/requirements-agent.txt`](../../tournament/requirements-agent.txt).
Students cannot install dependencies. Your Python code and model loading run
inside an isolated container with no network, credentials, repository access,
or writable submission files. Model archives are not unpacked by the trusted
controller. The container has 2 CPUs, 2 GiB RAM, 128 processes, and 128 MiB
of temporary storage. Startup may take at most 60 seconds, each action at most
2 seconds, and the complete evaluation at most 10 minutes. Print sparingly.

## Submit and evaluate

1. Fork the repository and add or update your own submission folder.
2. Open a PR against `main`. Keep infrastructure edits out of the PR.
3. Admission checks inspect the complete diff, then evaluate **30 episodes with
   seed 42**. A trusted publisher posts the evaluation report on the PR.
4. An instructor reviews and merges accepted submissions. The official tournament
   publishes standings on [GitHub Pages](https://gramuah.github.io/RL_tournament/).

The notebook helper remains available as
`submit_lab(lab_id=1, files_to_submit={"agent.py": "agent.py", ...}, github_token=token)`.
Use a token belonging to your own account. The helper authenticates that account,
uses its course fork, and creates an atomic commit based on upstream `main`.
Rerunning it replaces its own `submission-lab1-<login>` branch; unrelated edits
on that branch are discarded. Files already merged in your folder remain unless
overwritten. Legacy `submit_practical` and `practical_id` calls still work.

The website's Playground runs built-in educational policies in your browser.
It does not execute your submitted Python agent or determine official scores.
