def agent(observation):
    """
    Demo student agent for LunarLander-v3.
    Applies PD control to orient upright and regulate descent speed.
    """
    x, y, vx, vy, angle, v_angle, left_leg, right_leg = observation[:8]
    
    # Target orientation based on horizontal drift
    target_angle = float(x * 0.4 + vx * 0.8)
    target_angle = max(-0.35, min(0.35, target_angle))
    angle_error = target_angle - angle
    
    # If legs are in contact with ground, do not fire engines
    if left_leg or right_leg:
        return 0
        
    # Correct angular tilt first
    if angle_error > 0.04:
        return 3 # fire right engine to tilt left
    elif angle_error < -0.04:
        return 1 # fire left engine to tilt right
        
    # Main engine control for smooth touchdown
    target_vy = -0.3 if y > 0.3 else -0.15
    if vy < target_vy:
        return 2 # fire main engine to slow descent
        
    return 0
