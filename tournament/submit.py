#!/usr/bin/env python3
"""
RL Course Automated Submission Helper
Author: Course Teaching Staff
Description: Enables students to automatically fork, commit, and create a
Pull Request to the course repository directly from a Jupyter/Colab notebook.
"""

from functools import wraps

import base64
import json
import re
from pathlib import Path, PurePosixPath
import time
import urllib.error
import urllib.request

COURSE_OWNER = "gramuah"
COURSE_REPO = "RL_tournament"
BASE_BRANCH = "main"


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


def _github_request(url, method="GET", data=None, token=None):
    """Simple wrapper over urllib to avoid external dependencies like requests."""
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "RL-Course-Colab-Submitter",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"

    body = None
    if data is not None:
        headers["Content-Type"] = "application/json"
        body = json.dumps(data).encode("utf-8")

    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            res_body = response.read().decode("utf-8")
            return response.status, json.loads(res_body) if res_body else {}
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8")
        try:
            err_json = json.loads(err_body)
        except Exception:
            err_json = {"message": err_body}
        return e.code, err_json


# Kept self-contained: course notebooks execute this file directly from main.
# tests/test_submit.py checks these admission constants against policy.json.
_ALLOWED_EXTENSIONS = {".py", ".npy", ".npz", ".pkl", ".pickle", ".zip", ".json"}
_MAX_FILES = 100
_MAX_FILE_BYTES = 50 * 1024 * 1024
_MAX_TOTAL_BYTES = 100 * 1024 * 1024
_MAINTAINERS = {"carlosgual", "rflor01", "rlopezsastre"}
_OWNER_ALIASES = {"rflor01": "rafael_flor"}
_LOGIN_RE = re.compile(r"[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?\Z")
_PART_RE = re.compile(r"[A-Za-z0-9_][A-Za-z0-9_.-]*\Z")


def _validate_uploads(lab_id, files_to_submit):
    if type(lab_id) is not int or lab_id not in (1, 2):
        raise ValueError("lab_id must be the integer 1 or 2")
    if not isinstance(files_to_submit, dict) or "agent.py" not in files_to_submit:
        raise ValueError("files_to_submit must include agent.py")
    if len(files_to_submit) > _MAX_FILES:
        raise ValueError("At most 100 files may be submitted")
    contents = {}
    total = 0
    for filename, local_path in files_to_submit.items():
        if not isinstance(filename, str) or "\\" in filename or any(
            part in (".", "..") or not _PART_RE.fullmatch(part)
            for part in filename.split("/")
        ) or PurePosixPath(filename).suffix not in _ALLOWED_EXTENSIONS:
            raise ValueError(f"Invalid submission filename: {filename!r}")
        path = Path(local_path)
        if path.is_symlink() or not path.is_file():
            raise ValueError(f"Local submission must be a regular file: {local_path}")
        if path.stat().st_size > _MAX_FILE_BYTES:
            raise ValueError(f"File exceeds 50 MiB: {filename}")
        with path.open("rb") as stream:
            contents[filename] = stream.read(_MAX_FILE_BYTES + 1)
        size = len(contents[filename])
        total += size
        if size > _MAX_FILE_BYTES or total > _MAX_TOTAL_BYTES:
            raise ValueError("Submission exceeds the 50 MiB/file or 100 MiB total limit")
    return contents


