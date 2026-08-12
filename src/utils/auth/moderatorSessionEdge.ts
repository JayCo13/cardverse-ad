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

function decodeBase64Url(value: string) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export async function verifyModeratorSessionEdge(value: string | undefined) {
  if (!value) return null;
  const [encoded, suppliedSignature, extra] = value.split('.');
  if (!encoded || !suppliedSignature || extra) return null;

  const secret = process.env.MODERATOR_SESSION_SECRET;
  if (!secret || secret.length < 32) return null;

  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      decodeBase64Url(suppliedSignature),
      new TextEncoder().encode(encoded),
    );
    if (!valid) return null;

    const payload = JSON.parse(
      new TextDecoder().decode(decodeBase64Url(encoded)),
    ) as ModeratorSessionPayload;
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
