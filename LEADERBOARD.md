# 🏆 Reinforcement Learning Course — Official Class Tournament Leaderboard

Welcome to the automated competition leaderboard for the **Reinforcement Learning** course (Master in AI Applications, Universidad de Alcalá).

All agents uploaded to GitHub are automatically benchmarked under identical conditions using fixed seeds and evaluated with **GitHub Actions**.

> **Last Updated:** `2026-10-14 15:08:11 UTC`  
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
| 🥈 **2nd** | *baseline_random (Baseline)* | **-176.40** | ±101.77 | 0.0% | [-405.7, -36.2] | NEEDS IMPROVEMENT ⚠️ |

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
