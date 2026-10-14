# 🚕 Submissions: Practical 2 (Taxi-v3 / Taxi-v4)

This folder contains all participant models submitted for the **Practical 2 Tournament** (Master in AI Applications, Universidad de Alcalá).

## 📂 Directory Structure

Each participant or team must place their submission inside their own subfolder named after their GitHub username (or student ID):

```text
submissions/practical2/
├── baseline_random/
│   └── agent.py
└── <your_github_username>/
    ├── agent.py
    └── q-learning.pkl  (or your trained Q-table dictionary)
```

## 🛠️ Required Files

1. **`agent.py`**: Must define a function `agent(observation)` that receives the discrete state integer ($0 \le s \le 499$) and returns an integer action ($0 \dots 5$).
2. **Model weights**: e.g. `q-learning.pkl` containing your trained `qtable`.

### Minimal `agent.py` Example:
```python
import os
import pickle
import numpy as np

model_path = os.path.join(os.path.dirname(__file__), "q-learning.pkl")
with open(model_path, "rb") as f:
    model = pickle.load(f)

Qtable = model["qtable"]

def agent(observation):
    action = np.argmax(Qtable[observation][:])
    return int(action)
```

## 🤖 Automated Evaluation via GitHub Actions

1. Fork this repository.
2. Add your folder `submissions/practical2/<your_github_username>/`.
3. Open a **Pull Request** targeting `main`.
4. Our automated CI bot will test your agent across 50 evaluation episodes and comment your score directly on the PR!
5. Once merged, your rank appears on [LEADERBOARD.md](../../LEADERBOARD.md).
