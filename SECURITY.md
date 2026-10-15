# Tournament trust boundaries

Student Python and model files are untrusted, including after merge. Students use forks; they do not receive write access to this repository. Existing organization writers and repository administrators are trusted operators. Recheck those assumptions before adding a new cohort or changing organization permissions.

## Admission and review

The base revision's `tournament/policy.json` declares instructors, directory ownership exceptions, file types, and size limits. Its validator examines the complete Git diff and resulting submission tree without checking out student code. A student submission changes one author-owned participant directory in one lab. Symlinks, gitlinks, baseline changes, and infrastructure changes are rejected.

GitHub allows anyone to propose arbitrary changes in a fork. A PR workflow is itself PR-controlled, so its successful check alone is **not** a tamper-proof admission decision. Required instructor CODEOWNERS review and protected `main` are part of the security boundary. Review the complete diff, including workflow changes, and do not bypass protections to merge a student submission. The independently sourced report publisher rejects infrastructure-changing submissions even if their PR workflow reports success.

Instructor identities are CarlosGual, rflor01, and rlopezsastre. The historical `rafael_flor` submission is explicitly owned by rflor01. Infrastructure changes use the instructor route and still require review.

The general security/site test workflow checks out the immutable base revision for student-authored PRs before installing dependencies, building Docker images, or running tests. Only the three named instructors receive tests of their proposed merge revision; pushes use their exact commit SHA. Student agents are exercised separately by the admission workflow in isolation. The workflow YAML itself remains PR-controlled, so instructors must inspect workflow changes before approving an external run or merging a PR.

## Execution

The host controller owns Gymnasium, observations, rewards, seeds, metric calculations, and output serialization. Only inference and model loading run in a container. The container has no network, credentials, repository checkout, host Docker socket, or writable submission mount. It runs non-root with capabilities removed, privilege escalation disabled, a read-only filesystem, bounded temporary storage, and CPU/memory/process limits.

Initialization, inference, and total runtime are bounded. Both directions of the JSON observation/action protocol have deadlines and size limits; returned actions must be integers in range. Agent output is discarded rather than forwarded as runner workflow commands. Containers are removed on completion or failure. The environment and dependency health checks must succeed before publication.

This is a hardened OS-container boundary on disposable GitHub-hosted runners, not a Python language sandbox or proof against kernel vulnerabilities. Do not move these jobs onto shared/self-hosted infrastructure or pass extra credentials/mounts to containers.

Local notebook APIs retain direct execution for trusted experiments. They are not a safe way to evaluate unfamiliar agents. CI always selects isolated mode; unavailable isolation never falls back to local execution.

## Reporting and deployment

The PR report publisher runs from the default branch on a fresh runner. It checks run identity, workflow path, current PR revision, base ancestry, author, and the complete diff; it parses only a bounded JSON report from the expected artifact. Markdown is constructed from validated host metrics. No downloaded code or agent-produced Markdown is executed or published.

Official evaluation has read-only repository permission. A fresh build job validates scalar results and source provenance; only the deployment job receives Pages and OIDC permissions. No job needs `contents: write`. Pages accepts deployments from `main` only after rollout. Infrastructure failures preserve the prior deployment.

The static site renders participant names as text, loads same-origin assets, and enforces a restrictive meta Content Security Policy. Educational simulations and historical snapshots are labelled explicitly.

## Verification and settings

Run the unit suite, real Docker integration tests, and browser tests documented in README. The security workflow exercises malicious filesystem/network/process access, timeouts, invalid protocol messages, artifact forgery, ownership violations, and existing model compatibility.

Repository protections are external state: committing workflow YAML or CODEOWNERS does not activate them. Use the staged, reviewable [rollout procedure](tournament/OPERATIONS.md), verify the settings readback, and verify the first hosted deployment separately from local tests.

## Local interactive Gymnasium server

`python -m tournament.serve` binds only `127.0.0.1` and serves the `web/` directory. The JSON API requires a loopback Host and same-origin Origin/Fetch Metadata when present, accepts only bounded JSON bodies, and never enables CORS. It accepts a fixed set of labs, policies, integer seeds and discrete actions. Sessions are capped at eight, expire after five minutes idle, and close environments/containers on expiry, reset or shutdown. HTTP reads have a five-second timeout. This is a local teaching/development server, not an internet-facing multi-user service.

Saved submissions are disabled by default. `--isolated-agents` validates existing repository submission directories and requires the trusted Docker image before serving; inference always uses `IsolatedAgent`. Arbitrary paths, uploads and remote model URLs are not accepted. Errors close the failed session and never fall back to host execution. Environments, rewards and original Gymnasium frames remain owned by the trusted server. Practice never writes results, repository files or leaderboard data.
