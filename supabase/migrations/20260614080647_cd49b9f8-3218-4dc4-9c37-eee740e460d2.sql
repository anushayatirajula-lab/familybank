-- Revoke EXECUTE from PUBLIC and anon on all SECURITY DEFINER functions in public schema,
-- then grant EXECUTE to authenticated and service_role only.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT n.nspname AS schema_name,
           p.proname AS func_name,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC, anon;',
                   r.schema_name, r.func_name, r.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO authenticated, service_role;',
                   r.schema_name, r.func_name, r.args);
  END LOOP;
END$$;