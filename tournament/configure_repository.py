"""Inspect/apply phased repository protections. Default is a read-only settings plan.

Initial: protect main now, without requiring files/checks absent from main.
Post-merge: add CODEOWNERS/check gates and switch Pages to Actions after verification.
Existing stronger requirements and unrelated supported settings are preserved.
"""
import argparse
import difflib
import json
import subprocess

REPO = "gramuah/RL_tournament"
REQUIRED_CHECKS = ("Submission policy and evaluation", "Security and site checks")
BOOLEAN_SETTINGS = ("required_linear_history", "allow_force_pushes", "allow_deletions", "block_creations", "required_conversation_resolution", "lock_branch", "allow_fork_syncing")
KNOWN_RESPONSE_KEYS = set(BOOLEAN_SETTINGS) | {"url", "required_status_checks", "enforce_admins", "required_pull_request_reviews", "restrictions", "required_signatures"}


def call(path, method="GET", payload=None, optional=False):
    command = ["gh", "api", "repos/" + REPO + "/" + path, "--method", method]
    if payload is not None:
        command += ["--input", "-"]
    result = subprocess.run(command, input=None if payload is None else json.dumps(payload), text=True, capture_output=True)
    if result.returncode:
        if optional and "404" in result.stderr:
            return None
        raise RuntimeError(result.stderr.strip())
    return json.loads(result.stdout) if result.stdout.strip() else None


def enabled(value):
    return value.get("enabled", False) if isinstance(value, dict) else bool(value)


def actors(value):
    return {"users": [entry["login"] if isinstance(entry, dict) else entry for entry in value.get("users", [])],
            "teams": [entry["slug"] if isinstance(entry, dict) else entry for entry in value.get("teams", [])],
            "apps": [entry["slug"] if isinstance(entry, dict) else entry for entry in value.get("apps", [])]}


def protection_payload(current, phase):
    current = current or {}
    unknown = set(current) - KNOWN_RESPONSE_KEYS
    if unknown:
        raise ValueError("Unknown existing protection fields require manual review: " + ", ".join(sorted(unknown)))
    reviews = current.get("required_pull_request_reviews") or {}
    known_reviews = {"url", "dismissal_restrictions", "dismiss_stale_reviews", "require_code_owner_reviews", "required_approving_review_count", "require_last_push_approval", "bypass_pull_request_allowances"}
    if set(reviews) - known_reviews:
        raise ValueError("Unknown existing review settings require manual review")
    proposed_reviews = {key: reviews[key] for key in ("dismiss_stale_reviews", "require_code_owner_reviews", "required_approving_review_count", "require_last_push_approval") if key in reviews}
    for key in ("dismissal_restrictions", "bypass_pull_request_allowances"):
        if key in reviews:
            proposed_reviews[key] = actors(reviews[key])
    proposed_reviews.update(dismiss_stale_reviews=True,
                            require_code_owner_reviews=phase == "post-merge" or reviews.get("require_code_owner_reviews", False),
                            required_approving_review_count=max(1, reviews.get("required_approving_review_count", 0)))
    existing_checks = current.get("required_status_checks")
    checks = None
    if existing_checks is not None or phase == "post-merge":
        existing_checks = existing_checks or {}
        items = [dict(item) for item in existing_checks.get("checks", [])]
        represented = {item["context"] for item in items}
        items += [{"context": name, "app_id": -1} for name in existing_checks.get("contexts", []) if name not in represented]
        if phase == "post-merge":
            for name in REQUIRED_CHECKS:
                matching = [item for item in items if item["context"] == name]
                if matching and matching[0].get("app_id") not in (None, -1, 15368):
                    raise ValueError(f"Existing check {name!r} belongs to a different app; review before changing it")
                items = [item for item in items if item["context"] != name]
                items.append({"context": name, "app_id": 15368})
        checks = {"strict": phase == "post-merge" or existing_checks.get("strict", False), "checks": items}
    result = {"required_status_checks": checks, "enforce_admins": True, "required_pull_request_reviews": proposed_reviews,
              "restrictions": None if current.get("restrictions") is None else actors(current["restrictions"])}
    for key in BOOLEAN_SETTINGS:
        if key in current:
            result[key] = enabled(current[key])
    result.update(allow_force_pushes=False, allow_deletions=False, required_conversation_resolution=True)
    return result



