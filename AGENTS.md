# Repository instructions — `duykhang68/tetdinhmuiblog`

These instructions apply to **all files and every coding agent/PR** in this repository.

## Mandatory rule: Google Drive sync for data-oriented pages

**NON-NEGOTIABLE / BẮT BUỘC:** Every page, dashboard, utility, or sub-page that displays, manages, records, edits, imports, exports, or analyzes **statistics/analytics (thống kê), expenses/finance (chi phí/tài chính), or datasets/records (dữ liệu)** MUST integrate **Google Drive synchronization**. Applies to **existing pages when modified** and **every newly created relevant page**. Do not ship such a page with only localStorage, in-memory state, or Cloudflare-only storage.

For the authoritative acceptance criteria, consult [docs/GLOBAL-GOOGLE-DRIVE-SYNC-POLICY.md](docs/GLOBAL-GOOGLE-DRIVE-SYNC-POLICY.md) before modifying a data-oriented page.

Required capabilities:
1. **Shared Google OAuth:** Reuse the Editor's existing Web OAuth Client ID discovery (prefer `VITE_GOOGLE_CLIENT_ID`, fall back to its established safe configuration). Use Drive's minimum required permission (`drive.file`) and never put Client Secrets or tokens in source/localStorage.
2. **Automatic sync every 3 minutes:** When the page is open, online, and its Drive session is valid, synchronize at least once every **180 seconds**; queue/persist edits safely. Do not claim background synchronization while the tab is closed.
3. **Manual “Đồng bộ ngay” action:** An obvious button to sync now, with clear connected/syncing/synced/pending/error status, latest successful sync time, and an accessible link to the backup when available.
4. **Cross-device restore:** Signing in with the same Drive account on a different browser/device can restore the corresponding page's data, filters/preferences and relevant persisted settings as appropriate.
5. **Integrity + conflict safety:** Do not silently overwrite or delete different local/remote versions. Validate/normalize snapshots; compare account and revisions/snapshot ancestry; require explicit conflict resolution and preserve/export a backup before any destructive replacement. Avoid duplicate records on retry.
6. **Independent datasets:** Each page/module MUST use its own Drive appProperties tag, filename convention, snapshot schema/version, and local sync metadata key, unless explicitly designed and documented as one shared dataset. Never mix Starbucks transactions with Expenses or other pages.
7. **Preserve complete data:** Back up all meaningful fields including source/original values, amounts before/after discounts, surcharges, descriptive reasons, identifiers, and relevant dashboard settings. Never back up only currently visible/filtered rows.
8. **Tests and documentation:** Add/maintain automated tests for upload, read-back verification, restore on a new device, concurrent edit conflict, OAuth expiry, and dataset isolation. Update the corresponding setup docs. **1 feature = 1 PR**.

This requirement also covers read-only statistical dashboards: offer a meaningful Google Drive backup/sync of their dashboard datasets, saved settings, or snapshots. Do not silently exempt pages merely because data comes from a public API/GitHub; if a legitimate technical exception is necessary, obtain the owner's explicit approval and document it in the PR.

Do **not** replace Google Drive with Cloudflare D1/KV, GitHub, or browser storage as the sole backup source. Such sources may coexist, but Drive sync remains mandatory.

## Existing pages

The mandate is repository-wide, but **adding this policy does not itself retrofit legacy pages**. Audit and migrate each existing in-scope page with a separate feature/PR and track remaining gaps in the policy document. Do not claim a page is compliant until code, tests and live configuration have been verified.

## Other engineering conventions

- Never commit credentials or private user data.
- Prefer existing `apps/web/src/services/googleDriveService.js` and patterns in `apps/web/src/expenses/` and `apps/web/src/starbucks-insights/` over creating a new OAuth stack.
- Maintain accessible, responsive **Reddit-inspired light mode** unless the owner explicitly requests otherwise; avoid changing unrelated layouts or approved behavior.
- Follow the project's CI quality gate and keep changes scoped to one feature per PR.

## Mandatory rule: Quick Access shortcuts for every new page

**NON-NEGOTIABLE / BẮT BUỘC:** Whenever a PR creates a new website page, standalone route, dashboard, utility, insights view, or other user-facing destination with its own URL, it MUST register a visible, working shortcut in the Editor's existing **“Truy cập nhanh” (Quick Access)** section. The owner must not have to memorize or manually type the URL.

Acceptance criteria:
1. Add a clearly named shortcut pointing to the correct canonical deployed URL or route; do not link to an unrelated GitHub source file in place of the usable page.
2. Use the existing Quick Access section and navigation conventions rather than creating a competing widget. Keep existing links intact, deduplicate by canonical destination, and use consistent ordering/labels.
3. The shortcut must work on desktop and mobile, be keyboard accessible, and lead to the actual page (not a 404 or placeholder).
4. When a route is renamed or retired, update/remove its corresponding shortcut in the **same PR**. A page and its shortcut must ship together.
5. Include the Quick Access entry in the PR acceptance checklist and test/verify navigation in CI where feasible. Do not mark a new-page PR complete without the entry and a checked URL.
6. This rule is repository-wide and applies alongside the Google Drive sync mandate; neither rule exempts the other.
