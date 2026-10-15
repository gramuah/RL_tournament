import random

def agent(observation):
    """Baseline Random Agent for LunarLander-v3.
    Action Space:
      0: Do nothing
      1: Fire left orientation engine
      2: Fire main engine
      3: Fire right orientation engine
    """
    return random.randint(0, 3)
