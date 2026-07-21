import crypto from 'node:crypto';

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

function base64urlDecode(input) {
  return Buffer.from(input, 'base64url').toString('utf8');
}

export function signToken(payload, secret) {
  const payloadPart = base64url(JSON.stringify(payload));
  const signature = crypto.createHmac('sha256', secret).update(payloadPart).digest('base64url');
  return `${payloadPart}.${signature}`;
}

export function verifyToken(token, secret) {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [payloadPart, signature] = token.split('.');
  if (!payloadPart || !signature) return null;

  const expected = crypto.createHmac('sha256', secret).update(payloadPart).digest('base64url');
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (signatureBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return null;
  }

  let payload;
  try {
    payload = JSON.parse(base64urlDecode(payloadPart));
  } catch {
    return null;
  }

  if (typeof payload.exp !== 'number' || Date.now() > payload.exp) return null;
  return payload;
}

export function requireSigningSecret() {
  const secret = process.env.SESSION_SIGNING_SECRET;
  if (!secret) throw new Error('SESSION_SIGNING_SECRET is not configured.');
  return secret;
}
