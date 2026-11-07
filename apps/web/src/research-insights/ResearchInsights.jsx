import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';

const REPO = 'duykhang68/tetdinhmuiblog';
const POLL_MS = 180_000;
const iconPaths = {
  pulse:<><path d="M3 12h4l3-7 4 14 3-7h4"/></>,
  layers:<><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 4v16"/></>,
  clock:<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  check:<><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></>,
  search:<><circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/></>,
  refresh:<><path d="M20 7v5h-5M4 17v-5h5"/><path d="M6 9a7 7 0 0 1 12-2l2 5M4 12l2 5a7 7 0 0 0 12-2"/></>,
  arrow:<><path d="M7 17 17 7M8 7h9v9"/></>,
  lock:<><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>,
  chart:<><path d="M4 19V5m0 14h16M7 15l5-5 3 2 5-7"/></>,
  grid:<><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
  list:<><path d="M9 6h12M9 12h12M9 18h12M3 6h1M3 12h1M3 18h1"/></>,
  github:<><path d="M9 19c-4 1-4-2-6-2m12 4v-3.3a3 3 0 0 0-.8-2.1c2.7-.3 5.5-1.3 5.5-6A4.7 4.7 0 0 0 18.4 6a4.3 4.3 0 0 0-.1-3s-1 0-3.1 1.6a10.8 10.8 0 0 0-6.4 0C6.7 3 5.7 3 5.7 3a4.3 4.3 0 0 0-.1 3A4.7 4.7 0 0 0 4.3 9.6c0 4.7 2.8 5.7 5.5 6A3 3 0 0 0 9 17.7V21"/></>,
  filter:<><path d="M4 6h16M7 12h10m-7 6h4"/></>,
  chevron:<><path d="m9 18 6-6-6-6"/></>,
  spark:<><path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5z"/></>
};
function Icon({name,size=19}) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{iconPaths[name]||iconPaths.pulse}</svg>;
}
const n = value => value == null ? '—' : Number(value).toLocaleString('vi-VN');
const dayLabel = day => new Date(day+'T00:00:00Z').toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit',timeZone:'UTC'});
const dateLabel = value => value ? new Date(value).toLocaleString('vi-VN',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}) : '—';

