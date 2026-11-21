import os
import pickle
import numpy as np

with open(os.path.join(os.path.dirname(__file__), "q-learning.pkl"), "rb") as f:
    model = pickle.load(f)

Qtable = model["qtable"]
POLICY = np.argmax(Qtable, axis=1).astype(np.int64)


def agent(observation):
    return int(POLICY[int(observation)])
