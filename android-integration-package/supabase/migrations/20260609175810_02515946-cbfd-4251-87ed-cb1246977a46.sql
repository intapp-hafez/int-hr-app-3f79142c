
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.tg_set_updated_at() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.seed_leave_balances_for_employee() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.seed_leave_balances_for_type() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.apply_leave_balance_change() FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.has_permission(uuid, text, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.has_permission(uuid, text, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.smtp_config_decrypt(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.smtp_config_set_password(text, text) FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.import_employee_profile(text, text, text, public.app_role, text, text, uuid, uuid, text, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.import_employee_profile(text, text, text, public.app_role, text, text, uuid, uuid, text, text) TO authenticated;
