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

The **Live Duel** arena runs trained policies directly in the published page, with no local service required. Both selectors list every successful ranking entry. Use a row's **Duel** action for human versus policy, or **Load selection into Live Duel** for policy versus policy. Seeded scenarios, live rewards/steps, winner/tie detection, pause/reset, speed controls, keyboard shortcuts and touch controls are supported. New episodes start with a three-second countdown; resuming a paused episode is immediate. After both agents finish, higher reward wins, then fewer steps breaks a reward tie. The winner receives confetti; equal rewards and steps show a draw animation. Results remain visible with reduced motion enabled. There is no runtime selector.

CI exports the current Taxi Q-table and LunarLander PPO weights in isolated containers, validates the resulting data, and publishes it with the page. The browser performs actual inference and checks its predictions against the exported reference actions. Incompatible policies show an explicit error, never a substitute heuristic. Authors can supply compatible models through `browser_policy.json`; see [formats, limits and export checks](docs/browser-policies.md).

Taxi uses the original sprites and transition/reward rules. LunarLander ports Gymnasium's geometry, Box2D forces/joints, observation and reward rules to Planck. Browser random streams and physics numerics differ from Python, so live episodes do not change official standings. The optional `python -m tournament.serve --isolated-agents` developer runtime still provides original Gymnasium/Pygame frames, but is not needed for the published duels.

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

The website accent is UAH institutional blue, `#002C91` (RGB 0, 44, 145), read from the [official blue logo](https://www.uah.es/export/shared/es/.galleries/imagen-institucional/logotipos-principales/vA_azul_LogoPrincipal.png) on the [institutional identity page](https://www.uah.es/es/imagen-institucional/). Environment sprites retain their original task colours.