@_accept_legacy_practical_id(lab_position=0)
def submit_lab(lab_id, files_to_submit, github_token, github_username=None):
    """Upload an agent to the authenticated user's fork and create/update its PR.

    ``files_to_submit`` maps safe relative filenames to local regular files and
    must include agent.py. lab_id is 1 or 2. The legacy practical_id keyword and
    submit_practical name remain supported. The optional github_username must
    match the token's authenticated account; it cannot select another owner.

    Every upload creates one commit based on current upstream main and replaces
    this helper's submission branch. Unrelated old branch changes are discarded;
    files already merged into the participant directory remain unless overwritten.
    Model files are data here and are never imported or deserialized.
    """
    contents = _validate_uploads(lab_id, files_to_submit)
    if not isinstance(github_token, str) or not github_token.strip():
        raise ValueError("GitHub token cannot be empty")
    token = github_token.strip()

    def request(url, method="GET", data=None, expected=(200,)):
        status, result = _github_request(url, method=method, data=data, token=token)
        if status not in expected:
            message = result.get("message", "Unexpected GitHub response") if isinstance(result, dict) else "Unexpected response"
            raise RuntimeError(f"GitHub {method} failed (HTTP {status}): {message}")
        return result

    status, user_info = _github_request("https://api.github.com/user", token=token)
    if status != 200:
        raise PermissionError(f"GitHub authentication failed (HTTP {status})")
    username = user_info.get("login", "")
    if not isinstance(username, str) or not _LOGIN_RE.fullmatch(username):
        raise ValueError("GitHub returned an invalid account login")
    if github_username is not None and (
        not isinstance(github_username, str) or github_username.lower() != username.lower()
    ):
        raise ValueError("github_username must match the token's authenticated account")
    username = username.lower()
    participant = _OWNER_ALIASES.get(username, username)
    target_dir = f"submissions/lab{lab_id}/{participant}"
    fork_url = f"https://api.github.com/repos/{username}/{COURSE_REPO}"
    upstream_url = f"https://api.github.com/repos/{COURSE_OWNER}/{COURSE_REPO}"
    print(f"Authenticated as @{username}; preparing {target_dir}")

    status, repo_info = _github_request(fork_url, token=token)
    is_upstream = False
    if status == 404:
        request(upstream_url + "/forks", "POST", expected=(200, 202))
        for _ in range(15):
            time.sleep(2)
            status, repo_info = _github_request(fork_url, token=token)
            if status == 200:
                break
        if status != 200:
            raise TimeoutError("Fork initialization timed out; try again shortly")
    elif status != 200:
        raise RuntimeError(f"Cannot inspect your fork (HTTP {status})")

    # If GitHub returned the course upstream repository (which occurs when the user is the
    # course organization or when a maintainer previously transferred the repo to the org,
    # causing GitHub's API to transparently follow the 301 redirect to upstream):
    if repo_info.get("full_name", "").lower() == f"{COURSE_OWNER}/{COURSE_REPO}".lower():
        can_push = bool(repo_info.get("permissions", {}).get("push", False)) or (username in _MAINTAINERS)
        if can_push:
            target_repo = upstream_url
            is_upstream = True
        else:
            request(upstream_url + "/forks", "POST", expected=(200, 202))
            for _ in range(15):
                time.sleep(2)
                status, repo_info = _github_request(fork_url, token=token)
                if (
                    status == 200
                    and repo_info.get("fork")
                    and repo_info.get("parent", {}).get("full_name", "").lower() == f"{COURSE_OWNER}/{COURSE_REPO}".lower()
                ):
                    break
            if not repo_info.get("fork") or repo_info.get("parent", {}).get("full_name", "").lower() != f"{COURSE_OWNER}/{COURSE_REPO}".lower():
                raise ValueError(f"{username}/{COURSE_REPO} is not a fork of the course repository")
            target_repo = fork_url
    elif repo_info.get("fork") and repo_info.get("parent", {}).get("full_name", "").lower() == f"{COURSE_OWNER}/{COURSE_REPO}".lower():
        target_repo = fork_url
    else:
        raise ValueError(f"{username}/{COURSE_REPO} is not a fork of the course repository")

    latest_sha = request(upstream_url + f"/git/ref/heads/{BASE_BRANCH}")["object"]["sha"]
    base_tree = request(upstream_url + f"/git/commits/{latest_sha}")["tree"]["sha"]
    entries = []
    for filename, data in contents.items():
        blob = request(target_repo + "/git/blobs", "POST", {
            "content": base64.b64encode(data).decode("ascii"), "encoding": "base64",
        }, expected=(201,))
        entries.append({"path": f"{target_dir}/{filename}", "mode": "100644", "type": "blob", "sha": blob["sha"]})
    tree = request(target_repo + "/git/trees", "POST", {"base_tree": base_tree, "tree": entries}, expected=(201,))
    commit = request(target_repo + "/git/commits", "POST", {
        "message": f"Submit Lab {lab_id} agent for @{username}",
        "tree": tree["sha"], "parents": [latest_sha],
    }, expected=(201,))
    branch_name = f"submission-lab{lab_id}-{username}"
    branch_url = target_repo + f"/git/refs/heads/{branch_name}"
    status, _ = _github_request(branch_url, token=token)
    if status == 404:
        request(target_repo + "/git/refs", "POST", {
            "ref": f"refs/heads/{branch_name}", "sha": commit["sha"],
        }, expected=(201,))
    elif status == 200:
        request(branch_url, "PATCH", {"sha": commit["sha"], "force": True})
    else:
        raise RuntimeError(f"Cannot inspect submission branch (HTTP {status})")

    pr_url = upstream_url + "/pulls"
    head_ref = branch_name if is_upstream else f"{username}:{branch_name}"
    payload = {
        "title": f"Lab {lab_id} Submission: @{username}",
        "head": head_ref, "base": BASE_BRANCH,
        "body": f"Agent submission for **Lab {lab_id}** by @{username}.\n\nFiles: " + ", ".join(f"`{name}`" for name in contents),
    }
    status, result = _github_request(pr_url, method="POST", data=payload, token=token)
    if status == 201:
        url = result["html_url"]
    elif status == 422:
        head_query = f"{COURSE_OWNER}:{branch_name}" if is_upstream else f"{username}:{branch_name}"
        prs = request(pr_url + f"?head={head_query}&base={BASE_BRANCH}&state=open")
        if not prs and is_upstream:
            prs = request(pr_url + f"?head={branch_name}&base={BASE_BRANCH}&state=open")
        if not prs:
            raise RuntimeError("GitHub rejected the PR and no existing open submission PR was found")
        url = prs[0]["html_url"]
    else:
        raise RuntimeError(f"Could not open pull request (HTTP {status})")
    print(f"Submission ready: {url}")
    print("Admission checks and isolated evaluation will report on your pull request.")
    return url


submit_practical = submit_lab
