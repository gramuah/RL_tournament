#!/usr/bin/env python3
"""
RL Course Leaderboard Generator
Author: Course Teaching Staff
Description: Evaluates all participant submissions, sorts them by score,
and generates the official LEADERBOARD.md file.
"""

import argparse
import json
import os
import sys
import time
from pathlib import Path

# Import evaluation logic
from evaluate import evaluate_single_submission, LAB_CONFIGS, _accept_legacy_practical_id

# Backward-compatible module attribute.
PRACTICAL_CONFIGS = LAB_CONFIGS


REPO_ROOT = Path(__file__).resolve().parent.parent
LEADERBOARD_PATH = REPO_ROOT / "LEADERBOARD.md"
RESULTS_DIR = REPO_ROOT / "web" / "data"


def get_rank_medal(rank):
    if rank == 1:
        return "🥇 **1st**"
    elif rank == 2:
        return "🥈 **2nd**"
    elif rank == 3:
        return "🥉 **3rd**"
    else:
        return f"{rank}th"


def assert_evaluator_ready(lab_id, sandbox_image):
    """A trusted baseline distinguishes infrastructure outages from bad agents."""
    baseline = REPO_ROOT / "submissions" / f"lab{lab_id}" / "baseline_random"
    result = evaluate_single_submission(baseline, lab_id, num_episodes=1,
                                       base_seed=42, isolated=True,
                                       sandbox_image=sandbox_image)
    if not result.get("success"):
        raise RuntimeError(f"Lab {lab_id} evaluator readiness check failed; preserving the previous publication")


@_accept_legacy_practical_id(lab_position=0)
def run_full_evaluation(lab_id, episodes=30, seed=42, isolated=False, sandbox_image="rl-tournament-agent:local"):
    """Evaluates all submission folders for the given lab."""
    submissions_dir = Path("submissions") / f"lab{lab_id}"
    results = []

    if isolated:
        assert_evaluator_ready(lab_id, sandbox_image)

    if not submissions_dir.exists():
        print(f"Warning: {submissions_dir} does not exist.")
        return results

    for item in sorted(submissions_dir.iterdir()):
        if item.is_dir() and (item / "agent.py").exists():
            print(f"Evaluating Lab {lab_id}: {item.name} ...")
            r = evaluate_single_submission(item, lab_id, num_episodes=episodes, base_seed=seed, isolated=isolated, sandbox_image=sandbox_image)
            if isolated and not r.get("success"):
                assert_evaluator_ready(lab_id, sandbox_image)
            results.append(r)

    # Sort descending by mean_reward
    results.sort(key=lambda x: x.get("mean_reward", -99999), reverse=True)
    return results


@_accept_legacy_practical_id(lab_position=1)
def build_markdown_table(results, lab_id):
    """Builds a formatted markdown table from evaluation results."""
    if not results:
        return "_No submissions recorded yet. Be the first to open a Pull Request!_\n"

    lines = [
        "| Rank | Participant | Mean Score | Std Dev | Success Rate | Min / Max | Status |",
        "| :---: | :--- | :---: | :---: | :---: | :---: | :---: |",
    ]

    rank = 0
    for r in results:
        participant = r["participant"]
        if r.get("success", False):
            rank += 1
            rank_str = get_rank_medal(rank)
        else:
            rank_str = "—"
        sub_rel_path = f"submissions/lab{lab_id}/{participant}"
        participant_link = f"[{participant}]({sub_rel_path})"

        if not r.get("success", False):
            lines.append(f"| {rank_str} | {participant_link} | *Error* | - | - | - | ❌ Crash |")
            continue

        mean_str = f"**{r['mean_reward']:.2f}**"
        std_str = f"±{r['std_reward']:.2f}"
        success_str = f"{r['success_rate']:.1f}%"
        min_max_str = f"[{r['min_reward']:.1f}, {r['max_reward']:.1f}]"
        status_str = r["status"]

        # Highlight baselines differently
        if "baseline" in participant.lower():
            participant_link = f"*{participant} (Baseline)*"

        lines.append(
            f"| {rank_str} | {participant_link} | {mean_str} | {std_str} | {success_str} | {min_max_str} | {status_str} |"
        )

    return "\n".join(lines)


