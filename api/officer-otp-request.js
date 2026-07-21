import crypto from 'node:crypto';
import { signToken, requireSigningSecret } from './_lib/token.js';
import { findActiveOfficer } from './_lib/officers.js';

const OTP_TTL_MS = 5 * 60 * 1000;

function hashOtp(otp) {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

function generateOtp() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

async function sendOtpEmail(email, otp) {
  const serviceId = process.env.EMAILJS_SERVICE_ID || 'service_64qfdcy';
  const templateId = process.env.EMAILJS_OFFICER_TEMPLATE_ID || 'template_j21qmii';
  const publicKey = process.env.EMAILJS_PUBLIC_KEY || 'tNw7hEl-J4y6yRw9w';
  const privateKey = process.env.EMAILJS_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('Officer verification email is not configured. Set EMAILJS_PRIVATE_KEY in Vercel environment variables.');
  }

  const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service_id: serviceId,
      template_id: templateId,
      user_id: publicKey,
      accessToken: privateKey,
      template_params: {
        to_email: email,
        officer_email: email,
        verification_code: otp,
        subject: 'SSAI Officer Verification Code',
        message: [
          'Hello Officer,',
          '',
          `Your verification code is: ${otp}`,
          '',
          'This code expires in 5 minutes.',
          '',
          'If you did not request access, please ignore this email.',
          '',
          'Society for Student AI Innovation (SSAI)'
        ].join('\n')
      }
    })
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Unable to send verification email (${response.status}): ${detail}`);
  }
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

  const email = String(request.body?.email || '').trim();
  if (!email) {
    response.status(400).json({ ok: false, message: 'Email is required.' });
    return;
  }

  const officer = await findActiveOfficer(email);
  if (!officer) {
    response.status(200).json({ ok: false, message: 'This email is not registered as an active SSAI officer.' });
    return;
  }

  const otp = generateOtp();
  const ticket = signToken(
    { email: officer.email.toLowerCase(), otpHash: hashOtp(otp), exp: Date.now() + OTP_TTL_MS },
    secret
  );

  try {
    await sendOtpEmail(officer.email, otp);
  } catch (error) {
    console.error('Officer OTP email send failed', error);
    response.status(502).json({ ok: false, message: error.message || 'Unable to send verification code. Please try again later.' });
    return;
  }

  response.status(200).json({ ok: true, message: 'Verification code sent to the registered officer email.', ticket });
}
