import { NextResponse } from 'next/server';
import { getRole } from '@/utils/auth/getRole';

export async function GET() {
    const role = await getRole();
    return role
        ? NextResponse.json({ role }, { status: 200 })
        : NextResponse.json({ role: null }, { status: 401 });
}
