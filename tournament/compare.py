#!/usr/bin/env python3
"""
RL Course Head-to-Head Agent Duel & Comparator
Author: Course Teaching Staff
Description: Enables students and instructors to compare two RL agents side-by-side
under the exact same seed conditions (LunarLander-v3 and Taxi-v3/v4).
Computes head-to-head metrics (speed to completion, score, fuel/actions) and
generates a synchronized side-by-side broadcast duel video.
"""

from functools import wraps

import argparse
import base64
import importlib.util
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path
import numpy as np

try:
    import gymnasium as gym
except ImportError:
    gym = None

try:
    import cv2
except ImportError:
    cv2 = None

try:
    import imageio
except ImportError:
    imageio = None


LAB_CONFIGS = {
    1: {
        "name": "Lab 1 - LunarLander-v3",
        "env_candidates": ["LunarLander-v3", "LunarLander-v2"],
        "max_steps": 1000,
        "default_episodes": 5,
        "pass_threshold": 100.0,
        "task_name": "Lunar Landing",
        "action_names": {0: "No-op", 1: "Left Eng", 2: "Main Eng", 3: "Right Eng"},
    },
    2: {
        "name": "Lab 2 - Taxi-v3 / Taxi-v4",
        "env_candidates": ["Taxi-v4", "Taxi-v3"],
        "max_steps": 200,
        "default_episodes": 10,
        "pass_threshold": 4.5,
        "task_name": "Passenger Delivery",
        "action_names": {0: "South", 1: "North", 2: "East", 3: "West", 4: "Pickup", 5: "Dropoff"},
    },
}

GITHUB_OWNER = "gramuah"
GITHUB_REPO = "RL_tournament"


# Backward-compatible name for existing notebooks and integrations.
PRACTICAL_CONFIGS = LAB_CONFIGS


def _accept_legacy_practical_id(lab_position=0):
    """Keep the old keyword working while exposing lab_id in Python signatures."""
    def decorate(function):
        @wraps(function)
        def compatible(*args, **kwargs):
            if "practical_id" in kwargs:
                if "lab_id" in kwargs or len(args) > lab_position:
                    raise TypeError("Specify lab_id or practical_id, not both")
                kwargs["lab_id"] = kwargs.pop("practical_id")
            return function(*args, **kwargs)
        return compatible
    return decorate


def get_default_repo_root():
    """Safely determines the repository root directory in any environment."""
    if "__file__" in globals() and globals()["__file__"]:
        return Path(__file__).resolve().parent.parent
    return Path.cwd()


def make_env(env_candidates, seed=None, render_mode=None):
    """Attempt to create the environment using candidate names."""
    if gym is None:
        raise RuntimeError("Gymnasium is required. Run: pip install 'gymnasium[box2d]'")
    last_err = None
    for env_id in env_candidates:
        try:
            kwargs = {}
            if render_mode is not None:
                kwargs["render_mode"] = render_mode
            env = gym.make(env_id, **kwargs)
            if seed is not None:
                env.reset(seed=seed)
            return env, env_id
        except Exception as e:
            last_err = e
            continue
    raise RuntimeError(f"Could not instantiate any of {env_candidates}: {last_err}")


def load_agent_from_dir(directory_path):
    """Dynamically loads agent(observation) function from agent.py in directory_path."""
    dir_path = Path(directory_path).resolve()
    agent_file = dir_path / "agent.py"
    if not agent_file.exists():
        raise FileNotFoundError(f"Missing required file: {agent_file}")

    orig_cwd = os.getcwd()
    sys_path_inserted = False
    sub_dir_str = str(dir_path)

    if sub_dir_str not in sys.path:
        sys.path.insert(0, sub_dir_str)
        sys_path_inserted = True

    try:
        os.chdir(sub_dir_str)
        spec = importlib.util.spec_from_file_location(f"agent_mod_{dir_path.name}", str(agent_file))
        if spec is None or spec.loader is None:
            raise ImportError(f"Could not load specification for {agent_file}")

        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)

        if not hasattr(module, "agent"):
            raise AttributeError(f"{agent_file} must define a function named 'agent(observation)'")

        agent_fn = getattr(module, "agent")
        if not callable(agent_fn):
            raise TypeError("'agent' attribute in agent.py must be callable")

        return agent_fn
    finally:
        os.chdir(orig_cwd)
        if sys_path_inserted and sub_dir_str in sys.path:
            sys.path.remove(sub_dir_str)