function Metric({icon,title,value,sub,note,tone='indigo'}) {
  return <div className={'ri-metric ri-metric-'+tone}>
    <div className="ri-metric-top"><span className="ri-metric-icon"><Icon name={icon}/></span><span className="ri-metric-arrow"><Icon name="arrow" size={16}/></span></div>
    <div className="ri-metric-name">{title}</div><div className="ri-metric-value">{value}</div>
    <div className="ri-metric-foot"><span>{sub}</span>{note&&<span className="ri-metric-note">{note}</span>}</div>
  </div>;
}
function ActivityChart({data=[]}) {
  const height=225,width=690,left=36,right=18,bottom=190,top=26;
  const max=Math.max(1,...data.map(d=>d.count));
  const x=i=>left+i*(width-left-right)/Math.max(1,data.length-1);
  const y=v=>bottom-v/max*(bottom-top);
  const points=data.map((d,i)=>x(i)+','+y(d.count)).join(' ');
  const area=data.length?'M '+data.map((d,i)=>x(i)+' '+y(d.count)).join(' L ')+' L '+x(data.length-1)+' '+bottom+' L '+left+' '+bottom+' Z':'';
  const total=data.reduce((s,d)=>s+d.count,0);
  return <div className="ri-plot" role="img" aria-label={'Số incident mới trong 14 ngày: '+total}>
    <svg viewBox={'0 0 '+width+' '+height} preserveAspectRatio="xMidYMid meet">
      <defs><linearGradient id="researchArea" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#818cf8" stopOpacity=".34"/><stop offset="100%" stopColor="#818cf8" stopOpacity="0"/></linearGradient></defs>
      {[0,.25,.5,.75,1].map(f=><g key={f}><line x1={left} x2={width-right} y1={y(max*f)} y2={y(max*f)} stroke="#29364b" strokeDasharray="4 6"/><text x="7" y={y(max*f)+4} fill="#8291a8" fontSize="11">{Math.round(max*f)}</text></g>)}
      {area&&<path d={area} fill="url(#researchArea)"/>}
      <polyline points={points} fill="none" stroke="#a5b4fc" strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round"/>
      {data.map((d,i)=><circle key={d.day} cx={x(i)} cy={y(d.count)} r="4.5" fill="#020617" stroke="#a5b4fc" strokeWidth="2"><title>{dayLabel(d.day)+': '+d.count+' incidents'}</title></circle>)}
      {data.filter((_,i)=>i%3===0||i===data.length-1).map(d=><text key={d.day} x={x(data.indexOf(d))} y="217" textAnchor="middle" fill="#94a3b8" fontSize="11">{dayLabel(d.day)}</text>)}
    </svg>
    {!total&&<p className="ri-plot-empty">Chưa có incident mới trong khoảng thời gian này.</p>}
  </div>;
}
function TypesDonut({data=[]}) {
  const total=data.reduce((s,d)=>s+d.count,0);
  let used=0;const radius=71,circ=2*Math.PI*radius;
  const colors={CI:'#818cf8',CONFLICT:'#34d399'};
  return <div className="ri-donut-wrap">
    <svg viewBox="0 0 220 220" className="ri-donut" role="img" aria-label={'Phân loại: '+data.map(d=>d.name+' '+d.count).join(', ')}>
      <circle cx="110" cy="110" r={radius} stroke="#263449" strokeWidth="20" fill="none"/>
      {data.map(d=>{const len=total?d.count/total*circ:0;const offset=used;used+=len;return <circle key={d.name} cx="110" cy="110" r={radius} fill="none" stroke={colors[d.name]||'#64748b'} strokeWidth="20" strokeDasharray={len+' '+(circ-len)} strokeDashoffset={-offset} strokeLinecap={total&&len<circ?'butt':'round'} transform="rotate(-90 110 110)"/>;})}
      <text x="110" y="107" textAnchor="middle" fill="#f8fafc" fontSize="31" fontWeight="750">{total}</text>
      <text x="110" y="128" textAnchor="middle" fill="#94a3b8" fontSize="11">INCIDENTS</text>
    </svg>
    <div className="ri-donut-legend">{data.map(d=><div key={d.name}><span className={'ri-legend-dot ri-'+d.name.toLowerCase()}/><span>{d.name==='CI'?'CI failures':'Merge conflicts'}</span><b>{total?Math.round(d.count/total*100):0}%</b></div>)}</div>
  </div>;
}
function AuthGate({error,onRetry}) {
  return <div className="ri-gate"><div className="ri-gate-glow"/><section className="ri-auth-card">
    <div className="ri-auth-icon"><Icon name="lock" size={28}/></div>
    <div className="ri-eyebrow">PRIVATE ANALYTICS WORKSPACE</div>
    <h1>Research Insights<span>.</span></h1>
    <p>Dashboard nghiên cứu CI/CD chỉ mở khi phiên Google OAuth của bạn đã được xác thực.</p>
    {error&&<p role="alert" className="ri-error">{error}</p>}
    <a className="ri-primary ri-auth-action" href="/auth/google/start?return_to=research-insights">Kết nối bằng Google <Icon name="arrow" size={17}/></a>
    {error&&<button className="ri-text-button" onClick={onRetry}>Kiểm tra lại phiên</button>}
    <small>Phiên đăng nhập được xác minh tại backend · Không lưu access token trong trình duyệt.</small>
  </section></div>;
}
export default function ResearchInsights(){
  const [auth,setAuth]=useState('checking'),[authError,setAuthError]=useState('');
  const [check,setCheck]=useState(0),[refresh,setRefresh]=useState(0);
  const [snapshot,setSnapshot]=useState(null),[loading,setLoading]=useState(false),[error,setError]=useState('');
  const [updatedAt,setUpdatedAt]=useState(null),[filter,setFilter]=useState('all'),[search,setSearch]=useState('');
  const [traffic,setTraffic]=useState({status:'loading'});
  const busy=useRef(false);
  useEffect(()=>{
    const c=new AbortController();
    fetch('/api/status',{credentials:'same-origin',signal:c.signal,cache:'no-store'}).then(async r=>{
      if(!r.ok)throw Error('Không kiểm tra được trạng thái phiên Google.');
      const status=await r.json();
      if(!c.signal.aborted)setAuth(status.connected?'connected':'signedOut');
    }).catch(e=>{if(!c.signal.aborted){setAuthError(e.message);setAuth('signedOut');}});
    return ()=>c.abort();
  },[check]);
  useEffect(()=>{
    if(auth!=='connected')return;
    let alive=true;const c=new AbortController();
    const load=async()=>{
      if(document.hidden||busy.current)return;
      busy.current=true;setLoading(true);
      try{
        const r=await fetch('/api/research-insights',{credentials:'same-origin',cache:'no-store',signal:c.signal,headers:{Accept:'application/json'}});
        const body=await r.json().catch(()=>({}));
        if(r.status===401){if(alive){setAuth('signedOut');setSnapshot(null);}return;}
        if(!r.ok)throw Error(body.error||'Không tải được dữ liệu nghiên cứu (HTTP '+r.status+').');
        if(alive){setSnapshot(body);setUpdatedAt(Date.now());setError('');}
      }catch(e){if(alive&&e.name!=='AbortError')setError(e.message||'Không thể kết nối GitHub API.');}
      finally{if(alive){busy.current=false;setLoading(false);}}
    };
    load();
    const interval=setInterval(load,POLL_MS);
    const visible=()=>{if(!document.hidden)load();};
    document.addEventListener('visibilitychange',visible);
    return ()=>{alive=false;c.abort();clearInterval(interval);document.removeEventListener('visibilitychange',visible);busy.current=false;};
  },[auth,refresh]);
  useEffect(()=>{
    if(auth!=='connected')return;
    const controller=new AbortController();
    let alive=true,loading=false;
    const load=async()=>{
      if(document.hidden||loading)return;
      loading=true;
      try{
        const r=await fetch('/api/ga4-traffic',{credentials:'same-origin',cache:'no-store',signal:controller.signal,headers:{Accept:'application/json'}});
        const data=await r.json().catch(()=>({}));
        if(r.status===401){if(alive)setAuth('signedOut');return;}
        if(!r.ok)throw Error(data.error||'Không đọc được Google Analytics (HTTP '+r.status+').');
        if(alive)setTraffic(data);
      }catch(e){
        if(alive&&e.name!=='AbortError')setTraffic({status:'unavailable',message:e.message||'Không kết nối được Google Analytics.'});
      }finally{loading=false;}
    };
    load();
    const interval=setInterval(load,POLL_MS);
    const visible=()=>{if(!document.hidden)load();};
    document.addEventListener('visibilitychange',visible);
    return ()=>{alive=false;controller.abort();clearInterval(interval);document.removeEventListener('visibilitychange',visible);};
  },[auth,refresh]);
  const events=useMemo(()=>snapshot?.events?.filter(i=>{
    const match=filter==='all'||i.state===filter;
    const q=search.toLowerCase().trim();
    return match&&(!q||(i.title+' '+i.code+' '+i.id).toLowerCase().includes(q));
  })||[],[snapshot,filter,search]);
  const live=auth==='connected'&&!!snapshot&&!error&&updatedAt&&Date.now()-updatedAt<POLL_MS+60_000;
  if(auth==='checking')return <div className="ri-initial"><Icon name="pulse" size={27}/><p>Đang xác minh Google OAuth…</p></div>;
  if(auth!=='connected')return <AuthGate error={authError} onRetry={()=>setCheck(v=>v+1)}/>;
  const k=snapshot?.kpis||{};
  const total7=snapshot?.activity?.slice(-7).reduce((s,d)=>s+d.count,0)??null;
  return <div className="ri-app">
    <aside className="ri-sidebar">
      <a href="/research-insights.html" className="ri-brand"><span className="ri-brand-mark"><Icon name="pulse" size={23}/></span><span>RESEARCH<strong>INSIGHTS</strong></span></a>
      <div className="ri-nav-caption">WORKSPACE</div>
      <nav aria-label="Điều hướng Research Insights">
        <a className="ri-nav-active" href="#overview"><Icon name="grid"/> Overview</a>
        <a href="#trends"><Icon name="chart"/> Research trends</a>
        <a href="#incidents"><Icon name="list"/> Incident explorer</a>
      </nav>
      <div className="ri-sidebar-bottom"><div className="ri-source-panel"><Icon name="github"/><strong>Data intelligence</strong><p>researcher.py · GitHub Issues · Actions</p><a href={'https://github.com/'+REPO+'/blob/main/researcher.py'} target="_blank" rel="noopener noreferrer">Xem researcher.py <Icon name="arrow" size={13}/></a></div><a href="/" className="ri-back">← Quay về Editor</a></div>
    </aside>
    <div className="ri-main">
      <header className="ri-topbar"><div className="ri-breadcrumb"><span>Analytics</span><Icon name="chevron" size={15}/><strong>Research Insights</strong></div><div className="ri-top-actions"><span className={'ri-live '+(live?'is-live':'is-offline')}><i/>{live?'Connected · Live polling':loading?'Syncing':'Offline / stale'}</span><button type="button" className="ri-refresh" disabled={loading} onClick={()=>setRefresh(v=>v+1)}><Icon name="refresh" size={16}/><span>{loading?'Đang tải':'Refresh'}</span></button></div></header>
      <main id="overview" className="ri-content">
        <section className="ri-page-heading"><div><div className="ri-eyebrow"><Icon name="spark" size={14}/> INTELLIGENCE OVERVIEW <span className="ri-pill">BETA</span></div><h1>Research Insights<span className="ri-title-dot">.</span></h1><p>The command center for research, CI intelligence and engineering performance.</p></div><div className="ri-date-chip"><Icon name="clock" size={16}/><span>{updatedAt?'Đồng bộ '+dateLabel(updatedAt):'Đang chờ dữ liệu'}</span></div></section>
        {error&&<p className="ri-alert" role="alert">{error}{snapshot?' · Đang giữ dữ liệu đồng bộ gần nhất.':''}</p>}
        <section className="ri-kpi-grid" aria-label="Các chỉ số tổng quan">
          <Metric icon="layers" title="Total Research" value={n(k.totalResearch)} sub="Researcher incidents" note={k.researchGrowthPct==null?'Chưa đủ kỳ so sánh':(k.researchGrowthPct>0?'+':'')+k.researchGrowthPct+'% / 7 ngày'} tone="indigo"/>
          <Metric icon="pulse" title="Active Pipelines" value={n(k.activePipelines)} sub="GitHub Actions chưa kết thúc" note="100 runs gần nhất" tone="emerald"/>
          <Metric icon="clock" title="Real-time Latency" value={k.apiLatencyMs==null?'—':n(k.apiLatencyMs)+' ms'} sub="Độ trễ GitHub API" note="Đo từ backend" tone="cyan"/>
          <Metric icon="check" title="Success Rate" value={k.successRate==null?'—':k.successRate+'%'} sub="Workflow runs đã kết thúc" note={n(k.sampleRuns)+' mẫu'} tone="violet"/>
        </section>
        <section id="trends" className="ri-analytics-grid">
          <article className="ri-panel ri-trends"><div className="ri-panel-head"><div><div className="ri-section-subtitle">RESEARCH ACTIVITY</div><h2>Research trends <span>↗</span></h2><p>Số incident mới được ghi nhận trong 14 ngày gần nhất</p></div><div className="ri-heading-value"><strong>{n(total7)}</strong><span>7 ngày qua</span></div></div>{snapshot?<ActivityChart data={snapshot.activity}/>:<div className="ri-skeleton"/>}</article>
          <article className="ri-panel"><div className="ri-panel-head"><div><div className="ri-section-subtitle">DISTRIBUTION</div><h2>Incident types</h2><p>Tỉ trọng theo nguồn nghiên cứu</p></div></div>{snapshot?<TypesDonut data={snapshot.types}/>:<div className="ri-skeleton"/>}</article>
          <article className="ri-panel ri-categories"><div className="ri-panel-head"><div><div className="ri-section-subtitle">ROOT CAUSE TAXONOMY</div><h2>Top error classes</h2><p>Phân loại mã lỗi do researcher.py tạo</p></div></div><div className="ri-bars">{snapshot?.categories?.length?snapshot.categories.slice(0,6).map((d,i)=><div key={d.name} className="ri-bar-row"><div className="ri-bar-label"><span>{String(i+1).padStart(2,'0')} · {d.name}</span><strong>{d.count}</strong></div><div className="ri-bar-track"><div style={{width:100*d.count/snapshot.categories[0].count+'%'}}/></div></div>):<p className="ri-empty">Chưa có phân loại lỗi.</p>}</div></article>
          <article className="ri-panel ri-data-source"><div className="ri-panel-head"><div><div className="ri-section-subtitle">DATA OBSERVABILITY</div><h2>Signal health</h2><p>Chỉ số được xác minh theo nguồn</p></div></div><div className="ri-observability"><div><span className="ri-obs-status good"><i/> Connected</span><strong>GitHub Issues / Actions</strong><small>Nguồn dữ liệu trực tiếp, đọc bằng backend sau OAuth</small></div><div className="ri-ga4-source">
                <span className={'ri-obs-status '+(traffic.status==='connected'?'good':'pending')}><i/>{traffic.status==='connected'?'GA4 Connected':traffic.status==='needs_consent'?'Grant access':traffic.status==='loading'?'Checking':traffic.status==='needs_property'?'Setup required':'Unavailable'}</span>
                <strong>Website traffic · GA4</strong>
                <small>duynguyen99.blogspot.com · G-Z83BHS8KMY</small>
                {traffic.status==='connected'?<div className="ri-ga4-stats">
                  <div><span>Active · 30 phút</span><b>{n(traffic.metrics.activeUsers30m)}</b></div>
                  <div><span>Active users · 7 ngày</span><b>{n(traffic.metrics.activeUsers7d)}</b></div>
                  <div><span>Sessions · 7 ngày</span><b>{n(traffic.metrics.sessions7d)}</b></div>
                  <div><span>Page views · 7 ngày</span><b>{n(traffic.metrics.pageViews7d)}</b></div>
                  <small className="ri-ga4-footnote">Stream {traffic.streamId} · Xác minh từ Google Analytics Data API · {dateLabel(traffic.updatedAt)}</small>
                </div>:<div className="ri-ga4-note">
                  <span>{traffic.status==='needs_consent'?'Cấp quyền Analytics chỉ đọc để xem số liệu thực.':traffic.status==='loading'?'Đang kiểm tra nguồn GA4…':traffic.message||'Chưa đọc được báo cáo GA4.'}</span>
                  {traffic.status==='needs_consent'&&<a href="/auth/google/start?return_to=research-insights&analytics=1">Kết nối Google Analytics <Icon name="arrow" size={13}/></a>}
                </div>}
              </div><div><span className="ri-obs-status good"><i/> Every 3 min</span><strong>Automatic polling</strong><small>Tạm dừng khi tab ẩn và hỗ trợ tải lại thủ công</small></div></div></article>
        </section>
        <section id="incidents" className="ri-panel ri-table-panel"><div className="ri-panel-head"><div><div className="ri-section-subtitle">INCIDENT EXPLORER</div><h2>Research knowledge base</h2><p>Issue records do researcher.py ghi nhận, sắp theo lần cập nhật mới nhất</p></div><a className="ri-github-link" href={'https://github.com/'+REPO+'/issues?q='+encodeURIComponent('is:issue [RESEARCHER]')} target="_blank" rel="noopener noreferrer">Open GitHub <Icon name="arrow" size={15}/></a></div>
          <div className="ri-table-controls"><label className="ri-search"><Icon name="search" size={18}/><input type="search" aria-label="Tìm theo mã lỗi hoặc tiêu đề" placeholder="Search incident, fingerprint, issue ID…" value={search} onChange={e=>setSearch(e.target.value)}/></label><div className="ri-filters" role="group" aria-label="Lọc trạng thái">{[['all','All'],['open','Open'],['closed','Closed']].map(([value,label])=><button key={value} className={filter===value?'selected':''} type="button" onClick={()=>setFilter(value)}>{label}</button>)}</div></div>
          <div className="ri-table-scroll"><table><thead><tr><th>INCIDENT</th><th>ERROR CLASS</th><th>STATE</th><th>OCCURRENCES*</th><th>LAST UPDATED</th><th>DETAIL</th></tr></thead><tbody>{events.map(item=><tr key={item.id}><td><div className="ri-cell-main">{item.title}</div><span className="ri-cell-sub">Issue #{item.id} · {item.type}</span></td><td><code>{item.code}</code></td><td><span className={'ri-status ri-'+item.state}>{item.state}</span></td><td>{n(item.occurrences)}</td><td>{dateLabel(item.updatedAt)}</td><td>{item.url&&<a href={item.url} target="_blank" rel="noopener noreferrer" aria-label={'Mở Issue '+item.id}><Icon name="arrow" size={18}/></a>}</td></tr>)}</tbody></table>{!events.length&&<div className="ri-empty ri-table-empty">{snapshot?'Không có incident phù hợp bộ lọc.':'Đang tải dữ liệu từ GitHub…'}</div>}</div>
          <div className="ri-table-foot"><span>{n(events.length)} of {n(snapshot?.events?.length)} issues · *Số lần xuất hiện ước lượng = issue + comments.</span><span>{snapshot?.limited?.issues?'Dữ liệu giới hạn trong 100 issues GitHub mới cập nhật.':'GitHub REST API · Chỉ dữ liệu thực'}</span></div>
        </section>
        <footer className="ri-footer"><span>Research Insights © Duy Nguyen · Powered by GitHub & researcher.py</span><span>Google OAuth secured · <a href="/" >Editor</a></span></footer>
      </main>
    </div>
  </div>;
}
