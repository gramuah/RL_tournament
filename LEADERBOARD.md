# 🏆 Reinforcement Learning Course — Official Class Tournament Leaderboard

Welcome to the automated competition leaderboard for the **Reinforcement Learning** course (Master in AI Applications, Universidad de Alcalá).

All agents uploaded to GitHub are automatically benchmarked under identical conditions using fixed seeds and evaluated with **GitHub Actions**.

> **Last Updated:** `2026-10-14 11:52:48 UTC`  
> **Total Evaluated Agents:** `4`  
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
- **Pass Threshold:** $\text{Mean Reward} \ge 100.0$
- **Mastery Threshold:** $\text{Mean Reward} \ge 200.0$ (Solved Benchmark)
- **Episodes Evaluated:** 30 episodes (Fixed Seeds)

| Rank | Participant | Mean Score | Std Dev | Success Rate | Min / Max | Status |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: |
| 🥇 **1st** | [rafael_flor](submissions/practical1/rafael_flor) | **257.38** | ±23.07 | 100.0% | [215.8, 297.1] | MASTERY 🏆 |
| 🥈 **2nd** | *baseline_random (Baseline)* | **-210.62** | ±108.97 | 0.0% | [-409.4, 0.9] | NEEDS IMPROVEMENT ⚠️ |

---

## 🚕 Practical 2: Taxi-v3 / Taxi-v4

In this challenge, agents learn a tabular Q-learning policy to pick up and drop off passengers in a discrete gridworld.
- **Pass Threshold:** $\text{Mean Reward} \ge 4.5$
- **Mastery Threshold:** $\text{Mean Reward} \ge 7.0$
- **Episodes Evaluated:** 50 episodes (Fixed Seeds)

| Rank | Participant | Mean Score | Std Dev | Success Rate | Min / Max | Status |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: |
| 🥇 **1st** | [rafael_flor](submissions/practical2/rafael_flor) | **7.07** | ±2.50 | 100.0% | [3.0, 12.0] | MASTERY 🏆 |
| 🥈 **2nd** | *baseline_random (Baseline)* | **-778.07** | ±122.58 | 0.0% | [-983.0, -256.0] | NEEDS IMPROVEMENT ⚠️ |

---

## 📝 How to Submit Your Model

Participating in the tournament is completely automated:

1. **Train your model in the practical notebook** (`unit1_uah_student.ipynb` or `unit2_uah_student.ipynb`).
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
