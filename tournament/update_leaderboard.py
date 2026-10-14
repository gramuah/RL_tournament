#!/usr/bin/env python3
"""
RL Course Leaderboard Generator
Author: Course Teaching Staff
Description: Evaluates all participant submissions, sorts them by score,
and generates the official LEADERBOARD.md file.
"""

import argparse
import json
import os
import sys
import time
from pathlib import Path

# Import evaluation logic
from evaluate import evaluate_single_submission, PRACTICAL_CONFIGS


REPO_ROOT = Path(__file__).resolve().parent.parent
LEADERBOARD_PATH = REPO_ROOT / "LEADERBOARD.md"
RESULTS_DIR = REPO_ROOT / "tournament" / "results"


def get_rank_medal(rank):
    if rank == 1:
        return "🥇 **1st**"
    elif rank == 2:
        return "🥈 **2nd**"
    elif rank == 3:
        return "🥉 **3rd**"
    else:
        return f"{rank}th"


def run_full_evaluation(practical_id, episodes=30, seed=42):
    """Evaluates all submission folders for the given practical."""
    submissions_dir = Path("submissions") / f"practical{practical_id}"
    results = []

    if not submissions_dir.exists():
        print(f"Warning: {submissions_dir} does not exist.")
        return results

    for item in sorted(submissions_dir.iterdir()):
        if item.is_dir() and (item / "agent.py").exists():
            print(f"Evaluating Practical {practical_id}: {item.name} ...")
            r = evaluate_single_submission(item, practical_id, num_episodes=episodes, base_seed=seed)
            results.append(r)

    # Sort descending by mean_reward
    results.sort(key=lambda x: x.get("mean_reward", -99999), reverse=True)
    return results


def build_markdown_table(results, practical_id):
    """Builds a formatted markdown table from evaluation results."""
    if not results:
        return "_No submissions recorded yet. Be the first to open a Pull Request!_\n"

    lines = [
        "| Rank | Participant | Mean Score | Std Dev | Success Rate | Min / Max | Status |",
        "| :---: | :--- | :---: | :---: | :---: | :---: | :---: |",
    ]

    for idx, r in enumerate(results, start=1):
        rank_str = get_rank_medal(idx)
        participant = r["participant"]
        sub_rel_path = f"submissions/practical{practical_id}/{participant}"
        participant_link = f"[{participant}]({sub_rel_path})"

        if not r.get("success", False):
            lines.append(f"| {rank_str} | {participant_link} | *Error* | - | - | - | ❌ Crash |")
            continue

        mean_str = f"**{r['mean_reward']:.2f}**"
        std_str = f"±{r['std_reward']:.2f}"
        success_str = f"{r['success_rate']:.1f}%"
        min_max_str = f"[{r['min_reward']:.1f}, {r['max_reward']:.1f}]"
        status_str = r["status"]

        # Highlight baselines differently
        if "baseline" in participant.lower():
            participant_link = f"*{participant} (Baseline)*"

        lines.append(
            f"| {rank_str} | {participant_link} | {mean_str} | {std_str} | {success_str} | {min_max_str} | {status_str} |"
        )

    return "\n".join(lines)


