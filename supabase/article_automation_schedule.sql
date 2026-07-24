-- À exécuter dans le SQL Editor de Supabase Cloud APRÈS avoir configuré Vault
-- et déployé la fonction generate-daily-article.
-- Le cron est exprimé en UTC : adaptez 07:00 UTC à l'heure souhaitée.

-- Secrets Vault nécessaires (à créer avec leurs vraies valeurs, hors de Git) :
-- select vault.create_secret('https://<project-ref>.supabase.co', 'article_automation_project_url');
-- select vault.create_secret('<publishable-or-anon-key>', 'article_automation_publishable_key');
-- select vault.create_secret('<same-value-as-ARTICLE_AUTOMATION_CRON_SECRET>', 'article_automation_cron_secret');

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule(jobid)
from cron.job
where jobname = 'generate-daily-article';

select cron.schedule(
  'generate-daily-article',
  '0 7 * * *',
  $job$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'article_automation_project_url')
        || '/functions/v1/generate-daily-article',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'article_automation_publishable_key'),
        'x-article-automation-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'article_automation_cron_secret')
      ),
      body := jsonb_build_object('source', 'supabase-cron'),
      timeout_milliseconds := 120000
    );
  $job$
);
