import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeResearch,loadResearchInsights} from '../src/services/researchInsights.mjs';

const when = '2026-11-07T00:00:00Z';
const issue = (code,number=1) => ({title:'[RESEARCHER] CI-A · '+code,number,body:'- Error code: '+code,created_at:when,updated_at:when,html_url:'https://github.com/duykhang68/tetdinhmuiblog/issues/'+number,state:'open',comments:2});
test('repository incident records are filtered and counted; PRs are excluded',()=>{
  const s=summarizeResearch([issue('CI-CHECK-FAILED'),{...issue('CI-OTHER',2),pull_request:{url:'x'}}],{total_count:2,workflow_runs:[{status:'completed',conclusion:'success'},{status:'completed',conclusion:'failure'}]},{now:Date.parse(when),apiLatencyMs:200});
  assert.equal(s.kpis.totalResearch,1);
  assert.equal(s.kpis.successRate,50);
  assert.equal(s.kpis.sampleRuns,2);
  assert.equal(s.events[0].occurrences,3);
  assert.equal(s.kpis.visitors,null);
  assert.equal(s.activity.at(-1).count,1);
});
test('empty datasets never fabricate success, growth or visitors',()=>{
  const s=summarizeResearch([],{workflow_runs:[],total_count:0},{now:Date.parse(when)});
  assert.equal(s.kpis.successRate,null);
  assert.equal(s.kpis.researchGrowthPct,null);
  assert.equal(s.kpis.visitors,null);
});
test('live fetch is server-only and returns both sources',async()=>{
  const paths=[];
  const fetcher=async(url)=>{paths.push(url);return new Response(JSON.stringify(url.includes('/issues?')?[issue('PR-MERGE-DIRTY')]:{total_count:1,workflow_runs:[{status:'in_progress',conclusion:null}]}),{status:200});};
  const result=await loadResearchInsights({fetcher,now:()=>Date.parse(when)});
  assert.equal(paths.length,2);
  assert.equal(result.kpis.activePipelines,1);
  assert.equal(result.types.find(t=>t.name==='CONFLICT').count,1);
});
test('rate limits classify source failures and never fabricate zero metrics',async()=>{
  const snapshot=await loadResearchInsights({fetcher:async()=>new Response('',{status:403,headers:{'x-ratelimit-remaining':'0'}})});
  assert.equal(snapshot.partial,true);
  assert.equal(snapshot.sources.issues.code,'GH_RATE_LIMIT');
  assert.equal(snapshot.sources.actions.code,'GH_RATE_LIMIT');
  assert.equal(snapshot.kpis.totalResearch,null);
  assert.equal(snapshot.kpis.activePipelines,null);
  assert.equal(snapshot.kpis.successRate,null);
  assert.equal(snapshot.activity,null);
  assert.equal(snapshot.events,null);
});
test('Actions can still display success rate when Issues is unavailable',async()=>{
  const fetcher=async url=>url.includes('/issues?')
    ?new Response('',{status:403,headers:{'x-ratelimit-remaining':'0'}})
    :new Response(JSON.stringify({total_count:4,workflow_runs:[
      {status:'completed',conclusion:'success'},
      {status:'completed',conclusion:'failure'},
      {status:'in_progress',conclusion:null},
      {status:'completed',conclusion:'skipped'}
    ]}),{status:200});
  const s=await loadResearchInsights({fetcher});
  assert.equal(s.sources.issues.ok,false);
  assert.equal(s.sources.actions.ok,true);
  assert.equal(s.kpis.totalResearch,null);
  assert.equal(s.kpis.activePipelines,1);
  assert.equal(s.kpis.successRate,50);
  assert.equal(s.kpis.sampleRuns,2);
  assert.equal(s.partial,true);
});
test('Issues can still show verified incidents when Actions is unavailable',async()=>{
  const fetcher=async url=>url.includes('/issues?')
    ?new Response(JSON.stringify([issue('CI-CHECK-FAILED')]),{status:200})
    :new Response('',{status:401});
  const s=await loadResearchInsights({fetcher});
  assert.equal(s.sources.issues.ok,true);
  assert.equal(s.sources.actions.code,'GH_TOKEN_INVALID');
  assert.equal(s.kpis.totalResearch,1);
  assert.equal(s.kpis.activePipelines,null);
  assert.equal(s.kpis.successRate,null);
  assert.equal(s.events.length,1);
});
test('Permission failures are distinguished from actual GitHub rate limit',async()=>{
  const s=await loadResearchInsights({fetcher:async()=>new Response('',{status:403})});
  assert.equal(s.sources.actions.code,'GH_FORBIDDEN');
  assert.equal(s.sources.issues.code,'GH_FORBIDDEN');
});
test('Verified zero is reported only for valid empty API responses',async()=>{
  const s=await loadResearchInsights({fetcher:async url=>new Response(JSON.stringify(url.includes('/issues?')?[]:{workflow_runs:[],total_count:0}),{status:200})});
  assert.equal(s.partial,false);
  assert.equal(s.kpis.totalResearch,0);
  assert.equal(s.kpis.activePipelines,0);
  assert.deepEqual(s.events,[]);
});

