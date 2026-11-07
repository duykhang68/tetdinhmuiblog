import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {api} from './api.js';
import './quality-gate.css';

const REPO = 'duykhang68/tetdinhmuiblog';
const ACTIONS = 'https://github.com/' + REPO + '/actions';
const AUTH_URL = '/auth/google/start?return_to=%2Fquality-gate';
const POLL_MS = 90_000;
const statuses = {
  passed: {label: 'Passed', className: 'passed'},
  failed: {label: 'Failed', className: 'failed'},
  running: {label: 'Running', className: 'running'},
  other: {label: 'Other', className: 'other'}
};
function fmtDate(value, dateOnly = false) {
  if (!value || Number.isNaN(Date.parse(value))) return '—';
  return new Date(value).toLocaleString('vi-VN', dateOnly ? {day: '2-digit', month: 'short'} : {day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'});
}
function fmtNumber(n, unit = '') { return typeof n === 'number' && Number.isFinite(n) ? n.toLocaleString('vi-VN') + unit : '—'; }
function formatDuration(value) {return typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString('vi-VN', {maximumFractionDigits: 1}) + ' phút' : '—';}
function Status({value}) {
  const item = statuses[value] || statuses.other;
  return <span className={'qg-status qg-status-' + item.className}><span className="qg-status-dot" />{item.label}</span>;
}
function Icon({name, size = 18}) {
  const paths = {
    pulse: <><path d="M3 12h4l3-7 4 14 3-7h4"/></>,
    code: <><path d="m8 4-6 6 6 6m8-12 6 6-6 6m-5-14-4 20"/></>,
    shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    refresh: <><path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.5 9a7 7 0 0 1 12.1-2L20 12M4 12l2.4 5a7 7 0 0 0 12.1-2"/></>,
    git: <><circle cx="6" cy="4" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="6" cy="20" r="2"/><path d="M6 6v12M8 14h4a6 6 0 0 0 6-6"/></>,
    arrow: <><path d="M7 17 17 7M8 7h9v9"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/></>,
    lock: <><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></>,
    grid: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    chart: <><path d="M3 3v18h18M6 16l5-6 4 3 5-7"/></>,
    terminal: <><rect x="2" y="3" width="20" height="18" rx="2"/><path d="m6 9 3 3-3 3m6 0h6"/></>,
    warning: <><path d="m12 3 10 18H2L12 3Z"/><path d="M12 9v5m0 4h.01"/></>,
    logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4m7 14 5-5-5-5m5 5H9"/></>,
    chevron: <><path d="m9 18 6-6-6-6"/></>,
    rocket: <><path d="M5 16c2-6 5-9 14-12 1 9-2 12-8 14l-6-2ZM11 18l-2 3m-4-5-2 3m6-9 5 5"/><circle cx="15" cy="9" r="1"/></>
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.grid}</svg>;
}
function TrendChart({history = []}) {
  const w = 700, h = 236, left = 36, right = 10, top = 16, bottom = 34;
  const max = Math.max(1, ...history.map(x => x.passed + x.failed + x.running));
  const x = i => left + i * (w - left - right) / Math.max(1, history.length - 1);
  const y = value => top + (max - value) * (h - top - bottom) / max;
  const line = key => history.map((point, i) => x(i) + ',' + y(point[key])).join(' ');
  const area = key => history.length ? (left + ',' + y(0) + ' ' + line(key) + ' ' + x(history.length - 1) + ',' + y(0)) : '';
  return <div className="qg-chart-wrap" role="img" aria-label="Biểu đồ số pipeline Passed và Failed theo ngày, 14 ngày gần nhất">
    <svg viewBox={'0 0 ' + w + ' ' + h} className="qg-chart-svg" preserveAspectRatio="xMidYMid meet">
      <defs><linearGradient id="qg-pass-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#34d399" stopOpacity=".22"/><stop offset="1" stopColor="#34d399" stopOpacity="0"/></linearGradient></defs>
      {[0, .25, .5, .75, 1].map(f => <g key={f}><line x1={left} x2={w-right} y1={y(max * f)} y2={y(max * f)} stroke="#24354a" strokeDasharray="4 6"/><text x={left - 10} y={y(max*f) + 4} textAnchor="end" fill="#7889a0" fontSize="12">{Math.round(max * f)}</text></g>)}
      {history.length > 1 && <polygon points={area('passed')} fill="url(#qg-pass-area)"/>}
      <polyline points={line('passed')} fill="none" stroke="#34d399" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round"/>
      <polyline points={line('failed')} fill="none" stroke="#fb7185" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"/>
      {history.map((p, i) => (i === 0 || i === history.length-1 || i % 3 === 0) && <text key={p.day} x={x(i)} y={h-7} textAnchor="middle" fill="#8d9bb1" fontSize="12">{p.day.slice(5).replace('-', '/')}</text>)}
      {history.map((p,i) => <g key={p.day}><circle cx={x(i)} cy={y(p.passed)} r="3.3" fill="#34d399"/>{p.failed > 0 && <circle cx={x(i)} cy={y(p.failed)} r="3.3" fill="#fb7185"/>}</g>)}
    </svg>
  </div>;
}
function KPI({icon, label, value, hint, tone = 'mint', detail}) {
  return <div className={'qg-kpi qg-kpi-' + tone}>
    <div className="qg-kpi-head"><span>{label}</span><span className="qg-kpi-icon"><Icon name={icon} size={20}/></span></div>
    <strong>{value}</strong><div className="qg-kpi-hint">{hint}</div>{detail && <div className="qg-kpi-detail">{detail}</div>}
  </div>;
}
function LoginGate({error, loading}) {
  return <div className="qg-lock-screen"><div className="qg-login-card">
    <div className="qg-login-lock"><Icon name="lock" size={28}/></div>
    <span className="qg-eyebrow">PROTECTED WORKSPACE / GOOGLE OAUTH</span>
    <h1>CI / Quality Gate <span>Insights.</span></h1>
    <p>Đăng nhập bằng Google để xem dữ liệu kiểm thử, chất lượng mã nguồn và trạng thái CI/CD của repository.</p>
    {loading ? <div className="qg-loading">Đang xác minh phiên đăng nhập…</div> : <a className="qg-primary" href={AUTH_URL}>Đăng nhập với Google <Icon name="arrow" size={18}/></a>}
    {error && <div className="qg-error" role="alert">{error}</div>}
    <div className="qg-login-caption"><Icon name="shield" size={15}/> Sử dụng phiên Google OAuth của Editor. Không yêu cầu GitHub token ở trình duyệt.</div>
  </div></div>;
}
export default function QualityGateInsights() {
  const [auth, setAuth] = useState('checking');
  const [snapshot, setSnapshot] = useState(null);
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [workflow, setWorkflow] = useState('all');
  const [page, setPage] = useState(1);
  useEffect(() => {document.title = 'CI / Quality Gate Insights · Duy Nguyen';return () => {document.title = 'Duy Nguyen · Reddit Editor';};}, []);
  useEffect(() => {
    let active = true;
    api('/status').then(s => {if(active)setAuth(s.connected ? 'ok' : 'required');}).catch(e => {if(active){setAuth('required');setProblem(e.message);}});
    return () => {active = false;};
  }, []);
  const load = useCallback(async () => {
    if (auth !== 'ok' || document.hidden) return;
    setBusy(true);
    try {
      const result = await api('/quality-gate');
      setSnapshot(result);
      setProblem('');
    } catch (e) {
      if (e.status === 401) {setAuth('required');setSnapshot(null);}
      setProblem(e.message || 'Không thể đọc dữ liệu CI.');
    } finally {setBusy(false);}
  }, [auth]);
  useEffect(() => {
    if (auth !== 'ok') return;
    let active = true;
    const fetchSnapshot = async () => {
      if (!active || document.hidden) return;
      setBusy(true);
      try {
        const result = await api('/quality-gate');
        if(active){setSnapshot(result);setProblem('');}
      } catch(e) {
        if(active){if(e.status === 401){setAuth('required');setSnapshot(null);}setProblem(e.message || 'Không thể đọc dữ liệu CI.');}
      } finally {if(active)setBusy(false);}
    };
    fetchSnapshot();
    const timer = window.setInterval(fetchSnapshot, POLL_MS);
    const onVisible = () => {if(!document.hidden)fetchSnapshot();};
    document.addEventListener('visibilitychange', onVisible);
    return () => {active = false; window.clearInterval(timer);document.removeEventListener('visibilitychange', onVisible);};
  }, [auth, tick]);
  const choices = useMemo(() => [...new Set((snapshot?.jobs || []).map(x => x.workflow))].sort(), [snapshot]);
  const filteredJobs = useMemo(() => (snapshot?.jobs || []).filter(j => {
    if(filter !== 'all' && j.status !== filter) return false;
    if(workflow !== 'all' && j.workflow !== workflow) return false;
    const haystack = [j.name, j.workflow, j.branch, j.sha, j.event].join(' ').toLowerCase();
    return haystack.includes(query.toLowerCase().trim());
  }), [snapshot, filter, query, workflow]);
  const totalPages = Math.max(1, Math.ceil(filteredJobs.length / 10));
  const visibleJobs = filteredJobs.slice((Math.min(page, totalPages)-1)*10, Math.min(page, totalPages)*10);
  const updateFilter = value => {setFilter(value);setPage(1);};
  const refresh = () => {setTick(n => n + 1);};
  if(auth !== 'ok')return <div className="quality-page"><LoginGate loading={auth === 'checking'} error={problem}/></div>;
  const ci = snapshot?.ci;
  const security = snapshot?.security;
  const totalVulns = security && ['critical','major','minor'].every(k=>typeof security[k]==='number') ? security.critical + security.major + security.minor : null;
  return <div className="quality-page">
    <aside className="qg-sidebar" aria-label="Quality Gate navigation">
      <a href="/quality-gate" className="qg-brand"><span className="qg-logo"><Icon name="pulse" size={24}/></span><span><strong>DUY<span>OPS</span></strong><small>ENGINEERING INTELLIGENCE</small></span></a>
      <div className="qg-sidebar-label">MONITORING</div>
      <nav className="qg-nav"><a href="#overview" className="active"><Icon name="grid"/> Overview</a><a href="#trends"><Icon name="chart"/> Quality history</a><a href="#pipelines"><Icon name="terminal"/> Pipeline jobs</a><a href="#security"><Icon name="shield"/> Security signals</a></nav>
      <div className="qg-sidebar-label">WORKSPACE</div>
      <nav className="qg-nav"><a href={ACTIONS} target="_blank" rel="noopener noreferrer"><Icon name="git"/> GitHub Actions <Icon name="arrow" size={14}/></a><a href="/"><Icon name="code"/> Open Editor <Icon name="arrow" size={14}/></a></nav>
      <div className="qg-sidebar-bottom"><div className="qg-sidebar-live"><span className={'qg-pulse '+(problem?'qg-pulse-error':'')}/><span><b>{problem?'Data connection issue':'Google session active'}</b><small>{snapshot?'Last sync '+fmtDate(snapshot.fetchedAt):'Waiting for first sync'}</small></span></div><span>duykhang68 / tetdinhmuiblog</span></div>
    </aside>
    <main className="qg-main">
      <header className="qg-topbar"><div className="qg-breadcrumb">Workspace <Icon name="chevron" size={13}/> Engineering <Icon name="chevron" size={13}/> <strong>Quality Gate</strong></div><div className="qg-topbar-actions"><span className="qg-secure"><Icon name="lock" size={14}/> GOOGLE OAUTH</span><button className="qg-icon-button" onClick={refresh} disabled={busy} title="Refresh GitHub Actions" aria-label="Làm mới dữ liệu"><Icon name="refresh" size={18}/></button></div></header>
      <div className="qg-content" id="overview">
        <div className="qg-hero"><div><div className="qg-eyebrow"><span className="qg-live-spark"/> LIVE ENGINEERING OVERVIEW <span className="qg-hero-separator">/</span> MAIN BRANCH</div><h1>CI / Quality Gate <span>Insights.</span></h1><p>Giám sát sức khỏe pipeline, kiểm định chất lượng và tín hiệu triển khai từ dữ liệu thực.</p><div className="qg-hero-meta"><span><Icon name="git" size={15}/> {REPO}</span><span className="qg-meta-separator">•</span><span>{snapshot?'Dữ liệu lúc ' + fmtDate(snapshot.fetchedAt):'Đang tải dữ liệu…'}</span></div></div><div className="qg-hero-side"><div className="qg-hero-ring"><Icon name="shield" size={32}/></div><span>QUALITY OPERATIONS</span><strong>{snapshot ? (problem ? 'DEGRADED' : 'MONITORING') : 'CONNECTING'}</strong></div></div>
        {problem && <div className="qg-error" role="alert"><Icon name="warning" size={17}/>{problem}{snapshot && ' · Dữ liệu đang hiển thị là bản đồng bộ gần nhất.'}</div>}
        <section className="qg-metrics" aria-label="Quality Gate KPIs">
          <KPI icon="pulse" label="CI SUCCESS RATE" value={ci ? fmtNumber(ci.successRate,'%') : '—'} hint={ci ? fmtNumber(ci.passed) + ' passed / ' + fmtNumber(ci.failed) + ' failed' : 'Đang đồng bộ GitHub Actions'} tone="mint" detail={ci ? 'Trên ' + ci.total + ' lượt CI gần nhất; loại trừ pending, skipped, cancelled.' : ''}/>
          <KPI icon="code" label="CODE COVERAGE" value={fmtNumber(snapshot?.coverage?.linePercent,'%')} hint={snapshot?.coverage?.measuredAt ? 'Report ' + fmtDate(snapshot.coverage.measuredAt) : 'Chưa có báo cáo coverage được xác thực'} tone="blue"/>
          <KPI icon="shield" label="VULNERABILITIES" value={fmtNumber(totalVulns)} hint={security ? 'Critical ' + fmtNumber(security.critical) + ' · Major ' + fmtNumber(security.major) + ' · Minor ' + fmtNumber(security.minor) : 'Chờ báo cáo bảo mật'} tone="rose"/>
          <KPI icon="clock" label="DEPLOYMENT LATENCY" value={formatDuration(snapshot?.deployment?.averageMinutes)} hint={snapshot?.deployment?.sampleSize ? 'Trung bình ' + snapshot.deployment.sampleSize + ' deploy đã xác minh' : 'Chưa có mẫu đo Cloudflare Pages'} tone="violet"/>
        </section>
        <section className="qg-duo" id="trends">
          <div className="qg-panel qg-trend-panel"><div className="qg-panel-header"><div><div className="qg-section-kicker">HISTORICAL PERFORMANCE</div><h2>CI pipeline health</h2><p>Xu hướng kết quả CI trong 14 ngày gần nhất · UTC</p></div><div className="qg-legend"><span><i className="qg-legend-pass"/> Passed</span><span><i className="qg-legend-fail"/> Failed</span></div></div><TrendChart history={snapshot?.history || []}/></div>
          <div className="qg-panel qg-composition"><div className="qg-panel-header"><div><div className="qg-section-kicker">EXECUTION BREAKDOWN</div><h2>Build outcomes</h2><p>{ci ? ci.total + ' CI runs sampled' : 'Đang tải'}</p></div><Icon name="pulse" size={19}/></div><div className="qg-breakdown-main"><strong>{fmtNumber(ci?.total)}</strong><span>Total CI runs</span></div><div className="qg-stacked">{['passed','failed','running','other'].map((k) => {const count=k==='other'?ci?.excluded:ci?.[k];return <div key={k} className={'qg-stack-'+k} style={{width: ci?.total? (100*count/ci.total)+'%':'0%'}} title={k+': '+(count??'—')}/>;})}</div><div className="qg-breakdown-list">{[['Passed','passed',ci?.passed],['Failed','failed',ci?.failed],['Running','running',ci?.running],['Other / excluded','other',ci?.excluded]].map(([label,key,value])=><div key={key}><span><i className={'qg-small-dot qg-dot-'+key}/>{label}</span><strong>{fmtNumber(value)}</strong></div>)}</div><div className="qg-data-note">Success rate = passed / (passed + failed). Chưa hoàn tất và các kết luận khác không được tính vào mẫu số.</div></div>
        </section>
        <section className="qg-panel qg-pipelines" id="pipelines"><div className="qg-panel-header"><div><div className="qg-section-kicker">REAL-TIME STATUS / JOB EXECUTIONS</div><h2>Recent pipeline jobs <span className="qg-count">{snapshot?.jobs?.length ?? '—'}</span></h2><p>Dữ liệu GitHub Actions · tự kiểm tra mỗi 90 giây, không phải luồng log trực tiếp</p></div><span className="qg-sync-indicator"><span className={'qg-pulse '+(problem?'qg-pulse-error':'')}/>{problem?'Sync error':busy?'Syncing…':snapshot?'API connected':'Connecting…'}</span></div>
          <div className="qg-filters"><div className="qg-filter-tabs" aria-label="Filter job status">{[['all','All'],['passed','Passed'],['failed','Failed'],['running','Running']].map(([value,label])=><button key={value} type="button" className={filter===value?'selected':''} onClick={()=>updateFilter(value)} aria-pressed={filter===value}>{label}</button>)}</div><div className="qg-filter-controls"><label className="qg-search"><Icon name="search" size={17}/><input type="search" value={query} onChange={e=>{setQuery(e.target.value);setPage(1);}} placeholder="Search job, SHA, branch…" aria-label="Search pipeline jobs"/></label><select aria-label="Filter workflows" value={workflow} onChange={e=>{setWorkflow(e.target.value);setPage(1);}}><option value="all">All workflows</option>{choices.map(name=><option key={name} value={name}>{name}</option>)}</select></div></div>
          <div className="qg-table-scroll"><table className="qg-table"><thead><tr><th>JOB / WORKFLOW</th><th>COMMIT</th><th>BRANCH</th><th>STARTED</th><th>STATUS</th><th>LOGS</th></tr></thead><tbody>{visibleJobs.map(j=><tr key={j.runId+'-'+j.id}><td><strong>{j.name}</strong><small>{j.workflow} · {j.event}</small></td><td><code>{j.sha}</code></td><td><span className="qg-branch">{j.branch||'—'}</span></td><td>{fmtDate(j.startedAt)}</td><td><Status value={j.status}/></td><td><a className="qg-log-link" href={j.url} target="_blank" rel="noopener noreferrer" aria-label={'Mở GitHub job log: '+j.name}>View logs <Icon name="arrow" size={14}/></a></td></tr>)}{!visibleJobs.length && <tr><td colSpan={6} className="qg-empty">{busy&&!snapshot?'Đang đọc GitHub Actions…':'Không có job nào phù hợp với bộ lọc.'}</td></tr>}</tbody></table></div>
          <div className="qg-table-footer"><span>Showing {visibleJobs.length} / {filteredJobs.length} matched jobs · latest {snapshot?.sample?.recentWorkflowRuns ?? '—'} workflow runs</span><div><button disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))}>Previous</button><span>{Math.min(page,totalPages)} / {totalPages}</span><button disabled={page>=totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))}>Next</button></div></div>
        </section>
        <section className="qg-security-grid" id="security"><div className="qg-panel"><div className="qg-panel-header"><div><div className="qg-section-kicker">SECURITY POSTURE</div><h2>Vulnerability severity</h2></div><Icon name="shield" size={20}/></div><div className="qg-severity">{[['CRITICAL','critical'],['MAJOR','major'],['MINOR','minor']].map(([label,key])=><div key={key}><span className={'qg-severity-icon qg-severity-'+key}/><span>{label}</span><strong>{fmtNumber(security?.[key])}</strong></div>)}</div><p className="qg-data-note">Giá trị “—” là chưa được cung cấp qua báo cáo bảo mật, không có nghĩa là 0 lỗ hổng.</p></div><div className="qg-panel"><div className="qg-panel-header"><div><div className="qg-section-kicker">MAINTAINABILITY</div><h2>Code smells & data integrity</h2></div><Icon name="code" size={20}/></div><div className="qg-maintain"><strong>{fmtNumber(security?.codeSmells)}</strong><span>Verified code smells</span></div><p>Để hiển thị coverage, severity và code smells, xuất báo cáo JSON có timestamp từ hệ thống phân tích chất lượng mã nguồn.</p><a href={'https://github.com/'+REPO+'/blob/main/docs/QUALITY-GATE-INSIGHTS.md'} target="_blank" rel="noopener noreferrer">View data contract <Icon name="arrow" size={14}/></a></div></section>
        <footer className="qg-footer"><span>DUYOPS · CI / Quality Gate Insights</span><span>Source: GitHub Actions / Cloudflare Pages · Unmeasured metrics are never simulated.</span><a href={ACTIONS} target="_blank" rel="noopener noreferrer">GitHub Actions <Icon name="arrow" size={13}/></a></footer>
      </div>
    </main>
  </div>;
}
