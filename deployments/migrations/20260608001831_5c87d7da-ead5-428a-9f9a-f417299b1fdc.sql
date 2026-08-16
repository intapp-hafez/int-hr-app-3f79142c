
-- 1) Documents table
CREATE TABLE public.profile_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind text NOT NULL,
  name text NOT NULL,
  mime_type text NOT NULL,
  size_bytes integer NOT NULL CHECK (size_bytes >= 0 AND size_bytes <= 2097152),
  data_url text NOT NULL,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX profile_documents_profile_idx ON public.profile_documents(profile_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_documents TO authenticated;
GRANT ALL ON public.profile_documents TO service_role;

ALTER TABLE public.profile_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can read own documents"
  ON public.profile_documents FOR SELECT
  TO authenticated
  USING (profile_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));

CREATE POLICY "Admin/HR can insert documents"
  ON public.profile_documents FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));

CREATE POLICY "Admin/HR can update documents"
  ON public.profile_documents FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));

CREATE POLICY "Admin/HR can delete documents"
  ON public.profile_documents FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));

CREATE TRIGGER profile_documents_set_updated_at
  BEFORE UPDATE ON public.profile_documents
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 2) DB-side rule: issue date cannot be after expiry date
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_id_dates_chk
  CHECK (id_issue_date IS NULL OR id_expiry_date IS NULL OR id_issue_date <= id_expiry_date);
