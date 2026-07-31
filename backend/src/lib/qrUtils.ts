import crypto from 'crypto';

// ---------------------------------------------------------------------------
// QR payload structure
// ---------------------------------------------------------------------------
// Encoded as: base64(JSON.stringify({ preApprovalId, societyId, timestamp, hmac }))
// hmac = HMAC-SHA256(preApprovalId + '|' + societyId + '|' + timestamp, QR_HMAC_SECRET)
// ---------------------------------------------------------------------------

const QR_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function getSecret(): string {
  const secret = process.env['QR_HMAC_SECRET'];
  if (!secret) {
    throw new Error('QR_HMAC_SECRET environment variable is not set');
  }
  return secret;
}

function computeHmac(preApprovalId: string, societyId: string, timestamp: number): string {
  const message = `${preApprovalId}|${societyId}|${timestamp}`;
  return crypto
    .createHmac('sha256', getSecret())
    .update(message)
    .digest('hex');
}

export interface QrPayload {
  preApprovalId: string;
  societyId: string;
  timestamp: number;
  hmac: string;
}

/**
 * Generate a base64-encoded QR payload for a pre-approval.
 * Timestamp is current unix milliseconds; HMAC covers all three fields.
 */
export function generateQrPayload(preApprovalId: string, societyId: string): string {
  const timestamp = Date.now();
  const hmac = computeHmac(preApprovalId, societyId, timestamp);
  const payload: QrPayload = { preApprovalId, societyId, timestamp, hmac };
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

/**
 * Verify a base64-encoded QR payload.
 * Throws if:
 *   - payload is malformed / not valid JSON
 *   - HMAC does not match (tampered)
 *   - timestamp is older than 24 hours
 *
 * Returns the decoded fields on success.
 */
export function verifyQrPayload(
  encoded: string
): { preApprovalId: string; societyId: string; timestamp: number } {
  let parsed: unknown;
  try {
    const json = Buffer.from(encoded, 'base64').toString('utf8');
    parsed = JSON.parse(json);
  } catch {
    throw new Error('invalid_qr');
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    typeof (parsed as Record<string, unknown>)['preApprovalId'] !== 'string' ||
    typeof (parsed as Record<string, unknown>)['societyId'] !== 'string' ||
    typeof (parsed as Record<string, unknown>)['timestamp'] !== 'number' ||
    typeof (parsed as Record<string, unknown>)['hmac'] !== 'string'
  ) {
    throw new Error('invalid_qr');
  }

  const { preApprovalId, societyId, timestamp, hmac } = parsed as QrPayload;

  // Verify HMAC
  const expected = computeHmac(preApprovalId, societyId, timestamp);
  if (!crypto.timingSafeEqual(Buffer.from(hmac, 'hex'), Buffer.from(expected, 'hex'))) {
    throw new Error('invalid_qr');
  }

  // Check expiry
  if (Date.now() - timestamp > QR_TTL_MS) {
    throw new Error('expired_qr');
  }

  return { preApprovalId, societyId, timestamp };
}
