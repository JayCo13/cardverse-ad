import { createHmac, randomUUID, timingSafeEqual } from 'crypto';

export const MODERATOR_COOKIE_NAME = 'moderator_session';
const MODERATOR_SESSION_VERSION = 1;
const MODERATOR_SESSION_TTL_SECONDS = 60 * 60;

type ModeratorSessionPayload = {
  sid: string;
  role: 'moderator';
  version: number;
  iat: number;
  exp: number;
};

function sessionSecret() {
  const secret = process.env.MODERATOR_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('MODERATOR_SESSION_SECRET must contain at least 32 characters');
  }
  return secret;
}

function signature(payload: string) {
  return createHmac('sha256', sessionSecret()).update(payload).digest('base64url');
}

export function issueModeratorSession() {
  const now = Math.floor(Date.now() / 1000);
  const payload: ModeratorSessionPayload = {
    sid: randomUUID(),
    role: 'moderator',
    version: MODERATOR_SESSION_VERSION,
    iat: now,
    exp: now + MODERATOR_SESSION_TTL_SECONDS,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return {
    value: `${encoded}.${signature(encoded)}`,
    maxAge: MODERATOR_SESSION_TTL_SECONDS,
    payload,
  };
}

export function verifyModeratorSession(value: string | undefined) {
  if (!value) return null;
  const [encoded, suppliedSignature, extra] = value.split('.');
  if (!encoded || !suppliedSignature || extra) return null;

  let expectedSignature: string;
  try {
    expectedSignature = signature(encoded);
  } catch {
    return null;
  }

  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(expectedSignature);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as ModeratorSessionPayload;
    const now = Math.floor(Date.now() / 1000);
    if (
      payload.role !== 'moderator'
      || payload.version !== MODERATOR_SESSION_VERSION
      || !payload.sid
      || !Number.isSafeInteger(payload.iat)
      || !Number.isSafeInteger(payload.exp)
      || payload.iat > now + 60
      || payload.exp <= now
      || payload.exp - payload.iat > MODERATOR_SESSION_TTL_SECONDS
    ) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
