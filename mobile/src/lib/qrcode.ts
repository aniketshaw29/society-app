// ---------------------------------------------------------------------------
// Client-side QR payload handling
// Used in scanner callbacks — never throws, returns null on any error
// ---------------------------------------------------------------------------

export interface DecodedQrPayload {
  preApprovalId: string;
  societyId: string;
  timestamp: number;
}

/**
 * Decode a base64 QR payload string without cryptographic verification.
 * The server performs HMAC verification on POST /pre-approvals/verify-qr.
 *
 * Returns null for any malformed input — safe to call in scanner callbacks.
 */
export function decodeQrPayload(payload: string): DecodedQrPayload | null {
  try {
    const json = Buffer.from(payload, 'base64').toString('utf8');
    const parsed = JSON.parse(json) as unknown;

    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof (parsed as Record<string, unknown>)['preApprovalId'] !== 'string' ||
      typeof (parsed as Record<string, unknown>)['societyId'] !== 'string' ||
      typeof (parsed as Record<string, unknown>)['timestamp'] !== 'number'
    ) {
      return null;
    }

    const obj = parsed as Record<string, unknown>;
    return {
      preApprovalId: obj['preApprovalId'] as string,
      societyId: obj['societyId'] as string,
      timestamp: obj['timestamp'] as number,
    };
  } catch {
    return null;
  }
}
