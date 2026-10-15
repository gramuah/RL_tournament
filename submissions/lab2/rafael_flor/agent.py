import os
import numpy as np

_dir = os.path.dirname(os.path.abspath(__file__))
_qtable = np.load(os.path.join(_dir, 'qtable.npy'))

def agent(observation):
    return int(np.argmax(_qtable[observation, :]))
