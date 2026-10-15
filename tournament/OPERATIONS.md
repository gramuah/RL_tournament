# Tournament operations

## Trust boundaries

Students fork the public repository and propose a PR. They are not collaborators
with write access. A student submission changes one lab folder named for the PR
author's GitHub login. Instructor-owned historical aliases live in `policy.json`.
Instructor infrastructure PRs use a separate admission route. All changes require
instructor CODEOWNERS review once main protection is activated.

PR-defined checks cannot themselves prevent an author from modifying a workflow.
The complete-diff policy, required instructor review, dismissal of stale approvals,
and protected main work together. Instructors must review workflow/policy changes;
never bypass protection for student submissions. Branch protection also applies to administrators. Instructors use reviewed PRs;
any emergency change to protection is an explicit, auditable administrative action.

`Evaluate submission` uses the trusted base commit's policy, evaluator, Dockerfile,
and locked dependencies. It fetches PR objects without checking out student code;
only validated regular submission files are extracted. The host owns Gymnasium and
scores. Python imports, pickle loading, and inference run in constrained Linux Docker
containers with no network, host credentials, Docker socket, or writable repository.
No cache is shared between PR and privileged workflows. These containers reduce
risk; they do not claim protection against an unknown Linux kernel/container escape.

`Publish verified evaluation` starts on the default branch with narrowly scoped
comment permission. It verifies the source workflow/run attempt, associated PR,
author, current head, exact current PR base, full submission diff, and bounded
JSON report. A historical ancestor is never accepted as a substitute base.
It constructs comments from validated scalar metrics. It never executes artifact
contents, student code, or PR Markdown. Closed/superseded submissions are skipped. If main advances during or after
evaluation, the publisher skips the now-stale report; update the submission branch
against current main and trigger a fresh evaluation. Head and base are checked
again immediately before posting the comment.

Merged agents are also isolated. `Tournament and Pages` evaluates on a read-only
runner, uploads JSON only, validates results in a fresh static-build job, and gives
Pages/OIDC permissions only to a final deployment job without repository checkout.
It never commits leaderboard updates to main. `LEADERBOARD.md` links to live
standings; checked-in `web/data` is a snapshot. Current official results are on
Pages and workflow artifacts. A failed infrastructure readiness check or build preserves the previous Pages
deployment. Trusted baseline smoke checks run before each lab and after an agent
failure, so a Docker/Gym outage cannot silently publish an all-error leaderboard.

## Initial rollout

1. Run `python3 tournament/configure_repository.py --phase initial` to review
   current settings and the initial protection plan. With repository admin
   authorization, apply it using `--apply`. This phase requires one fresh approval,
   resolved conversations, protects against force pushes/deletions, enforces rules
   for admins, keeps tokens read-only, and requires approval for external Actions.
   It preserves existing stronger rules and does not change Pages or require new
   checks before those checks exist on main.
   Until this PR merges, the legacy leaderboard workflow on main still attempts
   a direct bot commit; the new protection blocks that write. The existing Pages
   deployment remains available while the replacement artifact pipeline is reviewed.
2. Review and merge the infrastructure PR. Its first `Evaluate submission` run
   performs no agent evaluation because the policy is not on the trusted base.
   The independent security workflow tests the proposed implementation. Then run
   `python3 tournament/configure_repository.py --phase post-merge` and review the
   settings diff before adding `--apply`. This idempotently upgrades initial
   protection to require both named checks, CODEOWNERS approval, up-to-date
   branches, restricts the `github-pages` environment to exactly the `main` branch,
   and switches Pages from `main:/docs` to Actions. Unknown/conflicting
   existing settings stop activation for manual review; stronger settings persist.
3. Confirm the script reports its successful environment readback: `github-pages`
   permits only the `main` branch. The post-merge phase removes the legacy
   `gh-pages` rule and any other branch/tag rule, preserves environment reviewers
   and wait timers, and verifies the exact final policy. An unexpected environment
   protection mode stops activation for review rather than replacing its rules.
4. Dispatch `gh workflow run tournament.yml --ref main`. Verify all three jobs
   succeed, the environment records the expected SHA, and
   <https://gramuah.github.io/RL_tournament/> serves the new design and fresh
   `data/manifest.json` alongside both leaderboards. Verify that `data/policies.json` has the same source SHA and that the existing Taxi and PPO policies load and finish live browser duels without a local service.
5. Open a controlled fork PR with only an allowed submission and confirm the
   policy/evaluation report, instructor review gate, and post-merge publication.
   A mixed workflow/submission diff and another student's folder must be rejected.

The settings script performs several separate API mutations, not a transaction.
If activation stops partway, inspect existing settings and finish the remaining
operations deliberately. Rerunning the same phase is safe; existing requirements
are preserved.

## Local checks and recovery

Use Python 3.11 on Linux and install `tournament/requirements-ci.lock` with
`pip install --require-hashes -r ...`. Build the agent image with
`docker build -f tournament/Dockerfile.agent -t rl-tournament-agent:local tournament`.
Run `RUN_SANDBOX_TESTS=1 python -m unittest discover -s tests -v` for actual isolation
tests; without that flag the Docker integration cases are explicitly skipped.

Actions evaluate both labs with 30 episodes, base seed 42. The website defaults
to Lab 2 and includes Lab 1. Browser demos are educational simulations, not submitted
Python agents. Real duel videos are generated by the manual workflow and downloaded
as artifacts; student browsers never receive GitHub tokens.

If publication breaks, fix/revert the reviewed commit through a PR and rerun the
workflow on main. Keep Pages in Actions mode; switching back to `/docs` will fail
after migration. Never recover by running student code with a write token or by
copying an unvalidated PR artifact into the site.
