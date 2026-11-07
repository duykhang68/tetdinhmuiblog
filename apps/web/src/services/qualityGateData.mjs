// Shared server-side GitHub / Cloudflare data adapter. Never import into the browser.
export const QUALITY_REPO = 'duykhang68/tetdinhmuiblog';
const GH = 'https://api.github.com/repos/' + QUALITY_REPO;
const CACHE_MS = 90_000;
let cached = null;
let expires = 0;
let inflight = null;

function normalizeStatus(record) {
  const c = String(record.conclusion || '').toLowerCase();
  const s = String(record.status || '').toLowerCase();
  if (s !== 'completed') return 'running';
  if (c === 'success') return 'passed';
  if (['failure', 'timed_out', 'action_required', 'startup_failure'].includes(c)) return 'failed';
  return 'other';
}
export function aggregateRuns(runs, clock = new Date()) {
  const mapped = (Array.isArray(runs) ? runs : []).map(run => ({...run, gateStatus: normalizeStatus(run)}));
  const passed = mapped.filter(x => x.gateStatus === 'passed').length;
  const failed = mapped.filter(x => x.gateStatus === 'failed').length;
  const running = mapped.filter(x => x.gateStatus === 'running').length;
  const history = [];
  for (let n = 13; n >= 0; n--) {
    const d = new Date(Date.UTC(clock.getUTCFullYear(), clock.getUTCMonth(), clock.getUTCDate() - n));
    const day = d.toISOString().slice(0, 10);
    const matches = mapped.filter(r => String(r.created_at || '').slice(0, 10) === day);
    history.push({day, passed: matches.filter(x => x.gateStatus === 'passed').length, failed: matches.filter(x => x.gateStatus === 'failed').length, running: matches.filter(x => x.gateStatus === 'running').length});
  }
  return {total: mapped.length, passed, failed, running, excluded: mapped.length - passed - failed - running, successRate: passed + failed ? Math.round(1000 * passed / (passed + failed)) / 10 : null, history};
}
function withTimeout(fetcher, url, init) {
  return fetcher(url, {...init, signal: AbortSignal.timeout(12000)});
}
async function githubApiError(res, tokenConfigured) {
  const detail = await res.json().catch(() => ({}));
  const message = String(detail?.message || '');
  const remaining = res.headers.get('x-ratelimit-remaining');
  const limited = res.status === 429 || remaining === '0' || /rate limit|abuse detection/i.test(message);
  let code, explanation;
  if (limited) {
    code = 'GITHUB_RATE_LIMIT';
    explanation = 'GitHub API đã giới hạn lượt gọi. ' +
      (tokenConfigured ? 'Kiểm tra hạn mức token và thử lại sau.' : 'Hãy cấu hình GITHUB_TOKEN (Actions: read) trong Cloudflare Pages Secrets.');
  } else if (res.status === 401) {
    code = 'GITHUB_TOKEN_INVALID';
    explanation = 'GitHub từ chối token (HTTP 401). Kiểm tra hoặc thay GITHUB_TOKEN trong Cloudflare Pages Secrets.';
  } else if (res.status === 403) {
    code = tokenConfigured ? 'GITHUB_PERMISSION_DENIED' : 'GITHUB_TOKEN_REQUIRED';
    explanation = tokenConfigured
      ? 'GitHub từ chối quyền đọc Actions (HTTP 403). Kiểm tra Actions: read và repo duykhang68/tetdinhmuiblog của token.'
      : 'GitHub từ chối truy cập không xác thực (HTTP 403). Cấu hình GITHUB_TOKEN phía server, không đặt token vào trình duyệt.';
  } else {
    code = 'GITHUB_API_ERROR';
    explanation = 'GitHub API trả HTTP ' + res.status + '. Kiểm tra GitHub Actions và đường dẫn workflow.';
  }
  const error = new Error(explanation);
  error.code = code;
  error.status = [401, 403, 429].includes(res.status) ? 503 : 502;
  const retryAfter = res.headers.get('retry-after');
  if (limited && retryAfter && /^\\d+$/.test(retryAfter)) error.retryAfter = retryAfter;
  return error;
}
function makeGithubFetcher(fetcher, token) {
  return async path => {
    const headers = {'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(token ? {Authorization: 'Bearer ' + token} : {})};
    const res = await withTimeout(fetcher, GH + path, {headers});
    if (!res.ok) throw await githubApiError(res, Boolean(token));
    return res.json();
  };
}
function optionalMetric(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}
function parseQualityReport(json) {
  if (!json || typeof json !== 'object' || !Number.isFinite(Date.parse(json.generatedAt))) return null;
  if (Date.now() - Date.parse(json.generatedAt) > 30 * 86400000 || Date.parse(json.generatedAt) > Date.now() + 300000) return null;
  // Values are only accepted from explicitly timestamped report data, never inferred from build success.
  return {
    generatedAt: json.generatedAt,
    coverage: optionalMetric(json.coverage?.linePercent),
    security: {
      critical: optionalMetric(json.security?.critical),
      major: optionalMetric(json.security?.major),
      minor: optionalMetric(json.security?.minor),
      codeSmells: optionalMetric(json.security?.codeSmells)
    }
  };
}
async function loadQualityReport(fetcher) {
  try {
    const url = 'https://raw.githubusercontent.com/' + QUALITY_REPO + '/main/data/quality-gate-report.json';
    const r = await withTimeout(fetcher, url, {});
    return r.ok ? parseQualityReport(await r.json()) : null;
  } catch { return null; }
}
async function loadDeployLatency(fetcher, github, cf) {
  if (!cf?.accountId || !cf?.projectName || !cf?.token) return {averageMinutes: null, sampleSize: 0, source: 'Chưa cấu hình Cloudflare Pages API'};
  try {
    const url = 'https://api.cloudflare.com/client/v4/accounts/' + encodeURIComponent(cf.accountId) + '/pages/projects/' + encodeURIComponent(cf.projectName) + '/deployments?per_page=20';
    const res = await withTimeout(fetcher, url, {headers: {Authorization: 'Bearer ' + cf.token, Accept: 'application/json'}});
    if (!res.ok) throw Error('Cloudflare HTTP ' + res.status);
    const data = await res.json();
    if (!data.success || !Array.isArray(data.result)) throw Error('Cloudflare response invalid');
    const deployed = data.result.filter(d => d.latest_stage?.status === 'success' && d.deployment_trigger?.metadata?.commit_hash && (d.latest_stage?.ended_on || d.modified_on)).slice(0, 6);
    const latencies = await Promise.all(deployed.map(async d => {
      try {
        const sha = d.deployment_trigger.metadata.commit_hash;
        if (!/^[0-9a-f]{40}$/i.test(sha)) return null;
        const commit = await github('/commits/' + sha);
        const a = Date.parse(commit.commit?.committer?.date);
        const b = Date.parse(d.latest_stage?.ended_on || d.modified_on);
        const ms = b - a;
        return Number.isFinite(ms) && ms >= 0 && ms <= 14 * 86400000 ? ms / 60000 : null;
      } catch {return null;}
    }));
    const valid = latencies.filter(Number.isFinite);
    return {averageMinutes: valid.length ? Math.round(valid.reduce((a, b) => a + b, 0) / valid.length * 10) / 10 : null, sampleSize: valid.length, source: 'Cloudflare Pages deployments + GitHub commit timestamps'};
  } catch {
    return {averageMinutes: null, sampleSize: 0, source: 'Không đọc được Cloudflare Pages API'};
  }
}
async function buildSnapshot({fetcher, githubToken, cloudflare}) {
  const github = makeGithubFetcher(fetcher, githubToken);
  const [ciData, allData] = await Promise.all([
    github('/actions/workflows/ci.yml/runs?per_page=60'),
    github('/actions/runs?per_page=35')
  ]);
  const ciRuns = Array.isArray(ciData.workflow_runs) ? ciData.workflow_runs : [];
  const allRuns = Array.isArray(allData.workflow_runs) ? allData.workflow_runs : [];
  const ci = aggregateRuns(ciRuns);
  // Only request job detail for a bounded recent window to respect API quota.
  const recent = allRuns.slice(0, 6);
  const jobResponses = await Promise.all(recent.map(async run => {
    try {
      const data = await github('/actions/runs/' + run.id + '/jobs?per_page=100');
      return (data.jobs || []).map(j => ({
        id: j.id, runId: run.id, name: j.name || 'Unnamed job',
        workflow: run.name || 'Workflow', branch: run.head_branch || '',
        sha: String(run.head_sha || '').slice(0, 8), event: run.event || '',
        status: normalizeStatus(j), conclusion: j.conclusion || null,
        startedAt: j.started_at || run.run_started_at || run.created_at,
        completedAt: j.completed_at || null,
        url: j.html_url || run.html_url, runUrl: run.html_url
      }));
    } catch {
      return [{id: run.id, runId: run.id, name: 'Xem jobs trên GitHub', workflow: run.name || 'Workflow', branch: run.head_branch || '', sha: String(run.head_sha || '').slice(0, 8), event: run.event || '', status: normalizeStatus(run), conclusion: run.conclusion || null, startedAt: run.run_started_at || run.created_at, completedAt: run.updated_at, url: run.html_url, runUrl: run.html_url}];
    }
  }));
  const jobs = jobResponses.flat().sort((a,b) => Date.parse(b.startedAt || 0) - Date.parse(a.startedAt || 0));
  const [report, deployment] = await Promise.all([loadQualityReport(fetcher), loadDeployLatency(fetcher, github, cloudflare)]);
  return {
    repository: QUALITY_REPO, fetchedAt: new Date().toISOString(),
    sample: {ciRuns: ciRuns.length, recentWorkflowRuns: allRuns.length, displayedJobs: jobs.length},
    ci: {total: ci.total, passed: ci.passed, failed: ci.failed, running: ci.running, excluded: ci.excluded, successRate: ci.successRate},
    history: ci.history,
    latest: allRuns.slice(0, 10).map(r => ({id: r.id, name: r.name || 'Workflow', status: normalizeStatus(r), createdAt: r.created_at, url: r.html_url})),
    jobs, coverage: {linePercent: report?.coverage ?? null, measuredAt: report?.generatedAt || null},
    security: report?.security || {critical: null, major: null, minor: null, codeSmells: null},
    deployment
  };
}
export async function getQualityGateSnapshot(options = {}) {
  if (cached && Date.now() < expires) return cached;
  if (inflight) return inflight;
  inflight = buildSnapshot({fetcher: options.fetcher || fetch, githubToken: options.githubToken || '', cloudflare: options.cloudflare || null})
    .then(result => {cached = result; expires = Date.now() + CACHE_MS; return result;})
    .finally(() => {inflight = null;});
  return inflight;
}
