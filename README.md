# 🏆 RL Course Tournament & Live Leaderboards

[![Tournament Status](https://img.shields.io/badge/Tournament-Active-success?style=for-the-badge&logo=github)](LEADERBOARD.md)
[![Leaderboard](https://img.shields.io/badge/Class_Leaderboard-View_Rankings-blue?style=for-the-badge&logo=trophy)](LEADERBOARD.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

Official public tournament and benchmark leaderboard platform for the **Reinforcement Learning** course (Master in AI Applications, Universidad de Alcalá).

👉 **[CLICK HERE TO VIEW THE LIVE CLASS LEADERBOARD (LEADERBOARD.md)](LEADERBOARD.md)** 👈

---

## 📌 Practical Sessions & Jupyter Notebooks

You can launch and execute the practical sessions directly in **Google Colab** with one click:

| Session | Topic | Colab Badge | Deliverable |
| :--- | :--- | :---: | :---: |
| **Practical 1** | Introduction to RL & Deep PPO (`LunarLander-v3`) | [![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/gramuah/RL_tournament/blob/main/Lab_sessions/Practical1/unit1_uah_student.ipynb) | [Submissions Folder](submissions/practical1/) |
| **Practical 2** | Tabular Q-Learning (`Taxi-v3 / Taxi-v4`) | [![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/gramuah/RL_tournament/blob/main/Lab_sessions/Practical2/unit2_uah_student.ipynb) | [Submissions Folder](submissions/practical2/) |
| **Final Practical** | Final Project | [![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/gramuah/RL_tournament/blob/main/Lab_sessions/Practical_final/unit3_uah_master.ipynb) | Oral Defense |

The official PDF student guide is available here:  
📄 **[Download Guide_Practical_Sessions.pdf](Lab_sessions/Guide_Practical_Sessions.pdf)**

---

## 🚀 How the Automated Tournament Works

1. **Train your Agent in Google Colab:**
   Open the notebook, train your policy, and evaluate its convergence.
2. **One-Click Pull Request from Colab:**
   Run the submission cell at the end of the notebook. It will securely ask for your GitHub Token, automatically fork this repository, and open a **Pull Request (PR)** for you!
3. **Instant Automated Evaluation 🤖:**
   A **GitHub Actions** CI robot runs your agent across standardized pseudo-random seeds ($42, 43, 44, \dots$) and comments directly on your Pull Request within 2 minutes with:
   - Mean Reward ($\mu$)
   - Stability Variance ($\pm \sigma$)
   - Success Rate (%)
   - Inference Latency (ms)
4. **Public Leaderboard 🏅:**
   Once your PR is merged, your agent joins the official rankings on **[LEADERBOARD.md](LEADERBOARD.md)**!

---

## 🥊 Head-to-Head Agent Duel (Side-by-Side Comparator)

Want to see **who lands faster** in LunarLander or test two agents on the exact same challenge?

Run the synchronized head-to-head duel tool locally or directly inside Google Colab:

```bash
# Compare two agents side-by-side with synchronized broadcast video
python tournament/compare.py --practical 1 --agent-a submissions/practical1/demo_student --agent-b baseline_heuristic --episodes 5 --video duel.mp4
```

Or directly inside your Colab notebook:
```python
import urllib.request
exec(urllib.request.urlopen("https://raw.githubusercontent.com/gramuah/RL_tournament/main/tournament/compare.py").read().decode("utf-8"))

# Duel against a baseline or against any classmate on the leaderboard!
duel_agents(practical_id=1, agent_a="agent.py", agent_b="baseline_heuristic", output_video="duel.mp4")
display_duel("duel.mp4")
```

- **Same seed**: Identical initial state, terrain slopes, flags, and wind turbulence.
- **Speed & Score metrics**: Identifies the faster touchdown and fuel/action efficiency.
- **Side-by-side replay**: Broadcast HUD with real-time stats and celebration victory screens.

---

## 📂 Submissions Directory Structure

Each student/team submits their model into their own folder:

```text
submissions/
├── practical1/
│   ├── baseline_random/
│   ├── baseline_heuristic/
│   └── <your_github_username>/
│       ├── agent.py
│       └── ppo-LunarLander-v3.zip
└── practical2/
    ├── baseline_random/
    └── <your_github_username>/
        ├── agent.py
        └── q-learning.pkl
```

---

## ⚖️ Tournament Rules & Fair Play

- **Evaluation Protocol:** All agents are evaluated with deterministic policies over fixed seed sequences.
- **Fair Resource Limits:** 1000 max steps for LunarLander, 200 max steps for Taxi. Maximum 100 ms per inference step.
- **Originality Bonus:** In addition to pure leaderboard ranking, independent research, hyperparameter exploration, and innovative architectures will receive bonus evaluation marks.
