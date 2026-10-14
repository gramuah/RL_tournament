#!/usr/bin/env python3
"""
RL Course Automated Submission Helper
Author: Course Teaching Staff
Description: Enables students to automatically fork, commit, and create a
Pull Request to the course repository directly from a Jupyter/Colab notebook.
"""

import base64
import json
import os
import time
import urllib.error
import urllib.request

COURSE_OWNER = "rflor01"
COURSE_REPO = "RL_tournament"
BASE_BRANCH = "main"


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
        with urllib.request.urlopen(req) as response:
            res_body = response.read().decode("utf-8")
            return response.status, json.loads(res_body) if res_body else {}
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8")
        try:
            err_json = json.loads(err_body)
        except Exception:
            err_json = {"message": err_body}
        return e.code, err_json


def submit_practical(practical_id, files_to_submit, github_token, github_username=None):
    """
    Submits a practical directly to GitHub by:
    1. Authenticating the token.
    2. Forking the repository (if not already forked).
    3. Creating or updating a submission branch.
    4. Uploading agent.py and model weight files.
    5. Opening a Pull Request against rflor01/RL_tournament:main.

    :param practical_id: 1 or 2
    :param files_to_submit: dict of {target_filename: local_path}
    :param github_token: GitHub Personal Access Token (classic 'repo' or fine-grained)
    :param github_username: (Optional) GitHub username; detected from token if omitted
    :return: Pull Request URL
    """
    token = github_token.strip()
    if not token:
        raise ValueError("GitHub token cannot be empty.")

    print("🔐 1. Authenticating with GitHub...")
    status, user_info = _github_request("https://api.github.com/user", token=token)
    if status != 200:
        raise PermissionError(f"GitHub authentication failed (HTTP {status}): {user_info.get('message', 'Invalid token')}")

    username = github_username or user_info.get("login")
    print(f"   Authenticated as: @{username}")

    # 2. Fork repository if needed
    print(f"🍴 2. Ensuring fork exists at @{username}/{COURSE_REPO}...")
    fork_url = f"https://api.github.com/repos/{username}/{COURSE_REPO}"
    status, repo_info = _github_request(fork_url, token=token)

    if status == 404:
        print(f"   Fork not found. Creating fork of {COURSE_OWNER}/{COURSE_REPO}...")
        create_fork_url = f"https://api.github.com/repos/{COURSE_OWNER}/{COURSE_REPO}/forks"
        status, fork_res = _github_request(create_fork_url, method="POST", token=token)
        if status not in (200, 202):
            raise RuntimeError(f"Failed to create fork: {fork_res.get('message')}")

        # Wait for fork to become ready
        print("   Waiting for GitHub to initialize fork...")
        for _ in range(15):
            time.sleep(2)
            status, _ = _github_request(fork_url, token=token)
            if status == 200:
                break
        if status != 200:
            raise TimeoutError("Fork creation timed out. Please try running this cell again in a few seconds.")
    print("   Fork is ready.")

    # 3. Create or sync submission branch
    branch_name = f"submission-practical{practical_id}-{username.lower()}"
    print(f"🌿 3. Setting up branch '{branch_name}'...")

    # Get SHA of upstream main
    status, main_ref = _github_request(
        f"https://api.github.com/repos/{COURSE_OWNER}/{COURSE_REPO}/git/ref/heads/{BASE_BRANCH}",
        token=token
    )
    if status != 200:
        # Fallback to fork main if upstream ref check is restricted
        status, main_ref = _github_request(
            f"https://api.github.com/repos/{username}/{COURSE_REPO}/git/ref/heads/{BASE_BRANCH}",
            token=token
        )
    latest_sha = main_ref["object"]["sha"]

    # Check if submission branch already exists
    branch_ref_url = f"https://api.github.com/repos/{username}/{COURSE_REPO}/git/refs/heads/{branch_name}"
    status, branch_ref = _github_request(branch_ref_url, token=token)

    if status == 404:
        # Create branch
        create_ref_url = f"https://api.github.com/repos/{username}/{COURSE_REPO}/git/refs"
        status, create_res = _github_request(
            create_ref_url,
            method="POST",
            data={"ref": f"refs/heads/{branch_name}", "sha": latest_sha},
            token=token
        )
        if status != 201:
            raise RuntimeError(f"Failed to create branch '{branch_name}': {create_res.get('message')}")
        print(f"   Created branch '{branch_name}'.")
    else:
        print(f"   Branch '{branch_name}' already exists. Updating files...")

    # 4. Upload files
    print(f"📤 4. Uploading submission files to 'submissions/practical{practical_id}/{username}/'...")
    target_dir = f"submissions/practical{practical_id}/{username}"

    for target_name, local_path in files_to_submit.items():
        if not os.path.exists(local_path):
            raise FileNotFoundError(f"Local file '{local_path}' does not exist.")

        with open(local_path, "rb") as f:
            content_b64 = base64.b64encode(f.read()).decode("utf-8")

        remote_file_path = f"{target_dir}/{target_name}"
        contents_url = f"https://api.github.com/repos/{username}/{COURSE_REPO}/contents/{remote_file_path}"

        # Check if file exists to get its SHA for update
        status, existing_file = _github_request(f"{contents_url}?ref={branch_name}", token=token)
        payload = {
            "message": f"Upload {target_name} for Practical {practical_id} (@{username})",
            "content": content_b64,
            "branch": branch_name,
        }
        if status == 200 and "sha" in existing_file:
            payload["sha"] = existing_file["sha"]

        status, put_res = _github_request(contents_url, method="PUT", data=payload, token=token)
        if status not in (200, 201):
            raise RuntimeError(f"Failed to upload '{target_name}': {put_res.get('message')}")
        print(f"   ✅ Uploaded: {remote_file_path}")

    # 5. Open Pull Request
    print("🚀 5. Opening Pull Request to course repository...")
    pr_url = f"https://api.github.com/repos/{COURSE_OWNER}/{COURSE_REPO}/pulls"
    pr_payload = {
        "title": f"Submission Practical {practical_id}: @{username}",
        "head": f"{username}:{branch_name}",
        "base": BASE_BRANCH,
        "body": f"""### 🏆 Automated Submission: Practical {practical_id}

- **Participant:** @{username}
- **Assignment:** Practical {practical_id}
- **Submitted Files:** `{', '.join(files_to_submit.keys())}`

*This pull request was automatically generated and submitted from Jupyter Notebook.*
"""
    }

    status, pr_res = _github_request(pr_url, method="POST", data=pr_payload, token=token)

    if status == 201:
        html_url = pr_res["html_url"]
        print("\n" + "=" * 65)
        print(f"🎉 PULL REQUEST CREATED SUCCESSFULLY!")
        print(f"🔗 URL: {html_url}")
        print("🤖 The GitHub Actions bot will now evaluate your agent and comment with your score card.")
        print("=" * 65)
        return html_url
    elif status == 422 and "A pull request already exists" in str(pr_res):
        # Retrieve existing PR
        status, prs = _github_request(
            f"https://api.github.com/repos/{COURSE_OWNER}/{COURSE_REPO}/pulls?head={username}:{branch_name}&state=open",
            token=token
        )
        if status == 200 and prs:
            html_url = prs[0]["html_url"]
            print("\n" + "=" * 65)
            print(f"🔄 EXISTING PULL REQUEST UPDATED!")
            print(f"🔗 URL: {html_url}")
            print("🤖 New commits pushed to branch. The bot will re-evaluate your updated agent.")
            print("=" * 65)
            return html_url

    raise RuntimeError(f"Failed to create Pull Request (HTTP {status}): {pr_res.get('message', pr_res)}")
