-- Run this in Supabase SQL editor to enable per-user notification category
-- preferences + Web Push subscriptions.

CREATE TABLE IF NOT EXISTS public.notification_category_prefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('pending_leave','late','absent','checkin','checkout')),
  channel  text NOT NULL CHECK (channel  IN ('inapp','email','push')),
  enabled  boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, category, channel)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_category_prefs TO authenticated;
GRANT ALL ON public.notification_category_prefs TO service_role;
ALTER TABLE public.notification_category_prefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ncp_owner_select" ON public.notification_category_prefs
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "ncp_owner_modify" ON public.notification_category_prefs
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS ncp_user_idx ON public.notification_category_prefs(user_id);

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth_secret text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_success_at timestamptz,
  failure_count int NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ps_owner_select" ON public.push_subscriptions
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "ps_owner_modify" ON public.push_subscriptions
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS ps_user_idx ON public.push_subscriptions(user_id);