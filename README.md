# Reinforcement Learning Assignments & Tournament

Public student materials and the agent tournament for the University of Alcalá reinforcement learning master's subject.

**[Open the tournament](https://gramuah.github.io/RL_tournament/)** · [Lab 1 submissions](submissions/lab1/) · [Lab 2 submissions](submissions/lab2/)

## Assignments

| Assignment | Student notebook | Submission |
| --- | --- | --- |
| Lab 1: PPO / LunarLander | [Notebook](Lab_sessions/Lab1/unit1_uah_student.ipynb) | [Agent guide](submissions/lab1/) |
| Lab 2: Q-learning / Taxi | [Notebook](Lab_sessions/Lab2/unit2_uah_student.ipynb) | [Agent guide](submissions/lab2/) |
| Final project: Deep Q-learning / Atari | [Notebook](Lab_sessions/FinalProject/unit3_uah_student.ipynb) | Presentation and oral defense |

Read the [lab guide](Lab_sessions/Lab_Guide.pdf) for notebook setup, deliverables, and assessment. Its [LaTeX source](Lab_sessions/Lab_Guide.tex) is maintained here. The private `RL_course` repository holds instructor master notebooks and solutions; never copy those into this public repository.

## Submit an agent

Train your agent, then use the notebook's existing helper or open a pull request from your fork:

```python
submit_lab(
    lab_id=2,
    files_to_submit={"agent.py": "agent.py", "qtable.npy": "qtable.npy"},
    github_token=github_token,
)
```

A submission PR changes only `submissions/lab1/<your-login>/` or `submissions/lab2/<your-login>/`, using your lowercase GitHub login. Keep `agent.py` and all model files in that directory. The helper authenticates the account, validates files, and creates an atomic submission commit from the current upstream `main`.

The agent interface remains `agent(observation) -> int`. Automated evaluation uses **30 episodes, environment seeds 42–71**, a fixed dependency set, and isolated inference. A separate trusted workflow posts a provisional PR report after validating the run and current submission revision. Instructor review and merge are required before official publication.

`submit_practical`, `practical_id`, `--practical`, and `PRACTICAL_CONFIGS` remain compatibility aliases. Supplying both old and new Python keywords raises `TypeError`.

## Repository layout

- `Lab_sessions/`: canonical student notebooks and lab guide.
- `tournament/`: submission helper, admission policy, isolated evaluator, comparator, and publication tooling.
- `submissions/`: participant Python agents and models, plus instructor-owned baselines.
- `web/`: static GitHub Pages site, shared media, and historical result snapshots.
- `.github/workflows/`: validation, isolated evaluation, PR reporting, duels, and Pages deployment.
- `tests/`: admission, artifact, sandbox, compatibility, and browser tests.

## Official results and the website

The tournament workflow evaluates the merged revision and uploads JSON results plus a Markdown snapshot as run artifacts. A fresh job validates those results and assembles `web/`; a separate job deploys to Pages. **No workflow commits generated scores to `main`.**

The published manifest records the source SHA, evaluation time, episode count, and base seed. Infrastructure failures stop publication and leave the previous deployment intact. Failed agents appear as unranked errors. Repository snapshots are labelled historical when previewed locally; the browser never substitutes fabricated scores.

The **Live Duel** arena supports human versus policy and policy versus policy for both labs, with synchronized seeded starts, live reward/step counters, winner/tie detection, pause/reset, new scenarios, and speed controls. The **Playground** uses the same environment controls for solo practice. Keyboard shortcuts from the original site (arrows/WASD, Space/P, Enter/O, R) and touch controls are preserved.

On GitHub Pages, browser practice uses the original bundled Taxi sprites and the original LunarLander-style canvas rendering, with labelled built-in heuristic/random policies and illustrative physics. The old `main` site also used JavaScript physics and substituted heuristics for named student agents; this UI does not misrepresent those as model inference.

For **original Gymnasium physics, rewards and rendered frames**, serve this same UI locally with Python:

```bash
# Python 3.11; activate your environment first. Box2D needs SWIG and a compiler.
python -m pip install -r tournament/requirements-ci.txt
python -m tournament.serve
# Open the printed http://127.0.0.1:8000/ URL. Gymnasium is selected automatically.

# Optional: expose existing repository submissions in the policy selectors.
# Docker must be running; agents execute only in the existing isolated image.
docker build -f tournament/Dockerfile.agent -t rl-tournament-agent:local tournament
python -m tournament.serve --isolated-agents
```

Both players use separate Gymnasium environments reset to the same seed. Taxi uses discrete keypresses; LunarLander advances while running and accepts held engine controls. Runtime errors stop play with an explicit error; they never switch to a substitute simulation or import student code on the host. The local runtime binds loopback, serves only `web/`, and rejects cross-origin API calls. Practice results never update official standings.

The archived LunarLander recording is a fixed example, not a selected-agent replay. For an exportable real-agent video, use the [duel workflow](https://github.com/gramuah/RL_tournament/actions/workflows/duel.yml) or the comparator below.

## Local development and verification

```bash
# Preview the site with the same project-path shape as GitHub Pages.
python3 -m http.server 8000 --directory ..
# Open http://localhost:8000/RL_tournament/web/

# Browser tests serve /RL_tournament/ themselves and capture desktop/mobile images.
npm ci
npx playwright install chromium
npm run test:web
# Include end-to-end original Gymnasium rendering/control tests:
GYM_PYTHON=python npm run test:web
# CI also sets GYM_ISOLATED_AGENTS=1 to test saved-agent play in Docker.
```

For evaluator development, use Python 3.11. The fully hashed CI lock targets Linux; local platform packages can be installed from its input file:

```bash
python3.11 -m venv .venv
source .venv/bin/activate
python -m pip install -r tournament/requirements-ci.txt
python -m unittest discover -s tests -v

# Docker must be available. Build the instructor-controlled inference image.
docker build -f tournament/Dockerfile.agent -t rl-tournament-agent:local tournament
RUN_SANDBOX_TESTS=1 python -m unittest discover -s tests -v
python tournament/evaluate.py --lab 2 \
  --submission submissions/lab2/rafael_flor --episodes 30 --isolated
```

The Docker image is pinned to Linux/amd64; ARM developers can use Docker's amd64 emulation. Box2D needs SWIG and a C/C++ toolchain when a wheel is unavailable. Video export additionally needs FFmpeg and the packages in `tournament/requirements.txt`.

For local or Colab experimentation, existing evaluator/comparator calls retain their direct-execution mode. **Use that mode only for code and model files you trust:** importing an agent or unpickling a model can execute Python. All repository workflows require isolation and fail closed if it is unavailable.

```bash
python tournament/compare.py --lab 1 \
  --agent-a submissions/lab1/rafael_flor --agent-b baseline_random \
  --episodes 3 --isolated --video duel.mp4

# Local rebuilds write web/data and LEADERBOARD.md; review changes before committing.
python tournament/update_leaderboard.py --episodes 30 --isolated
python tournament/update_leaderboard.py --from-json
```

Read [SECURITY.md](SECURITY.md) for the trust boundaries and [the rollout guide](tournament/OPERATIONS.md) before activating repository settings and the new Pages source.
