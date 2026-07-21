import { verifyToken, requireSigningSecret } from './_lib/token.js';
import { isAuthorizedForPath } from './_lib/roles.js';

const allowedMethods = new Set(['GET', 'PUT', 'DELETE']);

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.status(405).send('Method not allowed');
    return;
  }

  const token = process.env.GITHUB_CMS_TOKEN || process.env.CMS_TOKEN || process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  if (!token) {
    response.status(500).send('GitHub CMS token is not configured. Set GITHUB_CMS_TOKEN in Vercel environment variables.');
    return;
  }

  let secret;
  try {
    secret = requireSigningSecret();
  } catch {
    response.status(500).send('Session signing secret is not configured. Set SESSION_SIGNING_SECRET in Vercel environment variables.');
    return;
  }

  const authHeader = request.headers?.authorization || request.headers?.Authorization || '';
  const bearerMatch = /^Bearer (.+)$/.exec(authHeader);
  const session = bearerMatch ? verifyToken(bearerMatch[1], secret) : null;
  if (!session || typeof session.role !== 'string') {
    console.warn('GitHub CMS request rejected: missing or invalid officer session token');
    response.status(401).send('Missing or invalid officer session.');
    return;
  }

  const { owner, repo, branch, path, init } = request.body ?? {};
  const method = init?.method ?? 'GET';
  if (!owner || !repo || !branch || !path || !allowedMethods.has(method)) {
    response.status(400).send('Invalid GitHub CMS request.');
    return;
  }

  if (!isAuthorizedForPath(path, session.role)) {
    console.warn(`GitHub CMS request rejected: role "${session.role}" is not authorized for path "${path}"`);
    response.status(403).send('Officer role is not authorized to modify this content.');
    return;
  }

  const encodedPath = encodeURIComponent(path).replace(/%2F/g, '/');
  const refQuery = method === 'GET' ? `?ref=${encodeURIComponent(branch)}` : '';
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodedPath}${refQuery}`;
  const githubResponse = await fetch(url, {
    method,
    body: init?.body,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28'
    }
  });

  const body = await githubResponse.text();
  response.status(githubResponse.status);
  response.setHeader('Content-Type', githubResponse.headers.get('content-type') || 'application/json');
  response.send(body);
}
