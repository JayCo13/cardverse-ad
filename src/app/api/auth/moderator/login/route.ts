import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const { email, password } = await request.json();

        const modEmail = process.env.MODERATOR_EMAIL;
        const modPassword = process.env.MODERATOR_PASSWORD;

        if (!modEmail || !modPassword) {
            console.warn("Moderator credentials not set in environment variables.");
            return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
        }

        if (email === modEmail && password === modPassword) {
            // Create response and set a secure cookie
            const response = NextResponse.json({ success: true, role: "moderator" }, { status: 200 });

            response.cookies.set({
                name: 'moderator_session',
                value: 'true',
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                path: '/',
                maxAge: 60 * 60 * 24, // 24 hours
            });

            return response;
        }

        return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    } catch (error) {
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
