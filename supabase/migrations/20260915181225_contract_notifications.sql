CREATE TYPE public.notification_type_enum AS ENUM ('renew', 'resign');
CREATE TYPE public.notification_status_enum AS ENUM ('pending', 'notified', 'confirmed', 'closed');

CREATE TABLE public.contract_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  contract_end_date date NOT NULL,
  type public.notification_type_enum NOT NULL,
  status public.notification_status_enum NOT NULL DEFAULT 'pending',
  notes text,
  notified_at timestamptz,
  notified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notification_channel text,
  confirmed_at timestamptz,
  confirmed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  closed_at timestamptz,
  closed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, contract_end_date)
);

CREATE INDEX idx_contract_notifications_profile_id ON public.contract_notifications(profile_id);
CREATE INDEX idx_contract_notifications_status ON public.contract_notifications(status);
CREATE INDEX idx_contract_notifications_contract_end_date ON public.contract_notifications(contract_end_date);

ALTER TABLE public.contract_notifications ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contract_notifications TO authenticated;
GRANT ALL ON public.contract_notifications TO service_role;

CREATE POLICY "Admins and HR can manage contract notifications" 
ON public.contract_notifications 
FOR ALL TO authenticated 
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'hr')
) 
WITH CHECK (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'hr')
);

CREATE TRIGGER trg_contract_notifications_updated
  BEFORE UPDATE ON public.contract_notifications
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
