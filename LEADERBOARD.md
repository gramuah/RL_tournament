# 🏆 Reinforcement Learning Course — Official Class Tournament Leaderboard

Welcome to the automated competition leaderboard for the **Reinforcement Learning** course (Master in AI Applications, Universidad de Alcalá).

All agents uploaded to GitHub are automatically benchmarked under identical conditions using fixed seeds and evaluated with **GitHub Actions**.

> **Last Updated:** `2026-10-14 00:14:22 UTC`  
> **Total Evaluated Agents:** `4`  
> **Evaluation Engine:** Automated CI Runner (`ubuntu-latest` / Python 3.10)

---

## 📌 Table of Contents
- [🚀 Practical 1: LunarLander-v3](#-practical-1-lunarlander-v3)
- [🚕 Practical 2: Taxi-v3 / Taxi-v4](#-practical-2-taxi-v3--taxi-v4)
- [📝 How to Submit Your Model](#-how-to-submit-your-model)
- [⚙️ Evaluation Criteria & Rules](#-evaluation-criteria--rules)

---

## 🚀 Practical 1: LunarLander-v3

In this challenge, agents learn attitude and thruster control to land a spacecraft safely on the lunar surface between landing flags.
- **Pass Threshold:** $\text{Mean Reward} \ge 100.0$
- **Mastery Threshold:** $\text{Mean Reward} \ge 200.0$ (Solved Benchmark)
- **Episodes Evaluated:** 30 episodes (Fixed Seeds)

| Rank | Participant | Mean Score | Std Dev | Success Rate | Min / Max | Status |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: |
| 🥇 **1st** | *baseline_random (Baseline)* | **-156.06** | ±102.23 | 0.0% | [-485.6, 22.6] | NEEDS IMPROVEMENT ⚠️ |
| 🥈 **2nd** | *baseline_heuristic (Baseline)* | **-625.59** | ±178.43 | 0.0% | [-1112.7, -381.7] | NEEDS IMPROVEMENT ⚠️ |
| 🥉 **3rd** | [demo_student](submissions/practical1/demo_student) | **-628.78** | ±174.92 | 0.0% | [-1112.7, -381.7] | NEEDS IMPROVEMENT ⚠️ |

---

## 🚕 Practical 2: Taxi-v3 / Taxi-v4

In this challenge, agents learn a tabular Q-learning policy to pick up and drop off passengers in a discrete gridworld.
- **Pass Threshold:** $\text{Mean Reward} \ge 4.5$
- **Mastery Threshold:** $\text{Mean Reward} \ge 7.0$
- **Episodes Evaluated:** 50 episodes (Fixed Seeds)

| Rank | Participant | Mean Score | Std Dev | Success Rate | Min / Max | Status |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: |
| 🥇 **1st** | *baseline_random (Baseline)* | **-748.40** | ±101.76 | 0.0% | [-875.0, -412.0] | NEEDS IMPROVEMENT ⚠️ |

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

## ⚙️ Evaluation Criteria & Rules

1. **Fair Benchmark Seeds:** All participants are evaluated across the exact same sequence of pseudo-random seeds ($42, 43, 44, \dots$) to ensure 100% fair head-to-head comparison.
2. **Determinism:** Agent decisions should be deterministic at test time (`deterministic=True` or greedy argmax).
3. **Time Limit:** Agents must respond within 100 ms per step. Infinite loops or network calls are strictly disqualified.
4. **Originality Bonus:** In addition to leaderboard rankings, originality in exploration, hyperparameter tuning, and methodology will be rewarded!
