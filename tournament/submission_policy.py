"""Validate untrusted Git trees without checking them out or executing their code.

Run this module and load policy.json from the trusted base checkout. The PR's
policy, scripts, Git attributes, hooks, Python files, and models are never used.
"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path, PurePosixPath
import re
import subprocess
import tempfile

POLICY_PATH = Path(__file__).with_name("policy.json")
SHA_RE = re.compile(r"(?:[0-9a-f]{40}|[0-9a-f]{64})\Z")
LOGIN_RE = re.compile(r"[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?\Z")
PART_RE = re.compile(r"[A-Za-z0-9_][A-Za-z0-9_.-]*\Z")


class PolicyError(ValueError):
    """The complete pull request or resulting submission violates admission rules."""


def load_policy():
    return json.loads(POLICY_PATH.read_text(encoding="utf-8"))


def validate_relative_filename(filename, policy=None):
    policy = policy or load_policy()
    if not isinstance(filename, str) or not filename or "\\" in filename:
        raise PolicyError("Submission filenames must be relative POSIX paths")
    parts = filename.split("/")
    if any(part in (".", "..") or not PART_RE.fullmatch(part) for part in parts):
        raise PolicyError(f"Unsafe submission filename: {filename!r}")
    if PurePosixPath(filename).suffix not in policy["allowed_extensions"]:
        raise PolicyError(f"Unsupported file type: {filename!r}")
    return filename


def _git(repo, *arguments):
    result = subprocess.run(
        ["git", "--no-replace-objects", "-c", "core.hooksPath=/dev/null", "-C", str(repo), *arguments],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False,
    )
    if result.returncode:
        raise PolicyError("Git could not inspect the requested immutable revision")
    return result.stdout


def _revision(repo, value):
    if not isinstance(value, str) or not SHA_RE.fullmatch(value):
        raise PolicyError("Revisions must be full immutable lowercase commit SHAs")
    resolved = _git(repo, "rev-parse", "--verify", f"{value}^{{commit}}").decode().strip()
    if resolved != value:
        raise PolicyError("Revision must identify a commit, not a tag")
    return resolved


def _directory(path):
    parts = path.split("/")
    if len(parts) < 4 or parts[0] != "submissions" or parts[1] not in ("lab1", "lab2"):
        return None
    if not PART_RE.fullmatch(parts[2]) or parts[2] in (".", ".."):
        raise PolicyError("Invalid submission directory")
    return "/".join(parts[:3])


def _tree_files(repo, head, directory, policy):
    raw = _git(repo, "ls-tree", "-r", "-z", "-l", head, "--", directory + "/")
    files = []
    total = 0
    for entry in raw.split(b"\0"):
        if not entry:
            continue
        metadata, path_raw = entry.split(b"\t", 1)
        mode, kind, oid, size = metadata.decode("ascii").split()
        path = path_raw.decode("utf-8", errors="strict")
        if not path.startswith(directory + "/"):
            raise PolicyError("Git returned a path outside the selected submission")
        validate_relative_filename(path[len(directory) + 1:], policy)
        if mode not in ("100644", "100755") or kind != "blob":
            raise PolicyError("Only regular files are allowed; links and submodules are forbidden")
        size = int(size)
        if size > policy["max_file_bytes"]:
            raise PolicyError("Submission file exceeds the size limit")
        total += size
        files.append({"path": path, "mode": mode, "oid": oid, "size": size})
        if len(files) > policy["max_files"] or total > policy["max_total_bytes"]:
            raise PolicyError("Submission exceeds the file count or total size limit")
    if not any(file["path"] == directory + "/agent.py" for file in files):
        raise PolicyError("Submission must contain a regular agent.py file")
    return files


def validate_submission(repo, base, head, author, policy=None):
    """Check the full diff and entire resulting participant tree against trusted policy."""
    policy = policy or load_policy()
    if not isinstance(author, str) or not LOGIN_RE.fullmatch(author):
        raise PolicyError("Invalid GitHub author login")
    author = author.lower()
    base = _revision(repo, base)
    head = _revision(repo, head)
    raw = _git(repo, "diff", "--no-ext-diff", "--no-textconv", "--no-renames", "--name-only", "-z", base, head, "--")
    try:
        paths = [path.decode("utf-8", errors="strict") for path in raw.split(b"\0") if path]
    except UnicodeDecodeError as error:
        raise PolicyError("Submission paths must be UTF-8") from error
    if not paths:
        raise PolicyError("Pull request has no changed files")
    directories = {_directory(path) for path in paths}
    infrastructure = None in directories or any(
        directory and directory.rsplit("/", 1)[1].startswith("baseline_") for directory in directories
    )
    report = {"schema_version": 1, "base_sha": base, "head_sha": head, "author": author,
              "lab_id": None, "submission_dir": None, "files": []}
    if infrastructure:
        if author not in {login.lower() for login in policy["maintainers"]}:
            raise PolicyError("Students may change only their own submission directory")
        return {**report, "route": "infrastructure"}
    if len(directories) != 1:
        raise PolicyError("A submission PR must change exactly one participant in one lab")
    directory = directories.pop()
    participant = directory.rsplit("/", 1)[1]
    owner = policy["owners"].get(directory, participant).lower()
    if directory not in policy["owners"] and participant != author:
        raise PolicyError("Use the PR author login in lowercase for the submission directory")
    if owner != author:
        raise PolicyError("The submission directory must belong to the PR author")
    for path in paths:
        validate_relative_filename(path[len(directory) + 1:], policy)
    try:
        files = _tree_files(repo, head, directory, policy)
    except UnicodeDecodeError as error:
        raise PolicyError("Submission paths must be UTF-8") from error
    return {**report, "route": "submission", "lab_id": int(directory.split("/")[1][-1]),
            "submission_dir": directory, "files": files}


def extract_submission(repo, report, output_dir):
    """Extract a freshly revalidated tree as data; never invoke Git checkout or filters."""
    if report.get("route") != "submission":
        raise PolicyError("Only validated submissions may be extracted")
    verified = validate_submission(repo, report["base_sha"], report["head_sha"], report["author"])
    if verified != report:
        raise PolicyError("Submission report does not match the trusted Git inspection")
    destination = Path(output_dir).absolute()
    if destination.exists() or destination.is_symlink():
        raise PolicyError("Extraction destination must not already exist")
    destination.parent.mkdir(parents=True, exist_ok=True)
    directory = report["submission_dir"]
    with tempfile.TemporaryDirectory(prefix=".submission-", dir=destination.parent) as temporary:
        extracted = Path(temporary) / "contents"
        extracted.mkdir()
        for file in report["files"]:
            relative = file["path"][len(directory) + 1:]
            data = _git(repo, "cat-file", "blob", file["oid"])
            if len(data) != file["size"]:
                raise PolicyError("Blob size changed during extraction")
            target = extracted / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            with target.open("xb") as stream:
                stream.write(data)
            target.chmod(0o644)
        os.rename(extracted, destination)
    return destination


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", default=".")
    parser.add_argument("--base", required=True)
    parser.add_argument("--head", required=True)
    parser.add_argument("--author", required=True)
    parser.add_argument("--report", required=True)
    parser.add_argument("--extract")
    args = parser.parse_args()
    try:
        report = validate_submission(args.repo, args.base, args.head, args.author)
        if args.extract and report["route"] == "submission":
            extract_submission(args.repo, report, args.extract)
        Path(args.report).write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    except (PolicyError, OSError) as error:
        parser.exit(1, f"Submission rejected: {error}\n")


if __name__ == "__main__":
    main()
