// All email is delivered by Resend through ./transport. Required:
// RESEND_API_KEY; MAIL_FROM_EMAIL (default support@cardversehub.com, must be on
// the domain verified in Resend) and MAIL_REPLY_TO (where replies land).
export { createMailTransporter, getFromAddress, getSenderEmail, MAX_BCC_PER_MESSAGE } from './transport';
