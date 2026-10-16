"""Regenerate independent Gymnasium 1.2.1 transition/physics references."""
import json
from pathlib import Path
import gymnasium as gym
import numpy as np

class BrowserRandom:
    def __init__(self, seed):
        self.seed = seed
    def uniform(self, low, high, size=None):
        def one():
            self.seed = (1664525 * self.seed + 1013904223) % 2**32
            return low + (high-low)*self.seed/2**32
        return np.array([one() for _ in range(size[0] if isinstance(size, tuple) else size)]) if size else one()

root = Path('tests/fixtures')
taxi = gym.make('Taxi-v3').unwrapped
(root/'taxi-transitions.json').write_text(json.dumps([
    [taxi.P[s][a][0][1], taxi.P[s][a][0][2], taxi.P[s][a][0][3]]
    for s in range(500) for a in range(6)], separators=(',', ':'))+'\n')
lander = gym.make('LunarLander-v3').unwrapped
lander.np_random = BrowserRandom(42)
o, _ = lander.reset()
rows = [{'observation': o.tolist(), 'reward': 0, 'done': False}]
for a in [0,2,1,3]*25:
    o, r, done, _, _ = lander.step(a)
    rows.append({'action': a, 'observation': o.tolist(), 'reward': r, 'done': done})
    if done:
        break
(root/'lander-trajectory.json').write_text(json.dumps(rows, separators=(',', ':'))+'\n')
lander.close()
