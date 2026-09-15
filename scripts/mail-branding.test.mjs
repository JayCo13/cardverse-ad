import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const root = new URL('../', import.meta.url);
const resendSender = 'CardVerseHub <support@cardversehub.com>';
const replyTo = 'cardversehub.vn@gmail.com';
const logo = 'https://cardversehub.com/assets/logo-verse.png';

// Execute real mail builders and transport without secrets or network access:
// the transport posts to the Resend API, captured by the fetch mock.
function harness(overrides = {}) {
  const env = { RESEND_API_KEY: 're_test_key', MAIL_REPLY_TO: replyTo,
    RESEND_FROM_EMAIL: 'CardVerse <noreply@cardversehub.com>', NEXT_PUBLIC_APP_URL: 'http://localhost:3000', ...overrides };
  const sent = [];
  const requests = [];
  let resendResponse = () => ({ ok: true, status: 200, json: async () => ({ id: 'resend-id' }) });
  const fetch = async (url, init) => {
    const message = JSON.parse(init.body);
    requests.push({ url, headers: init.headers, message });
    const response = resendResponse(message);
    if (response.ok) sent.push(message);
    return response;
  };
  const cache = new Map();
  function load(path, mocks = {}) {
    const url = new URL(path, root);
    const filename = fileURLToPath(url);
    if (cache.has(filename)) return cache.get(filename);
    const { outputText } = ts.transpileModule(readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }, fileName: filename,
    });
    const mod = { exports: {} };
    runInNewContext(outputText, { module: mod, exports: mod.exports, process: { env },
      // Short delays run immediately; the transport's 10s abort timer is never fired.
      console, Response, Date, fetch, AbortController, setTimeout: (fn, ms) => (ms < 10_000 && fn(), 0), clearTimeout: () => {},
      Deno: { env: { get: (key) => env[key] }, serve: (handler) => { cache.set('handler', handler); } },
      require(name) {
        if (name in mocks) return mocks[name];
        if (name.startsWith('.')) return load(new URL(name.endsWith('.ts') ? name : `${name}.ts`, url).href);
        throw new Error(`Unexpected dependency: ${name}`);
      },
    }, { filename });
    cache.set(filename, mod.exports);
    return mod.exports;
  }
  return { env, sent, requests, load, cache, failResend(response) { resendResponse = () => response; } };
}

const transportPath = 'src/utils/mail/transport.ts';

test('Resend delivers from the verified domain, overrides caller From, replies to Gmail and adds plain text', async () => {
  const h = harness();
  const mail = h.load(transportPath);
  assert.equal(mail.getFromAddress(), resendSender);
  assert.equal(mail.getSenderEmail(), 'support@cardversehub.com');
  const transport = mail.createMailTransporter();
  const result = await transport.sendMail({ from: 'CardVerse <noreply@cardversehub.com>', to: 'buyer@example.test', subject: 'Reminder', html: '<p>Hello &amp; <a href="https://cardversehub.com">welcome</a></p>' });
  assert.equal(result.id, 'resend-id');
  assert.equal(h.requests[0].url, 'https://api.resend.com/emails');
  assert.equal(h.requests[0].headers.Authorization, 'Bearer re_test_key');
  const message = h.sent[0];
  assert.equal(message.from, resendSender);
  assert.deepEqual(message.to, ['buyer@example.test']);
  assert.equal(message.bcc, undefined);
  assert.equal(message.reply_to, replyTo);
  assert.equal(message.text, 'Hello & welcome (https://cardversehub.com)');
  assert.equal(await transport.sendMail({ from: resendSender, to: ' ', subject: 'Empty', html: '' }), null);
  assert.equal(h.sent.length, 1);
});

test('Resend bcc-only fan-out addresses the sender and keeps recipients private; MAIL_* env overrides apply', async () => {
  const h = harness({ MAIL_FROM_EMAIL: 'Hello@CardVerseHub.com', MAIL_REPLY_TO: 'team@example.test' });
  const transport = h.load(transportPath).createMailTransporter();
  await transport.sendMail({ from: 'CardVerse <old@gmail.com>', bcc: 'one@example.test, two@example.test', subject: 'News', html: 'test' });
  assert.equal(h.sent[0].from, 'CardVerseHub <hello@cardversehub.com>');
  assert.deepEqual(h.sent[0].to, ['CardVerseHub <hello@cardversehub.com>']);
  assert.deepEqual(h.sent[0].bcc, ['one@example.test', 'two@example.test']);
  assert.equal(h.sent[0].reply_to, 'team@example.test');
});

test('Resend rejects senders outside cardversehub.com and surfaces API failures with the subject', async () => {
  const wrongDomain = harness({ MAIL_FROM_EMAIL: 'noreply@gmail.com' }).load(transportPath);
  assert.throws(() => wrongDomain.getFromAddress(), /MAIL_FROM_EMAIL/);
  await assert.rejects(wrongDomain.createMailTransporter().sendMail({ from: '', to: 'a@example.test', subject: 'x', html: 'x' }), /MAIL_FROM_EMAIL/);
  const h = harness();
  h.failResend({ ok: false, status: 403, json: async () => ({ statusCode: 403, name: 'validation_error', message: 'domain is not verified' }) });
  await assert.rejects(
    h.load(transportPath).createMailTransporter().sendMail({ from: resendSender, to: 'buyer@example.test', subject: 'Reminder', html: 'test' }),
    /Resend send failed to="buyer@example.test" bcc=0 subject="Reminder" :: 403 validation_error domain is not verified/,
  );
  assert.equal(h.sent.length, 0);
});

