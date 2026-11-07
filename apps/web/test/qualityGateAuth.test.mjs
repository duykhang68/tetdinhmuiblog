import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequest} from '../functions/[[path]].js';

const base = 'https://editor.example';
const env = {
  GOOGLE_CLIENT_ID: 'example.apps.googleusercontent.com',
  GOOGLE_CLIENT_SECRET: 'test-only',
  GOOGLE_REDIRECT_URI: base + '/auth/google/callback',
  FRONTEND_ORIGIN: base,
  APP_SECRET: 'a'.repeat(64),
  RESEARCH_GITHUB_TOKEN: 'existing-read-only-token'
};
const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json', ...headers}});

test('Cloudflare Quality Gate respects Google auth, preserves return path and uses server-side research token', async t => {
  const githubHeaders = [];
  const mock = t.mock.method(globalThis, 'fetch', async (input, init = {}) => {
    const url = new URL(String(input));
    if (url.hostname === 'oauth2.googleapis.com')
      return json({access_token: 'google-access', refresh_token: 'google-refresh', expires_in: 3600});
    if (url.hostname === 'api.github.com') {
      githubHeaders.push(init.headers);
      if (url.pathname.endsWith('/actions/workflows/ci.yml/runs') ||
          url.pathname.endsWith('/actions/runs'))
        return json({workflow_runs: []});
      throw Error('Unexpected GitHub URL ' + url.pathname);
    }
    if (url.hostname === 'raw.githubusercontent.com') return new Response('', {status: 404});
    throw Error('Unexpected fetch ' + url);
  });
  const call = (pathname, cookie = '') => onRequest({
    request: new Request(base + pathname, {headers: cookie ? {Cookie: cookie} : {}}),
    env
  });
  try {
    const denied = await call('/api/quality-gate');
    assert.equal(denied.status, 401);
    assert.equal(githubHeaders.length, 0);

    const status = await call('/api/status');
    const visitorCookie = status.headers.get('set-cookie').split(';')[0];
    const start = await call('/auth/google/start?return_to=%2Fquality-gate', visitorCookie);
    assert.equal(start.status, 302);
    const authUrl = new URL(start.headers.get('location'));
    const flowCookie = start.headers.get('set-cookie').split(';')[0];
    const callback = await call('/auth/google/callback?state=' +
      encodeURIComponent(authUrl.searchParams.get('state')) + '&code=ok', flowCookie);
    assert.equal(callback.status, 302);
    assert.equal(callback.headers.get('location'), base + '/quality-gate?connected=1');

    const loggedIn = callback.headers.get('set-cookie').split(';')[0];
    const dashboard = await call('/api/quality-gate', loggedIn);
    assert.equal(dashboard.status, 200);
    const snapshot = await dashboard.json();
    assert.equal(snapshot.repository, 'duykhang68/tetdinhmuiblog');
    assert.ok(githubHeaders.length >= 2);
    assert.ok(githubHeaders.every(headers => headers.Authorization === 'Bearer existing-read-only-token'));
    assert.ok(!JSON.stringify(snapshot).includes('existing-read-only-token'));
  } finally { mock.mock.restore(); }
});

test('GitHub 403 without configured token is not labeled a confirmed rate limit', async () => {
  const {getQualityGateSnapshot} = await import('../src/services/qualityGateData.mjs?missing-token');
  await assert.rejects(
    () => getQualityGateSnapshot({fetcher: async () => json({message: 'Resource not accessible'}, 403)}),
    err => err.code === 'GITHUB_TOKEN_REQUIRED' && err.status === 503 && /GITHUB_TOKEN/.test(err.message)
  );
});

test('GitHub 403 with valid token distinguishes missing Actions permissions', async () => {
  const {getQualityGateSnapshot} = await import('../src/services/qualityGateData.mjs?denied-actions');
  await assert.rejects(
    () => getQualityGateSnapshot({githubToken: 'scoped-token', fetcher: async () =>
      json({message: 'Resource not accessible by integration'}, 403)}),
    err => err.code === 'GITHUB_PERMISSION_DENIED' && /Actions: read/.test(err.message)
  );
});

test('Rate limit headers are recognized and Retry-After is passed through', async () => {
  const {getQualityGateSnapshot} = await import('../src/services/qualityGateData.mjs?rate-limited');
  await assert.rejects(
    () => getQualityGateSnapshot({fetcher: async () =>
      json({message: 'API rate limit exceeded'}, 403, {'x-ratelimit-remaining': '0', 'retry-after': '60'})}),
    err => err.code === 'GITHUB_RATE_LIMIT' && err.retryAfter === '60'
  );
});

test('GitHub 401 reports invalid credentials rather than rate limits', async () => {
  const {getQualityGateSnapshot} = await import('../src/services/qualityGateData.mjs?invalid-token');
  await assert.rejects(
    () => getQualityGateSnapshot({githubToken: 'expired', fetcher: async () =>
      json({message: 'Bad credentials'}, 401)}),
    err => err.code === 'GITHUB_TOKEN_INVALID' && /HTTP 401/.test(err.message)
  );
});
