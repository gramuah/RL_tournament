# 🚀 Submissions: Practical 1 (LunarLander-v3)

This folder contains all participant models submitted for the **Practical 1 Tournament** (Master in AI Applications, Universidad de Alcalá).

## 📂 Directory Structure

Each participant or team must place their submission inside their own subfolder named after their GitHub username (or student ID):

```text
submissions/practical1/
├── baseline_heuristic/
│   └── agent.py
├── baseline_random/
│   └── agent.py
└── <your_github_username>/
    ├── agent.py
    └── ppo-LunarLander-v3.zip  (or your trained model file)
```

## 🛠️ Required Files

1. **`agent.py`**: Must define a function `agent(observation)` that receives the 8-dimensional observation vector and returns an integer action (`0`, `1`, `2`, or `3`).
2. **Model weights**: e.g. `ppo-LunarLander-v3.zip` (loaded by your `agent.py`).

### Minimal `agent.py` Example:
```python
import os
from stable_baselines3 import PPO

# Load your model relative to this file
model_path = os.path.join(os.path.dirname(__file__), "ppo-LunarLander-v3.zip")
model = PPO.load(model_path)

def agent(observation):
    action, _ = model.predict(observation, deterministic=True)
    return int(action)
```

## 🤖 Automated Evaluation via GitHub Actions

1. Fork this repository.
2. Add your folder `submissions/practical1/<your_github_username>/`.
3. Open a **Pull Request** targeting `main`.
4. Our automated CI bot will test your agent across 30 evaluation episodes and comment your score directly on the PR!
5. Once merged, your rank appears on [LEADERBOARD.md](../../LEADERBOARD.md).
