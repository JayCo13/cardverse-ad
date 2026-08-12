import { NextResponse } from 'next/server';
import { MODERATOR_COOKIE_NAME } from '@/utils/auth/moderatorSession';

export async function POST() {
    const response = NextResponse.json({ success: true }, { status: 200 });

    // Clear the moderator session cookie
    response.cookies.set({
        name: MODERATOR_COOKIE_NAME,
        value: '',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        expires: new Date(0), // Expire immediately
    });

    return response;
}
