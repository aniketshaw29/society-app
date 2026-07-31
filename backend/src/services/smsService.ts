/**
 * smsService.ts
 *
 * Abstraction over SMS OTP delivery.
 *
 * In production set SMS_PROVIDER to 'msg91' or 'twofactor'.
 * In development / test leave it unset (or 'console') — logs to stdout only.
 */

import https from 'https';
import http from 'http';
import { URL } from 'url';

type SmsProvider = 'msg91' | 'twofactor' | 'console';

function getProvider(): SmsProvider {
  const raw = process.env['SMS_PROVIDER'];
  if (raw === 'msg91' || raw === 'twofactor') return raw;
  return 'console';
}

// ============================================================
// Provider implementations
// ============================================================

/**
 * MSG91 — POST https://api.msg91.com/api/v5/otp
 * Requires: SMS_MSG91_AUTHKEY, SMS_MSG91_TEMPLATE_ID
 */
async function sendViaMSG91(
  phone: string,
  otp: string,
  _guestName: string
): Promise<void> {
  const authkey = process.env['SMS_MSG91_AUTHKEY'];
  const templateId = process.env['SMS_MSG91_TEMPLATE_ID'];

  if (!authkey || !templateId) {
    throw new Error('[smsService] MSG91 requires SMS_MSG91_AUTHKEY and SMS_MSG91_TEMPLATE_ID');
  }

  // Normalise to E.164 (91 prefix for India)
  const e164 = phone.startsWith('91') ? phone : `91${phone}`;

  const payload = JSON.stringify({
    template_id: templateId,
    mobile: e164,
    authkey,
    otp,
  });

  await httpPost('https://api.msg91.com/api/v5/otp', payload, {
    'Content-Type': 'application/json',
    authkey,
  });
}

/**
 * 2Factor — GET https://2factor.in/API/V1/{apikey}/SMS/{phone}/AUTOGEN
 * Requires: SMS_2FACTOR_APIKEY
 */
async function sendVia2Factor(
  phone: string,
  otp: string,
  _guestName: string
): Promise<void> {
  const apikey = process.env['SMS_2FACTOR_APIKEY'];

  if (!apikey) {
    throw new Error('[smsService] 2Factor requires SMS_2FACTOR_APIKEY');
  }

  const e10 = phone.replace(/^91/, '').slice(-10);
  // Use AUTOGEN path — 2Factor generates and sends the OTP; we pass our otp value via OTP1
  const url = `https://2factor.in/API/V1/${apikey}/SMS/${e10}/AUTOGEN/${encodeURIComponent(otp)}`;

  await httpGet(url);
}

/**
 * Console stub — prints OTP to stdout. Safe for dev/test.
 */
function sendViaConsole(phone: string, otp: string, guestName: string): void {
  console.log(
    `[smsService:console] OTP for ${guestName} (${phone}): ${otp}`
  );
}

// ============================================================
// Public API
// ============================================================

/**
 * Send an OTP SMS to the guest's phone number.
 *
 * @param phone     10-digit Indian mobile number (no country code)
 * @param otp       Plain-text 6-digit OTP
 * @param guestName Guest's name (used in SMS template)
 */
export async function sendOtpSms(
  phone: string,
  otp: string,
  guestName: string
): Promise<void> {
  const provider = getProvider();

  try {
    switch (provider) {
      case 'msg91':
        await sendViaMSG91(phone, otp, guestName);
        break;
      case 'twofactor':
        await sendVia2Factor(phone, otp, guestName);
        break;
      case 'console':
      default:
        sendViaConsole(phone, otp, guestName);
    }
  } catch (err) {
    // SMS delivery failure is non-fatal — log and continue.
    // The resident can resend via the UI.
    console.error(`[smsService] Failed to send OTP to ${phone} via ${provider}:`, err);
  }
}

// ============================================================
// Minimal HTTP helpers (no extra deps)
// ============================================================

function httpPost(
  rawUrl: string,
  body: string,
  headers: Record<string, string>
): Promise<void> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(rawUrl);
    const isHttps = parsed.protocol === 'https:';
    const transport = isHttps ? https : http;

    const req = transport.request(
      {
        method: 'POST',
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        headers: {
          ...headers,
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        // Drain response body
        res.resume();
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`[smsService] HTTP ${res.statusCode} from ${parsed.hostname}`));
          } else {
            resolve();
          }
        });
      }
    );

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function httpGet(rawUrl: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(rawUrl);
    const isHttps = parsed.protocol === 'https:';
    const transport = isHttps ? https : http;

    const req = transport.get(
      {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
      },
      (res) => {
        res.resume();
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`[smsService] HTTP ${res.statusCode} from ${parsed.hostname}`));
          } else {
            resolve();
          }
        });
      }
    );

    req.on('error', reject);
  });
}
