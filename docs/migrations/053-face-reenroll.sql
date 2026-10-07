-- Admin-controlled one-time face re-enroll permission (off by default)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS face_reenroll_allowed boolean NOT NULL DEFAULT false;
