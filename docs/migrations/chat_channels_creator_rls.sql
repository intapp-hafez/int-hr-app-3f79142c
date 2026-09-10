-- Optional enhancement for chat_channels RLS
-- Allows channel creator (e.g. manager) to select and update channel even before participants are enrolled.

DROP POLICY IF EXISTS "chat_channels_select" ON public.chat_channels;
CREATE POLICY "chat_channels_select" ON public.chat_channels FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'hr')
  OR type = 'broadcast'
  OR created_by = auth.uid()
  OR public.is_chat_channel_member(id, auth.uid())
);

DROP POLICY IF EXISTS "chat_channels_update" ON public.chat_channels;
CREATE POLICY "chat_channels_update" ON public.chat_channels FOR UPDATE TO authenticated USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'hr')
  OR created_by = auth.uid()
  OR public.is_chat_channel_member(id, auth.uid())
);
