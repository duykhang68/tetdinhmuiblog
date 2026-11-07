# Research Insights (Google OAuth dashboard)

**Route:** /research-insights.html (Cloudflare Pages and local Vite).

This is a separate Vite HTML entry with its own React root and CSS; it does not mount the Blogger editor.

## Security

- The frontend calls /api/status first and renders NO charts or incident data until the existing Google OAuth session is connected.
- /api/research-insights is also protected at both Node and Cloudflare Pages backends. A browser request without a valid encrypted/session cookie is rejected with 401. The backend refreshes expired Google access tokens before fetching metrics.
- Click "Kết nối bằng Google" to reuse /auth/google/start?return_to=research-insights. Only a fixed server-side allowlisted return path is accepted; Google OAuth state + PKCE remain unchanged. OAuth callback returns to this dashboard.
- GitHub credentials (optional) are exclusively server-side: RESEARCH_GITHUB_TOKEN. Never put them in VITE_* variables, source files or browser storage. If omitted, the public repository can be read anonymously under GitHub's API rate limits.

## Actual data source / definitions

researcher.py is event-driven, NOT an HTTP server. Its durable research outputs are GitHub Issues with titles starting [RESEARCHER]. The dashboard reads these issues through the authenticated backend; the separate GitHub Actions API provides workflow run telemetry.

- **Total Research:** researcher-created incidents found among the latest 100 GitHub issues, not number of Python executions.
- **Active Pipelines:** currently noncompleted workflow runs from the latest 100 GitHub Actions runs.
- **Real-time Latency:** server-side duration of the two GitHub API requests, not the runtime of researcher.py.
- **Success Rate:** percentage of successful concluded workflows in the latest 100 runs, excluding skipped/neutral.
- **Activity:** newly created researcher incidents by UTC calendar day over the most recent 14-day window.
- **Error classes and incident types:** derived from researcher issue code/body.
- **Occurrences:** 1 + issue comment count (proxy only; comments can include other conversation).
- **Website traffic:** unavailable until real GA4 or server analytics has been configured. No fabricated visitor counts.

Polling is every 3 minutes when the tab is visible; there is also manual refresh. Failed API calls show an error, and stale data stays visibly marked.

GitHub API public limits apply. For reliable multi-device deployments, configure a read-only RESEARCH_GITHUB_TOKEN in Cloudflare Pages environment variables or the local server's environment. Do not expose tokens in API responses.

## Deploy

Build command: npm run build. Build output: apps/web/dist. Cloudflare Pages Functions live under apps/web/functions and serve /api/* and /auth/*. Deploy the updated build and Function together. On Google Cloud, ensure the configured OAuth redirect URI already points to /auth/google/callback on the production domain; the new dashboard does not require a new redirect URI.

For local development: npm run dev and open http://localhost:5173/research-insights.html. Google OAuth requires the existing apps/server/.env configuration, a running Node API, and authorized OAuth origin/callback.

Run tests: npm run check, then npm run build. Never assume a successful deploy before CI and Cloudflare publish are confirmed.
