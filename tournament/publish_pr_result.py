"""Privileged publisher: verify source run and PR independently, then render JSON.

Executed only from the default branch by workflow_run, never from a PR checkout.
"""
import io
import json
import os
import subprocess
import urllib.request
from urllib.parse import urlsplit
import zipfile

from tournament.result_artifacts import MAX_JSON_BYTES, validate_report
from tournament.submission_policy import validate_submission


class SafeRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if urlsplit(newurl).scheme != "https":
            raise ValueError("Artifact redirects must use HTTPS")
        redirected = super().redirect_request(req, fp, code, msg, headers, newurl)
        if redirected is not None and urlsplit(req.full_url).netloc != urlsplit(newurl).netloc:
            redirected.remove_header("Authorization")
        return redirected


def api(path, method="GET", payload=None, binary=False):
    url = path if path.startswith("https://") else "https://api.github.com/" + path
    req = urllib.request.Request(url, data=None if payload is None else json.dumps(payload).encode(), method=method, headers={"Authorization": "Bearer " + os.environ["GH_TOKEN"], "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"})
    with urllib.request.build_opener(SafeRedirect()).open(req, timeout=30) as response:
        raw = response.read(MAX_JSON_BYTES + 1)
    if len(raw) > MAX_JSON_BYTES:
        raise ValueError("API response/artifact exceeds limit")
    return raw if binary else json.loads(raw)


def unpack_report(raw):
    with zipfile.ZipFile(io.BytesIO(raw)) as archive:
        entries = archive.infolist()
        if len(entries) != 1 or entries[0].filename != "report.json" or entries[0].file_size > MAX_JSON_BYTES:
            raise ValueError("Unexpected artifact members")
        return validate_report(json.loads(archive.read(entries[0])))


def main():
    repo = os.environ["GITHUB_REPOSITORY"]
    run_id = int(os.environ["SOURCE_RUN_ID"])
    run = api(f"repos/{repo}/actions/runs/{run_id}")
    if run["event"] != "pull_request" or run["status"] != "completed" or run["conclusion"] != "success" or run["path"] != ".github/workflows/evaluate_pr.yml":
        raise ValueError("Untrusted source workflow")
    artifacts = api(f"repos/{repo}/actions/runs/{run_id}/artifacts")
    candidates = [item for item in artifacts["artifacts"] if item["name"] == "evaluation-report" and not item["expired"]]
    if not candidates:
        print("No submission report (infrastructure PR or no evaluated submission).")
        return
    if len(candidates) != 1 or candidates[0]["size_in_bytes"] > MAX_JSON_BYTES:
        raise ValueError("Unexpected source artifacts")
    report = unpack_report(api(f"repos/{repo}/actions/artifacts/{candidates[0]['id']}/zip", binary=True))
    if report["run_id"] != run_id or report["run_attempt"] != run["run_attempt"] or report["head_sha"] != run["head_sha"]:
        raise ValueError("Artifact identity mismatch")
    pr = api(f"repos/{repo}/pulls/{report['pr_number']}")
    if pr["state"] != "open" or pr["head"]["sha"] != report["head_sha"]:
        print("Skipping closed or superseded pull request.")
        return
    if pr["base"]["sha"] != report["base_sha"]:
        print("Skipping report for an outdated base; rerun evaluation against the current main commit.")
        return
    if pr["base"]["repo"]["full_name"] != repo or pr["base"]["ref"] != "main" or pr["user"]["login"].lower() != report["author"].lower():
        raise ValueError("PR identity mismatch")
    if run["head_repository"]["full_name"] != pr["head"]["repo"]["full_name"] or run["head_branch"] != pr["head"]["ref"]:
        raise ValueError("Source run is not from this PR branch")
    associations = run.get("pull_requests", [])
    if associations:
        if not any(item["number"] == report["pr_number"] and item["head"]["sha"] == report["head_sha"] and item["base"]["sha"] == report["base_sha"] for item in associations):
            raise ValueError("PR not associated with source run and original base")
    else:
        # GitHub can omit pull_requests even for genuine PR runs (notably forks).
        # Independently resolve the commit association; also require original base
        # ancestry below. Exact current PR base equality is required above: an
        # arbitrary older ancestor would let an attacker hide infrastructure changes
        # by reverting to a historical tree and forging that historical base.
        associated = api(f"repos/{repo}/commits/{report['head_sha']}/pulls?per_page=100")
        if not any(item["number"] == report["pr_number"] for item in associated):
            raise ValueError("Source commit is not associated with this PR")
    # Fetch objects only. Never checkout/import code from these commits.
    subprocess.run(["git", "fetch", "--no-tags", "origin", report["base_sha"], report["head_sha"]], check=True)
    subprocess.run(["git", "fetch", "--no-tags", "origin", "main"], check=True)
    subprocess.run(["git", "merge-base", "--is-ancestor", report["base_sha"], "FETCH_HEAD"], check=True)
    policy = validate_submission(".", report["base_sha"], report["head_sha"], report["author"])
    if policy["route"] != "submission" or policy["lab_id"] != report["lab_id"]:
        raise ValueError("Submission policy rejected report")
    for path in (".github/workflows/evaluate_pr.yml", "tournament/submission_policy.py", "tournament/policy.json", "tournament/evaluate.py", "tournament/result_artifacts.py"):
        subprocess.run(["git", "diff", "--exit-code", report["base_sha"], report["head_sha"], "--", path], check=True)
    result = report["result"]
    marker = "<!-- rl-tournament-evaluation -->"
    lines = [marker, f"### RL Tournament Evaluation Report: `{report['author']}`", f"Lab {report['lab_id']} · 30 episodes · seed 42", f"Commit: `{report['head_sha']}`", ""]
    if result["success"]:
        lines += ["| Metric | Result |", "| --- | ---: |", f"| Mean reward | {result['mean_reward']:.2f} |", f"| Standard deviation | {result['std_reward']:.2f} |", f"| Success rate | {result['success_rate']:.1f}% |", f"| Mean steps | {result['avg_steps']:.1f} |", "", result["status"]]
    else:
        lines += ["Evaluation failed. Check the evaluation log for import, dependency, timeout, or invalid-action errors."]
    lines += ["", f"[Evaluation run](https://github.com/{repo}/actions/runs/{run_id}). Official rankings update after instructor review and merge."]
    body = "\n".join(lines)
    comments = api(f"repos/{repo}/issues/{report['pr_number']}/comments?per_page=100")
    previous = next((item for item in comments if item["user"]["login"] == "github-actions[bot]" and item["body"].startswith(marker)), None)
    # Recheck head immediately before the mutation to avoid stale result replacement.
    current_pr = api(f"repos/{repo}/pulls/{report['pr_number']}")
    if current_pr["state"] != "open" or current_pr["head"]["sha"] != report["head_sha"] or current_pr["base"]["sha"] != report["base_sha"]:
        print("Skipping report because the PR head, base, or state changed during verification.")
        return
    path = f"repos/{repo}/issues/comments/{previous['id']}" if previous else f"repos/{repo}/issues/{report['pr_number']}/comments"
    api(path, "PATCH" if previous else "POST", {"body": body})


if __name__ == "__main__":
    main()
