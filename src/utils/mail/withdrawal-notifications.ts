import { buildTemplate } from './kyc-notifications';
import { createMailTransporter, getFromAddress } from './transporter';

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export async function sendWithdrawalRejected(input: {
  email: string;
  displayName: string | null;
  amountRequested: number;
  reason: string;
}) {
  try {
    const transporter = createMailTransporter();
    const from = getFromAddress();
    const amount = new Intl.NumberFormat('vi-VN').format(input.amountRequested);
    const name = escapeHtml(input.displayName || 'bạn');
    const reason = escapeHtml(input.reason);
    const walletUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://cardversehub.com'}/wallet`;

    await transporter.sendMail({
      from,
      to: input.email,
      subject: 'Thông báo từ chối yêu cầu rút tiền | CardVerseHub',
      html: buildTemplate(
        'Yêu cầu rút tiền đã bị từ chối',
        `<p>Xin chào <strong style="color:#f97316;">${name}</strong>,</p>
        <p>Yêu cầu rút <strong>${amount}đ</strong> của bạn đã bị từ chối. Khoản tiền tạm giữ đã được hoàn lại vào số dư khả dụng trong ví.</p>
        <div style="background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.25); border-radius:8px; padding:16px; margin:20px 0;">
          <p style="margin:0 0 8px; color:#fca5a5; font-weight:700;">Lý do từ chối</p>
          <p style="margin:0; color:#fecaca;">${reason}</p>
        </div>
        <div style="text-align:center; margin:24px 0;">
          <a href="${walletUrl}" style="display:inline-block; background:#f97316; color:#fff; padding:12px 32px; border-radius:8px; text-decoration:none; font-weight:600; font-size:14px;">Xem ví của tôi →</a>
        </div>`,
      ),
    });
  } catch (error) {
    console.error('[Mail] Failed to send withdrawal rejection email:', error);
  }
}
