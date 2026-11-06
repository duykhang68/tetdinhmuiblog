# CI/CD merge and deployment policy

## PR quality gate
- `CI · Quality Gate` runs on every pull request into `main`.
- Locked `npm ci`, syntax checks and automated tests (`npm run check`), production build (`npm run build`), and production dependency audit (`npm audit --omit=dev --audit-level=high`) must pass.
- This repository does not currently define a dedicated lint command; syntax checks are not a replacement for a full ESLint rule set.

## Auto-merge
- Only open, non-draft, same-repository PRs can be considered.
- The latest HEAD SHA must have a successful `Test and build (Node 22)` check.
- When main has advanced, refresh the PR branch and wait for CI on the new SHA.
- GitHub must report a clean, mergeable PR, and GitHub's server-side branch protection/rulesets are authoritative.
- No bot approval is supplied to bypass human-review requirements.
- A change to `.github/workflows/**`, `.github/actions/**` or `CODEOWNERS` requires an authorized/manual merge after CI passes.
- HTTP 403 related to workflow permissions is recorded as a controlled block, not an unhandled action failure.

## Branch protection configuration (repository administrator)
GitHub Settings > Rules > Rulesets: protect `main` and require `Test and build (Node 22)`, prevent force-push and deletion, require pull requests, enforce review policy where desired, and disallow bypass for automation identities. Set required checks using a recent successful run. Only administrators can change repository rules; workflows cannot guarantee a ruleset is configured.

## Release and deployment
- `CD · Versioned Release (No Live Deployment)` builds, checks archive integrity and HTML, and publishes a versioned GitHub release.
- This repository has no configured production host/backend deployment in these workflows. Publishing a release is **not** deploying an application.
- After deploying to a real public HTTPS host, use `CD · Post-deploy Verification` with `deployment_url` to verify the deployed endpoint.
- Production deployment must be configured for a chosen host/provider separately; protect deployment environments and secrets using GitHub Environments.
