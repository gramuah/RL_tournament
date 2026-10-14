import os
from pathlib import Path

_MODEL = None

def _get_model():
    global _MODEL
    if _MODEL is None:
        try:
            from stable_baselines3 import PPO
            model_path = Path(__file__).parent / "ppo-LunarLander-v3.zip"
            if model_path.exists():
                _MODEL = PPO.load(str(model_path))
        except Exception:
            _MODEL = False
    return _MODEL if _MODEL is not False else None


def agent(observation):
    """
    Trained PPO Agent for LunarLander-v3.
    Uses trained neural network policy weights when available,
    falling back to PD attitude stabilization if weights are not found.
    """
    model = _get_model()
    if model is not None:
        action, _ = model.predict(observation, deterministic=True)
        return int(action)

    # Fallback PD Controller
    x, y, vx, vy, angle, v_angle, left_leg, right_leg = observation[:8]
    target_angle = float(x * 0.4 + vx * 0.8)
    target_angle = max(-0.35, min(0.35, target_angle))
    angle_error = target_angle - angle

    if left_leg or right_leg:
        return 0
    if angle_error > 0.04:
        return 3
    elif angle_error < -0.04:
        return 1
    target_vy = -0.3 if y > 0.3 else -0.15
    if vy < target_vy:
        return 2
    return 0
