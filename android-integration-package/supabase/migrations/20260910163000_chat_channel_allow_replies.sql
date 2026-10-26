-- Add allow_replies column to chat_channels (defaults to true)
ALTER TABLE public.chat_channels 
ADD COLUMN IF NOT EXISTS allow_replies boolean NOT NULL DEFAULT true;

-- Update RLS policies for chat_channels to allow updating channel settings
DROP POLICY IF EXISTS "chat_channels_update" ON public.chat_channels;
CREATE POLICY "chat_channels_update" ON public.chat_channels FOR UPDATE TO authenticated USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'hr')
  OR public.is_chat_channel_member(id, auth.uid())
);

-- Update RLS insert policy on chat_messages so regular employees cannot insert if allow_replies is false
DROP POLICY IF EXISTS "chat_messages_insert" ON public.chat_messages;
CREATE POLICY "chat_messages_insert" ON public.chat_messages FOR INSERT TO authenticated WITH CHECK (
  sender_id = auth.uid()
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'hr')
    OR public.has_role(auth.uid(), 'manager')
    OR (
      EXISTS (
        SELECT 1 FROM public.chat_channels cc
        WHERE cc.id = public.chat_messages.channel_id
        AND COALESCE(cc.allow_replies, true) = true
        AND (
          cc.type = 'broadcast'
          OR public.is_chat_channel_member(public.chat_messages.channel_id, auth.uid())
        )
      )
    )
  )
);
