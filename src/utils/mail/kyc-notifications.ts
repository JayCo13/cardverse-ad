import { createMailTransporter, getFromAddress } from './transporter';

function getAppUrl() {
    return process.env.NEXT_PUBLIC_APP_URL || 'https://cardversehub.com';
}

export function buildTemplate(title: string, body: string) {
    const appUrl = getAppUrl();
    // Luôn trỏ logo về server thật để test ở localhost cũng xem được ảnh
    const logoUrl = `https://cardversehub.com/assets/logo-verse.png`;
    const year = new Date().getFullYear();

    return `<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="color-scheme" content="dark">
    <title>CardVerse</title>
</head>
<body style="margin: 0; padding: 0; background-color: #08080a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
    <!-- Preheader (hidden) -->
    <div style="display: none; max-height: 0; overflow: hidden; opacity: 0;">${title}</div>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #08080a;">
        <tr>
            <td align="center" style="padding: 40px 16px;">
                <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width: 100%; max-width: 600px; background-color: #131316; border-radius: 20px; border: 1px solid rgba(255,255,255,0.06); overflow: hidden; box-shadow: 0 24px 64px rgba(0,0,0,0.6);">
                    <!-- Header with centered logo -->
                    <tr>
                        <td align="center" style="padding: 40px 40px 32px; background: linear-gradient(135deg, rgba(249,115,22,0.18) 0%, rgba(249,115,22,0.03) 55%, transparent 100%);">
                            <img src="${logoUrl}" alt="CardVerse" height="40" style="display: block; height: 40px; width: auto; border: 0; outline: none; text-decoration: none;">
                        </td>
                    </tr>
                    <!-- Accent divider -->
                    <tr>
                        <td style="height: 3px; line-height: 3px; font-size: 0; background: linear-gradient(90deg, transparent, #f97316 50%, transparent);">&nbsp;</td>
                    </tr>
                    <!-- Title -->
                    <tr>
                        <td style="padding: 36px 40px 12px;">
                            <h2 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 700; letter-spacing: -0.4px; line-height: 1.35;">${title}</h2>
                        </td>
                    </tr>
                    <!-- Body -->
                    <tr>
                        <td style="padding: 0 40px 36px;">
                            <div style="color: #b4b4bd; font-size: 15px; line-height: 1.75;">
                                ${body}
                            </div>
                        </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                        <td style="padding: 28px 40px; background-color: rgba(0,0,0,0.35); border-top: 1px solid rgba(255,255,255,0.06);">
                            <p style="margin: 0 0 6px; color: #71717a; font-size: 13px; text-align: center; font-weight: 600;">CardVerse — Sàn giao dịch thẻ bài</p>
                            <p style="margin: 0; color: #52525b; font-size: 12px; text-align: center; line-height: 1.6;">
                                <a href="${appUrl}" style="color: #f97316; text-decoration: none;">${appUrl.replace(/^https?:\/\//, '')}</a>
                                &nbsp;&middot;&nbsp; &copy; ${year} CardVerse. All rights reserved.
                            </p>
                        </td>
                    </tr>
                </table>
                <!-- Sub-footer note -->
                <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width: 100%; max-width: 600px;">
                    <tr>
                        <td style="padding: 16px 40px 0; text-align: center;">
                            <p style="margin: 0; color: #3f3f46; font-size: 11px; line-height: 1.6;">Email này được gửi tự động, vui lòng không trả lời trực tiếp.</p>
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
                '🎉 Chúc mừng, bạn đã trở thành Người bán!',
                `<p style="margin: 0 0 16px; color: #e4e4e7;">Xin chào <strong style="color: #f97316;">${fullName}</strong>,</p>
                <p style="margin: 0 0 20px;">Hồ sơ xác minh người bán của bạn đã được <strong style="color: #22c55e;">DUYỆT</strong> thành công. Tài khoản của bạn giờ đã sẵn sàng để kinh doanh trên CardVerse!</p>

                <!-- Verified status card -->
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 0 0 24px;">
                    <tr>
                        <td style="background: linear-gradient(135deg, rgba(34,197,94,0.16), rgba(34,197,94,0.04)); border: 1px solid rgba(34,197,94,0.28); border-radius: 14px; padding: 20px 22px;">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                                <tr>
                                    <td style="font-size: 26px; width: 40px; vertical-align: middle;">✅</td>
                                    <td style="vertical-align: middle;">
                                        <p style="margin: 0; color: #4ade80; font-size: 15px; font-weight: 700;">Đã xác minh — Verified Seller</p>
                                        <p style="margin: 4px 0 0; color: #a1a1aa; font-size: 13px;">Bạn đã có thể đăng bán, đấu giá và razz thẻ.</p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>

                <!-- CTA button -->
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 0 0 28px;">
                    <tr>
                        <td align="center">
                            <a href="${getAppUrl()}/sell" style="display: inline-block; background: linear-gradient(135deg, #fb923c, #f97316); color: #ffffff; padding: 14px 38px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 15px; box-shadow: 0 8px 24px rgba(249,115,22,0.35);">Đăng bán ngay →</a>
                        </td>
                    </tr>
                </table>

                <!-- Next steps -->
                <p style="margin: 0 0 10px; color: #d4d4d8; font-size: 14px; font-weight: 600;">Bước tiếp theo:</p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 0 0 8px;">
                    <tr><td style="color: #f97316; font-size: 14px; width: 24px; vertical-align: top;">1.</td><td style="color: #b4b4bd; font-size: 14px; padding-bottom: 8px;">Tạo tin đăng đầu tiên với ảnh thẻ rõ nét.</td></tr>
                    <tr><td style="color: #f97316; font-size: 14px; width: 24px; vertical-align: top;">2.</td><td style="color: #b4b4bd; font-size: 14px; padding-bottom: 8px;">Cập nhật địa chỉ giao hàng để tạo đơn nhanh hơn.</td></tr>
                    <tr><td style="color: #f97316; font-size: 14px; width: 24px; vertical-align: top;">3.</td><td style="color: #b4b4bd; font-size: 14px;">Theo dõi đơn hàng trong mục “Quản lý bán hàng”.</td></tr>
                </table>

                <p style="margin: 24px 0 0; color: #71717a; font-size: 13px;">Cảm ơn bạn đã tham gia cộng đồng CardVerse. Chúc bạn giao dịch thuận lợi! 🚀</p>`
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
