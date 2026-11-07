// Researcher is event-driven; its durable outputs are GitHub Issues and Actions.
// Never execute researcher.py or expose a GitHub token to the browser.
export const RESEARCH_REPO = 'duykhang68/tetdinhmuiblog';
const API_BASE = 'https://api.github.com/repos/' + RESEARCH_REPO;
const DAY = 86_400_000;

function round(n) { return Math.round(n * 10) / 10; }
function codeOf(issue) {
  const title = String(issue.title || '');
  const body = String(issue.body || '');
  return (body.match(/^- Error code:\s*([A-Z0-9-]+)/m) || title.match(/ · ([A-Z0-9-]+)$/) || [,'UNCLASSIFIED'])[1];
}
function issueRecord(issue) {
  const code = codeOf(issue);
  return {
    id: Number(issue.number),
    title: String(issue.title || '').slice(0, 180),
    code,
    type: code === 'PR-MERGE-DIRTY' ? 'CONFLICT' : 'CI',
    state: issue.state === 'closed' ? 'closed' : 'open',
    createdAt: issue.created_at,
    updatedAt: issue.updated_at,
    occurrences: 1 + Math.max(0, Number(issue.comments) || 0),
    url: /^https:\/\/github\.com\/duykhang68\/tetdinhmuiblog\/issues\/\d+$/.test(issue.html_url || '') ? issue.html_url : null
  };
}
async function githubJSON(fetcher, path, token, charge) {
  charge();
  const headers = {'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};
  if (token) headers.Authorization = 'Bearer ' + token;
  let response;
  try {
    response = await fetcher(API_BASE + path, {headers,signal:AbortSignal.timeout(12000)});
  } catch {
    throw new Error('Không kết nối được GitHub API. Hãy kiểm tra mạng hoặc thử lại.');
  }
  if (!response.ok) {
    if (response.status === 403 || response.status === 429)
      throw new Error('GitHub API đang giới hạn truy cập. Cấu hình RESEARCH_GITHUB_TOKEN cho backend hoặc thử lại sau.');
    throw new Error('GitHub API trả HTTP ' + response.status + '.');
  }
  const payload = await response.json();
  return payload;
}
export function summarizeResearch(issues, workflowRuns, options = {}) {
  const now = options.now ?? Date.now();
  const records = issues.filter(item => !item.pull_request && /^\[RESEARCHER\]\s/.test(String(item.title || ''))).map(issueRecord);
  records.sort((a,b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  const activity = Array.from({length:14},(_,index)=>{
    const timestamp = now - (13-index)*DAY;
    const day = new Date(timestamp).toISOString().slice(0,10);
    return {day, count: records.filter(item => item.createdAt?.slice(0,10) === day).length};
  });
  const categories = [...records.reduce((m,item)=>m.set(item.code,(m.get(item.code)||0)+1),new Map())]
    .map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count);
  const types = ['CI','CONFLICT'].map(name=>({name,count:records.filter(i=>i.type===name).length}));
  const runs = Array.isArray(workflowRuns.workflow_runs) ? workflowRuns.workflow_runs : [];
  const active = runs.filter(run => ['queued','in_progress','waiting','pending','requested'].includes(run.status)).length;
  const concluded = runs.filter(run => run.status==='completed' && !['skipped','neutral',null].includes(run.conclusion));
  const successes = concluded.filter(run => run.conclusion==='success').length;
  const current = activity.slice(7).reduce((n,d)=>n+d.count,0);
  const previous = activity.slice(0,7).reduce((n,d)=>n+d.count,0);
  return {
    generatedAt:new Date(now).toISOString(),
    source:'researcher.py → GitHub Issues; GitHub Actions',
    limited:{issues:issues.length>=100,runs:Number(workflowRuns.total_count||0)>runs.length},
    kpis:{
      totalResearch:records.length,
      researchGrowthPct:previous?round((current-previous)*100/previous):null,
      activePipelines:active,
      successRate:concluded.length?round(successes*100/concluded.length):null,
      sampleRuns:concluded.length,
      apiLatencyMs:options.apiLatencyMs ?? null,
      visitors:null
    },
    activity,categories,types,events:records
  };
}
export async function loadResearchInsights({fetcher=fetch,token='',charge=()=>{},now=Date.now}={}) {
  const start=now();
  const [issues,runs] = await Promise.all([
    githubJSON(fetcher,'/issues?state=all&per_page=100&sort=updated&direction=desc',token,charge),
    githubJSON(fetcher,'/actions/runs?per_page=100',token,charge)
  ]);
  if (!Array.isArray(issues) || !runs || !Array.isArray(runs.workflow_runs))
    throw new Error('GitHub trả dữ liệu không hợp lệ.');
  return summarizeResearch(issues,runs,{now:now(),apiLatencyMs:Math.max(0,now()-start)});
}
