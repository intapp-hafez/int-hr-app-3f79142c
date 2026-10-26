-- Create Cost Centers table
CREATE TABLE IF NOT EXISTS public.cost_centers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  name_en text NOT NULL,
  name_ar text NOT NULL,
  description_en text,
  description_ar text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'Active', 'Inactive')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index for quick lookup by code
CREATE INDEX IF NOT EXISTS idx_cost_centers_code ON public.cost_centers(code);

-- Enable RLS
ALTER TABLE public.cost_centers ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cost_centers' AND policyname = 'cost_centers_read_all') THEN
    CREATE POLICY "cost_centers_read_all" ON public.cost_centers FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cost_centers' AND policyname = 'cost_centers_admin_write') THEN
    CREATE POLICY "cost_centers_admin_write" ON public.cost_centers FOR ALL TO authenticated USING (
      has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role)
    ) WITH CHECK (
      has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role)
    );
  END IF;
END $$;

-- Add cost_center_id to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cost_center_id uuid REFERENCES public.cost_centers(id) ON DELETE SET NULL;
