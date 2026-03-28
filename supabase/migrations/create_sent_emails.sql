-- Create sent_emails table for tracking email history
CREATE TABLE IF NOT EXISTS public.sent_emails (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    recipient_type TEXT NOT NULL CHECK (recipient_type IN ('all', 'specific')),
    recipient_emails TEXT[] NOT NULL DEFAULT '{}',
    recipient_count INTEGER NOT NULL DEFAULT 0,
    sent_count INTEGER NOT NULL DEFAULT 0,
    failed_count INTEGER NOT NULL DEFAULT 0,
    sent_by TEXT NOT NULL DEFAULT 'unknown',
    status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'partial', 'failed')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for listing recent emails
CREATE INDEX IF NOT EXISTS idx_sent_emails_created_at ON public.sent_emails (created_at DESC);

-- RLS: Only service role can access (admin dashboard uses service role key)
ALTER TABLE public.sent_emails ENABLE ROW LEVEL SECURITY;
