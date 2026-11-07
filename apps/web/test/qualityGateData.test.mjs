import test from 'node:test';
import assert from 'node:assert/strict';
import {aggregateRuns, getQualityGateSnapshot} from '../src/services/qualityGateData.mjs';

const clock = new Date('2026-11-07T07:00:00Z');
test('CI success rate excludes queued, cancelled and skipped results', () => {
  const runs = [
    {created_at:'2026-11-07T06:00:00Z',status:'completed',conclusion:'success'},
    {created_at:'2026-11-06T06:00:00Z',status:'completed',conclusion:'failure'},
    {created_at:'2026-11-06T06:00:00Z',status:'completed',conclusion:'timed_out'},
    {created_at:'2026-11-05T06:00:00Z',status:'in_progress',conclusion:null},
    {created_at:'2026-11-04T06:00:00Z',status:'completed',conclusion:'cancelled'},
    {created_at:'2026-11-04T06:00:00Z',status:'completed',conclusion:'skipped'}
  ];
  const r = aggregateRuns(runs, clock);
  assert.deepEqual([r.total,r.passed,r.failed,r.running,r.excluded,r.successRate],[6,1,2,1,2,33.3]);
  assert.equal(r.history.length,14);
  assert.deepEqual(r.history.at(-1),{day:'2026-11-07',passed:1,failed:0,running:0});
});
test('empty sample returns unknown success rate rather than misleading 0%', () => {
  const r = aggregateRuns([], clock);
  assert.equal(r.successRate,null);
  assert.equal(r.total,0);
});
test('quality adapter returns genuine CI/job snapshots, unmeasured security and coverage stay null', async () => {
  const now = new Date().toISOString();
  const seen=[];
  const fetcher = async url => {
    seen.push(String(url));
    if (url.includes('/actions/workflows/ci.yml/runs')) return new Response(JSON.stringify({workflow_runs:[{id:10,status:'completed',conclusion:'success',created_at:now,head_branch:'main',head_sha:'a'.repeat(40)}]}), {status:200});
    if (url.includes('/actions/runs?')) return new Response(JSON.stringify({workflow_runs:[{id:10,name:'CI · Quality Gate',status:'completed',conclusion:'success',created_at:now,head_branch:'main',head_sha:'a'.repeat(40),html_url:'https://github.com/duykhang68/tetdinhmuiblog/actions/runs/10'}]}), {status:200});
    if (url.includes('/actions/runs/10/jobs')) return new Response(JSON.stringify({jobs:[{id:100,name:'Test and build',status:'completed',conclusion:'success',started_at:now,html_url:'https://github.com/duykhang68/tetdinhmuiblog/actions/runs/10/job/100'}]}),{status:200});
    if (url.includes('quality-gate-report.json')) return new Response('', {status:404});
    return new Response('{}',{status:404});
  };
  const snap=await getQualityGateSnapshot({fetcher});
  assert.equal(snap.ci.passed,1);
  assert.equal(snap.ci.successRate,100);
  assert.equal(snap.jobs.length,1);
  assert.equal(snap.jobs[0].status,'passed');
  assert.equal(snap.coverage.linePercent,null);
  assert.equal(snap.security.critical,null);
  assert.equal(snap.deployment.averageMinutes,null);
  assert.ok(seen.every(url=>!url.includes('access_token=')));
});
