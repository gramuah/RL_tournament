def agent(observation):
    """
    Simple heuristic proportional-derivative controller for LunarLander-v3.
    Demonstrates baseline performance against which RL agents are compared.
    """
    x, y, vx, vy, angle, v_angle, left_leg, right_leg = observation[:8]

    # Target angle based on horizontal position and velocity
    target_angle = float(x * 0.5 + vx * 1.0)
    target_angle = max(-0.4, min(0.4, target_angle))
    angle_error = target_angle - angle

    # Hover / main engine
    target_vy = -0.5
    vy_error = target_vy - vy

    if left_leg or right_leg:
        return 0

    if angle_error > 0.05:
        return 3  # Fire right engine to tilt left
    elif angle_error < -0.05:
        return 1  # Fire left engine to tilt right
    elif vy_error > 0.0 or y < 0.2:
        return 2  # Fire main engine to decelerate
    return 0