def generate_leaderboard_content(p1_results, p2_results, timestamp):
    p1_cfg = PRACTICAL_CONFIGS[1]
    p2_cfg = PRACTICAL_CONFIGS[2]

    p1_table = build_markdown_table(p1_results, 1)
    p2_table = build_markdown_table(p2_results, 2)

    total_submissions = len(p1_results) + len(p2_results)

    content = f"""# 🏆 Reinforcement Learning Course — Official Class Tournament Leaderboard

Welcome to the automated competition leaderboard for the **Reinforcement Learning** course (Master in AI Applications, Universidad de Alcalá).

All agents uploaded to GitHub are automatically benchmarked under identical conditions using fixed seeds and evaluated with **GitHub Actions**.

> **Last Updated:** `{timestamp}`  
> **Total Evaluated Agents:** `{total_submissions}`  
> **Evaluation Engine:** Automated CI Runner (`ubuntu-latest` / Python 3.10)

### 🌐 Arena Interactiva y Visualizador Web en GitHub
👉 **[CLICK AQUÍ PARA ABRIR LA ARENA INTERACTIVA (GitHub Pages)](https://gramuah.github.io/RL_tournament/)** 👈  
*Permite seleccionar dos agentes cualesquiera y ver el enfrentamiento cara a cara en vídeo sincronizado con métricas de velocidad de aterrizaje y telemetría en tiempo real.*

👉 **[Ejecutar Duelo Interactivo a la Carta en GitHub Actions](https://github.com/gramuah/RL_tournament/actions/workflows/duel.yml)**  
*(Pulsa "Run workflow" en GitHub para generar un duelo personalizado con animación y reporte instantáneo).*

---

### 🎬 Repetición en Directo: Enfrentamiento Cara a Cara (*Split-Screen*)
Ambos agentes comienzan con la **misma semilla determinista** (terreno, altitud, objetivo y viento idénticos):

<p align="center">
  <img src="assets/duels/duel_lunarlander_preview.gif" alt="LunarLander Synchronized Duel Replay" width="100%" style="border-radius: 10px; box-shadow: 0 4px 20px rgba(0,0,0,0.5);" />
</p>

---

## 📌 Table of Contents
- [🌐 Arena Interactiva en GitHub Pages](https://gramuah.github.io/RL_tournament/)
- [🚀 Practical 1: LunarLander-v3](#-practical-1-lunarlander-v3)
- [🚕 Practical 2: Taxi-v3 / Taxi-v4](#-practical-2-taxi-v3--taxi-v4)
- [📝 How to Submit Your Model](#-how-to-submit-your-model)
- [⚙️ Evaluation Criteria & Rules](#-evaluation-criteria--rules)

---

## 🚀 Practical 1: LunarLander-v3

In this challenge, agents learn attitude and thruster control to land a spacecraft safely on the lunar surface between landing flags.
- **Pass Threshold:** $\\text{{Mean Reward}} \\ge {p1_cfg['pass_threshold']}$
- **Mastery Threshold:** $\\text{{Mean Reward}} \\ge {p1_cfg['mastery_threshold']}$ (Solved Benchmark)
- **Episodes Evaluated:** {p1_cfg['default_episodes']} episodes (Fixed Seeds)

{p1_table}

---

## 🚕 Practical 2: Taxi-v3 / Taxi-v4

In this challenge, agents learn a tabular Q-learning policy to pick up and drop off passengers in a discrete gridworld.
- **Pass Threshold:** $\\text{{Mean Reward}} \\ge {p2_cfg['pass_threshold']}$
- **Mastery Threshold:** $\\text{{Mean Reward}} \\ge {p2_cfg['mastery_threshold']}$
- **Episodes Evaluated:** {p2_cfg['default_episodes']} episodes (Fixed Seeds)

{p2_table}

---

## 📝 How to Submit Your Model

Participating in the tournament is completely automated:

1. **Train your model in the practical notebook** (`unit1_uah_master.ipynb` or `unit2_uah_master.ipynb`).
2. Run the final packaging cell in the notebook. It generates your `agent.py` and model weights.
3. **Fork or branch this repository** and create your submission directory:
   ```bash
   # For Practical 1:
   submissions/practical1/<your_github_username>/
       ├── agent.py
       └── ppo-LunarLander-v3.zip

   # For Practical 2:
   submissions/practical2/<your_github_username>/
       ├── agent.py
       └── q-learning.pkl
   ```
4. **Open a Pull Request (PR)** targeting `main`.
5. **Instant Feedback 🤖:** GitHub Actions will automatically evaluate your agent and comment on your PR with your score card within 2 minutes!
6. **Leaderboard Update 🏅:** When your PR is merged, the official leaderboard above is automatically updated.

---

## 🎯 Tournament Evaluation Criteria: What is Rewarded?

The automated evaluation engine ranks models based on a multi-dimensional assessment across standardized deterministic seeds (42, 43, 44, ...):

1. **Mean Cumulative Reward (μ, Primary Metric):**
   - **Practical 1 (LunarLander):** Moving from top to landing pad (+100 to +140 pts); leg ground contact (+10 pts each); safe touchdown between flags with zero velocity (+100 pts bonus); crash penalty (-100 pts); main thruster firing (-0.3 pts/frame); lateral thruster firing (-0.03 pts/frame). Top tier: > 270 pts.
   - **Practical 2 (Taxi):** Successful passenger delivery (+20 pts); step penalty (-1 pt per step taken, rewarding direct routes); illegal pickup/drop-off penalty (-10 pts). Top tier: > +8.0 to +9.5 pts/episode.
2. **Success Rate (%):**
   - Percentage of episodes completed without crashing (LunarLander) or timing out (Taxi). Top-ranked agents maintain **100% success rate**.
3. **Stability & Low Variance (±σ):**
   - Consistency across different wind turbulence, terrain slopes, and passenger spawn configurations. Lower σ breaks ties.
4. **Step Efficiency (Speed to Goal):**
   - In head-to-head duels and Taxi navigation, the agent that accomplishes the task in fewer time steps wins the match and claims podium positions.
5. **Inference Latency (ms):**
   - Forward-pass inference time must remain under 100 ms per step for real-time control.

---

## 🚀 How to Achieve Higher Scores & Win Duels

### 🌕 Strategies for Practical 1 (LunarLander-v2/v3 Deep PPO):
- **Expanded Policy Architecture:** Upgrade the default MLP from `[64, 64]` to `[128, 128]` or `[256, 256]` hidden layers with orthogonal initialization (`ortho_init=True`) and `Tanh` activations.
- **Hyperparameter Optimization:**
  - Increase discount factor γ = 0.999 and GAE λ = 0.98 for long-horizon trajectory planning.
  - Tune learning rate with linear or cosine decay starting at 3e-4.
  - Calibrate entropy coefficient (`ent_coef = 0.005`) to prevent premature policy collapse while guaranteeing convergence.
  - Set clip range ε = 0.2 and batch size to 64 or 128.
- **Parallel Vectorized Envs:** Train with `make_vec_env("LunarLander-v3", n_envs=8)` to decorrelate gradient updates.
- **Observation Normalization:** Apply `VecNormalize` to scale altitude, linear velocity, angular tilt, and ground contact sensors.
- **Fuel Economy:** Minimize redundant main and side thruster firings during final descent to gain an extra +20 to +30 points toward the > 280 threshold.
- **Deterministic Evaluation:** Always evaluate with `deterministic=True` when exporting your agent.

### 🚕 Strategies for Practical 2 (Taxi-v3/v4 Tabular Q-Learning):
- **Exponential Epsilon Decay:** Use an exponential exploration schedule `ε_t = ε_min + (ε_max - ε_min) * exp(-decay * t)` with `decay ≈ 0.0005` over 25,000–30,000 episodes to ensure all 500 discrete states are thoroughly explored.
- **Learning Rate Decay:** Start with α = 0.7 and decay to 0.1 as the Q-table stabilizes.
- **Discount Factor γ in [0.95, 0.99]:** Incentivizes shortest Manhattan paths over wandering.
- **Zero-Penalty Target:** Ensure zero illegal pickup/drop-off attempts (-10). Optimal trajectories require between 11 and 14 steps, achieving +7.5 to +9.5 reward per episode.
- **Strict Greedy Policy at Test Time:** Always execute `np.argmax(Q[state])` with ε = 0 during competition evaluation.
"""
    return content


