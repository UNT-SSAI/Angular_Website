import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import handler from './github-cms.js';
import { signToken } from './_lib/token.js';

const originalFetch = globalThis.fetch;
const tokenEnvNames = ['GITHUB_CMS_TOKEN', 'CMS_TOKEN', 'GH_TOKEN', 'GITHUB_TOKEN'];
const originalTokenEnv = Object.fromEntries(tokenEnvNames.map((name) => [name, process.env[name]]));

const TEST_SECRET = 'test-signing-secret';
process.env.SESSION_SIGNING_SECRET = TEST_SECRET;

function sessionToken(overrides = {}) {
  return signToken({ email: 'officer@ssai.org', role: 'Super Admin', exp: Date.now() + 60000, ...overrides }, TEST_SECRET);
}

function authHeaders(token) {
  return { authorization: `Bearer ${token}` };
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const name of tokenEnvNames) {
    if (originalTokenEnv[name] === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = originalTokenEnv[name];
    }
  }
});

function responseRecorder() {
  const state = { statusCode: 0, headers: {}, body: '' };
  return {
    state,
    status(code) {
      state.statusCode = code;
      return this;
    },
    setHeader(name, value) {
      state.headers[name] = value;
    },
    send(body) {
      state.body = body;
    }
  };
}

function githubOkResponse() {
  return {
    status: 200,
    headers: {
      get(name) {
        return name.toLowerCase() === 'content-type' ? 'application/json' : null;
      }
    },
    async text() {
      return JSON.stringify({ ok: true });
    }
  };
}

async function runCmsRequest(init, headers = authHeaders(sessionToken()), path = 'public/assets/data/events.json') {
  const calls = [];
  for (const name of tokenEnvNames) delete process.env[name];
  process.env.GITHUB_CMS_TOKEN = 'test-token';
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return githubOkResponse();
  };
  const response = responseRecorder();
  await handler({
    method: 'POST',
    headers,
    body: {
      owner: 'sesha456',
      repo: 'SSAI_Website',
      branch: 'main',
      path,
      init
    }
  }, response);
  return { calls, response: response.state };
}

test('GET requests include the branch as a ref query', async () => {
  const { calls, response } = await runCmsRequest({ method: 'GET' });

  assert.equal(response.statusCode, 200);
  assert.equal(calls[0].url, 'https://api.github.com/repos/sesha456/SSAI_Website/contents/public/assets/data/events.json?ref=main');
  assert.equal(calls[0].options.method, 'GET');
});

test('PUT requests do not include a ref query', async () => {
  const body = JSON.stringify({ message: 'Update events', content: 'W10=', branch: 'main', sha: 'abc123' });
  const { calls, response } = await runCmsRequest({ method: 'PUT', body });

  assert.equal(response.statusCode, 200);
  assert.equal(calls[0].url, 'https://api.github.com/repos/sesha456/SSAI_Website/contents/public/assets/data/events.json');
  assert.equal(calls[0].options.method, 'PUT');
  assert.equal(calls[0].options.body, body);
});

test('DELETE requests do not include a ref query', async () => {
  const body = JSON.stringify({ message: 'Delete media', branch: 'main', sha: 'abc123' });
  const { calls, response } = await runCmsRequest({ method: 'DELETE', body });

  assert.equal(response.statusCode, 200);
  assert.equal(calls[0].url, 'https://api.github.com/repos/sesha456/SSAI_Website/contents/public/assets/data/events.json');
  assert.equal(calls[0].options.method, 'DELETE');
  assert.equal(calls[0].options.body, body);
});

test('CMS_TOKEN alias is accepted when GITHUB_CMS_TOKEN is absent', async () => {
  delete process.env.GITHUB_CMS_TOKEN;
  process.env.CMS_TOKEN = 'alias-token';
  let authorization = '';
  globalThis.fetch = async (_url, options) => {
    authorization = options.headers.Authorization;
    return githubOkResponse();
  };
  const recorder = responseRecorder();

  await handler({
    method: 'POST',
    headers: authHeaders(sessionToken()),
    body: {
      owner: 'sesha456',
      repo: 'SSAI_Website',
      branch: 'main',
      path: 'public/assets/data/events.json',
      init: { method: 'GET' }
    }
  }, recorder);

  assert.equal(recorder.state.statusCode, 200);
  assert.equal(authorization, 'Bearer alias-token');
});

test('request with no session token is rejected with 401', async () => {
  const { calls, response } = await runCmsRequest({ method: 'GET' }, {});

  assert.equal(response.statusCode, 401);
  assert.equal(calls.length, 0);
});

test('request with expired session token is rejected with 401', async () => {
  const expired = sessionToken({ exp: Date.now() - 1000 });
  const { calls, response } = await runCmsRequest({ method: 'GET' }, authHeaders(expired));

  assert.equal(response.statusCode, 401);
  assert.equal(calls.length, 0);
});

test('request with a tampered session token signature is rejected with 401', async () => {
  const token = sessionToken();
  const tampered = `${token.split('.')[0]}.not-the-real-signature`;
  const { calls, response } = await runCmsRequest({ method: 'GET' }, authHeaders(tampered));

  assert.equal(response.statusCode, 401);
  assert.equal(calls.length, 0);
});

test('valid token with a role not authorized for the path is rejected with 403', async () => {
  const token = sessionToken({ role: 'Event Coordinator' });
  const { calls, response } = await runCmsRequest(
    { method: 'PUT', body: '{}' },
    authHeaders(token),
    'public/assets/data/officers.json'
  );

  assert.equal(response.statusCode, 403);
  assert.equal(calls.length, 0);
});

test('valid Super Admin token can write officers.json', async () => {
  const { calls, response } = await runCmsRequest(
    { method: 'PUT', body: '{}' },
    authHeaders(sessionToken({ role: 'Super Admin' })),
    'public/assets/data/officers.json'
  );

  assert.equal(response.statusCode, 200);
  assert.equal(calls.length, 1);
});