def generate_leaderboard_content(p1_results, p2_results, timestamp):
    """A downloadable snapshot; the checked-in Markdown links to the live site."""
    return f"""# RL Tournament — evaluation snapshot

Generated: {timestamp}

[Live standings and educational demos](https://gramuah.github.io/RL_tournament/)
· [Repository](https://github.com/gramuah/RL_tournament)

This artifact records one trusted controller evaluation. Official Actions runs use
30 episodes per agent with base seed 42. The accompanying JSON manifest identifies
the source commit, environments, dependencies, and generation time. Failed agents
are unranked. Successful reference baselines are included for comparison.

## Lab 2 · Taxi

{build_markdown_table(p2_results, 2)}

[Lab 2 submission guide](https://github.com/gramuah/RL_tournament/tree/main/submissions/lab2)

## Lab 1 · LunarLander

{build_markdown_table(p1_results, 1)}

[Lab 1 submission guide](https://github.com/gramuah/RL_tournament/tree/main/submissions/lab1)

Submit through a fork PR containing only your authorized participant folder.
Instructor review is required before merge; official standings update after the
merged tournament finishes. Browser simulations demonstrate built-in policies,
not submitted Python agents. Real submitted-agent duel videos are generated by
the instructor-triggered [duel workflow](https://github.com/gramuah/RL_tournament/actions/workflows/duel.yml).
"""


def build_manifest(p1_results, p2_results, episodes, seed, source_sha):
    """Bind evaluated environments and exact dependency locks to this run."""
    from datetime import datetime, timezone
    from importlib.metadata import version
    import hashlib
    import platform
    return {
        "schema_version": 1,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source_sha": source_sha,
        "episodes": episodes,
        "base_seed": seed,
        "environments": {
            "1": sorted({item["env_id"] for item in p1_results if item.get("success")}),
            "2": sorted({item["env_id"] for item in p2_results if item.get("success")}),
        },
        "dependencies": {"python": platform.python_version(), "gymnasium": version("gymnasium"), "numpy": version("numpy")},
        "dependency_locks": {
            "controller_sha256": hashlib.sha256((REPO_ROOT / "tournament/requirements-ci.lock").read_bytes()).hexdigest(),
            "agent_sha256": hashlib.sha256((REPO_ROOT / "tournament/requirements-agent.lock").read_bytes()).hexdigest(),
        },
    }


def main():
    parser = argparse.ArgumentParser(description="Update Course Leaderboard")
    parser.add_argument("--episodes", type=int, default=30, help="Episodes per agent")
    parser.add_argument("--seed", type=int, default=42, help="Base seed")
    parser.add_argument("--from-json", action="store_true", help="Build leaderboard from cached JSON files in web/data")
    parser.add_argument("--isolated", action="store_true", help="Run submitted agents inside constrained Docker containers")
    parser.add_argument("--sandbox-image", default="rl-tournament-agent:local")
    args = parser.parse_args()

    if args.isolated and not args.from_json:
        from sandbox import preflight_sandbox
        preflight_sandbox(args.sandbox_image)

    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime())

    p1_json = RESULTS_DIR / "leaderboard_p1.json"
    p2_json = RESULTS_DIR / "leaderboard_p2.json"

    if args.from_json:
        if not p1_json.exists() or not p2_json.exists():
            raise FileNotFoundError("Both cached leaderboard JSON files are required; --from-json never executes agents")
        print("Loading cached results from JSON...")
        with open(p1_json, "r", encoding="utf-8") as f:
            p1_results = json.load(f)
        with open(p2_json, "r", encoding="utf-8") as f:
            p2_results = json.load(f)
    else:
        print("Running full tournament evaluation...")
        p1_results = run_full_evaluation(1, episodes=args.episodes, seed=args.seed, isolated=args.isolated, sandbox_image=args.sandbox_image)
        p2_results = run_full_evaluation(2, episodes=args.episodes, seed=args.seed, isolated=args.isolated, sandbox_image=args.sandbox_image)

        with open(p1_json, "w", encoding="utf-8") as f:
            json.dump(p1_results, f, indent=2)
        with open(p2_json, "w", encoding="utf-8") as f:
            json.dump(p2_results, f, indent=2)

    if not args.from_json:
        manifest = build_manifest(p1_results, p2_results, args.episodes, args.seed, os.environ.get("GITHUB_SHA", "local"))
        (RESULTS_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

    markdown_content = generate_leaderboard_content(p1_results, p2_results, timestamp)

    with open(LEADERBOARD_PATH, "w", encoding="utf-8") as f:
        f.write(markdown_content)

    print(f"✅ Successfully generated {LEADERBOARD_PATH} and updated web dashboard data!")


if __name__ == "__main__":
    main()
