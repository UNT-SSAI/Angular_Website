import crypto from 'node:crypto';
import { signToken, verifyToken, requireSigningSecret } from './_lib/token.js';
import { findActiveOfficer } from './_lib/officers.js';

const SESSION_TTL_MS = 10 * 60 * 1000;

function hashOtp(otp) {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.status(405).json({ ok: false, message: 'Method not allowed' });
    return;
  }

  let secret;
  try {
    secret = requireSigningSecret();
  } catch (error) {
    response.status(500).json({ ok: false, message: error.message });
    return;
  }

  const email = String(request.body?.email || '').trim().toLowerCase();
  const otp = String(request.body?.otp || '').trim();
  const ticket = String(request.body?.ticket || '');

  const ticketPayload = verifyToken(ticket, secret);
  if (!ticketPayload || ticketPayload.email !== email || typeof ticketPayload.otpHash !== 'string') {
    response.status(401).json({ ok: false, message: 'Verification code has expired. Please request a new code.' });
    return;
  }

  const expectedHash = Buffer.from(ticketPayload.otpHash);
  const suppliedHash = Buffer.from(hashOtp(otp));
  if (expectedHash.length !== suppliedHash.length || !crypto.timingSafeEqual(expectedHash, suppliedHash)) {
    response.status(401).json({ ok: false, message: 'Invalid verification code.' });
    return;
  }

  const officer = await findActiveOfficer(email);
  if (!officer) {
    response.status(401).json({ ok: false, message: 'This email is not registered as an active SSAI officer.' });
    return;
  }

  const now = Date.now();
  const token = signToken({ email: officer.email, role: officer.role, name: officer.name, iat: now, exp: now + SESSION_TTL_MS }, secret);

  response.status(200).json({
    ok: true,
    token,
    session: {
      isOfficer: true,
      name: officer.name,
      role: officer.role,
      email: officer.email,
      loginTime: new Date(now).toISOString(),
      expiresAt: new Date(now + SESSION_TTL_MS).toISOString()
    }
  });
}
