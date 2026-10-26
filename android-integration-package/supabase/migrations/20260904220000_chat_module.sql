-- Chat Channels, Participants, and Messages Module
CREATE TABLE IF NOT EXISTS public.chat_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('direct', 'department', 'broadcast')),
  name text,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  department_name text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.chat_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.chat_channels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  joined_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_chat_channel_user UNIQUE (channel_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.chat_channels(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  attachments jsonb DEFAULT '[]'::jsonb,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_chat_channels_type ON public.chat_channels(type);
CREATE INDEX IF NOT EXISTS idx_chat_channels_last_msg ON public.chat_channels(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_channels_dept ON public.chat_channels(department_id);
CREATE INDEX IF NOT EXISTS idx_chat_participants_user ON public.chat_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_participants_channel ON public.chat_participants(channel_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_channel ON public.chat_messages(channel_id, created_at ASC);

-- Permissions & RLS
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_channels TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_participants TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_messages TO authenticated;

GRANT ALL ON public.chat_channels TO service_role;
GRANT ALL ON public.chat_participants TO service_role;
GRANT ALL ON public.chat_messages TO service_role;

ALTER TABLE public.chat_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Security definer helper to prevent recursive RLS checks on chat_participants
CREATE OR REPLACE FUNCTION public.is_chat_channel_member(p_channel_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_participants
    WHERE channel_id = p_channel_id AND user_id = p_user_id
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_chat_channel_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_chat_channel_member(uuid, uuid) TO service_role;

-- Channels policy: Users can see channels they participate in, or broadcast channels, or admins can see all
DROP POLICY IF EXISTS "chat_channels_select" ON public.chat_channels;
CREATE POLICY "chat_channels_select" ON public.chat_channels FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'hr')
  OR type = 'broadcast'
  OR public.is_chat_channel_member(id, auth.uid())
);

DROP POLICY IF EXISTS "chat_channels_insert" ON public.chat_channels;
CREATE POLICY "chat_channels_insert" ON public.chat_channels FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'hr')
  OR public.has_role(auth.uid(), 'manager')
  OR auth.uid() IS NOT NULL
);

DROP POLICY IF EXISTS "chat_channels_update" ON public.chat_channels;
CREATE POLICY "chat_channels_update" ON public.chat_channels FOR UPDATE TO authenticated USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'hr')
  OR public.is_chat_channel_member(id, auth.uid())
);

-- Participants policy: Non-recursive using security definer helper
DROP POLICY IF EXISTS "chat_participants_select" ON public.chat_participants;
CREATE POLICY "chat_participants_select" ON public.chat_participants FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'hr')
  OR user_id = auth.uid()
  OR public.is_chat_channel_member(channel_id, auth.uid())
);

DROP POLICY IF EXISTS "chat_participants_insert" ON public.chat_participants;
CREATE POLICY "chat_participants_insert" ON public.chat_participants FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'hr')
  OR public.has_role(auth.uid(), 'manager')
  OR user_id = auth.uid()
);

DROP POLICY IF EXISTS "chat_participants_update" ON public.chat_participants;
CREATE POLICY "chat_participants_update" ON public.chat_participants FOR UPDATE TO authenticated USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'hr')
  OR user_id = auth.uid()
);

-- Messages policy: Non-recursive using security definer helper
DROP POLICY IF EXISTS "chat_messages_select" ON public.chat_messages;
CREATE POLICY "chat_messages_select" ON public.chat_messages FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'hr')
  OR EXISTS (
    SELECT 1 FROM public.chat_channels cc
    WHERE cc.id = public.chat_messages.channel_id AND cc.type = 'broadcast'
  )
  OR public.is_chat_channel_member(channel_id, auth.uid())
);

DROP POLICY IF EXISTS "chat_messages_insert" ON public.chat_messages;
CREATE POLICY "chat_messages_insert" ON public.chat_messages FOR INSERT TO authenticated WITH CHECK (
  sender_id = auth.uid()
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'hr')
    OR EXISTS (
      SELECT 1 FROM public.chat_channels cc
      WHERE cc.id = public.chat_messages.channel_id AND cc.type = 'broadcast'
    )
    OR public.is_chat_channel_member(channel_id, auth.uid())
  )
);
