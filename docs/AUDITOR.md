# Auditor: one-minute CI failure monitoring

The new root-level `auditor.py` scans **current** GitHub Actions failure states, cross-references verified guidance in `researcher.py` and past GitHub incidents, and researches related Stack Overflow discussions as **unverified references only**.

## Scheduling and cost

GitHub Actions scheduled workflows support a shortest cron interval of **5 minutes**, not 1 minute. `.github/workflows/auditor.yml` runs on `*/5 * * * *` and makes **five checks per run**, with **at least 60 seconds between checks**. Thus it provides approximately one-minute checks while a runner is active. GitHub may delay scheduled workflow starts, so this is **not a guaranteed 24/7 exact one-minute cadence**. Each five-check run uses roughly four minutes of hosted-runner time plus API overhead. Running around the clock can consume substantial hosted-runner minutes, quota and billing; verify your Actions plan and usage. A separate externally hosted cron service is required if you need a truly continuous one-minute schedule with lower Actions runner usage.

## Automatic response

1. Read up to 100 recent Actions runs plus current `main` and open PR commit SHAs. Only the **newest matching workflow run on an active HEAD** is considered actionable; old red X marks on superseded commits remain history.
2. Use existing `researcher.py` error-code taxonomy, GitHub's failed job/step metadata, and persistent `[RESEARCHER]` incidents to find prior recovery experience.
3. Research Stack Overflow using its public Stack Exchange search API. Only links, question titles and scores are collected. External suggestions are never executed or treated as validated instructions.
4. Open **one GitHub Issue per failed run** containing exact code, affected run, failing stage, prior knowledge and advisory research. Further scans reuse the same Issue.
5. Retry only a confirmed runner startup failure, **at most four times** after the initial attempt. If a known dependency-install failure affects a failed push CI on `main`, dispatch the existing restricted `Self-Healing` recovery workflow once. Other failures stop with a clear incident code and require a separately tested **one fix = one PR**.
6. Record the five-cycle results in `auditor.md`, uploaded as a workflow artifact and posted in the Actions job summary. Permanent incident history lives in GitHub Issues.

## Error and safety rules

- `CI-RUNNER-STARTUP`: bounded, deduplicated failed-job reruns, maximum four
- `CI-INSTALL-FAILED`: one dispatch to the existing safe main-only lockfile recovery, if applicable
- `CI-CHECK-FAILED`, `CI-BUILD-FAILED`, `CI-AUDIT-FAILED`: stop; report actual failing stage and require proper CI-verified fix
- `CI-UNKNOWN`: stop and research; do not assume rerunning changes anything
- `AUDITOR-PROCESSING-ERROR`: report GitHub API or incident processing failure rather than declare green

The auditor never force-pushes, bypasses Rulesets, tampers with historical check conclusions, writes directly to `main`, or runs arbitrary Stack Overflow/AI-generated code. A later successful CI run on the current commit is required to consider a regression resolved.

## Usage

Workflow: **Auditor · One-Minute CI Failure Watch** (automatically scheduled after the feature merges to `main`). You may also choose *Run workflow* to launch a five-cycle check.

For a local single scan, with appropriate GitHub credentials and network access:

```bash
GITHUB_REPOSITORY=duykhang68/tetdinhmuiblog GITHUB_TOKEN=... python3 auditor.py --cycles 1
```

For offline regression checks:

```bash
python3 -m unittest discover -s tests -p test_auditor.py -v
```

Only GitHub Issue numbers, workflow metadata, sanitized stages and Stack Overflow links are persisted. Raw job logs and credentials are not copied into Issues or reports.
