"""Bounded JSON contracts shared by unprivileged evaluation and publishers.

Never publish agent-authored Markdown, HTML, or exception text. Reconstruct public
results from an allowlist of host-calculated scalar fields.
"""
import argparse
import json
import math
import os
import re
from pathlib import Path

MAX_JSON_BYTES = 2 * 1024 * 1024
SHA = re.compile(r"[0-9a-f]{40}\Z")
LOGIN = re.compile(r"[A-Za-z0-9][A-Za-z0-9_-]{0,63}\Z")
METRICS = ("mean_reward", "std_reward", "min_reward", "max_reward", "median_reward", "success_rate", "avg_steps", "avg_step_ms")


def read_json(path):
    with Path(path).open("rb") as stream:
        raw = stream.read(MAX_JSON_BYTES + 1)
    if len(raw) > MAX_JSON_BYTES:
        raise ValueError("Result JSON exceeds size limit")
    return json.loads(raw)


def clean_result(value, lab_id, participant=None):
    if not isinstance(value, dict) or type(value.get("success")) is not bool:
        raise ValueError("Invalid result")
    name = participant if participant is not None else value.get("participant")
    if not isinstance(name, str) or not LOGIN.fullmatch(name):
        raise ValueError("Invalid participant")
    result = {"participant": name, "lab_id": lab_id, "success": value["success"]}
    if not value["success"]:
        return {**result, "status": "Evaluation failed", "status_code": "error", "mean_reward": -9999, "std_reward": 0, "error": "Agent evaluation failed; inspect the evaluation log."}
    if value.get("lab_id") != lab_id or value.get("env_id") not in ({"LunarLander-v3", "LunarLander-v2"} if lab_id == 1 else {"Taxi-v3", "Taxi-v4"}):
        raise ValueError("Unexpected environment")
    for key in METRICS:
        number = value.get(key)
        if type(number) not in (int, float) or not math.isfinite(number) or abs(number) > 1_000_000:
            raise ValueError(f"Invalid metric: {key}")
        result[key] = number
    if not 0 <= result["success_rate"] <= 100 or not 0 <= result["avg_steps"] <= (1000 if lab_id == 1 else 200):
        raise ValueError("Metric outside environment bounds")
    for key in ("num_episodes", "base_seed"):
        if type(value.get(key)) is not int or not 0 <= value[key] <= 1_000_000:
            raise ValueError(f"Invalid {key}")
        result[key] = value[key]
    if result["num_episodes"] != 30 or result["base_seed"] != 42:
        raise ValueError("Unexpected benchmark configuration")
    threshold, mastery = (100, 200) if lab_id == 1 else (4.5, 7)
    status = "MASTERY" if result["mean_reward"] >= mastery else "PASSED" if result["mean_reward"] >= threshold else "NEEDS IMPROVEMENT"
    result.update(env_id=value["env_id"], status=status, status_code="passed" if result["mean_reward"] >= threshold else "warning", pass_threshold=threshold, mastery_threshold=mastery)
    return result


def validate_report(report):
    if not isinstance(report, dict) or report.get("schema_version") != 1:
        raise ValueError("Unsupported report")
    for key in ("base_sha", "head_sha"):
        if not isinstance(report.get(key), str) or not SHA.fullmatch(report[key]):
            raise ValueError(f"Invalid {key}")
    for key in ("pr_number", "run_id", "run_attempt"):
        if type(report.get(key)) is not int or report[key] <= 0:
            raise ValueError(f"Invalid {key}")
    author = report.get("author")
    if not isinstance(author, str) or not LOGIN.fullmatch(author) or report.get("lab_id") not in (1, 2):
        raise ValueError("Invalid submission identity")
    result = clean_result(report.get("result"), report["lab_id"], author)
    return {key: report[key] for key in ("schema_version", "base_sha", "head_sha", "pr_number", "run_id", "run_attempt", "author", "lab_id")} | {"result": result}


def validate_site(data_dir, expected_sha):
    data_dir = Path(data_dir)
    manifest = read_json(data_dir / "manifest.json")
    if manifest.get("schema_version") != 1 or manifest.get("source_sha") != expected_sha or manifest.get("episodes") != 30 or manifest.get("base_seed") != 42:
        raise ValueError("Leaderboard manifest does not match this build")
    from datetime import datetime
    datetime.fromisoformat(manifest["generated_at"])
    for lab in (1, 2):
        path = data_dir / f"leaderboard_p{lab}.json"
        values = read_json(path)
        if not isinstance(values, list) or len(values) > 1000:
            raise ValueError("Leaderboard exceeds participant limit")
        clean = [clean_result(value, lab) for value in values]
        if len({value["participant"] for value in clean}) != len(clean):
            raise ValueError("Duplicate participants")
        path.write_text(json.dumps(clean, indent=2) + "\n", encoding="utf-8")


def main():
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)
    pack = sub.add_parser("pack")
    pack.add_argument("--policy", required=True)
    pack.add_argument("--result", required=True)
    pack.add_argument("--output", required=True)
    site = sub.add_parser("site")
    site.add_argument("--data-dir", required=True)
    site.add_argument("--sha", required=True)
    args = parser.parse_args()
    if args.command == "site":
        validate_site(args.data_dir, args.sha)
        return
    policy = read_json(args.policy)
    report = {key: policy[key] for key in ("base_sha", "head_sha", "author", "lab_id")}
    report.update(schema_version=1, pr_number=int(os.environ["PR_NUMBER"]), run_id=int(os.environ["GITHUB_RUN_ID"]), run_attempt=int(os.environ["GITHUB_RUN_ATTEMPT"]), result=read_json(args.result))
    Path(args.output).write_text(json.dumps(validate_report(report)) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
