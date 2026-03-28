import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const { email } = await req.json();

        if (!email) {
            return NextResponse.json({ error: "Email is required" }, { status: 400 });
        }

        // Prevent moderator from resetting via Supabase auth (since mod password is in env vars)
        if (email === process.env.MODERATOR_EMAIL) {
            return NextResponse.json({ error: "Moderator password cannot be reset via this portal." }, { status: 403 });
        }

        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false
                }
            }
        );

        // Fetch users from auth system (up to 1000) to confirm they have an Admin account
        const { data: usersData, error: listError } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });

        if (listError) {
            throw listError;
        }

        const normalizedEmail = email.toLowerCase().trim();
        const userExists = usersData.users.find((u) => u.email?.toLowerCase().trim() === normalizedEmail);

        if (!userExists) {
            // "if not. prevent them from this"
            return NextResponse.json({ error: "No admin account found with this email." }, { status: 404 });
        }

        // Send out reset password link
        // We set the redirectTo URL to the admin dashboard's update-password page
        const { error: resetError } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
            redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/reset-password`,
        });

        if (resetError) {
            throw resetError;
        }

        return NextResponse.json({ message: "Password reset link sent successfully." }, { status: 200 });

    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error('[/api/auth/reset-password] Error:', error.message);
        } else {
            console.error('[/api/auth/reset-password] Error:', error);
        }
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