@_accept_legacy_practical_id(lab_position=0)
def list_available_opponents(lab_id=1, repo_root=None):
    """Returns a list of all local and known opponent submissions."""
    if repo_root is None:
        repo_root = get_default_repo_root()
    else:
        repo_root = Path(repo_root).resolve()

    sub_dir = repo_root / "submissions" / f"lab{lab_id}"
    opponents = []
    if sub_dir.exists():
        for entry in sorted(sub_dir.iterdir()):
            if entry.is_dir() and (entry / "agent.py").exists():
                opponents.append(entry.name)
    return opponents


@_accept_legacy_practical_id(lab_position=0)
def download_github_submission(lab_id, github_username, target_dir):
    """Downloads a classmate's submission folder from the official GitHub repository."""
    os.makedirs(target_dir, exist_ok=True)
    api_url = f"https://api.github.com/repos/{GITHUB_OWNER}/{GITHUB_REPO}/contents/submissions/lab{lab_id}/{github_username}"

    headers = {"Accept": "application/vnd.github+json", "User-Agent": "RL-Duel-Comparator"}
    req = urllib.request.Request(api_url, headers=headers)
    try:
        with urllib.request.urlopen(req) as response:
            items = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        if e.code == 404:
            raise ValueError(
                f"Opponent '{github_username}' was not found in lab {lab_id} of repository {GITHUB_OWNER}/{GITHUB_REPO}."
            )
        raise RuntimeError(f"GitHub API Error ({e.code}): {e.reason}")

    downloaded = []
    for item in items:
        if item.get("type") == "file":
            download_url = item.get("download_url")
            file_name = item.get("name")
            if download_url and file_name:
                dest_file = Path(target_dir) / file_name
                print(f"📥 Downloading opponent file: {file_name}...")
                urllib.request.urlretrieve(download_url, str(dest_file))
                downloaded.append(file_name)

    if "agent.py" not in downloaded:
        raise FileNotFoundError(f"Opponent folder for '{github_username}' did not contain 'agent.py'.")
    return target_dir


@_accept_legacy_practical_id(lab_position=1)
def resolve_agent(agent_spec, lab_id, repo_root=None):
    """
    Resolves agent_spec into:
    (callable_agent_fn, display_name, cleanup_callback_or_none)
    """
    if callable(agent_spec):
        name = getattr(agent_spec, "__name__", "CustomAgent")
        return agent_spec, name, None

    agent_str = str(agent_spec).strip()

    # Case 1: Direct file or directory path
    path = Path(agent_str)
    if path.is_file() and path.name == "agent.py":
        return load_agent_from_dir(path.parent), path.parent.name, None
    if path.is_file() and path.suffix == ".py":
        # Any custom python file
        temp_dir = tempfile.mkdtemp(prefix="agent_custom_")
        shutil.copy(str(path), str(Path(temp_dir) / "agent.py"))
        agent_fn = load_agent_from_dir(temp_dir)
        def cleanup():
            shutil.rmtree(temp_dir, ignore_errors=True)
        return agent_fn, path.stem, cleanup

    if path.is_dir() and (path / "agent.py").exists():
        return load_agent_from_dir(path), path.name, None

    # Case 2: In submissions/labX/
    if repo_root is None:
        repo_root = get_default_repo_root()
    sub_candidate = Path(repo_root) / "submissions" / f"lab{lab_id}" / agent_str
    if sub_candidate.is_dir() and (sub_candidate / "agent.py").exists():
        return load_agent_from_dir(sub_candidate), agent_str, None

    # Case 3: Try downloading from public GitHub repository
    print(f"🌐 Fetching opponent '{agent_str}' from repository {GITHUB_OWNER}/{GITHUB_REPO}...")
    temp_dir = tempfile.mkdtemp(prefix=f"opponent_{agent_str}_")
    try:
        download_github_submission(lab_id, agent_str, temp_dir)
        agent_fn = load_agent_from_dir(temp_dir)
        def cleanup():
            shutil.rmtree(temp_dir, ignore_errors=True)
        return agent_fn, f"{agent_str} (Remote)", cleanup
    except Exception as e:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise ValueError(
            f"Could not resolve agent '{agent_str}'. It is neither a local path, a known baseline, nor a valid GitHub submission. Error: {e}"
        )