test('Resend recipient cap: 49 bcc fits with the sender slot, 50 bcc is refused before any request', async () => {
  const h = harness();
  const mail = h.load(transportPath);
  assert.equal(mail.MAX_BCC_PER_MESSAGE, 49);
  const transport = mail.createMailTransporter();
  const many = (n) => Array.from({ length: n }, (_, i) => `sub${i}@example.test`);
  await transport.sendMail({ from: resendSender, bcc: many(49), subject: 'News', html: 'x' });
  assert.equal(h.sent[0].to.length + h.sent[0].bcc.length, 50);
  await assert.rejects(transport.sendMail({ from: resendSender, bcc: many(50), subject: 'News', html: 'x' }), /51 recipients exceeds the 50 per-message cap/);
  await assert.rejects(transport.sendMail({ from: resendSender, to: many(2), bcc: many(49), subject: 'News', html: 'x' }), /exceeds/);
  assert.equal(h.requests.length, 1);
});

test('missing RESEND_API_KEY fails before any send', async () => {
  for (const key of [undefined, '', '  ']) {
    const h = harness({ RESEND_API_KEY: key });
    assert.throws(() => h.load(transportPath).createMailTransporter(), /RESEND_API_KEY/);
    assert.equal(h.requests.length, 0);
  }
});

function assertBranded(message) {
  assert.equal(message.from, resendSender);
  assert.equal(message.reply_to, replyTo);
  assert.ok(message.text.length > 0);
  assert.ok(message.html.includes(`src="${logo}"`));
  assert.ok(message.html.includes('alt="CardVerseHub"'));
}

test('admin KYC, refund and withdrawal email builders share the Resend identity and logo', async () => {
  const h = harness();
  const kyc = h.load('src/utils/mail/kyc-notifications.ts');
  await kyc.sendKYCApproved('buyer@example.test', 'Buyer');
  await kyc.sendKYCRejected('buyer@example.test', 'Buyer', 'Reason');
  await h.load('src/utils/mail/order-notifications.ts').sendOrderRefundEmails({ buyerEmail: 'buyer@example.test', sellerEmail: 'seller@example.test', cardName: 'Card', amount: 10000, orderId: '12345678' });
  await h.load('src/utils/mail/withdrawal-notifications.ts').sendWithdrawalRejected({ email: 'seller@example.test', displayName: 'Seller', amountRequested: 10000, reason: 'Reason' });
  assert.equal(h.sent.length, 5);
  h.sent.forEach(assertBranded);
});

test('subscriber route preserves authorization, individual recipients and private bulk delivery', async () => {
  const hundred = Array.from({ length: 100 }, (_, i) => `sub${i}@example.test`);
  for (const recipients of [['buyer@example.test'], ['buyer@example.test', 'seller@example.test'], hundred]) {
    const h = harness();
    let role = null;
    const log = [];
    const route = h.load('src/app/api/subscribers/mail/route.ts', {
      'next/server': { NextResponse: { json: (data, init) => new Response(JSON.stringify(data), init) } },
      '@/utils/auth/getRole': { getRole: async () => role },
      '@/utils/supabase/admin': { createAdminClient: () => ({ from: () => ({ insert: async row => { log.push(row); return {}; } }) }) },
      '@/utils/mail/transporter': h.load('src/utils/mail/transporter.ts'),
    });
    const request = () => new Request('https://example.test', { method: 'POST', body: JSON.stringify({ recipients, subject: 'News', message: 'Hello' }) });
    assert.equal((await route.POST(request())).status, 403);
    assert.equal(h.sent.length, 0);
    role = 'admin';
    assert.equal((await route.POST(request())).status, 200);
    h.sent.forEach(assertBranded);
    if (recipients.length > 2) {
      // Batched under Resend's 50-address cap, sender included: 49 + 49 + 2.
      assert.deepEqual(h.sent.map((m) => m.bcc.length), [49, 49, 2]);
      for (const m of h.sent) assert.ok(m.to.length + m.bcc.length <= 50);
      assert.deepEqual(h.sent.flatMap((m) => m.bcc), recipients);
    } else if (recipients.length > 1) {
      assert.equal(h.sent.length, 1);
      assert.deepEqual(h.sent[0].to, [resendSender]);
      assert.deepEqual(h.sent[0].bcc, recipients);
    } else {
      assert.equal(h.sent.length, 1);
      assert.deepEqual(h.sent[0].to, recipients);
    }
    assert.equal(log[0].sent_count, recipients.length);
    assert.equal(log[0].failed_count, 0);
    assert.equal(log[0].sent_by, 'admin:support@cardversehub.com');
  }
});
