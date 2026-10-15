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
from evaluate import evaluate_single_submission, LAB_CONFIGS, _accept_legacy_practical_id

# Backward-compatible module attribute.
PRACTICAL_CONFIGS = LAB_CONFIGS


REPO_ROOT = Path(__file__).resolve().parent.parent
LEADERBOARD_PATH = REPO_ROOT / "LEADERBOARD.md"
RESULTS_DIR = REPO_ROOT / "docs" / "data"


def get_rank_medal(rank):
    if rank == 1:
        return "🥇 **1st**"
    elif rank == 2:
        return "🥈 **2nd**"
    elif rank == 3:
        return "🥉 **3rd**"
    else:
        return f"{rank}th"


@_accept_legacy_practical_id(lab_position=0)
def run_full_evaluation(lab_id, episodes=30, seed=42):
    """Evaluates all submission folders for the given lab."""
    submissions_dir = Path("submissions") / f"lab{lab_id}"
    results = []

    if not submissions_dir.exists():
        print(f"Warning: {submissions_dir} does not exist.")
        return results

    for item in sorted(submissions_dir.iterdir()):
        if item.is_dir() and (item / "agent.py").exists():
            print(f"Evaluating Lab {lab_id}: {item.name} ...")
            r = evaluate_single_submission(item, lab_id, num_episodes=episodes, base_seed=seed)
            results.append(r)

    # Sort descending by mean_reward
    results.sort(key=lambda x: x.get("mean_reward", -99999), reverse=True)
    return results


