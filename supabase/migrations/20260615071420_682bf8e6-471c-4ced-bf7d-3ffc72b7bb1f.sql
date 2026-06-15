CREATE OR REPLACE FUNCTION public.fb_verify_cron_secret(p_secret text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public, vault
AS $$
DECLARE
  v_secret text;
BEGIN
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'CRON_SECRET'
  LIMIT 1;

  RETURN v_secret IS NOT NULL AND p_secret IS NOT NULL AND p_secret = v_secret;
END;
$$;

REVOKE ALL ON FUNCTION public.fb_verify_cron_secret(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fb_verify_cron_secret(text) FROM anon;
REVOKE ALL ON FUNCTION public.fb_verify_cron_secret(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.fb_verify_cron_secret(text) TO service_role;