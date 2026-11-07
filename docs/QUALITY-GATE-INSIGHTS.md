# CI / Quality Gate Insights

## Route and access

- URL: \`/quality-gate\` (standalone, lazy-loaded React route; responsive dark layout).
- Access: protected by **existing Blogger Google OAuth session**, not a new client-side or Drive OAuth token. The API \`GET /api/quality-gate\` requires the same encrypted/signed session cookie as other authenticated API routes. Unauthenticated calls return HTTP 401; frontend shows the Google sign-in gate and **does not render previously fetched CI data**.
- Sign-in via \`/auth/google/start?return_to=/quality-gate\`, with return path **allowlisted**, not an arbitrary URL (prevents open redirects). Login callback lands back at dashboard.
- The GitHub repository itself is public, so the OAuth gate protects the dashboard/API UX, not GitHub's independently public Actions data.
- Do not place GitHub, Cloudflare or Google secret tokens inside Vite \`VITE_*\` variables, client bundle, URLs or Local Storage.

## Live sources and semantics

The server-side fetcher uses GitHub REST API:

1. \`actions/workflows/ci.yml/runs?per_page=60\`: build success/failure/running and 14-day chart. Sample of **latest 60 CI runs**, not lifetime total; success % is passed/(passed+failed), excludes pending, cancelled, skipped.
2. \`actions/runs?per_page=35\`: recent workflow runs, of which the six newest are expanded with \`actions/runs/{id}/jobs\`. The job list is **bounded**, not the entire run history. Job details link to authenticated/public GitHub Actions log pages rather than exposing log content in the dashboard.
3. Optional \`data/quality-gate-report.json\` on \`main\`: coverage and vulnerability/code smell numbers. Report must contain recent, valid \`generatedAt\` (30-day freshness bound). Missing or invalid report displays **— (unknown)**, never a manufactured zero.
4. Optional Cloudflare Pages API deployments: last six successful deployments with matching GitHub SHA commits. Deployment latency is the duration from GitHub commit **committer timestamp** to Cloudflare deployment last-stage end time, in minutes. If configuration, matching SHA or completed timestamps are missing, display **—**.

The dashboard polls every 90 seconds while visible; server-side snapshot cache lasts 90 seconds to reduce API traffic. The green ping indicator means **successful API refresh**, not a persistent WebSocket connection.

## Optional server-only configuration

Set the following as Cloudflare Pages **Secrets / environment variables** for production, or as local server env variables for development:

| Name | Purpose |
| --- | --- |
| \`GITHUB_TOKEN\` | Optional, recommended for higher GitHub API rate limit; needs repository Actions read access (read-only). |
| \`CLOUDFLARE_ACCOUNT_ID\` | Cloudflare account ID for deployment analytics |
| \`CLOUDFLARE_PAGES_PROJECT\` | Cloudflare Pages project name |
| \`CLOUDFLARE_API_TOKEN\` | Scoped token with read access to the Pages project |

Leave Cloudflare variables unset if not available; no fabricated latency will appear. OAuth secrets (\`GOOGLE_CLIENT_ID\`, \`GOOGLE_CLIENT_SECRET\`, \`GOOGLE_REDIRECT_URI\`, \`FRONTEND_ORIGIN\`, \`APP_SECRET\`) are already used by the existing editor and must remain configured for Cloudflare and local backend.

## Quality report data contract

If a code quality / vulnerability scanner is connected, publish the following **verified** JSON structure to \`data/quality-gate-report.json\` on \`main\`:

\`\`\`json
{
  "generatedAt": "2026-11-07T07:00:00Z",
  "coverage": {"linePercent": 85.2},
  "security": {
    "critical": 0,
    "major": 0,
    "minor": 0,
    "codeSmells": 0
  }
}
\`\`\`

**Example only, not real project metrics.** Replace with actual scanner output and timestamp; do not commit the illustrative numbers. Coverage must be measured from instrumented tests; vulnerabilities/security must come from a scanner capable of defining the categories. npm audit's exit code alone does **not** establish count by severity or code smells.

## Operational validation

\`\`\`bash
npm ci
npm test
npm run build
\`\`\`

- Open \`/quality-gate\` while logged out; UI offers Google sign in and \`/api/quality-gate\` should return HTTP 401.
- Login with existing Google OAuth; return to \`/quality-gate\` and confirm real statuses, filtering, deep links to GitHub.
- Confirm no frontend bundle includes a server API token, and never confuse missing measurement with zero.
- After merge and Cloudflare Pages deploy, check Cloudflare Pages **SPA fallback routing** serves \`index.html\` at \`/quality-gate\`. \`/_routes.json\` intentionally maps only \`/api/*\` and \`/auth/*\` to Functions, leaving the standalone React route as an SPA asset path.