def _draw_hud_panel(frame, title, steps, reward, status_text, status_color, side_label="A"):
    """Overlays an esports-style stats panel on an environment frame."""
    if cv2 is None:
        return frame
    h, w = frame.shape[:2]
    # Top header band
    top_bar_h = 44
    cv2.rectangle(frame, (0, 0), (w, top_bar_h), (25, 25, 30), -1)

    # Agent title badge
    badge_color = (235, 120, 40) if side_label == "A" else (40, 160, 240)  # BGR
    cv2.circle(frame, (18, 22), 8, badge_color, -1)
    cv2.putText(frame, title, (36, 28), cv2.FONT_HERSHEY_DUPLEX, 0.65, (255, 255, 255), 1, cv2.LINE_AA)

    # Bottom status bar
    bot_bar_h = 36
    cv2.rectangle(frame, (0, h - bot_bar_h), (w, h), (20, 20, 24), -1)

    # Stats text
    stats_str = f"Step: {steps:<4} | Reward: {reward:+.1f}"
    cv2.putText(frame, stats_str, (12, h - 12), cv2.FONT_HERSHEY_SIMPLEX, 0.52, (200, 220, 220), 1, cv2.LINE_AA)

    # Status badge (Flying / Landed / Crashed)
    cv2.putText(
        frame,
        status_text,
        (w - 180, h - 12),
        cv2.FONT_HERSHEY_DUPLEX,
        0.52,
        status_color,
        1,
        cv2.LINE_AA,
    )
    return frame


def _draw_finished_overlay(frame, status_text, status_color, reward, steps):
    """Draws a semi-transparent celebratory or crash card when an agent finishes early."""
    if cv2 is None:
        return frame
    h, w = frame.shape[:2]
    overlay = frame.copy()
    box_w, box_h = int(w * 0.75), 90
    x1, y1 = (w - box_w) // 2, (h - box_h) // 2
    x2, y2 = x1 + box_w, y1 + box_h

    cv2.rectangle(overlay, (x1, y1), (x2, y2), (20, 20, 24), -1)
    cv2.rectangle(overlay, (x1, y1), (x2, y2), status_color, 2)
    cv2.addWeighted(overlay, 0.82, frame, 0.18, 0, frame)

    cv2.putText(
        frame,
        status_text,
        (x1 + 20, y1 + 35),
        cv2.FONT_HERSHEY_DUPLEX,
        0.75,
        status_color,
        2,
        cv2.LINE_AA,
    )
    detail_str = f"Finished at Step {steps}  |  Score: {reward:+.1f}"
    cv2.putText(
        frame,
        detail_str,
        (x1 + 20, y1 + 68),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.55,
        (240, 240, 240),
        1,
        cv2.LINE_AA,
    )
    return frame


def _build_duel_frame(frame_a, frame_b, title_a, title_b, done_a, done_b, seed, step):
    """Composes two environment frames side by side with a shared broadcast header."""
    if cv2 is None:
        return np.hstack([frame_a, frame_b])
    ha, wa = frame_a.shape[:2]
    hb, wb = frame_b.shape[:2]

    target_h = max(ha, hb)
    if ha != target_h:
        frame_a = cv2.resize(frame_a, (int(wa * (target_h / ha)), target_h))
    if hb != target_h:
        frame_b = cv2.resize(frame_b, (int(wb * (target_h / hb)), target_h))

    wa = frame_a.shape[1]
    wb = frame_b.shape[1]

    composite = np.hstack([frame_a, frame_b])
    total_w = composite.shape[1]

    banner_h = 32
    banner = np.full((banner_h, total_w, 3), 15, dtype=np.uint8)
    match_str = f"HEAD-TO-HEAD DUEL  |  SEED #{seed}  |  STEP {step}"
    text_size = cv2.getTextSize(match_str, cv2.FONT_HERSHEY_DUPLEX, 0.55, 1)[0]
    tx = (total_w - text_size[0]) // 2
    cv2.putText(banner, match_str, (tx, 22), cv2.FONT_HERSHEY_DUPLEX, 0.55, (255, 215, 0), 1, cv2.LINE_AA)

    cv2.line(composite, (wa, 0), (wa, target_h), (255, 215, 0), 2)
    final_frame = np.vstack([banner, composite])
    return final_frame