PAGES_ENVIRONMENT = "environments/github-pages"


def pages_branch_policies():
    policies = []
    for page in range(1, 101):
        response = call(f"{PAGES_ENVIRONMENT}/deployment-branch-policies?per_page=100&page={page}")
        policies.extend(response["branch_policies"])
        if len(policies) >= response["total_count"]:
            return policies
    raise ValueError("Unexpected number of Pages environment policies; review manually")


def pages_environment_plan():
    environment = call(PAGES_ENVIRONMENT)
    mode = environment.get("deployment_branch_policy")
    if mode != {"protected_branches": False, "custom_branch_policies": True}:
        raise ValueError("Pages environment is not using custom branch policies; review its protection settings before migration")
    return pages_branch_policies()


def restrict_pages_environment():
    """Keep exactly main; retain existing reviewers, wait timers and other rules."""
    policies = pages_environment_plan()
    main = [item for item in policies if item["name"] == "main" and item.get("type", "branch") == "branch"]
    if not main:
        created = call(f"{PAGES_ENVIRONMENT}/deployment-branch-policies", "POST", {"name": "main", "type": "branch"})
        main = [created]
    keep_id = main[0]["id"]
    for item in policies:
        if item["id"] != keep_id:
            call(f"{PAGES_ENVIRONMENT}/deployment-branch-policies/{item['id']}", "DELETE")
    verified = pages_environment_plan()
    if len(verified) != 1 or verified[0]["name"] != "main" or verified[0].get("type", "branch") != "branch":
        raise RuntimeError("Pages environment readback did not confirm main-only deployments")
    print("Verified github-pages environment permits only the main branch.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--phase", choices=("initial", "post-merge"), default="initial")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    pages = call("pages")
    protection = call("branches/main/protection", optional=True)
    try:
        proposed = protection_payload(protection, args.phase)
    except ValueError:
        print(json.dumps({"current_protection": protection}, indent=2))
        raise
    if args.phase == "post-merge":
        print(json.dumps({"current_pages_environment_branches": pages_environment_plan(), "proposed_pages_environment_branches": [{"name": "main", "type": "branch"}]}, indent=2))
    print(json.dumps({"phase": args.phase, "current_pages": pages["build_type"], "pages_after": "workflow" if args.phase == "post-merge" else pages["build_type"], "proposed_protection": proposed}, indent=2))
    print("\n".join(difflib.unified_diff(json.dumps(protection, indent=2, sort_keys=True).splitlines(), json.dumps(proposed, indent=2, sort_keys=True).splitlines(), fromfile="current API protection", tofile="proposed PUT payload", lineterm="")))
    if not args.apply:
        return
    if args.phase == "post-merge":
        for path in ("tournament/submission_policy.py", ".github/workflows/publish_pr_result.yml", ".github/workflows/security_checks.yml", ".github/CODEOWNERS", "web/index.html"):
            call("contents/" + path + "?ref=main")
    call("branches/main/protection", "PUT", proposed)
    call("actions/permissions/workflow", "PUT", {"default_workflow_permissions": "read", "can_approve_pull_request_reviews": False})
    call("actions/permissions/fork-pr-contributor-approval", "PUT", {"approval_policy": "all_external_contributors"})
    if args.phase == "post-merge":
        restrict_pages_environment()
        call("pages", "PUT", {"build_type": "workflow"})
    print("Settings applied. " + ("Dispatch Tournament and Pages on main and verify deployment." if args.phase == "post-merge" else "After merge, rerun with --phase post-merge --apply."))


if __name__ == "__main__":
    main()
