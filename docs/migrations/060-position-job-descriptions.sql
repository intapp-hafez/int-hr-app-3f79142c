CREATE TABLE public.position_job_descriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id uuid NOT NULL UNIQUE REFERENCES public.positions(id) ON DELETE CASCADE,
  job_description text NOT NULL,
  tags text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.position_job_descriptions TO authenticated;
GRANT ALL ON public.position_job_descriptions TO service_role;
ALTER TABLE public.position_job_descriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "HR and admins manage position descriptions"
  ON public.position_job_descriptions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));
CREATE TRIGGER position_job_descriptions_updated_at BEFORE UPDATE
  ON public.position_job_descriptions FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();