// Transport selection lives in ./transport — Resend when RESEND_API_KEY is
// set, SMTP otherwise. Kept as a re-export so every existing importer of
// `createMailTransporter` / `getFromAddress` works unchanged.
//
// Required env vars:
//   RESEND_API_KEY     - preferred; sends over a DKIM-signed verified domain
//   RESEND_FROM_EMAIL  - e.g. "CardVerseHub <noreply@cardversehub.com>"
// Fallback (used only when RESEND_API_KEY is absent):
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM_EMAIL
export { createMailTransporter, getFromAddress } from './transport';
