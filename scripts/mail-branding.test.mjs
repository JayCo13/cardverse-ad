import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const root = new URL('../', import.meta.url);
const sender = 'CardVerseHub <cardversehubsupport@gmail.com>';
const logo = 'https://cardversehub.com/assets/logo-verse.png';

// Execute real mail builders and transport without secrets or network access.
function harness(overrides = {}) {
  const env = { SMTP_USER: 'cardversehubsupport@gmail.com', SMTP_PASSWORD: 'test-password',
    RESEND_API_KEY: 'stale-key', RESEND_FROM_EMAIL: 'CardVerse <noreply@cardversehub.com>',
    SMTP_FROM_EMAIL: 'CardVerse <broken@gmail.com@gmail.com>', NEXT_PUBLIC_APP_URL: 'http://localhost:3000', ...overrides };
  const sent = [];
  const configs = [];
  const nodemailer = { createTransport(config) {
    configs.push(config);
    return { async sendMail(message) { sent.push(message); return { messageId: 'test' }; } };
  } };
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
      console, Response, Date, setTimeout: (fn) => fn(),
      Deno: { env: { get: (key) => env[key] }, serve: (handler) => { cache.set('handler', handler); } },
      require(name) {
        if (name in mocks) return mocks[name];
        if (name === 'nodemailer' || name.startsWith('npm:nodemailer@')) return nodemailer;
        if (name.startsWith('.')) return load(new URL(name.endsWith('.ts') ? name : `${name}.ts`, url).href);
        throw new Error(`Unexpected dependency: ${name}`);
      },
    }, { filename });
    cache.set(filename, mod.exports);
    return mod.exports;
  }
  return { env, sent, configs, load, cache };
}

const transportPath = 'src/utils/mail/transport.ts';

test('legacy Resend/from settings and caller From cannot override Gmail identity; BCC stays private', async () => {
  const h = harness();
  const mail = h.load(transportPath);
  assert.equal(mail.getFromAddress(), sender);
  const transport = mail.createMailTransporter();
  await transport.sendMail({ from: 'CardVerse <noreply@cardversehub.com>', bcc: ['one@example.test', 'two@example.test'], subject: 'Reminder', html: 'test' });
  assert.equal(h.sent[0].from, sender);
  assert.equal(h.sent[0].to, undefined);
  assert.deepEqual(h.sent[0].bcc, ['one@example.test', 'two@example.test']);
  assert.equal(h.configs[0].host, 'smtp.gmail.com');
  assert.equal(h.configs[0].auth.user, 'cardversehubsupport@gmail.com');
  assert.equal(h.configs[0].requireTLS, true);
  assert.equal(await transport.sendMail({ from: sender, to: ' ', subject: 'Empty', html: '' }), null);
  assert.equal(h.sent.length, 1);
});

test('missing credentials, malformed/wrong account and non-Gmail SMTP fail without provider fallback', () => {
  for (const overrides of [
    { SMTP_USER: undefined }, { SMTP_USER: 'noreply@cardversehub.com' },
    { SMTP_USER: 'cardversehubsupport@gmail.com@gmail.com' }, { SMTP_PASSWORD: '' },
    { SMTP_HOST: 'other.example.test' }, { SMTP_PORT: '587garbage' },
  ]) {
    const h = harness(overrides);
    assert.throws(() => h.load(transportPath).createMailTransporter(), /Configure|requires/);
    assert.equal(h.configs.length, 0);
  }
  const h = harness({ SMTP_PORT: '465' });
  h.load(transportPath).createMailTransporter();
  assert.equal(h.configs[0].secure, true);
});

function assertBranded(message) {
  assert.equal(message.from, sender);
  assert.ok(message.html.includes(`src="${logo}"`));
  assert.ok(message.html.includes('alt="CardVerseHub"'));
}

test('admin KYC, refund and withdrawal email builders share the Gmail identity and logo', async () => {
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
  for (const recipients of [['buyer@example.test'], ['buyer@example.test', 'seller@example.test']]) {
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
    assert.equal(h.sent.length, 1);
    assertBranded(h.sent[0]);
    if (recipients.length > 1) {
      assert.equal(h.sent[0].to, undefined);
      assert.equal(h.sent[0].bcc, recipients.join(', '));
    } else assert.equal(h.sent[0].to, recipients[0]);
    assert.equal(log[0].sent_count, recipients.length);
  }
});
