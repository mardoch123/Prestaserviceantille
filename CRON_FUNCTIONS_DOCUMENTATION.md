# Documentation des Tâches Cron et Fonctions Backend

## Vue d'ensemble

Le projet utilise **deux systèmes** pour les tâches planifiées et les fonctions backend :
1. **Vercel Cron Jobs** - Pour les tâches planifiées simples
2. **Supabase Edge Functions** - Pour les fonctions serverless complexes

---

## 1. Vercel Cron Jobs (Configuration dans `vercel.json`)

### Configuration actuelle

```json
{
  "crons": [
    {
      "path": "/api/cron/purge-device-tokens",
      "schedule": "0 3 * * *"
    }
  ]
}
```

### Tâche Cron existante

| Tâche | Chemin | Schedule | Description |
|-------|--------|----------|-------------|
| Purge Device Tokens | `/api/cron/purge-device-tokens` | `0 3 * * *` (3h00 quotidien) | Supprime les tokens FCM obsolètes |

### Pour ajouter une nouvelle tâche Cron Vercel

1. **Créer le fichier API** dans `/api/cron/nom-de-la-tache.js`
2. **Ajouter la configuration** dans `vercel.json` :

```json
{
  "crons": [
    {
      "path": "/api/cron/purge-device-tokens",
      "schedule": "0 3 * * *"
    },
    {
      "path": "/api/cron/ma-nouvelle-tache",
      "schedule": "0 */6 * * *"
    }
  ]
}
```

**Format Schedule (syntaxe cron)** :
- `0 3 * * *` → Tous les jours à 3h00
- `0 */6 * * *` → Toutes les 6 heures
- `*/5 * * * *` → Toutes les 5 minutes
- `0 9 * * 1` → Tous les lundis à 9h00

---

## 2. Supabase Edge Functions

Les Edge Functions sont déployées sur Supabase et accessibles via l'URL :
```
https://<project-ref>.supabase.co/functions/v1/<function-name>
```

### Liste des Edge Functions

#### A. Rappels de Mission

| Fonction | Fichier | Description | Déclenchement |
|----------|---------|-------------|---------------|
| **mission-reminder-48h** | `supabase/functions/mission-reminder-48h/index.ts` | Rappel 48h aux clients | Appel API manuel ou cron externe |
| **provider-mission-reminder-24h** | `supabase/functions/provider-mission-reminder-24h/index.ts` | Rappel 24h aux prestataires | Appel API manuel ou cron externe |

**Variables d'environnement requises** :
```bash
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
EMAILJS_SERVICE_ID=
EMAILJS_TEMPLATE_ID=
EMAILJS_PUBLIC_KEY=
```

**Test manuel** :
```bash
curl -X POST https://<project>.supabase.co/functions/v1/mission-reminder-48h \
  -H "Authorization: Bearer <service-role-key>" \
  -H "Content-Type: application/json" \
  -d '{"dryRun": true, "limit": 10}'
```

#### B. Marketing Automatisé

| Fonction | Fichier | Description |
|----------|---------|-------------|
| **marketing-automation** | `supabase/functions/marketing-automation/index.ts` | Campagnes marketing automatiques |
| **mkt-auto-create-client** | `supabase/functions/mkt-auto-create-client/index.ts` | Création auto de clients |
| **mkt-notification-dispatcher** | `supabase/functions/mkt-notification-dispatcher/index.ts` | Distribution des notifications marketing |

**Fonctionnalités** :
- Rappel clients sans mission (> 3 jours)
- Rappel post-mission (> 15 jours)
- Création automatique de campagnes

#### C. Devis et Signatures

| Fonction | Fichier | Description |
|----------|---------|-------------|
| **quote-signature-reminder** | `supabase/functions/quote-signature-reminder/index.ts` | Rappel signature de devis (48h avant expiration) |

**Modes** :
- `batch` : Traite tous les devis en attente
- `single` : Traite un devis spécifique (avec `docId`)

#### D. Utilitaires

| Fonction | Fichier | Description |
|----------|---------|-------------|
| **send-email** | `supabase/functions/send-email/index.ts` | Envoi d'emails générique |
| **create-user** | `supabase/functions/create-user/index.ts` | Création d'utilisateurs |

---

## 3. API Routes (Serverless Functions Vercel)

### Fichiers dans `/api/`

| Route | Fichier | Description |
|-------|---------|-------------|
| `/api/cron/purge-device-tokens` | `api/cron/purge-device-tokens.js` | Nettoyage tokens FCM |
| `/api/notify` | `api/notify.js` | Envoi de notifications push |
| `/api/demo-accounts` | `api/demo-accounts.js` | Gestion comptes démo |
| `/api/device-tokens` | `api/device-tokens.js` | Gestion tokens appareils |
| `/api/service-requests` | `api/service-requests.js` | Demandes de service |
| `/api/supabase-proxy` | `api/supabase-proxy.js` | Proxy Supabase |

### Variables d'environnement pour API Routes