def main():
    parser = argparse.ArgumentParser(description="Update Course Leaderboard")
    parser.add_argument("--episodes", type=int, default=30, help="Episodes per agent")
    parser.add_argument("--seed", type=int, default=42, help="Base seed")
    parser.add_argument("--from-json", action="store_true", help="Build leaderboard from cached JSON files in tournament/results")
    args = parser.parse_args()

    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime())

    p1_json = RESULTS_DIR / "leaderboard_p1.json"
    p2_json = RESULTS_DIR / "leaderboard_p2.json"

    if args.from_json and p1_json.exists() and p2_json.exists():
        print("Loading cached results from JSON...")
        with open(p1_json, "r", encoding="utf-8") as f:
            p1_results = json.load(f)
        with open(p2_json, "r", encoding="utf-8") as f:
            p2_results = json.load(f)
    else:
        print("Running full tournament evaluation...")
        p1_results = run_full_evaluation(1, episodes=args.episodes, seed=args.seed)
        p2_results = run_full_evaluation(2, episodes=args.episodes, seed=args.seed)

        with open(p1_json, "w", encoding="utf-8") as f:
            json.dump(p1_results, f, indent=2)
        with open(p2_json, "w", encoding="utf-8") as f:
            json.dump(p2_results, f, indent=2)

        # Also sync to GitHub Pages docs/data directory if it exists
        docs_data_dir = REPO_ROOT / "docs" / "data"
        if docs_data_dir.exists():
            with open(docs_data_dir / "leaderboard_p1.json", "w", encoding="utf-8") as f:
                json.dump(p1_results, f, indent=2)
            with open(docs_data_dir / "leaderboard_p2.json", "w", encoding="utf-8") as f:
                json.dump(p2_results, f, indent=2)

    markdown_content = generate_leaderboard_content(p1_results, p2_results, timestamp)

    with open(LEADERBOARD_PATH, "w", encoding="utf-8") as f:
        f.write(markdown_content)

    print(f"✅ Successfully generated {LEADERBOARD_PATH} and updated web dashboard data!")


if __name__ == "__main__":
    main()
