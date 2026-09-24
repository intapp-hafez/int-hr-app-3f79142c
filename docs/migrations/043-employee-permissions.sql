-- Migration: 043-employee-permissions
-- Description: Create employee_permissions table with 4h/month, max 2 requests/month, max 2h/request policy

CREATE TABLE IF NOT EXISTS public.employee_permissions (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    employee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    date date NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    duration_hours numeric(3, 1) NOT NULL,
    reason text NOT NULL,
    status text NOT NULL DEFAULT 'pending',
    decision_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    decision_at timestamp with time zone,
    decision_note text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT employee_permissions_pkey PRIMARY KEY (id),
    CONSTRAINT chk_permission_duration CHECK (duration_hours > 0 AND duration_hours <= 2.0),
    CONSTRAINT chk_permission_status CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_employee_permissions_emp_date ON public.employee_permissions (employee_id, date);
CREATE INDEX IF NOT EXISTS idx_employee_permissions_status ON public.employee_permissions (status);

-- Enable RLS
ALTER TABLE public.employee_permissions ENABLE ROW LEVEL SECURITY;

-- Policies:
-- 1. Read access: Employees can see their own; Admin/HR can see all
DROP POLICY IF EXISTS "Users can read own permissions" ON public.employee_permissions;
CREATE POLICY "Users can read own permissions" ON public.employee_permissions
    FOR SELECT TO authenticated
    USING (
        auth.uid() = employee_id 
        OR public.has_role(auth.uid(), 'admin') 
        OR public.has_role(auth.uid(), 'hr')
    );

-- 2. Insert access: Users can request for themselves; Admin/HR can request for any employee
DROP POLICY IF EXISTS "Users can request own permissions" ON public.employee_permissions;
CREATE POLICY "Users can request own permissions" ON public.employee_permissions
    FOR INSERT TO authenticated
    WITH CHECK (
        auth.uid() = employee_id 
        OR public.has_role(auth.uid(), 'admin') 
        OR public.has_role(auth.uid(), 'hr')
    );

-- 3. Update access: Admin/HR can approve/reject; Employees can cancel their own pending requests
DROP POLICY IF EXISTS "Admins and HR can update permissions" ON public.employee_permissions;
CREATE POLICY "Admins and HR can update permissions" ON public.employee_permissions
    FOR UPDATE TO authenticated
    USING (
        public.has_role(auth.uid(), 'admin') 
        OR public.has_role(auth.uid(), 'hr')
        OR (auth.uid() = employee_id AND status = 'pending')
    );

-- 4. Delete access: Admin and HR
DROP POLICY IF EXISTS "Admins and HR can delete permissions" ON public.employee_permissions;
CREATE POLICY "Admins and HR can delete permissions" ON public.employee_permissions
    FOR DELETE TO authenticated
    USING (
        public.has_role(auth.uid(), 'admin') 
        OR public.has_role(auth.uid(), 'hr')
    );

-- Updated_at trigger
DROP TRIGGER IF EXISTS set_employee_permissions_updated_at ON public.employee_permissions;
CREATE TRIGGER set_employee_permissions_updated_at
    BEFORE UPDATE ON public.employee_permissions
    FOR EACH ROW
    EXECUTE FUNCTION public.tg_set_updated_at();
