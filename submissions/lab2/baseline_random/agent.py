import random

def agent(observation):
    """
    Baseline Random Agent for Taxi-v3 / Taxi-v4.
    Action Space:
      0: Move south (down)
      1: Move north (up)
      2: Move east (right)
      3: Move west (left)
      4: Pickup passenger
      5: Dropoff passenger
    """
    return random.randint(0, 5)
