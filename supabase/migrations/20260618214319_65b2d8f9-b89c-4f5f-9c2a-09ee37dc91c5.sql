ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
ALTER TABLE public.positions   ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

-- Backfill: order by name_en so existing rows have stable initial order
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY name_en NULLS LAST, created_at) * 10 AS rn
  FROM public.departments
)
UPDATE public.departments d SET sort_order = r.rn FROM ranked r WHERE d.id = r.id AND d.sort_order = 0;

WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY name_en NULLS LAST, created_at) * 10 AS rn
  FROM public.positions
)
UPDATE public.positions p SET sort_order = r.rn FROM ranked r WHERE p.id = r.id AND p.sort_order = 0;

CREATE INDEX IF NOT EXISTS idx_departments_sort_order ON public.departments(sort_order);
CREATE INDEX IF NOT EXISTS idx_positions_sort_order ON public.positions(sort_order);