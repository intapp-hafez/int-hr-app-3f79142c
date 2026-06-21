
REVOKE EXECUTE ON FUNCTION public.smtp_config_decrypt(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.smtp_config_set_password(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.smtp_config_decrypt(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.smtp_config_set_password(text, text) TO service_role;
