import { createMailTransporter, getFromAddress } from './transporter';

function buildTemplate(title: string, body: string) {
    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0a0a0a;">
        <tr>
            <td align="center" style="padding: 40px 20px;">
                <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #18181b; border-radius: 16px; border: 1px solid rgba(255,255,255,0.05); overflow: hidden;">
                    <!-- Header -->
                    <tr>
                        <td style="padding: 32px 40px; background: linear-gradient(135deg, rgba(249,115,22,0.15), transparent); border-bottom: 1px solid rgba(255,255,255,0.05);">
                            <h1 style="margin: 0; color: #f97316; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">CardVerse</h1>
                        </td>
                    </tr>
                    <!-- Subject -->
                    <tr>
                        <td style="padding: 32px 40px 16px;">
                            <h2 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 600;">${title}</h2>
                        </td>
                    </tr>
                    <!-- Body -->
                    <tr>
                        <td style="padding: 0 40px 32px;">
                            <div style="color: #a1a1aa; font-size: 15px; line-height: 1.7;">
                                ${body}
                            </div>
                        </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                        <td style="padding: 24px 40px; background-color: rgba(0,0,0,0.3); border-top: 1px solid rgba(255,255,255,0.05);">
                            <p style="margin: 0; color: #52525b; font-size: 12px; text-align: center;">
                                &copy; ${new Date().getFullYear()} CardVerse. All rights reserved.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;
}

export async function sendKYCApproved(userEmail: string, fullName: string) {
    try {
        const transporter = createMailTransporter();
        const from = getFromAddress();

        await transporter.sendMail({
            from,
            to: userEmail,
            subject: '✅ Hồ sơ KYC đã được duyệt — CardVerse',
            html: buildTemplate(
                '✅ Xác minh thành công!',
                `<p style="color: #e4e4e7;">Xin chào <strong style="color: #f97316;">${fullName}</strong>,</p>
                <p>Hồ sơ xác minh người bán của bạn đã được <strong style="color: #22c55e;">DUYỆT</strong> thành công! 🎉</p>
                <div style="background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.2); border-radius: 8px; padding: 16px; margin: 20px 0;">
                    <p style="margin: 0; color: #4ade80;">✅ <strong>Trạng thái:</strong> Đã xác minh</p>
                    <p style="margin: 8px 0 0; color: #a1a1aa; font-size: 13px;">Bạn đã có thể đăng bán thẻ trên CardVerse!</p>
                </div>
                <div style="text-align: center; margin: 24px 0;">
                    <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/sell" style="display: inline-block; background: #f97316; color: #fff; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">Đăng bán ngay →</a>
                </div>
                <p style="color: #71717a; font-size: 13px;">Cảm ơn bạn đã tham gia cộng đồng CardVerse!</p>`
            ),
        });
        console.log(`[Mail] KYC approved notification sent to ${userEmail}`);
    } catch (error) {
        console.error('[Mail] Failed to send KYC approved email:', error);
    }
}

export async function sendKYCRejected(userEmail: string, fullName: string, reason: string) {
    try {
        const transporter = createMailTransporter();
        const from = getFromAddress();

        await transporter.sendMail({
            from,
            to: userEmail,
            subject: '❌ Hồ sơ KYC chưa được duyệt — CardVerse',
            html: buildTemplate(
                '❌ Hồ sơ chưa được duyệt',
                `<p style="color: #e4e4e7;">Xin chào <strong style="color: #f97316;">${fullName}</strong>,</p>
                <p>Hồ sơ xác minh người bán của bạn chưa đạt yêu cầu. Vui lòng xem lý do bên dưới:</p>
                <div style="background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.2); border-radius: 8px; padding: 16px; margin: 20px 0;">
                    <p style="margin: 0; color: #f87171;">❌ <strong>Lý do từ chối:</strong></p>
                    <p style="margin: 8px 0 0; color: #fca5a5;">${reason}</p>
                </div>
                <p>Bạn có thể chỉnh sửa thông tin và gửi lại hồ sơ bất kỳ lúc nào.</p>
                <div style="text-align: center; margin: 24px 0;">
                    <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/sell" style="display: inline-block; background: #f97316; color: #fff; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">Gửi lại hồ sơ →</a>
                </div>
                <p style="color: #71717a; font-size: 13px;">Nếu có thắc mắc, vui lòng liên hệ hỗ trợ.</p>`
            ),
        });
        console.log(`[Mail] KYC rejected notification sent to ${userEmail}`);
    } catch (error) {
        console.error('[Mail] Failed to send KYC rejected email:', error);
    }
}
