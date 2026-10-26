CREATE TABLE IF NOT EXISTS public.department_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  old_department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  new_department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  old_position_id uuid REFERENCES public.positions(id) ON DELETE SET NULL,
  new_position_id uuid REFERENCES public.positions(id) ON DELETE SET NULL,
  old_manager_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  new_manager_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  effective_date DATE NOT NULL,
  note TEXT,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.department_transfers TO authenticated;
GRANT ALL ON public.department_transfers TO service_role;
ALTER TABLE public.department_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins/HR view transfers" ON public.department_transfers 
  FOR SELECT TO authenticated 
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr') OR employee_id = auth.uid());

CREATE POLICY "Admins/HR insert transfers" ON public.department_transfers 
  FOR INSERT TO authenticated 
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));
