-- Migration: Prevent inactive accounts from logging in dynamically
-- Syncs public.profiles.status with Supabase auth.users.banned_until
-- Note: Uses '2099-12-31 23:59:59+00' instead of 'infinity' because GoTrue's Go driver cannot decode 'infinity'

-- 1. Repair any existing 'infinity' values in auth.users
UPDATE auth.users
SET banned_until = '2099-12-31 23:59:59+00'::timestamptz
WHERE banned_until IS NOT NULL;

-- 2. Create or replace the synchronization function
CREATE OR REPLACE FUNCTION public.sync_profile_status_to_auth_users()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- If status is Inactive, ban user in auth.users and revoke active sessions
  IF NEW.status = 'Inactive' THEN
    UPDATE auth.users
    SET banned_until = '2099-12-31 23:59:59+00'::timestamptz
    WHERE id = NEW.id;

    -- Invalidate active sessions if auth.sessions exists
    BEGIN
      DELETE FROM auth.sessions WHERE user_id = NEW.id;
    EXCEPTION WHEN OTHERS THEN
      -- ignore if auth.sessions table or schema is not directly accessible
    END;

    BEGIN
      DELETE FROM auth.refresh_tokens WHERE user_id = NEW.id;
    EXCEPTION WHEN OTHERS THEN
      -- ignore if refresh_tokens schema differs
    END;

  ELSIF NEW.status = 'Active' THEN
    -- Reactivated: unban user so they can login again
    UPDATE auth.users
    SET banned_until = NULL
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

-- 3. Drop existing trigger if present
DROP TRIGGER IF EXISTS trg_sync_profile_status_to_auth_users ON public.profiles;

-- 4. Create trigger on public.profiles
CREATE TRIGGER trg_sync_profile_status_to_auth_users
  AFTER INSERT OR UPDATE OF status
  ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_status_to_auth_users();

-- 5. Sync existing inactive profiles to auth.users
UPDATE auth.users u
SET banned_until = '2099-12-31 23:59:59+00'::timestamptz
FROM public.profiles p
WHERE u.id = p.id AND p.status = 'Inactive';

-- 6. Unban existing active profiles
UPDATE auth.users u
SET banned_until = NULL
FROM public.profiles p
WHERE u.id = p.id AND (p.status IS NULL OR p.status = 'Active') AND u.banned_until IS NOT NULL;
