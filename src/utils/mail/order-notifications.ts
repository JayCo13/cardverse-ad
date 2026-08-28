import { createMailTransporter, getFromAddress } from './transporter';
import { buildTemplate } from './kyc-notifications';

const fmtVND = (n: number) => new Intl.NumberFormat('vi-VN').format(Number(n || 0)) + 'đ';

type RefundInfo = {
    buyerEmail?: string | null;
    sellerEmail?: string | null;
    cardName: string;
    amount: number;   // total_paid refunded to the buyer
    orderId: string;
    note?: string;
};

// Notify BOTH parties when an admin refunds a disputed/escalated order. Emails
// are best-effort — a mail failure must never block the refund itself.
export async function sendOrderRefundEmails(info: RefundInfo) {
    const { buyerEmail, sellerEmail, cardName, amount, orderId, note } = info;
    const shortId = String(orderId).slice(0, 8).toUpperCase();
    const noteBlock = note
        ? `<p style="margin: 16px 0 0; color: #a1a1aa; font-size: 13px;">Ghi chú từ quản trị viên: <em style="color: #d4d4d8;">${note}</em></p>`
        : '';

    try {
        const transporter = createMailTransporter();
        const from = getFromAddress();
        const tasks: Promise<unknown>[] = [];

        if (buyerEmail) {
            tasks.push(transporter.sendMail({
                from,
                to: buyerEmail,
                subject: `💸 Đã hoàn tiền đơn #${shortId} — CardVerseHub`,
                html: buildTemplate(
                    'Đơn hàng đã được hoàn tiền',
                    `<p style="margin: 0 0 16px;">Sau khi kiểm tra khiếu nại, quản trị viên đã <strong style="color: #22c55e;">hoàn tiền</strong> cho đơn hàng của bạn.</p>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 0 0 20px;">
                        <tr><td style="background: linear-gradient(135deg, rgba(34,197,94,0.16), rgba(34,197,94,0.04)); border: 1px solid rgba(34,197,94,0.28); border-radius: 14px; padding: 18px 20px;">
                            <p style="margin: 0 0 6px; color: #a1a1aa; font-size: 13px;">Sản phẩm: <strong style="color: #e4e4e7;">${cardName}</strong></p>
                            <p style="margin: 0 0 6px; color: #a1a1aa; font-size: 13px;">Mã đơn: <strong style="color: #e4e4e7;">#${shortId}</strong></p>
                            <p style="margin: 0; color: #4ade80; font-size: 18px; font-weight: 700;">+ ${fmtVND(amount)} đã hoàn vào ví</p>
                        </td></tr>
                    </table>
                    <p style="margin: 0;">Số tiền đã được cộng vào <strong style="color: #f97316;">ví CardVerseHub</strong> của bạn. Bạn có thể dùng để mua tiếp hoặc rút về ngân hàng.</p>
                    ${noteBlock}`,
                ),
            }));
        }

        if (sellerEmail) {
            tasks.push(transporter.sendMail({
                from,
                to: sellerEmail,
                subject: `⚠️ Đơn #${shortId} đã huỷ & hoàn tiền — CardVerseHub`,
                html: buildTemplate(
                    'Đơn hàng đã bị huỷ và hoàn tiền',
                    `<p style="margin: 0 0 16px;">Sau khi kiểm tra khiếu nại về đơn hàng, quản trị viên đã quyết định <strong style="color: #f97316;">hoàn tiền cho người mua</strong>.</p>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 0 0 20px;">
                        <tr><td style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 18px 20px;">
                            <p style="margin: 0 0 6px; color: #a1a1aa; font-size: 13px;">Sản phẩm: <strong style="color: #e4e4e7;">${cardName}</strong></p>
                            <p style="margin: 0; color: #a1a1aa; font-size: 13px;">Mã đơn: <strong style="color: #e4e4e7;">#${shortId}</strong></p>
                        </td></tr>
                    </table>
                    <p style="margin: 0;">Thẻ trong đơn đã được khôi phục về trạng thái đang bán (nếu còn). Nếu bạn cho rằng quyết định chưa chính xác, vui lòng liên hệ đội ngũ hỗ trợ.</p>
                    ${noteBlock}`,
                ),
            }));
        }

        await Promise.allSettled(tasks);
        console.log(`[Mail] Order refund emails sent for #${shortId}`);
    } catch (error) {
        console.error('[Mail] Failed to send order refund emails:', error);
    }
}
