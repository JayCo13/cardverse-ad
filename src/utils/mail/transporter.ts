// All email uses the CardVerseHub Gmail identity via ./transport.
// Required: SMTP_USER=cardversehubsupport@gmail.com and SMTP_PASSWORD.
// Optional: SMTP_HOST=smtp.gmail.com and SMTP_PORT=587 (or 465).
// Legacy RESEND_* and SMTP_FROM_EMAIL settings do not override the sender.
export { createMailTransporter, getFromAddress } from './transport';
