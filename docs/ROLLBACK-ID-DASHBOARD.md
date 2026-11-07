# Rollback ID Dashboard — implementation & operations

## Location

- Source SPA: `apps/web/public/rollback-dashboard/index.html`
- Published route after Cloudflare Pages / Vite deployment: `/rollback-dashboard/`
- Dispatch workflow: `.github/workflows/rollback-deploy.yml`
- Repository: `duykhang68/tetdinhmuiblog`; default branch: `main`

The web app is a single self-contained HTML file: vanilla JavaScript and custom Reddit-inspired light CSS, with no build dependency or third-party scripts. Open it directly in a browser for a demo/offline view. Vite copies the file from `public` into `dist` unchanged.

## Data accuracy

1. Read `/commits?sha=<branch>`, `/pulls?state=closed`, `/actions/runs`, and the dedicated CI workflow runs.
2. Reconcile PRs by merge commit SHA first, then by `(#PR-number)` in the commit message when possible.
3. Display latest 10 commits per page. Searching, status filtering, pagination, accordion details and lazy changed-file retrieval are client-side.
4. If GitHub fails, label records **DEMO** explicitly. Example status/PR data in demo mode is illustrative, not authenticated evidence.
5. An Actions `success` means the matched workflow completed successfully, **not** that Cloudflare Pages has deployed that commit. Unmatched commits are `No signal`, not automatically `Failed`.

## Credentials

For browser dispatch use a PAT restricted to this repository:

- Fine-grained: **Actions: Read and write**, **Contents: Read-only** (plus repository metadata); for private repositories include access to the target repo.
- Or classic PAT with `repo` scope.

The PAT stays only in the tab's memory by default. An explicit opt-in stores it **unencrypted** in localStorage, which is not a secure vault. Use a short-lived fine-grained PAT, avoid shared devices, and consider a server-side OAuth/session proxy before production expansion. Never put PATs in the URL, repository code, screenshots or issues.

The rollback workflow also needs a GitHub Actions secret `ROLLBACK_WORKFLOW_TOKEN` (preferred), or the existing `AUTO_MERGE_WORKFLOW_TOKEN`, with permission to push a temporary branch and create Pull Requests. For a classic PAT, use `repo` and `workflow`; for a fine-grained token, select the repository and include Contents/PR write and permissions needed to update workflow files. The workflow intentionally fails closed if neither secret is configured.

## Recovery flow

1. Select a historical commit by SHA and select `main`, `deploy` or `gh-pages` (the branch must already exist).
2. Enter PAT and select **Bắt đầu Rollback**.
3. Read the safety dialog, verify target SHA/branch and actively check the confirmation box.
4. Browser validates `GET /user`, resolves full commit SHA, checks branch existence and ancestry, verifies the workflow is active, then calls `POST /actions/workflows/rollback-deploy.yml/dispatches` on ref `main`.
5. Action fetches full history, checks target ancestor again, creates a new branch from current branch HEAD and restores tracked repository content to the target SHA, **retaining current `.github/workflows` policies**.
6. Action opens a PR targeting the selected branch. For `main`, existing CI/auto-merge policies determine if and when the change can merge; for other branches, configure their own checks/merge policy.
7. Cloudflare deployment depends on the external Pages integration; workflow dispatch and PR merge alone are not proof of deployment. Verify the actual production URL after merging.

**No force-push** is executed. No direct mutation of the production branch is performed by the dashboard.

## QA checklist

- [ ] Load local `index.html` and confirm 100% light theme and marked DEMO data while offline.
- [ ] Load `/rollback-dashboard/` via Cloudflare after merge and verify actual GitHub rows, cards, search, filtering, pagination and expansion.
- [ ] Check that changed files appear on expansion and links use the selected repository.
- [ ] Test API read without token on the public repository, then with a token via Settings.
- [ ] Ensure invalid SHA, unknown branch, unauthorized token and missing workflow all fail before dispatch.
- [ ] Validate confirmation checkbox blocks dispatch until checked.
- [ ] Test workflow using a **non-production test branch** that exists and contains a known ancestor SHA; inspect generated PR and CI before any merge.
- [ ] Verify no PAT is persisted if the remember option remains unchecked.

## Caveats

- The REST API returns bounded recent pages. The dashboard does not claim a complete archive of all workflow runs or all historic PRs.
- `gh-pages` / `deploy` may not exist on this repository; their selection is supported but runtime validation will reject missing branches.
- Single-file/offline operation necessarily cannot authenticate or dispatch GitHub actions without an Internet connection.
- Rollback leaves existing workflow definitions unchanged to preserve current security gates. It therefore restores application content, not an exact historical workflow configuration.