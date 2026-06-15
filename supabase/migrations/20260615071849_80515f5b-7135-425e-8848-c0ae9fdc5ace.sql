DO $$
BEGIN
  PERFORM net.http_post(
    url := 'https://aervpdnvpepfruxjevxm.supabase.co/functions/v1/process-allowances',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'CRON_SECRET' limit 1)
    ),
    body := '{}'::jsonb
  );

  PERFORM net.http_post(
    url := 'https://aervpdnvpepfruxjevxm.supabase.co/functions/v1/process-recurring-chores',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'CRON_SECRET' limit 1)
    ),
    body := '{}'::jsonb
  );
END $$;