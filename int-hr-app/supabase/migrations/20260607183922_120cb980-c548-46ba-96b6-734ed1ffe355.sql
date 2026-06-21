
CREATE OR REPLACE FUNCTION public.smtp_config_set_password(_key text, _password text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
  UPDATE public.smtp_config
     SET password_encrypted = pgp_sym_encrypt(_password, _key),
         updated_at = now()
   WHERE id = 1;
END; $$;
REVOKE EXECUTE ON FUNCTION public.smtp_config_set_password(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.smtp_config_set_password(text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.smtp_config_decrypt(_key text)
RETURNS TABLE (
  host text, port int, secure boolean, username text,
  password text, from_email text, from_name text
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
  RETURN QUERY
  SELECT s.host, s.port, s.secure, s.username,
         CASE WHEN s.password_encrypted IS NULL THEN ''
              ELSE pgp_sym_decrypt(s.password_encrypted, _key) END AS password,
         s.from_email, s.from_name
    FROM public.smtp_config s
   WHERE s.id = 1;
END; $$;
REVOKE EXECUTE ON FUNCTION public.smtp_config_decrypt(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.smtp_config_decrypt(text) TO service_role;