def _build_victory_screen(width, height, winner_title, subtitle, score_a, score_b, name_a, name_b):
    """Creates a final victory splash frame with pure ASCII text (no OpenCV glyph artifacts)."""
    if cv2 is None:
        return np.zeros((height, width, 3), dtype=np.uint8)
    splash = np.full((height, width, 3), (24, 24, 28), dtype=np.uint8)
    cv2.rectangle(splash, (15, 15), (width - 15, height - 15), (255, 215, 0), 3)

    is_tie = "DRAW" in winner_title.upper() or "TIE" in winner_title.upper()
    title_color = (0, 215, 255) if is_tie else (50, 230, 80)
    v_text = f"RESULT: {winner_title.upper()}" if is_tie else f"VICTORY: {winner_title.upper()}"

    t_size = cv2.getTextSize(v_text, cv2.FONT_HERSHEY_DUPLEX, 1.05, 2)[0]
    cv2.putText(
        splash,
        v_text,
        ((width - t_size[0]) // 2, height // 2 - 50),
        cv2.FONT_HERSHEY_DUPLEX,
        1.05,
        title_color,
        2,
        cv2.LINE_AA,
    )

    clean_subtitle = "".join(c for c in subtitle if ord(c) < 128)
    s_size = cv2.getTextSize(clean_subtitle, cv2.FONT_HERSHEY_SIMPLEX, 0.72, 1)[0]
    cv2.putText(
        splash,
        clean_subtitle,
        ((width - s_size[0]) // 2, height // 2 - 5),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.72,
        (240, 240, 240),
        1,
        cv2.LINE_AA,
    )

    clean_a = "".join(c for c in name_a if ord(c) < 128)
    clean_b = "".join(c for c in name_b if ord(c) < 128)
    score_str = f"{clean_a}: {score_a:+.1f} pts  vs  {clean_b}: {score_b:+.1f} pts"
    sc_size = cv2.getTextSize(score_str, cv2.FONT_HERSHEY_DUPLEX, 0.65, 1)[0]
    cv2.putText(
        splash,
        score_str,
        ((width - sc_size[0]) // 2, height // 2 + 55),
        cv2.FONT_HERSHEY_DUPLEX,
        0.65,
        (255, 215, 0),
        1,
        cv2.LINE_AA,
    )
    return splash


@_accept_legacy_practical_id(lab_position=0)
def run_single_duel_episode(
    lab_id,
    agent_a_fn,
    agent_b_fn,
    name_a="Agent A",
    name_b="Agent B",
    seed=42,
    capture_video=False,
):
    """
    Executes a single head-to-head duel on identical seed.
    Returns: (metrics_dict, list_of_composite_bgr_frames)
    """
    config = LAB_CONFIGS[lab_id]
    env_candidates = config["env_candidates"]
    max_steps = config["max_steps"]

    render_mode = "rgb_array" if capture_video else None
    env_a, _ = make_env(env_candidates, seed=seed, render_mode=render_mode)
    env_b, _ = make_env(env_candidates, seed=seed, render_mode=render_mode)

    obs_a, _ = env_a.reset(seed=seed)
    obs_b, _ = env_b.reset(seed=seed)

    done_a = False
    done_b = False
    reward_a = 0.0
    reward_b = 0.0
    steps_a = 0
    steps_b = 0
    success_a = False
    success_b = False
    crash_a = False
    crash_b = False

    last_frame_a = None
    last_frame_b = None
    frames = []

    try:
        for step in range(1, max_steps + 1):
            if done_a and done_b:
                break

            # --- Agent A step ---
            if not done_a:
                action_a = agent_a_fn(obs_a)
                next_obs_a, r_a, term_a, trunc_a, info_a = env_a.step(action_a)
                reward_a += float(r_a)
                steps_a = step
                obs_a = next_obs_a

                if term_a or trunc_a:
                    done_a = True
                    if lab_id == 1:
                        success_a = term_a and (r_a >= 100 or reward_a >= config["pass_threshold"])
                        crash_a = term_a and (r_a <= -100 or reward_a < 0)
                    else:  # Taxi
                        success_a = term_a and r_a == 20
                        crash_a = False

            # --- Agent B step ---
            if not done_b:
                action_b = agent_b_fn(obs_b)
                next_obs_b, r_b, term_b, trunc_b, info_b = env_b.step(action_b)
                reward_b += float(r_b)
                steps_b = step
                obs_b = next_obs_b

                if term_b or trunc_b:
                    done_b = True
                    if lab_id == 1:
                        success_b = term_b and (r_b >= 100 or reward_b >= config["pass_threshold"])
                        crash_b = term_b and (r_b <= -100 or reward_b < 0)
                    else:
                        success_b = term_b and r_b == 20
                        crash_b = False

            # --- Video Rendering & HUD Composite ---
            if capture_video:
                if not done_a or last_frame_a is None:
                    raw_a = env_a.render()
                    raw_a_bgr = cv2.cvtColor(raw_a, cv2.COLOR_RGB2BGR) if cv2 is not None else raw_a
                    st_text_a = "FLYING" if lab_id == 1 else "NAVIGATING"
                    st_color_a = (220, 200, 50)
                    panel_a = _draw_hud_panel(raw_a_bgr, name_a, steps_a, reward_a, st_text_a, st_color_a, "A")
                    last_frame_a = panel_a
                else:
                    panel_a = last_frame_a.copy()
                    if success_a:
                        status_str = "TOUCHDOWN! [OK]" if lab_id == 1 else "DELIVERED! [OK]"
                        color = (40, 220, 50)
                    elif crash_a:
                        status_str = "CRASHED! [FAIL]"
                        color = (30, 40, 230)
                    else:
                        status_str = "TIME OUT"
                        color = (40, 160, 230)
                    panel_a = _draw_finished_overlay(panel_a, status_str, color, reward_a, steps_a)

                if not done_b or last_frame_b is None:
                    raw_b = env_b.render()
                    raw_b_bgr = cv2.cvtColor(raw_b, cv2.COLOR_RGB2BGR) if cv2 is not None else raw_b
                    st_text_b = "FLYING" if lab_id == 1 else "NAVIGATING"
                    st_color_b = (220, 200, 50)
                    panel_b = _draw_hud_panel(raw_b_bgr, name_b, steps_b, reward_b, st_text_b, st_color_b, "B")
                    last_frame_b = panel_b
                else:
                    panel_b = last_frame_b.copy()
                    if success_b:
                        status_str = "TOUCHDOWN! [OK]" if lab_id == 1 else "DELIVERED! [OK]"
                        color = (40, 220, 50)
                    elif crash_b:
                        status_str = "CRASHED! [FAIL]"
                        color = (30, 40, 230)
                    else:
                        status_str = "TIME OUT"
                        color = (40, 160, 230)
                    panel_b = _draw_finished_overlay(panel_b, status_str, color, reward_b, steps_b)

                composite = _build_duel_frame(
                    panel_a, panel_b, name_a, name_b, done_a, done_b, seed, step
                )
                frames.append(composite)

    finally:
        env_a.close()
        env_b.close()

    # Determine Winner
    if success_a and not success_b:
        winner = name_a
        win_reason = f"{name_a} completed the objective safely while {name_b} did not"
    elif success_b and not success_a:
        winner = name_b
        win_reason = f"{name_b} completed the objective safely while {name_a} did not"
    elif success_a and success_b:
        if steps_a < steps_b:
            winner = name_a
            win_reason = f"{name_a} was FASTER! ({steps_a} steps vs {steps_b} steps)"
        elif steps_b < steps_a:
            winner = name_b
            win_reason = f"{name_b} was FASTER! ({steps_b} steps vs {steps_a} steps)"
        else:
            if reward_a > reward_b:
                winner = name_a
                win_reason = f"Same speed ({steps_a} st), higher score ({reward_a:+.1f} vs {reward_b:+.1f})"
            elif reward_b > reward_a:
                winner = name_b
                win_reason = f"Same speed ({steps_b} st), higher score ({reward_b:+.1f} vs {reward_a:+.1f})"
            else:
                winner = "TIE"
                win_reason = f"Identical speed ({steps_a} st) and score ({reward_a:+.1f} pts)"
    else:
        if reward_a > reward_b:
            winner = name_a
            win_reason = f"Higher reward ({reward_a:+.1f} vs {reward_b:+.1f})"
        elif reward_b > reward_a:
            winner = name_b
            win_reason = f"Higher reward ({reward_b:+.1f} vs {reward_a:+.1f})"
        else:
            winner = "TIE"
            win_reason = "Identical performance"

    # Hold final duel outcome frame so viewers can clearly see the landing/crash positions
    if capture_video and len(frames) > 0:
        final_duel_frame = frames[-1]
        for _ in range(35):
            frames.append(final_duel_frame)

    # Add Victory screen
    if capture_video and len(frames) > 0:
        splash_h, splash_w = frames[-1].shape[:2]
        victory_frame = _build_victory_screen(
            splash_w,
            splash_h,
            winner_title=f"{winner} WINS!" if winner != "TIE" else "IT'S A DRAW!",
            subtitle=win_reason,
            score_a=reward_a,
            score_b=reward_b,
            name_a=name_a,
            name_b=name_b,
        )
        for _ in range(45):
            frames.append(victory_frame)

    metrics = {
        "seed": seed,
        "steps_a": steps_a,
        "steps_b": steps_b,
        "reward_a": reward_a,
        "reward_b": reward_b,
        "success_a": success_a,
        "success_b": success_b,
        "crash_a": crash_a,
        "crash_b": crash_b,
        "winner": winner,
        "win_reason": win_reason,
    }
    return metrics, frames


def save_video(frames, output_path, fps=30):
    """Encodes and saves frames as a browser-compatible MP4 (or GIF) video."""
    if not frames:
        return None

    out_file = Path(output_path).resolve()
    out_file.parent.mkdir(parents=True, exist_ok=True)
    h, w = frames[0].shape[:2]

    if out_file.suffix.lower() == ".gif":
        if imageio is None:
            raise RuntimeError("imageio is required for GIF export. Install with: pip install imageio")
        rgb_frames = [cv2.cvtColor(f, cv2.COLOR_BGR2RGB) if cv2 is not None else f for f in frames]
        imageio.mimsave(str(out_file), rgb_frames, fps=fps)
        print(f"🎬 Duel GIF saved: {out_file}")
        return str(out_file)

    # 1. Prefer ffmpeg CLI with H.264
    ffmpeg_available = shutil.which("ffmpeg") is not None
    if ffmpeg_available:
        cmd = [
            "ffmpeg",
            "-y",
            "-f",
            "rawvideo",
            "-vcodec",
            "rawvideo",
            "-s",
            f"{w}x{h}",
            "-pix_fmt",
            "bgr24",
            "-r",
            str(fps),
            "-i",
            "-",
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-preset",
            "fast",
            "-crf",
            "22",
            str(out_file),
        ]
        try:
            proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stderr=subprocess.PIPE)
            for f in frames:
                proc.stdin.write(f.tobytes())
            proc.stdin.close()
            proc.wait()
            if proc.returncode == 0:
                print(f"🎬 Duel video saved (H.264 MP4): {out_file}")
                return str(out_file)
        except Exception:
            pass

    # 2. Fallback to OpenCV VideoWriter
    if cv2 is not None:
        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        writer = cv2.VideoWriter(str(out_file), fourcc, float(fps), (w, h))
        for f in frames:
            writer.write(f)
        writer.release()
        print(f"🎬 Duel video saved (OpenCV MP4): {out_file}")
        return str(out_file)

    # 3. Fallback to GIF via imageio
    if imageio is not None:
        gif_fallback = out_file.with_suffix(".gif")
        rgb_frames = [cv2.cvtColor(f, cv2.COLOR_BGR2RGB) if cv2 is not None else f for f in frames]
        imageio.mimsave(str(gif_fallback), rgb_frames, fps=fps)
        print(f"🎬 Duel fallback saved as GIF: {gif_fallback}")
        return str(gif_fallback)


@_accept_legacy_practical_id(lab_position=0)
def run_head_to_head(
    lab_id=1,
    agent_a="rafael_flor",
    agent_b="baseline_random",
    episodes=5,
    base_seed=42,
    video_path=None,
    video_fps=30,
    repo_root=None,
):
    """
    High-level entry point to compare two RL agents over N seeded episodes.
    Returns summary results dictionary.
    """
    fn_a, name_a, clean_a = resolve_agent(agent_a, lab_id, repo_root)
    fn_b, name_b, clean_b = resolve_agent(agent_b, lab_id, repo_root)

    print(f"\n=======================================================")
    print(f"🥊 RL TOURNAMENT HEAD-TO-HEAD DUEL 🥊")
    print(f"Lab: {LAB_CONFIGS[lab_id]['name']}")
    print(f"🔵 Corner A: {name_a}")
    print(f"🟠 Corner B: {name_b}")
    print(f"Episodes:   {episodes} (Base seed: {base_seed})")
    print(f"=======================================================\n")

    wins_a = 0
    wins_b = 0
    ties = 0

    history = []
    recorded_video = None

    try:
        for ep in range(episodes):
            seed = base_seed + ep
            capture_this = (video_path is not None) and (ep == 0)

            metrics, frames = run_single_duel_episode(
                lab_id=lab_id,
                agent_a_fn=fn_a,
                agent_b_fn=fn_b,
                name_a=name_a,
                name_b=name_b,
                seed=seed,
                capture_video=capture_this,
            )

            if capture_this and len(frames) > 0:
                recorded_video = save_video(frames, video_path, fps=video_fps)

            history.append(metrics)
            if metrics["winner"] == name_a:
                wins_a += 1
                badge = f"🔵 {name_a}"
            elif metrics["winner"] == name_b:
                wins_b += 1
                badge = f"🟠 {name_b}"
            else:
                ties += 1
                badge = "⚖️ TIE"

            print(
                f"Episode {ep+1:02d} (Seed {seed}): "
                f"{name_a} [st: {metrics['steps_a']}, r: {metrics['reward_a']:+6.1f}]  vs  "
                f"{name_b} [st: {metrics['steps_b']}, r: {metrics['reward_b']:+6.1f}]  "
                f"--> Winner: {badge} ({metrics['win_reason']})"
            )

        rewards_a = [h["reward_a"] for h in history]
        rewards_b = [h["reward_b"] for h in history]
        steps_a = [h["steps_a"] for h in history]
        steps_b = [h["steps_b"] for h in history]
        succ_a = sum(1 for h in history if h["success_a"]) / episodes * 100
        succ_b = sum(1 for h in history if h["success_b"]) / episodes * 100

        print("\n" + "=" * 55)
        print("📊 FINAL DUEL SCOREBOARD")
        print("=" * 55)
        print(f"🏆 Head-to-Head Wins:  {name_a}: {wins_a} | {name_b}: {wins_b} | Ties: {ties}")
        print(f"⚡ Mean Steps (Speed): {name_a}: {np.mean(steps_a):.1f} steps  vs  {name_b}: {np.mean(steps_b):.1f} steps")
        print(f"⭐ Mean Reward:        {name_a}: {np.mean(rewards_a):+.1f} ± {np.std(rewards_a):.1f}  vs  {name_b}: {np.mean(rewards_b):+.1f} ± {np.std(rewards_b):.1f}")
        print(f"🎯 Success Rate:       {name_a}: {succ_a:.1f}%  vs  {name_b}: {succ_b:.1f}%")

        if wins_a > wins_b:
            overall_winner = name_a
            print(f"\n🎉 OVERALL WINNER: 🔵 {name_a} 🎉")
        elif wins_b > wins_a:
            overall_winner = name_b
            print(f"\n🎉 OVERALL WINNER: 🟠 {name_b} 🎉")
        else:
            overall_winner = "DRAW"
            print(f"\n🤝 OVERALL RESULT: IT'S A DRAW! 🤝")
        print("=" * 55)

        return {
            "name_a": name_a,
            "name_b": name_b,
            "wins_a": wins_a,
            "wins_b": wins_b,
            "ties": ties,
            "overall_winner": overall_winner,
            "mean_steps_a": float(np.mean(steps_a)),
            "mean_steps_b": float(np.mean(steps_b)),
            "mean_reward_a": float(np.mean(rewards_a)),
            "mean_reward_b": float(np.mean(rewards_b)),
            "success_rate_a": succ_a,
            "success_rate_b": succ_b,
            "video_path": recorded_video,
            "history": history,
        }

    finally:
        if clean_a:
            clean_a()
        if clean_b:
            clean_b()


def display_duel(video_path):
    """
    Renders the duel video inline inside Google Colab or Jupyter Notebooks.
    Uses HTML5 video with embedded base64 data for 100% reliable rendering.
    """
    if not video_path or not Path(video_path).exists():
        print(f"Video file not found: {video_path}")
        return

    path = Path(video_path)
    try:
        from IPython.display import HTML, display
        if path.suffix.lower() == ".gif":
            from IPython.display import Image
            display(Image(filename=str(path)))
            return

        with open(path, "rb") as f:
            video_b64 = base64.b64encode(f.read()).decode("ascii")

        html_code = f"""
        <div style="display: flex; flex-direction: column; align-items: center; margin: 15px 0;">
            <video width="850" height="auto" controls autoplay loop playsinline
                   style="border-radius: 10px; box-shadow: 0 4px 14px rgba(0,0,0,0.4); max-width: 100%;">
                <source src="data:video/mp4;base64,{video_b64}" type="video/mp4">
                Your browser does not support HTML5 video.
            </video>
            <p style="color: #666; font-size: 13px; margin-top: 6px;">
                ⚔️ Side-by-Side Synchronized Duel Replay
            </p>
        </div>
        """
        display(HTML(html_code))
    except Exception as e:
        print(f"Could not render inline video: {e}")
        print(f"You can view the video file directly at: {video_path}")


@_accept_legacy_practical_id(lab_position=0)
def duel_agents(lab_id, agent_a, agent_b, episodes=5, seed=42, output_video=None):
    """Convenient alias for notebooks and scripts."""
    return run_head_to_head(
        lab_id=lab_id,
        agent_a=agent_a,
        agent_b=agent_b,
        episodes=episodes,
        base_seed=seed,
        video_path=output_video,
    )


def main():
    parser = argparse.ArgumentParser(description="RL Course Head-to-Head Agent Duel & Comparator")
    parser.add_argument("--lab", "--practical", dest="lab", type=int, choices=[1, 2], default=1, help="Lab session (1 or 2)")
    parser.add_argument("--agent-a", type=str, default="rafael_flor", help="Path, baseline, or username for Agent A")
    parser.add_argument("--agent-b", type=str, default="baseline_random", help="Path, baseline, or username for Agent B")
    parser.add_argument("--episodes", type=int, default=5, help="Number of benchmark duel episodes")
    parser.add_argument("--seed", type=int, default=42, help="Base random seed")
    parser.add_argument("--video", type=str, default=None, help="Output path for duel video (e.g. duel.mp4)")
    parser.add_argument("--list-opponents", action="store_true", help="List all available local opponents")

    args = parser.parse_args()

    if args.list_opponents:
        opponents = list_available_opponents(args.lab)
        print(f"Available opponents for Lab {args.lab}:")
        for op in opponents:
            print(f"  • {op}")
        return

    run_head_to_head(
        lab_id=args.lab,
        agent_a=args.agent_a,
        agent_b=args.agent_b,
        episodes=args.episodes,
        base_seed=args.seed,
        video_path=args.video,
    )


if __name__ == "__main__" and len(sys.argv) > 0 and sys.argv[0].endswith("compare.py"):
    main()
