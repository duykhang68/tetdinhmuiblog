import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequest} from '../functions/[[path]].js';

const base='https://editor.example';
const env={
  GOOGLE_CLIENT_ID:'test-client.apps.googleusercontent.com',
  GOOGLE_CLIENT_SECRET:'test-secret-only',
  GOOGLE_REDIRECT_URI:base+'/auth/google/callback',
  FRONTEND_ORIGIN:base,
  APP_SECRET:'a'.repeat(64),
  GITHUB_TOKEN:'example-github-token'
};
const json=(body,status=200,headers={})=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json',...headers}});
const issue={number:35,title:'[RESEARCHER] CI-86CFBCD21AE0 · CI-CHECK-FAILED',
  body:'- Error code: CI-CHECK-FAILED',created_at:'2026-11-07T01:00:00Z',
  updated_at:'2026-11-07T01:00:00Z',state:'open',comments:0,
  html_url:'https://github.com/duykhang68/tetdinhmuiblog/issues/35'};

async function connectedCookie() {
  const call=(pathname,cookie='')=>onRequest({
    request:new Request(base+pathname,{headers:cookie?{Cookie:cookie}:{}}),env
  });
  const initial=await call('/api/status');
  const cookie=initial.headers.get('set-cookie').split(';')[0];
  const started=await call('/auth/google/start?return_to=research-insights',cookie);
  const url=new URL(started.headers.get('location'));
  const flowCookie=started.headers.get('set-cookie').split(';')[0];
  const completed=await call('/auth/google/callback?state='+encodeURIComponent(url.searchParams.get('state'))+'&code=ok',flowCookie);
  assert.equal(completed.status,302);
  return completed.headers.get('set-cookie').split(';')[0];
}
test('Cloudflare Insights reuses existing GITHUB_TOKEN with OAuth and reads both actual sources',async t=>{
  const githubCalls=[];
  const mocked=t.mock.method(globalThis,'fetch',async (url, options={})=>{
    if(String(url)==='https://oauth2.googleapis.com/token')
      return json({access_token:'google-test',refresh_token:'refresh-test',expires_in:3600});
    if(String(url).startsWith('https://api.github.com/')){
      githubCalls.push(options.headers);
      assert.equal(options.headers.Authorization,'Bearer example-github-token');
      if(String(url).includes('/issues?')) return json([issue]);
      if(String(url).includes('/actions/runs?'))return json({workflow_runs:[{status:'in_progress'},{status:'completed',conclusion:'success'}],total_count:2});
    }
    throw Error('Unexpected URL '+url);
  });
  try {
    const cookie=await connectedCookie();
    const response=await onRequest({request:new Request(base+'/api/research-insights',{headers:{Cookie:cookie}}),env});
    const body=await response.json();
    assert.equal(response.status,200);
    assert.equal(body.partial,false);
    assert.equal(body.kpis.totalResearch,1);
    assert.equal(body.kpis.activePipelines,1);
    assert.equal(body.kpis.successRate,100);
    assert.equal(body.sources.issues.ok,true);
    assert.equal(body.sources.actions.ok,true);
    assert.equal(JSON.stringify(body).includes('example-github-token'),false);
    assert.equal(githubCalls.length,2);
  }finally{mocked.mock.restore();}
});
test('Cloudflare GitHub rate-limit failures return source diagnostics instead of generic HTTP 500',async t=>{
  const mocked=t.mock.method(globalThis,'fetch',async url=>{
    if(String(url)==='https://oauth2.googleapis.com/token')
      return json({access_token:'google-test',refresh_token:'refresh-test',expires_in:3600});
    if(String(url).startsWith('https://api.github.com/'))
      return json({message:'API rate limit exceeded'},403,{'x-ratelimit-remaining':'0'});
    throw Error('Unexpected URL '+url);
  });
  try {
    const cookie=await connectedCookie();
    const response=await onRequest({request:new Request(base+'/api/research-insights',{headers:{Cookie:cookie}}),env});
    const body=await response.json();
    assert.equal(response.status,200);
    assert.equal(body.partial,true);
    assert.equal(body.kpis.totalResearch,null);
    assert.equal(body.sources.issues.code,'GH_RATE_LIMIT');
    assert.equal(body.sources.actions.code,'GH_RATE_LIMIT');
  }finally{mocked.mock.restore();}
});
