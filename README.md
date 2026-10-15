# Reinforcement Learning Assignments & Tournament

Public student materials and agent tournament for the University of Alcalá Reinforcement Learning master's subject. Students work on the assignment notebooks, train their agents, and submit them through pull requests for evaluation.

## Assignment notebooks

| Assignment | Student notebook | Submission guide |
| --- | --- | --- |
| Lab 1: PPO / LunarLander | [Open notebook](Lab_sessions/Lab1/unit1_uah_student.ipynb) | [Submit an agent](submissions/practical1/) |
| Lab 2: Q-learning / Taxi | [Open notebook](Lab_sessions/Lab2/unit2_uah_student.ipynb) | [Submit an agent](submissions/practical2/) |
| Final project: Deep Q-learning / Atari | [Open notebook](Lab_sessions/FinalProject/unit3_uah_student.ipynb) | Presentation and oral defense |

Read the [lab guide](Lab_sessions/Lab_Guide.pdf) for notebook setup, deliverables, and assessment. Its editable [LaTeX source](Lab_sessions/Lab_Guide.tex) is maintained here alongside the PDF.

Use **Lab 1** and **Lab 2**, the `--lab` CLI option, the `lab` workflow input, and `lab_id` in Python calls. The submission helper is `submit_lab`. For existing notebooks, `--practical`, the `practical_id` keyword, `submit_practical`, and `PRACTICAL_CONFIGS` remain compatibility aliases. Passing both Python keywords raises `TypeError`. Submission directories (`submissions/practical1/` and `submissions/practical2/`), submission branch names, and stored JSON keys (`practical_id` and `practical_name`) retain their existing names so agents, scores, and existing submissions continue to work.

## Repository ownership

- `Lab_sessions/`: canonical student notebooks and lab guide. Notebook illustrations are embedded so downloaded notebooks work independently.
- `tournament/`: canonical submission helper, evaluator, comparator, and leaderboard generator.
- `submissions/`: submitted agents and their model artifacts, plus the random baselines.
- `docs/`: GitHub Pages arena, shared media, and canonical leaderboard JSON in `docs/data/`.
- `.github/workflows/`: submission evaluation, leaderboard updates, and on-demand duels.

The private `RL_course` repository holds instructor master notebooks, teaching resources, and illustration source files. Edit public assignments and tournament tooling here; edit instructor solutions there. Changes shared by a master and its student assignment require a deliberate review in both repositories. Never copy master notebooks or solution outputs into this public repository.

## Local setup

```bash
python -m venv .venv
source .venv/bin/activate
python -m pip install -r tournament/requirements.txt
```

Box2D installation may require SWIG and a C/C++ toolchain. Video export also requires FFmpeg. The workflows contain the Ubuntu setup used for automated evaluation.

## 🏆 Class Competitions & Automated Leaderboard

Students can submit their trained models directly to GitHub! An automated **GitHub Actions CI/CD runner** automatically evaluates submissions under fair, fixed benchmark seeds and publishes live class rankings:

👉 **[View the Live Class Leaderboard (LEADERBOARD.md)](LEADERBOARD.md)** 👈

- 🚀 **Lab 1:** `LunarLander-v3` — [Folder & Submission Guide](submissions/practical1/)
- 🚕 **Lab 2:** `Taxi-v3 / Taxi-v4` — [Folder & Submission Guide](submissions/practical2/)

When you submit via Pull Request, a bot evaluates your agent and leaves a score report on your PR when the evaluation workflow completes.

### 🥊 Head-to-Head Agent Duel (Side-by-Side Comparator)

Want to see **who lands faster** in LunarLander or how two agents tackle the exact same challenge?

Run the synchronized head-to-head duel tool locally or directly inside Google Colab:

```bash
# Compare two agents side-by-side with synchronized broadcast video
python tournament/compare.py --lab 1 --agent-a submissions/practical1/rafael_flor --agent-b baseline_random --episodes 5 --video duel.mp4
```

Or inside your Colab notebook:
```python
import urllib.request
exec(urllib.request.urlopen("https://raw.githubusercontent.com/gramuah/RL_tournament/main/tournament/compare.py").read().decode("utf-8"))

duel_agents(lab_id=1, agent_a="agent.py", agent_b="baseline_random", output_video="duel.mp4")
display_duel("duel.mp4")
```
- **Same seed**: Identical terrain, wind turbulence, and initial conditions.
- **Speed & Score metrics**: Identifies the faster touchdown and action efficiency.
- **Side-by-side replay**: Broadcast HUD with real-time stats and celebration victory screens.

The notebook submission helper uses the same naming:

```python
submit_lab(
    lab_id=1,
    files_to_submit={"agent.py": "agent.py", "ppo-LunarLander-v3.zip": "ppo-LunarLander-v3.zip"},
    github_token=github_token,
)
```

## Updating the leaderboard

```bash
# Evaluate all submitted agents and update the Markdown and Pages data.
python tournament/update_leaderboard.py --episodes 30

# Rebuild Markdown from the existing canonical scores without running agents.
python tournament/update_leaderboard.py --from-json
```

Cached scores live in `docs/data/`; full evaluation replaces that cache, while `--from-json` reads it. The shared duel GIF and MP4 live in `docs/assets/` and serve both GitHub Markdown and GitHub Pages.
