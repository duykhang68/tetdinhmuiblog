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
test('rate limits report an error rather than fabricated data',async()=>{
  await assert.rejects(()=>loadResearchInsights({fetcher:async()=>new Response('',{status:403})}),/giới hạn/);
});