```bash
# Supabase
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

# Firebase Cloud Messaging (FCM)
FCM_SERVER_KEY=

# EmailJS (pour emails)
EMAILJS_SERVICE_ID=
EMAILJS_TEMPLATE_ID=
EMAILJS_PUBLIC_KEY=
```

---

## 4. Configuration des Variables d'Environnement

### Vercel Dashboard
1. Allez sur [vercel.com](https://vercel.com)
2. Sélectionnez votre projet
3. **Settings** → **Environment Variables**
4. Ajoutez les variables :
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `FCM_SERVER_KEY`
   - `EMAILJS_SERVICE_ID`
   - `EMAILJS_TEMPLATE_ID`
   - `EMAILJS_PUBLIC_KEY`

### Supabase Dashboard (pour Edge Functions)
1. Allez sur [supabase.com](https://supabase.com)
2. Sélectionnez votre projet
3. **Settings** → **Edge Functions**
4. Cliquez sur **Add secret**
5. Ajoutez les mêmes variables

---

## 5. Déploiement des Edge Functions

### Déployer une fonction

```bash
# Déployer une fonction spécifique
supabase functions deploy mission-reminder-48h

# Déployer toutes les fonctions
supabase functions deploy
```

### Tester localement

```bash
# Lancer le serveur de développement
supabase functions serve

# Tester avec curl
curl -X POST http://localhost:54321/functions/v1/mission-reminder-48h \
  -H "Authorization: Bearer <service-role-key>" \
  -d '{"dryRun": true}'
```

---

## 6. Créer une Nouvelle Edge Function

```bash
# Créer la structure
mkdir -p supabase/functions/ma-nouvelle-fonction
touch supabase/functions/ma-nouvelle-fonction/index.ts
```

**Template de base** (`index.ts`) :

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function getEnv(key: string): string {
  const value = (globalThis as any)?.Deno?.env?.get?.(key);
  if (!value) throw new Error(`Missing env var: ${key}`);
  return value;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = getEnv("SUPABASE_URL");
    const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
    
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Votre logique ici
    
    return new Response(
      JSON.stringify({ ok: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
```

---

## 7. Fonctions SQL Supabase

### Fichiers de migration dans `/supabase/`

| Fichier | Description |
|---------|-------------|
| `marketing_email_system.sql` | Système d'emails marketing |
| `marketing_module.sql` | Module marketing complet |
| `create_mission_change_requests.sql` | Table des demandes de changement |
| `create_video_recordings_table.sql` | Table des enregistrements vidéo |
| `update_contracts_table.sql` | Mise à jour table contrats |

### Appliquer une migration SQL

Via le dashboard Supabase :
1. **SQL Editor** → **New Query**
2. Copiez le contenu du fichier `.sql`
3. Cliquez sur **Run**

---

## 8. Planification des Cron Jobs Recommandée

### Pour les rappels de mission

| Fonction | Fréquence | Méthode |
|----------|-----------|---------|
| `mission-reminder-48h` | Toutes les heures | Cron externe (GitHub Actions / Zapier) |
| `provider-mission-reminder-24h` | Toutes les heures | Cron externe |
| `quote-signature-reminder` | Toutes les 6 heures | Cron externe |
| `marketing-automation` | Une fois par jour | Cron externe |

### Exemple avec GitHub Actions

```yaml
# .github/workflows/cron.yml
name: Cron Jobs
on:
  schedule:
    - cron: '0 * * * *'  # Toutes les heures

jobs:
  reminders:
    runs-on: ubuntu-latest
    steps:
      - name: Call 48h reminder
        run: |
          curl -X POST ${{ secrets.SUPABASE_URL }}/functions/v1/mission-reminder-48h \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}"
      
      - name: Call 24h provider reminder
        run: |
          curl -X POST ${{ secrets.SUPABASE_URL }}/functions/v1/provider-mission-reminder-24h \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}"
```

---

## Résumé des Endpoints

### Edge Functions Supabase
```
POST https://<project>.supabase.co/functions/v1/mission-reminder-48h
POST https://<project>.supabase.co/functions/v1/provider-mission-reminder-24h
POST https://<project>.supabase.co/functions/v1/marketing-automation
POST https://<project>.supabase.co/functions/v1/quote-signature-reminder
POST https://<project>.supabase.co/functions/v1/send-email
POST https://<project>.supabase.co/functions/v1/create-user
POST https://<project>.supabase.co/functions/v1/mkt-auto-create-client
POST https://<project>.supabase.co/functions/v1/mkt-notification-dispatcher
```

### API Routes Vercel
```
GET/POST  /api/cron/purge-device-tokens
POST      /api/notify
GET/POST  /api/demo-accounts
GET/POST  /api/device-tokens
GET/POST  /api/service-requests
GET/POST  /api/supabase-proxy
```

---

## Besoin d'aide ?

- **Documentation Vercel Cron** : https://vercel.com/docs/cron-jobs
- **Documentation Supabase Edge Functions** : https://supabase.com/docs/guides/functions
- **Syntaxe Cron** : https://crontab.guru/
