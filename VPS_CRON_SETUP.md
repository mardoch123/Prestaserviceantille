# Configuration Cron Jobs sur VPS Supabase

## 2 Méthodes pour les Cron Jobs sur VPS

### Méthode 1: Cron Système du VPS (Recommandé)

Utilise le cron natif du serveur pour appeler les Edge Functions.

#### 1. Éditer le crontab

```bash
ssh root@votre-vps
crontab -e
```

#### 2. Ajouter les tâches cron

```bash
# Toutes les heures - Rappel 48h clients
0 * * * * curl -X POST https://outremerfermetures.com/api/functions/v1/mission-reminder-48h \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3NzI1Nzg4MDAsImV4cCI6MTkzMDM0NTIwMH0.4N8utvMn8tgjgt7aOTUPDZdutp-plKd-0Gm5Pe3e7m8" \
  -H "Content-Type: application/json" \
  -d '{"limit": 100}' >> /var/log/presta-cron.log 2>&1

# Toutes les heures - Rappel 24h prestataires
15 * * * * curl -X POST https://outremerfermetures.com/api/functions/v1/provider-mission-reminder-24h \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3NzI1Nzg4MDAsImV4cCI6MTkzMDM0NTIwMH0.4N8utvMn8tgjgt7aOTUPDZdutp-plKd-0Gm5Pe3e7m8" \
  -H "Content-Type: application/json" \
  -d '{"limit": 100}' >> /var/log/presta-cron.log 2>&1

# Toutes les 6 heures - Rappel signature devis
0 */6 * * * curl -X POST https://outremerfermetures.com/api/functions/v1/quote-signature-reminder \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3NzI1Nzg4MDAsImV4cCI6MTkzMDM0NTIwMH0.4N8utvMn8tgjgt7aOTUPDZdutp-plKd-0Gm5Pe3e7m8" \
  -H "Content-Type: application/json" \
  -d '{"mode": "batch"}' >> /var/log/presta-cron.log 2>&1

# Une fois par jour à 9h00 - Marketing automation
0 9 * * * curl -X POST https://outremerfermetures.com/api/functions/v1/marketing-automation \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3NzI1Nzg4MDAsImV4cCI6MTkzMDM0NTIwMH0.4N8utvMn8tgjgt7aOTKd-0Gm5Pe3e7m8" \
  >> /var/log/presta-cron.log 2>&1

# Tous les jours à 3h00 - Purge tokens FCM
0 3 * * * curl -X POST https://outremerfermetures.com/api/cron/purge-device-tokens \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3NzI1Nzg4MDAsImV4cCI6MTkzMDM0NTIwMH0.4N8utvMn8tgjgt7aOTUPDZdutp-plKd-0Gm5Pe3e7m8" \
  >> /var/log/presta-cron.log 2>&1
```

#### 3. Créer le fichier de log

```bash
touch /var/log/presta-cron.log
chmod 644 /var/log/presta-cron.log
```

#### 4. Vérifier les logs

```bash
tail -f /var/log/presta-cron.log
```

---

### Méthode 2: pg_cron (Extension PostgreSQL)

Si pg_cron est installé sur votre VPS Supabase.

#### 1. Vérifier si pg_cron est disponible

```sql
SELECT * FROM pg_available_extensions WHERE name = 'pg_cron';
```

#### 2. Activer pg_cron

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
```

#### 3. Créer les tâches cron SQL

```sql
-- Toutes les heures - Rappel 48h
SELECT cron.schedule(
  'mission-reminder-48h',
  '0 * * * *',
  $$ SELECT net.http_post(
    url:='https://outremerfermetures.com/api/functions/v1/mission-reminder-48h',
    headers:='{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIs...", "Content-Type": "application/json"}'::jsonb,
    body:='{"limit": 100}'::jsonb
  ) $$
);

-- Toutes les heures - Rappel 24h prestataires
SELECT cron.schedule(
  'provider-reminder-24h',
  '15 * * * *',
  $$ SELECT net.http_post(
    url:='https://outremerfermetures.com/api/functions/v1/provider-mission-reminder-24h',
    headers:='{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIs..."}'::jsonb,
    body:='{"limit": 100}'::jsonb
  ) $$
);
```

**Note**: Nécessite l'extension `pg_net` pour les requêtes HTTP depuis PostgreSQL.

---

## Commandes Utiles

### Voir les tâches cron actives
```bash
crontab -l
```

### Voir les logs cron
```bash
grep CRON /var/log/syslog
# ou
tail -f /var/log/presta-cron.log
```

### Tester une Edge Function manuellement
```bash
curl -X POST https://outremerfermetures.com/api/functions/v1/mission-reminder-48h \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  -H "Content-Type: application/json" \
  -d '{"dryRun": true, "limit": 5}'
```

### Supprimer une tâche cron
```bash
crontab -e
# Supprimez la ligne correspondante
```

---

## URLs des Edge Functions sur VPS

```
https://outremerfermetures.com/api/functions/v1/mission-reminder-48h
https://outremerfermetures.com/api/functions/v1/provider-mission-reminder-24h
https://outremerfermetures.com/api/functions/v1/quote-signature-reminder
https://outremerfermetures.com/api/functions/v1/marketing-automation
https://outremerfermetures.com/api/functions/v1/send-email
https://outremerfermetures.com/api/functions/v1/create-user
```

---

## Sécurité

**IMPORTANT**: 
- Ne jamais exposer `SUPABASE_SERVICE_ROLE_KEY` côté client
- Utiliser des variables d'environnement dans les scripts cron
- Restreindre l'accès aux logs: `chmod 600 /var/log/presta-cron.log`

### Script avec variables d'environnement

Créez `/opt/presta/cron-env.sh`:
```bash
export SUPABASE_SERVICE_ROLE_KEY="votre_clé"
export FCM_SERVER_KEY="votre_clé_fcm"
```

Puis dans crontab:
```bash
0 * * * * source /opt/presta/cron-env.sh && /opt/presta/run-reminders.sh
```
