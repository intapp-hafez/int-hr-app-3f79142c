-- Fix infinite recursion on chat_participants RLS
-- Run this in Supabase SQL Editor

-- 1. Helper function with SECURITY DEFINER to bypass RLS recursion on chat_participants
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

-- 2. Update Channels policies
DROP POLICY IF EXISTS "chat_channels_select" ON public.chat_channels;
CREATE POLICY "chat_channels_select" ON public.chat_channels FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'hr')
  OR type = 'broadcast'
  OR public.is_chat_channel_member(id, auth.uid())
);

DROP POLICY IF EXISTS "chat_channels_update" ON public.chat_channels FOR UPDATE TO authenticated USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'hr')
  OR public.is_chat_channel_member(id, auth.uid())
);

-- 3. Update Participants policies (breaks self-referential recursion)
DROP POLICY IF EXISTS "chat_participants_select" ON public.chat_participants;
CREATE POLICY "chat_participants_select" ON public.chat_participants FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'hr')
  OR user_id = auth.uid()
  OR public.is_chat_channel_member(channel_id, auth.uid())
);

-- 4. Update Messages policies
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
