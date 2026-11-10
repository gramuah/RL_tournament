import os
from stable_baselines3 import PPO

custom_objects = {
    'learning_rate': 0.0,
    'lr_schedule': lambda _: 0.0,
    'clip_range': lambda _: 0.2,
}
model_path = os.path.join(os.path.dirname(__file__), "ppo-LunarLander-v3.zip")
model = PPO.load(model_path, custom_objects=custom_objects)

def agent(observation):
    # Given an observation, predict the best action
    action, _states = model.predict(observation, deterministic=True)
    return int(action)
