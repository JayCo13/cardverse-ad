import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { getRole } from '@/utils/auth/getRole';
import { createMailTransporter, getFromAddress } from '@/utils/mail/transporter';

// GET: Fetch sent email history
export async function GET(request: Request) {
    const role = await getRole();
    if (!role) {
        return NextResponse.json({ error: 'Forbidden. You must be authenticated.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const search = searchParams.get('search') || '';

    try {
        const supabaseAdmin = createAdminClient();
        let query = supabaseAdmin
            .from('sent_emails')
            .select('*', { count: 'exact' });

        if (search) {
            query = query.or(`subject.ilike.%${search}%,sent_by.ilike.%${search}%`);
        }

        const { data, count, error } = await query
            .order('created_at', { ascending: false })
            .range((page - 1) * limit, page * limit - 1);

        if (error) throw error;

        return NextResponse.json({
            emails: data || [],
            total: count || 0,
        }, { status: 200 });

    } catch (error: any) {
        const message = error?.message || 'Unknown error';
        console.error('[/api/subscribers/mail GET] Raw Error:', error);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// POST: Send email and log it
export async function POST(request: Request) {
    const role = await getRole();
    if (!role) {
        return NextResponse.json({ error: 'Forbidden. You must be authenticated.' }, { status: 403 });
    }

    try {
        const supabaseAdmin = createAdminClient();
        const body = await request.json();
        const { recipients, subject, message } = body as {
            recipients: 'all' | string[];
            subject: string;
            message: string;
        };

        if (!subject || !message) {
            return NextResponse.json({ error: 'Subject and message are required.' }, { status: 400 });
        }

        // Resolve recipient list
        let emailList: string[] = [];
        const recipientType = recipients === 'all' ? 'all' : 'specific';

        if (recipients === 'all') {
            const { data, error } = await supabaseAdmin
                .from('newsletter_subscribers')
                .select('email');

            if (error) throw error;
            emailList = (data || []).map((s: { email: string }) => s.email);
        } else if (Array.isArray(recipients) && recipients.length > 0) {
            emailList = recipients;
        } else {
            return NextResponse.json({ error: 'At least one recipient is required.' }, { status: 400 });
        }

        if (emailList.length === 0) {
            return NextResponse.json({ error: 'No recipients found to send email to.' }, { status: 400 });
        }

        // Validate SMTP credentials
        if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
            return NextResponse.json({ error: 'SMTP credentials are not configured. Set SMTP_USER and SMTP_PASSWORD in your environment.' }, { status: 500 });
        }

        const transporter = createMailTransporter();
        const fromAddress = getFromAddress();

        // Build email HTML with CardVerse branding
        const htmlBody = `
<!DOCTYPE html>
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
                            <h2 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 600;">${subject}</h2>
                        </td>
                    </tr>
                    <!-- Body -->
                    <tr>
                        <td style="padding: 0 40px 32px;">
                            <div style="color: #a1a1aa; font-size: 15px; line-height: 1.7;">
                                ${message.replace(/\n/g, '<br>')}
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

        // Send emails — use BCC for bulk to protect privacy
        let successCount = 0;
        let failCount = 0;
        const errors: string[] = [];

        if (emailList.length === 1) {
            try {
                await transporter.sendMail({
                    from: fromAddress,
                    to: emailList[0],
                    subject,
                    html: htmlBody,
                });
                successCount = 1;
            } catch (err: unknown) {
                failCount = 1;
                errors.push(err instanceof Error ? err.message : 'Unknown error');
            }
        } else {
            const batchSize = 50;
            for (let i = 0; i < emailList.length; i += batchSize) {
                const batch = emailList.slice(i, i + batchSize);
                try {
                    await transporter.sendMail({
                        from: fromAddress,
                        bcc: batch.join(', '),
                        subject,
                        html: htmlBody,
                    });
                    successCount += batch.length;
                } catch (err: unknown) {
                    failCount += batch.length;
                    errors.push(err instanceof Error ? err.message : 'Unknown error');
                }
            }
        }

        // Determine status
        let status = 'sent';
        if (failCount > 0 && successCount > 0) status = 'partial';
        if (failCount > 0 && successCount === 0) status = 'failed';

        // Log to sent_emails table
        const senderEmail = process.env.SMTP_USER || 'unknown';
        await supabaseAdmin.from('sent_emails').insert({
            subject,
            message,
            recipient_type: recipientType,
            recipient_emails: emailList,
            recipient_count: emailList.length,
            sent_count: successCount,
            failed_count: failCount,
            sent_by: role === 'moderator' ? `mod:${senderEmail}` : `admin:${senderEmail}`,
            status,
        });

        return NextResponse.json({
            success: true,
            sent: successCount,
            failed: failCount,
            errors: errors.length > 0 ? errors : undefined,
        }, { status: 200 });

    } catch (error: any) {
        const message = error?.message || 'Unknown error';
        console.error('[/api/subscribers/mail POST] Raw Error:', error);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
