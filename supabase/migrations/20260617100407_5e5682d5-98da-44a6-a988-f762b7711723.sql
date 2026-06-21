
-- ========== payroll_settings ==========
CREATE TABLE public.payroll_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_insurance_rate numeric(6,5) NOT NULL,
  employer_insurance_rate numeric(6,5) NOT NULL,
  martyrs_fund_rate numeric(6,5) NOT NULL DEFAULT 0,
  martyrs_fund_enabled boolean NOT NULL DEFAULT true,
  insurance_ceiling numeric(12,2) NOT NULL,
  insurance_floor numeric(12,2) NOT NULL DEFAULT 0,
  annual_personal_exemption numeric(12,2) NOT NULL DEFAULT 0,
  effective_date date NOT NULL UNIQUE,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.payroll_settings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.payroll_settings TO authenticated;
GRANT ALL ON public.payroll_settings TO service_role;

ALTER TABLE public.payroll_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read payroll settings"
  ON public.payroll_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins/HR can write payroll settings"
  ON public.payroll_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'));

CREATE TRIGGER tg_payroll_settings_updated_at
  BEFORE UPDATE ON public.payroll_settings
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ========== tax_brackets ==========
CREATE TABLE public.tax_brackets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  effective_date date NOT NULL,
  from_amount numeric(14,2) NOT NULL,
  to_amount numeric(14,2),   -- NULL = infinity
  tax_rate numeric(6,5) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tax_brackets_effective_idx ON public.tax_brackets (effective_date, from_amount);

GRANT SELECT ON public.tax_brackets TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.tax_brackets TO authenticated;
GRANT ALL ON public.tax_brackets TO service_role;

ALTER TABLE public.tax_brackets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read tax brackets"
  ON public.tax_brackets FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins/HR can write tax brackets"
  ON public.tax_brackets FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'));

-- ========== profiles columns ==========
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS salary_type text NOT NULL DEFAULT 'GROSS' CHECK (salary_type IN ('NET','GROSS')),
  ADD COLUMN IF NOT EXISTS salary_amount numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS insurance_applicable boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS tax_applicable boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS martyrs_fund_applicable boolean NOT NULL DEFAULT true;

-- backfill salary_amount from existing salary_gross/net where possible
UPDATE public.profiles
  SET salary_type  = COALESCE(UPPER(salary_mode), 'GROSS'),
      salary_amount = COALESCE(
        CASE WHEN UPPER(COALESCE(salary_mode,'GROSS'))='NET' THEN salary_net ELSE salary_gross END,
        salary_gross, salary_net, 0
      )
  WHERE salary_amount = 0;

-- ========== seed Egyptian 2024 defaults ==========
INSERT INTO public.payroll_settings
  (employee_insurance_rate, employer_insurance_rate, martyrs_fund_rate, martyrs_fund_enabled,
   insurance_ceiling, insurance_floor, annual_personal_exemption, effective_date, notes)
VALUES
  (0.11, 0.1875, 0.0005, true, 12600, 2000, 20000, '2024-01-01',
   'Egyptian payroll defaults — 2024');

INSERT INTO public.tax_brackets (effective_date, from_amount, to_amount, tax_rate) VALUES
  ('2024-01-01',      0,    40000, 0.000),
  ('2024-01-01',  40000,    55000, 0.100),
  ('2024-01-01',  55000,    70000, 0.150),
  ('2024-01-01',  70000,   200000, 0.200),
  ('2024-01-01', 200000,   400000, 0.225),
  ('2024-01-01', 400000,  1200000, 0.250),
  ('2024-01-01', 1200000,    NULL, 0.275);
