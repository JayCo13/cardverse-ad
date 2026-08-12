import assert from 'node:assert/strict';
import test from 'node:test';
import {
  issueModeratorSession,
  verifyModeratorSession,
} from '../src/utils/auth/moderatorSession.ts';
import { verifyModeratorSessionEdge } from '../src/utils/auth/moderatorSessionEdge.ts';

const originalSecret = process.env.MODERATOR_SESSION_SECRET;

test.after(() => {
  if (originalSecret === undefined) delete process.env.MODERATOR_SESSION_SECRET;
  else process.env.MODERATOR_SESSION_SECRET = originalSecret;
});

test('accepts only an untampered, signed, unexpired moderator cookie', () => {
  process.env.MODERATOR_SESSION_SECRET = 'test-only-secret-with-at-least-32-characters';
  const session = issueModeratorSession();
  const verified = verifyModeratorSession(session.value);
  assert.equal(verified?.sid, session.payload.sid);
  assert.equal(verified?.role, 'moderator');

  const [payload, signature] = session.value.split('.');
  const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  decoded.role = 'admin';
  const forgedPayload = Buffer.from(JSON.stringify(decoded)).toString('base64url');
  assert.equal(verifyModeratorSession(`${forgedPayload}.${signature}`), null);
  assert.equal(verifyModeratorSession(`${payload}.${signature.slice(0, -1)}x`), null);
  assert.equal(verifyModeratorSession('moderator_session=true'), null);
});

test('fails closed when the signing secret is missing or too short', () => {
  delete process.env.MODERATOR_SESSION_SECRET;
  assert.throws(() => issueModeratorSession(), /at least 32 characters/);
  process.env.MODERATOR_SESSION_SECRET = 'short';
  assert.throws(() => issueModeratorSession(), /at least 32 characters/);
  assert.equal(verifyModeratorSession('payload.signature'), null);
});

test('edge middleware verifier rejects legacy and forged cookies', async () => {
  process.env.MODERATOR_SESSION_SECRET = 'test-only-secret-with-at-least-32-characters';
  const session = issueModeratorSession();
  assert.equal((await verifyModeratorSessionEdge(session.value))?.sid, session.payload.sid);
  assert.equal(await verifyModeratorSessionEdge('true'), null);
  assert.equal(await verifyModeratorSessionEdge('moderator_session=true'), null);

  const [payload, signature] = session.value.split('.');
  assert.equal(await verifyModeratorSessionEdge(`${payload}.${signature.slice(0, -1)}x`), null);
});
