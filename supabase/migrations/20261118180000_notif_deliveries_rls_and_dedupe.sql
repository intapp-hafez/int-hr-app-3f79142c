-- Migration: 20261118180000_notif_deliveries_rls_and_dedupe.sql
-- Description: Enable proper RLS policies and table grants for notif_deliveries

-- 1. Grant table permissions to authenticated role
GRANT SELECT, INSERT, UPDATE ON public.notif_deliveries TO authenticated;

-- 2. Allow authenticated users to insert notification delivery logs (needed by browser function adapters and alert dispatches)
DROP POLICY IF EXISTS "deliveries insert policy" ON public.notif_deliveries;
CREATE POLICY "deliveries insert policy" ON public.notif_deliveries
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid() 
    OR public.has_role(auth.uid(), 'admin') 
    OR public.has_role(auth.uid(), 'hr')
    OR user_id IS NULL
  );

-- 3. Allow Admin and HR to view and manage all delivery logs in Sent Emails Delivery Log
DROP POLICY IF EXISTS "deliveries admin all" ON public.notif_deliveries;
CREATE POLICY "deliveries admin all" ON public.notif_deliveries
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') 
    OR public.has_role(auth.uid(), 'hr')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') 
    OR public.has_role(auth.uid(), 'hr')
  );

-- 4. Ensure individual users can view their own deliveries
DROP POLICY IF EXISTS "deliveries self read" ON public.notif_deliveries;
CREATE POLICY "deliveries self read" ON public.notif_deliveries
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