@_accept_legacy_practical_id(lab_position=1)
def build_markdown_table(results, lab_id):
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
        sub_rel_path = f"submissions/lab{lab_id}/{participant}"
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
    p1_cfg = LAB_CONFIGS[1]
    p2_cfg = LAB_CONFIGS[2]

    p1_table = build_markdown_table(p1_results, 1)
    p2_table = build_markdown_table(p2_results, 2)

    total_submissions = len(p1_results) + len(p2_results)

    content = f"""# 🏆 Reinforcement Learning Course — Official Class Tournament Leaderboard

Welcome to the automated competition leaderboard for the **Reinforcement Learning** course (Master in AI Applications, University of Alcalá).

All agents uploaded to GitHub are automatically benchmarked under identical conditions using fixed seeds and evaluated with **GitHub Actions**.

> **Last Updated:** `{timestamp}`  
> **Total Evaluated Agents:** `{total_submissions}`  
> **Evaluation Engine:** Automated CI Runner (`ubuntu-latest` / Python 3.10)

### 🌐 Interactive Arena and Web Viewer on GitHub
👉 **[OPEN THE INTERACTIVE ARENA (GitHub Pages)](https://gramuah.github.io/RL_tournament/)** 👈<br>
*Select any two agents and watch their head-to-head duel in synchronized video with landing-speed metrics and real-time telemetry.*

👉 **[Run an On-Demand Interactive Duel in GitHub Actions](https://github.com/gramuah/RL_tournament/actions/workflows/duel.yml)**<br>
*(Click "Run workflow" on GitHub to generate a custom duel with animation and an instant report).*

---

### 🎬 Live Replay: Head-to-Head Duel (*Split-Screen*)
Both agents start with the **same deterministic seed** (identical terrain, altitude, target, and wind):

<p align="center">
  <img src="docs/assets/duel_lunarlander_preview.gif" alt="LunarLander Synchronized Duel Replay" width="100%" style="border-radius: 10px; box-shadow: 0 4px 20px rgba(0,0,0,0.5);" />
</p>

---

## 📌 Table of Contents
- [🌐 Interactive Arena on GitHub Pages](https://gramuah.github.io/RL_tournament/)
- [🚀 Lab 1: LunarLander-v3](#-lab-1-lunarlander-v3)
- [🚕 Lab 2: Taxi-v3 / Taxi-v4](#-lab-2-taxi-v3--taxi-v4)
- [📝 How to Submit Your Model](#-how-to-submit-your-model)
- [⚙️ Evaluation Criteria & Rules](#-evaluation-criteria--rules)

---

## 🚀 Lab 1: LunarLander-v3

In this challenge, agents learn attitude and thruster control to land a spacecraft safely on the lunar surface between landing flags.
- **Pass Threshold:** $\\text{{Mean Reward}} \\ge {p1_cfg['pass_threshold']}$
- **Mastery Threshold:** $\\text{{Mean Reward}} \\ge {p1_cfg['mastery_threshold']}$ (Solved Benchmark)
- **Episodes Evaluated:** {p1_cfg['default_episodes']} episodes (Fixed Seeds)

{p1_table}

---

## 🚕 Lab 2: Taxi-v3 / Taxi-v4

In this challenge, agents learn a tabular Q-learning policy to pick up and drop off passengers in a discrete gridworld.
- **Pass Threshold:** $\\text{{Mean Reward}} \\ge {p2_cfg['pass_threshold']}$
- **Mastery Threshold:** $\\text{{Mean Reward}} \\ge {p2_cfg['mastery_threshold']}$
- **Episodes Evaluated:** {p2_cfg['default_episodes']} episodes (Fixed Seeds)

{p2_table}

---

## 📝 How to Submit Your Model

Participating in the tournament is completely automated:

1. **Train your model in the lab notebook** (`unit1_uah_master.ipynb` or `unit2_uah_master.ipynb`).
2. Run the final packaging cell in the notebook. It generates your `agent.py` and model weights.
3. **Fork or branch this repository** and create your submission directory:
   ```bash
   # For Lab 1:
   submissions/lab1/<your_github_username>/
       ├── agent.py
       └── ppo-LunarLander-v3.zip

   # For Lab 2:
   submissions/lab2/<your_github_username>/
       ├── agent.py
       └── q-learning.pkl
   ```
4. **Open a Pull Request (PR)** targeting `main`.
5. **Instant Feedback 🤖:** GitHub Actions will automatically evaluate your agent and comment on your PR with your score card within 2 minutes!
6. **Leaderboard Update 🏅:** When your PR is merged, the official leaderboard above is automatically updated.

---

## 🎯 Tournament Scoring: Point Formulas

Points awarded in each environment are calculated as follows:

### 🌕 LunarLander-v2 / v3:
```
R = R_trajectory + 10 * N_legs - 0.3 * N_main - 0.03 * N_side + R_terminal
```
- **R_trajectory (+100 to +140 pts):** Moving from top to landing pad while reducing speed and tilt.
- **N_legs (+10 pts each):** Each leg touching the lunar surface.
- **N_main (-0.3 pts/frame):** Main engine fuel consumption.
- **N_side (-0.03 pts/frame):** Side thrusters fuel consumption.
- **R_terminal:** **+100 pts** for safe touchdown inside flags; **-100 pts** for a crash.

---

### 🚕 Taxi-v3 / v4:
```
R = 20 * 1_{{delivered}} - 1 * (steps) - 10 * (illegal_actions)
```
- **+20 pts:** Successfully delivering the passenger at the destination.
- **-1 pt / step:** Cost per step taken (rewarding shortest route).
- **-10 pts:** Penalty for each illegal pickup or drop-off attempt.
"""
    return content


def main():
    parser = argparse.ArgumentParser(description="Update Course Leaderboard")
    parser.add_argument("--episodes", type=int, default=30, help="Episodes per agent")
    parser.add_argument("--seed", type=int, default=42, help="Base seed")
    parser.add_argument("--from-json", action="store_true", help="Build leaderboard from cached JSON files in docs/data")
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

    markdown_content = generate_leaderboard_content(p1_results, p2_results, timestamp)

    with open(LEADERBOARD_PATH, "w", encoding="utf-8") as f:
        f.write(markdown_content)

    print(f"✅ Successfully generated {LEADERBOARD_PATH} and updated web dashboard data!")


if __name__ == "__main__":
    main()
