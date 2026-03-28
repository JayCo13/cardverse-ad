import nodemailer from 'nodemailer';

// SMTP Configuration using environment variables
// Required env vars:
//   SMTP_HOST       - e.g. smtp.gmail.com
//   SMTP_PORT       - e.g. 587
//   SMTP_USER       - e.g. your-email@gmail.com
//   SMTP_PASSWORD   - e.g. your app password
//   SMTP_FROM_EMAIL - e.g. "CardVerse <noreply@cardverse.com>"
export function createMailTransporter() {
    return nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: parseInt(process.env.SMTP_PORT || '587', 10) === 465,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD,
        },
    });
}

export function getFromAddress() {
    return process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || 'noreply@cardverse.com';
}
