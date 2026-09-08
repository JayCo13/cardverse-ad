import { NextResponse } from 'next/server';
import { getAdminActor } from '@/utils/auth/getRole';
import { createAdminClient } from '@/utils/supabase/admin';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await getAdminActor()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  const client = createAdminClient();
  const { data, error } = await client.from('account_restriction_events').select('id,action,reason,actor_id,actor_role,created_at').eq('user_id', id).order('created_at', { ascending: false }).limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 503 });
  return NextResponse.json({ events: data }, { headers: { 'Cache-Control': 'private, no-store' } });
}
