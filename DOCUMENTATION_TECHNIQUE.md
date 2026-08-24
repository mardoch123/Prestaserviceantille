# Documentation Technique — Presta Services Antilles

> **Version du document :** 1.0  
> **Dernière mise à jour :** Août 2026  
> **Version de l'application :** 1.0.48+

---

## Table des matières

1. [Vue d'ensemble](#1-vue-densemble)
2. [Architecture technique](#2-architecture-technique)
3. [Stack technologique](#3-stack-technologique)
4. [Structure du projet](#4-structure-du-projet)
5. [Configuration et environnement](#5-configuration-et-environnement)
6. [Modèle de données (Base de données)](#6-modèle-de-données-base-de-données)
7. [Système d'authentification et rôles](#7-système-dauthentification-et-rôles)
8. [Contexte global : DataContext](#8-contexte-global-datacontext)
9. [Routage et navigation](#9-routage-et-navigation)
10. [Modules fonctionnels](#10-modules-fonctionnels)
11. [API Serverless (Vercel)](#11-api-serverless-vercel)
12. [Edge Functions Supabase](#12-edge-functions-supabase)
13. [Moteur de disponibilités](#13-moteur-de-disponibilités)
14. [Système de notifications push](#14-système-de-notifications-push)
15. [Mode hors-ligne et cache](#15-mode-hors-ligne-et-cache)
16. [PWA et Service Worker](#16-pwa-et-service-worker)
17. [Application mobile (Capacitor)](#17-application-mobile-capacitor)
18. [Règles métier](#18-règles-métier)
19. [Build, déploiement et versioning](#19-build-déploiement-et-versioning)
20. [Guide d'extension : ajouter une fonctionnalité](#20-guide-dextension-ajouter-une-fonctionnalité)
21. [Composants externes détaillés (pages et portails)](#21-composants-externes-détaillés-pages-et-portails)

---

## 1. Vue d'ensemble

**Presta Services Antilles** est une application web progressive (PWA) et mobile (Android/iOS) de gestion pour une entreprise de services à la personne (ménage, entretien) basée en Martinique. Elle couvre l'intégralité du cycle opérationnel :

- Gestion des **clients** (CRM, contrats, packs, fidélité)
- Gestion des **prestataires** (planning, disponibilités, congés)
- **Planning** et assignation de missions (avec binômes)
- **Devis / Factures** avec signature électronique
- **Notifications** push et email
- **Marketing** (flyers, promotions, parrainage)
- **SAV** (enquêtes de satisfaction, incidents)
- **Comptabilité** (statistiques financières)
- **QR Code** (pointage entrée/sortie chez les clients)
- **Demandes de service** (workflow client → admin)
- **Supervision vidéo** (enregistrement des interventions)

L'application sert **4 types d'utilisateurs** avec des interfaces dédiées :
- **Super Admin / Admin** : interface complète de gestion
- **Client** : portail client (réservations, factures, suivi)
- **Prestataire** : portail prestataire (missions, pointage, scan)

---

## 2. Architecture technique

### 2.1 Architecture globale

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (Frontend)                         │
│  React 18 + TypeScript + Vite + Tailwind CSS                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │ Portail  │  │ Portail  │  │ Interface│  │  Pages   │       │
│  │ Client   │  │ presta.  │  │   Admin  │  │ Publiques│       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
│                         │                                       │
│              ┌──────────┴──────────┐                            │
│              │   DataContext       │  (État global + CRUD)      │
│              │   (React Context)   │                            │
│              └──────────┬──────────┘                            │
│                         │                                       │
│     ┌───────────────────┼───────────────────┐                   │
│     │                   │                   │                   │
│  ┌──┴───┐         ┌────┴────┐        ┌─────┴─────┐            │
│  │Supa- │         │ TanStack│        │  Modules  │            │
│  │base  │         │ Query   │        │ (marketing│            │
│  │Client│         │ (cache) │        │  SAV etc.)│            │
│  └──┬───┘         └────┬────┘        └─────┬─────┘            │
└─────┼──────────────────┼───────────────────┼───────────────────┘
      │                  │                   │
      ▼                  ▼                   ▼
┌─────────────┐  ┌──────────────┐  ┌──────────────────┐
│  Supabase   │  │   Vercel     │  │  Supabase Edge   │
│  (PostgreSQL│  │  Serverless  │  │  Functions       │
│   + Auth +  │  │  API Routes  │  │  (Deno/TypeScript│
│  Storage)   │  │  (/api/*)    │  │   + Firebase)    │
└─────────────┘  └──────────────┘  └──────────────────┘
```

### 2.2 Flux de données

1. **Lecture** : Le `DataContext` charge toutes les données au démarrage → Supabase REST API → mise en cache TanStack Query + localForage
2. **Écriture** : Mutations via le `DataContext` → Supabase REST/RPC → invalidation du cache
3. **Temps réel** : Notifications push via Firebase Cloud Messaging → Capacitor Push Notifications
4. **Hors-ligne** : Queue d'actions en attente → synchronisation au retour réseau

---

## 3. Stack technologique

### Frontend
| Technologie | Version | Rôle |
|---|---|---|
| **React** | 18.2 | Framework UI |
| **TypeScript** | 5.2 | Typage statique |
| **Vite** | 5.0 | Build tool + dev server |
| **React Router** | 6.20 | Routing SPA |
| **Tailwind CSS** | CDN | Styling utility-first |
| **Lucide React** | 0.300 | Icônes |
| **Recharts** | 2.10 | Graphiques et charts |
| **dayjs** | 1.11 | Manipulation dates |
| **date-fns** | 4.1 | Utilitaires dates |
| **Quill / react-quill** | 1.3/2.0 | Éditeur riche |

### Backend / API
| Technologie | Version | Rôle |
|---|---|---|
| **Supabase** | - | Base PostgreSQL + Auth + Storage + Realtime |
| **Vercel Serverless** | - | API routes (Node.js) |
| **Supabase Edge Functions** | - | Functions Deno (emails, rappels, marketing) |
| **Firebase Admin SDK** | 13.6 | Push notifications FCM |

### Cache / Offline
| Technologie | Version | Rôle |
|---|---|---|
| **TanStack Query** | 5.95 | Cache serveur + mutations |
| **localForage** | 1.10 | Persistance IndexedDB/LocalStorage |
| **Workbox** | 7.4 | Service Worker / PWA |
| **broadcast-channel** | 7.3 | Sync cross-tab |

### Mobile
| Technologie | Version | Rôle |
|---|---|---|
| **Capacitor** | 6.0 | Bridge natif (Android/iOS) |
| **@capacitor/push-notifications** | 6.0 | Push FCM/APNs |
| **@capacitor/local-notifications** | 6.0 | Notifications locales |
| **@capacitor/network** | 6.0 | Détection réseau |
| **@capacitor/haptics** | 6.0 | Retours haptiques |
| **@capacitor/status-bar** | 6.0 | Contrôle barre de statut |

### PDF / Documents
| Technologie | Version | Rôle |
|---|---|---|
| **jsPDF** | 3.0 | Génération PDF |
| **html2canvas** | 1.4 | Capture HTML → image |
| **@react-pdf/renderer** | 4.3 | Composants PDF React |
| **html-to-image** | 1.11 | Conversion HTML → image |

### Vidéo / Streaming
| Technologie | Version | Rôle |
|---|---|---|
| **LiveKit** | 2.16 | WebRTC / visioconférence |
| **simple-peer** | 9.11 | Peer-to-peer vidéo |
| **socket.io-client** | 4.8 | Signaling WebSocket |

---

## 4. Structure du projet

```
Prestaserviceantille/
├── App.tsx                    # POINT D'ENTRÉE PRINCIPAL (routing, layout, providers)
├── index.tsx                  # Montage React + vérification cache
├── index.html                 # HTML shell (Tailwind CDN, fonts, importmap)
├── types.ts                   # TYPES GLOBAUX (User, Provider, Client, Mission, Document...)
│
├── context/
│   ├── DataContext.tsx        # CONTEXTE PRINCIPAL (8300+ lignes, CRUD complet)
│   └── DataContext.tanstack.tsx  # Intégration TanStack Query (cache avancé)
│
├── components/                # COMPOSANTS UI
│   ├── Admin*.tsx             # Pages admin (Devis, Missions, Notifications...)
│   ├── Client*.tsx            # Portail client
│   ├── Provider*.tsx          # Portail prestataire
│   ├── Planning.tsx           # Planning avec vue calendrier
│   ├── Dashboard.tsx          # Tableau de bord
│   ├── DevisFactures.tsx      # Gestion devis/factures
│   ├── mobile/                # Composants mobile (Toast, BottomNav, PullToRefresh)
│   └── ...                    # 40+ composants
│
├── modules/                   # MODULES FONCTIONNELS ISOLÉS
│   ├── marketing/             # Flyers, parrainage, promotions, récompenses
│   │   ├── ui/               # 25+ pages UI
│   │   ├── client.ts         # Client API Supabase
│   │   ├── referralClient.ts # Client API parrainage
│   │   └── types.ts          # Types marketing
│   ├── sav/                   # Service Après-Vente
│   │   ├── ui/               # Pages SAV
│   │   ├── client.ts         # Client API (RPC Supabase)
│   │   └── types.ts          # Types SAV
│   ├── providerAvailability/  # Disponibilité prestataires
│   │   ├── ui/               # Page disponibilité
│   │   ├── client.ts         # Client API
│   │   └── types.ts          # Types
│   ├── serviceRequests/       # Demandes de service client
│   │   ├── ui/               # Pages demandes
│   │   ├── client.ts         # Client API
│   │   └── types.ts          # Types
│   └── accounting/            # Comptabilité (protégée par code)
│       ├── ui/               # Page statistiques
│       └── useAccountingAuth.ts  # Hook auth par code
│
├── hooks/                     # HOOKS PERSONNALISÉS
│   ├── useSupabaseQueries.ts  # Hooks TanStack Query (useClients, useMissions...)
│   ├── useMobile.ts           # Détection viewport mobile
│   ├── useHaptic.ts           # Retours haptiques
│   ├── useSwipe.ts            # Gestes swipe
│   ├── usePullToRefresh.ts    # Pull-to-refresh
│   ├── useUploadProgress.ts   # Progression uploads
│   ├── useCacheManager.ts     # Gestion cache
│   └── useCachedData.ts       # Données cachées
│
├── utils/                     # UTILITAIRES
│   ├── supabaseClient.ts      # Client Supabase configuré
│   ├── availabilityCalculator.ts  # MOTEUR DE DISPONIBILITÉS (850 lignes)
│   ├── holidays.ts            # Jours fériés Martinique
│   ├── emailService.ts        # Envoi emails (EmailJS)
│   ├── emailTemplates.ts      # Templates emails
│   ├── serviceTypes.ts        # Détection type de service
│   ├── queryClient.ts         # Config TanStack Query + persistance
│   ├── dataCache.ts           # Cache de données
│   ├── smartFetch.ts          # Fetch intelligent (retry, offline)
│   ├── cacheManager.ts        # Gestionnaire cache global
│   ├── serviceWorkerRegistration.ts  # Enregistrement SW
│   ├── htmlPdf.ts             # Génération PDF HTML
│   ├── videoStreaming.ts      # Streaming vidéo
│   └── networkRetry.ts        # Retry réseau
│
├── api/                       # API SERVERLESS (Vercel)
│   ├── _lib/
│   │   ├── supabaseAdmin.js   # Client Supabase admin (service_role)
│   │   └── firebaseAdmin.js   # Firebase Admin SDK
│   ├── notify.js              # Endpoint push notifications
│   ├── device-tokens.js       # Enregistrement tokens push
│   ├── service-requests.js    # API demandes de service
│   ├── emailjs-quota.js       # Quota emails
│   ├── supabase-proxy.js      # Proxy Supabase
│   ├── demo-accounts.js       # Comptes démo
│   └── cron/
│       └── purge-device-tokens.js  # Purge tokens expirés (cron quotidien)
│
├── supabase/
│   ├── functions/             # EDGE FUNCTIONS (11 fonctions)
│   │   ├── create-user/       # Création utilisateur + email bienvenue
│   │   ├── send-email/        # Envoi email transactionnel
│   │   ├── send-password-reset/  # Reset mot de passe
│   │   ├── mission-reminder-48h/ # Rappel client 48h avant mission
│   │   ├── provider-mission-reminder-24h/  # Rappel prestataire 24h
│   │   ├── quote-signature-reminder/  # Rappel signature devis
│   │   ├── marketing-automation/  # Automation marketing
│   │   ├── mkt-auto-create-client/  # Auto-création client depuis lead
│   │   ├── mkt-notification-dispatcher/ # Dispatch notifications marketing
│   │   ├── emailjs-quota/     # Vérification quota EmailJS
│   │   └── run-migrations/    # Exécution migrations
│   └── migrations/            # 30 fichiers SQL de migration
│
├── android/                   # Projet Android natif (Capacitor)
├── scripts/                   # Scripts build/déploiement
├── public/                    # Assets statiques + Service Worker
├── resources/                 # Icônes et splash screens
├── capacitor.config.ts        # Configuration Capacitor
├── vite.config.ts             # Configuration Vite + PWA
├── vercel.json                # Configuration Vercel (rewrites, crons)
└── package.json               # Dépendances et scripts
```

---

## 5. Configuration et environnement

### 5.1 Variables d'environnement

Créer un fichier `.env` à la racine (voir `.env.example`) :

```bash
# Frontend (Vite) — accessible côté client
VITE_SUPABASE_URL=https://<votre-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<votre-anon-key>

# Optionnel : URL de base API (auto-détecté en production)
# VITE_API_BASE=https://votre-domaine.vercel.app

# Backend (Vercel serverless) — JAMAIS exposé au client
SUPABASE_URL=https://<votre-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<votre-service-role-key>

# Firebase (push notifications)
FIREBASE_PROJECT_ID=<votre-project-id>
FIREBASE_CLIENT_EMAIL=<votre-client-email>
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n"
```

### 5.2 Configuration Supabase

Le client Supabase est configuré dans `utils/supabaseClient.ts` :
- **URL** : Résout dynamiquement entre VPS, proxy Vercel, ou Supabase cloud
- **Auth** : Session persistante via `localStorage`, auto-refresh des tokens
- **Clé** : `anon key` côté frontend, `service_role` côté API uniquement

### 5.3 Démarrage local

```bash
npm install          # Installer les dépendances
npm run dev          # Lancer le dev server (port 3000)
npm run dev:vercel   # Lancer avec les API Vercel (port 3000 + 3001)
```

---

## 6. Modèle de données (Base de données)

### 6.1 Tables principales

La base de données est **PostgreSQL** hébergée sur Supabase. Voici les tables principales :

#### `users` — Utilisateurs authentifiés
| Colonne | Type | Description |
|---|---|---|
| `id` | UUID | Identifiant Supabase Auth |
| `email` | TEXT | Email de connexion |
| `role` | ENUM | `admin`, `super_admin`, `client`, `provider` |
| `related_entity_id` | UUID | Lien vers `clients.id` ou `providers.id` |

#### `clients` — Clients
| Colonne | Type | Description |
|---|---|---|
| `id` | UUID | Identifiant unique |
| `name` | TEXT | Nom complet |
| `address` | TEXT | Adresse d'intervention |
| `city` | TEXT | Ville |
| `email` | TEXT | Email |
| `phone` | TEXT | Téléphone |
| `pack` | TEXT | Pack souscrit |
| `status` | TEXT | `active`, `new`, `prospect` |
| `since` | DATE | Date d'inscription |
| `packs_consumed` | INT | Packs consommés |
| `loyalty_hours_available` | FLOAT | Heures de fidélité |
| `initial_password` | TEXT | Mot de passe initial (admin) |

#### `providers` — Prestataires
| Colonne | Type | Description |
|---|---|---|
| `id` | UUID | Identifiant unique |
| `first_name` | TEXT | Prénom |
| `last_name` | TEXT | Nom |
| `email` | TEXT | Email |
| `phone` | TEXT | Téléphone |
| `specialty` | TEXT | Spécialité (ex: "Ménage") |
| `status` | TEXT | `Active`, `Inactive`, `Passive` |
| `rating` | FLOAT | Note moyenne |
| `hours_worked` | FLOAT | Heures travaillées |
| `non_intervention_days` | JSONB | Jours de repos [0-6] |
| `non_intervention_hours` | JSONB | Plages horaires d'indisponibilité |
| `availability_mode` | TEXT | `unavailable` (défaut) ou `available` |
| `availability_hours` | JSONB | Plages de disponibilité (mode `available`) |
| `scheduled_unavailabilities` | JSONB | Indisponibilités programmées multi-semaines |
| `one_time_unavailabilities` | JSONB | Indisponibilités ponctuelles |
| `initial_password` | TEXT | Mot de passe initial |

#### `missions` — Missions / Interventions
| Colonne | Type | Description |
|---|---|---|
| `id` | UUID | Identifiant unique |
| `date` | DATE | Date d'intervention |
| `start_time` | TIME | Heure de début |
| `end_time` | TIME | Heure de fin |
| `duration` | FLOAT | Durée en heures |
| `service` | TEXT | Description du service |
| `service_type` | TEXT | `Ménage`, `Jardinage`, `Bricolage`, `Autre` |
| `client_id` | UUID | FK → clients |
| `client_name` | TEXT | Nom du client (dénormalisé) |
| `provider_id` | UUID | FK → providers (prestataire 1) |
| `provider_name` | TEXT | Nom prestataire 1 |
| `provider2_id` | UUID | FK → providers (prestataire 2 / binôme) |
| `provider2_name` | TEXT | Nom prestataire 2 |
| `status` | TEXT | `planned`, `in_progress`, `completed`, `cancelled` |
| `color` | TEXT | `orange`, `blue`, `green`, `gray` |
| `source` | TEXT | `devis` ou `reservation` |
| `start_photos` | TEXT[] | URLs photos de début |
| `end_photos` | TEXT[] | URLs photos de fin |
| `start_remark` | TEXT | Remarque de début |
| `end_remark` | TEXT | Remarque de fin |
| `started_at` | TIMESTAMPTZ | Timestamp de démarrage |
| `is_overtime` | BOOLEAN | Heures supplémentaires |
| `source_document_id` | UUID | FK → documents (devis source) |

#### `documents` — Devis et Factures
| Colonne | Type | Description |
|---|---|---|
| `id` | UUID | Identifiant unique |
| `ref` | TEXT | Référence unique |
| `client_id` | UUID | FK → clients |
| `client_name` | TEXT | Nom du client |
| `date` | DATE | Date du document |
| `type` | TEXT | `Devis` ou `Facture` |
| `category` | TEXT | `pack` ou `custom` |
| `description` | TEXT | Description |
| `service_type` | TEXT | Type de service |
| `unit_price` | FLOAT | Prix unitaire |
| `quantity` | INT | Quantité |
| `tva_rate` | FLOAT | Taux TVA (0, 2.1, 8.5) |
| `total_ht` | FLOAT | Total HT |
| `total_ttc` | FLOAT | Total TTC |
| `tax_credit_enabled` | BOOLEAN | Crédit d'impôt activé |
| `status` | TEXT | `draft`, `sent`, `signed`, `validated`, `expired`, `paid`, `converted`, `rejected` |
| `linked_invoice_id` | UUID | FK self-referencing (devis → facture) |
| `slots_data` | JSONB | Créneaux horaires proposés |
| `frequency` | TEXT | Fréquence (hebdomadaire, etc.) |
| `signature_data` | TEXT | URL/Base64 signature |
| `client_signature_url` | TEXT | URL signature client |
| `signed_at` | TIMESTAMPTZ | Date de signature |
| `pack_id` | UUID | FK → packs |

#### `packs` — Packs de services
| Colonne | Type | Description |
|---|---|---|
| `id` | UUID | Identifiant unique |
| `name` | TEXT | Nom du pack |
| `main_service` | TEXT | Service principal |
| `hours` | FLOAT | Heures incluses |
| `frequency` | TEXT | Fréquence |
| `type` | TEXT | `ponctuel` ou `regulier` |
| `price_ttc` | FLOAT | Prix TTC |
| `price_ht` | FLOAT | Prix HT |
| `is_sap` | BOOLEAN | Services à la personne |
| `schedules` | JSONB | Options d'horaires |

#### `contracts` — Contrats
| Colonne | Type | Description |
|---|---|---|
| `id` | UUID | Identifiant unique |
| `name` | TEXT | Nom du contrat |
| `content` | TEXT | Contenu (HTML/texte) |
| `pack_id` | UUID | FK → packs |
| `client_id` | UUID | FK → clients |
| `status` | TEXT | `draft`, `active`, `pending_validation` |
| `validation_status` | TEXT | `draft`, `pending_validation`, `validated`, `rejected` |
| `is_generic` | BOOLEAN | Contrat générique |
| `quote_id` | UUID | FK → documents (devis associé) |

#### `notifications` — Notifications applicatives
| Colonne | Type | Description |
|---|---|---|
| `id` | UUID | Identifiant unique |
| `type` | TEXT | `info`, `alert`, `success`, `message` |
| `title` | TEXT | Titre |
| `message` | TEXT | Message |
| `date` | TIMESTAMPTZ | Date |
| `is_read` | BOOLEAN | Lu ou non |
| `target_user_type` | TEXT | `admin`, `client`, `provider` |
| `target_user_id` | UUID | ID utilisateur cible |
| `link` | TEXT | Lien de navigation |

### 6.2 Tables Marketing (module `marketing`)

| Table | Description |
|---|---|
| `mkt_flyers` | Flyers promotionnels (titre, image, prix, dates) |
| `mkt_promotions` | Codes promotionnels (pourcentage/fixe) |
| `mkt_customer_requests` | Demandes clients depuis flyers |
| `mkt_referrers` | Parrains (code de parrainage, lien auth) |
| `mkt_referrals` | Filleuls (lien parrain → filleul) |
| `mkt_points_ledger` | Grand livre de points (entrées/sorties) |
| `mkt_rewards` | Récompenses disponibles |
| `mkt_reward_rules` | Règles d'éligibilité aux récompenses |
| `mkt_reward_redemptions` | Demandes de récompenses |
| `client_leads` | Leads clients (via parrainage/marketing) |

### 6.3 Tables SAV

| Table | Description |
|---|---|
| `sav_records` | Enregistrements SAV (type, statut, priorité) |
| `satisfaction_surveys` | Enquêtes de satisfaction (qualité, propreté, recommandation) |

### 6.4 Tables infrastructure

| Table | Description |
|---|---|
| `device_tokens` | Tokens push par utilisateur (token, platform, last_seen) |
| `provider_availability` | Créneaux de disponibilité par date |
| `customer_service_requests` | Demandes de service client |
| `email_logs` | Logs d'emails envoyés |
| `visit_scans` | Pointages QR code (entrée/sortie) |
| `expenses` | Dépenses (catégorie, montant, justificatif) |
| `messages` | Messages admin ↔ client |
| `reminders` | Rappels administratifs |
| `company_settings` | Paramètres entreprise (JSON single-row) |

### 6.5 Storage Buckets

| Bucket | Contenu |
|---|---|
| `documents` | PDFs, signatures, images de formulaires SAV |
| `mission_media` | Photos/vidéos de début et fin de mission |

---

## 7. Système d'authentification et rôles

### 7.1 Flux d'authentification

```
Login → Supabase Auth (email/password)
  ├── Succès → Stockage session localStorage ('sb-presta-auth-token')
  │            → Chargement User + relatedEntityId
  │            → Redirection selon rôle
  └── Échec → Message d'erreur
```

### 7.2 Rôles et permissions

| Rôle | Accès | Interface |
|---|---|---|
| `super_admin` | Tout (validation contrats, suppression) | Admin complète |
| `admin` | Gestion complète (sauf validations super_admin) | Admin complète |
| `client` | Réservations, factures, profil, scan QR | Portail Client |
| `provider` | Missions, pointage, scan QR | Portail Prestataire |

### 7.3 Cycle de vie de session

1. **Connexion** : `supabase.auth.signInWithPassword()` → session stockée dans `localStorage`
2. **Persistance** : `presta_current_user` dans `localStorage` pour restauration rapide
3. **Rafraîchissement** : Auto-refresh du token JWT par le client Supabase
4. **Déconnexion** : `supabase.auth.signOut()` → nettoyage complet du cache
5. **Reset password** : Edge Function `send-password-reset` → email avec lien

### 7.4 Comptes démo

Un système de démonstration permet de tester l'interface avec des données fictives :
- `enterDemoMode(role)` → bascule en mode démo
- Les données démo sont isolées des données réelles
- Rôles disponibles : `admin`, `client`, `provider`

---

## 8. Contexte global : DataContext

Le `DataContext` (`context/DataContext.tsx`) est le **centre névralgique** de l'application. C'est un React Context de ~8300 lignes qui fournit :

### 8.1 Données globales
```typescript
{
  currentUser: User | null,
  clients: Client[],
  providers: Provider[],
  missions: Mission[],
  documents: Document[],
  packs: Pack[],
  contracts: Contract[],
  notifications: AppNotification[],
  messages: Message[],
  reminders: Reminder[],
  expenses: Expense[],
  contactForms: ContactForm[],
  visitScans: VisitScan[],
  videoRecordings: VideoRecording[],
  companySettings: CompanySettings,
  // ... et plus
}
```

### 8.2 Fonctions CRUD
Chaque entité a ses fonctions de création, lecture, mise à jour et suppression :
- `addClient()`, `updateClient()`, `deleteClients()`
- `addProvider()`, `updateProvider()`, `deleteProviders()`
- `addMission()`, `startMission()`, `endMission()`, `updateMission()`
- `addDocument()`, `updateDocument()`, `convertQuoteToInvoice()`
- etc.

### 8.3 Fonctions métier spécifiques
- `getAvailableSlots(date)` → Créneaux libres
- `generateMissionsFromDocument(doc)` → Génère les missions depuis un devis signé
- `assignProvider()`, `assignSecondProvider()` → Assignation prestataires (binôme)
- `signQuoteWithData()` → Signature électronique de devis
- `registerScan(clientId)` → Pointage QR code
- `requestMissionReschedule()` → Demande de reprogrammation

### 8.4 Gestion réseau
- `isOnline` : État de connexion
- `pendingSyncCount` : Actions en attente
- `attemptReconnection()` : Tentative de reconnexion
- `connectionStatus` : `connected` | `disconnected` | `reconnecting`

### 8.5 Initialisation

Au démarrage, le `DataProvider` :
1. Restaure la session utilisateur depuis `localStorage`
2. Vérifie la connectivité réseau
3. Charge toutes les données depuis Supabase (tables principales)
4. Initialise les paramètres entreprise
5. Démarre l'écoute des changements réseau

---

## 9. Routage et navigation

### 9.1 Architecture de routage

Le routage utilise `react-router-dom` v6 avec une logique de redirection dans `AppLayout` :

```
App
├── ErrorBoundary
├── QueryClientProvider (TanStack)
├── DataProvider (Context)
│   └── BrowserRouter
│       └── AppLayout
│           ├── Routes publiques (sans auth)
│           │   ├── /contact → ContactPage
│           │   ├── /flyers/* → FlyersPublicRoutes
│           │   ├── /parrainage/* → ReferralPublicRoutes
│           │   └── /disponibilites → PublicAvailabilityPage
│           │
│           ├── Non-authentifié → Login / ResetPassword
│           │
│           ├── role === 'client' → ClientPortal
│           │   ├── /scan → ScanPage
│           │   ├── /scan-success → ScanSuccess
│           │   └── /nouvelle-demande → NewServiceRequestPage
│           │
│           ├── role === 'provider' → ProviderPortal
│           │   ├── /scan → ScanPage
│           │   └── /scan-success → ScanSuccess
│           │
│           └── role === 'admin' | 'super_admin' → Admin Layout
│               ├── / → Dashboard
│               ├── /clients → Clients
│               ├── /clients/:id → ClientDetailPage
│               ├── /providers → Providers
│               ├── /providers/:id → ProviderDetailPage
│               ├── /invoices → DevisFactures
│               ├── /invoices/:id → DocumentDetailPage
│               ├── /planning → Planning
│               ├── /planning/missions/:id → MissionDetailPage
│               ├── /statistics → Statistics
│               ├── /financials → Financials
│               ├── /reservations → Reservations
│               ├── /secretariat → Secretariat
│               ├── /qrcode → QRCodeManager
│               ├── /reports → MissionReports
│               ├── /settings → Settings
│               ├── /admin/devis/:id → AdminDevisDetails
│               ├── /admin/planning/missions/:id → AdminMissionDetails
│               ├── /admin/notifications/:id → AdminNotificationDetails
│               ├── /admin/flyers → AdminFlyersPage
│               ├── /admin/referrals → AdminReferralsPage
│               ├── /admin/service-requests → AdminServiceRequestsPage
│               ├── /admin/email-marketing → AdminEmailMarketing
│               ├── /provider-availability → ProviderAvailabilityPage
│               ├── /sav → SAVPage
│               ├── /accounting → AccountingStatistics
│               └── /demo-accounts → DemoAccounts
```

### 9.2 Sidebar (navigation admin)

La sidebar (`components/Sidebar.tsx`) organise les liens en sections :
- **Principal** : Dashboard, QR, Planning, Devis/Factures
- **Gestion** : Clients, Prestataires, Réservations, Secrétariat
- **Marketing** : Flyers, Parrainage, Email Marketing (sous-menu collapsible)
- **Analyse** : Statistiques, Comptabilité, Rapports
- **Système** : SAV, Formulaires contact, Comptes démo, Paramètres
- **Filtre service** : Dropdown pour filtrer par type (Ménage, Bricolage, etc.)

---

## 10. Modules fonctionnels

### 10.1 Module Marketing (`modules/marketing/`)

**Architecture** : Module autonome avec son propre client API, types et 25+ pages UI.

#### Sous-modules :

**Flyers & Promotions** :
- `FlyersPromotionsPage` : Page publique listant les offres
- `FlyerDetailsPage` : Détail d'un flyer
- `FlyerRequestPage` : Formulaire de demande depuis un flyer
- `AdminFlyersPage` : Gestion admin des flyers (CRUD)
- `AdminCustomerRequestsPage` : Traitement des demandes clients

**Parrainage (Referral System)** :
- Système de parrainage multi-niveaux avec points de fidélité
- `BecomeReferrerPage` / `BecomeReferrerClientPage` : Inscription parrain
- `RegisterFilleulPage` : Inscription filleul
- `ReferralSignupPage` : Finalisation inscription
- `ReferrerDashboardPage` : Dashboard parrain
- `MyFilleulsPage` : Liste des filleuls
- `ReferralPointsPage` : Solde de points
- `RewardsCatalogPage` : Catalogue de récompenses
- `AdminReferralsPage` : Gestion admin des filleuls
- `AdminReferrersPerformancePage` : Performance des parrains
- `AdminRewardsPointsPage` : Gestion des récompenses/points

**Flux de points** :
```
Mission complétée → +points (ledger)
Facture payée → +points (ledger)
Ajustement admin → ±points (ledger)
Récompense demandée → -points (ledger)
```

**Fonctions API clés** (`client.ts`) :
- `mktAutoCreateClient()` : Auto-création client via Edge Function
- `createReferrer()` / `createReferral()` : Création parrain/filleul
- `getMyPointsSummary()` : Solde de points
- `adminListReferrersPerformance()` : Stats admin via RPC
- `adminAdjustReferrerPoints()` : Ajustement manuel de points
- `adminGrantReward()` : Attribution de récompense

### 10.2 Module SAV (`modules/sav/`)

**Service Après-Vente** avec enquêtes de satisfaction et gestion d'incidents.

**Types de SAV** :
- `satisfaction_survey` : Enquête de qualité post-mission
- `complaint` : Réclamation client
- `incident` : Incident pendant l'intervention
- `follow_up` : Suivi planifié

**Enquête de satisfaction** (3 questions) :
1. **Qualité** : `excellent` | `bon` | `a_améliorer`
2. **Propreté** : `très_propre` | `correctement_propre` | `à_améliorer`
3. **Recommandation** : `oui` | `peut_être` | `non`

**Accès DB** : Utilise exclusivement des **RPC Supabase** (fonctions SQL `SECURITY DEFINER`) pour contourner les politiques RLS.

### 10.3 Module Disponibilité Prestataires (`modules/providerAvailability/`)

**Vue calendrier** des disponibilités avec assignation de missions non-assignées.

**Fonctionnalités** :
- Vue jour/semaine/mois
- Filtrage par domaine (Ménage uniquement)
- Détection de conflits d'horaires
- Assignation de missions non-pourvues
- Mise à jour de disponibilité par date

### 10.4 Module Demandes de Service (`modules/serviceRequests/`)

**Workflow** : Client crée une demande → Admin valide → Devis + Missions générés

**Statuts** : `pending` → `validated` | `rejected` | `cancelled`

**Données** :
- Type de service, pack associé
- Créneaux demandés (date + horaires)
- Signature électronique du client
- Prix estimé

### 10.5 Module Comptabilité (`modules/accounting/`)

**Protection** : Accès par code (`COMPTA2024!`) avec session d'1 heure.

**Fonctionnement** :
- Hook `useAccountingAuth()` gère l'authentification par code
- Session stockée en `sessionStorage` (expire à la fermeture d'onglet)
- Affiche des statistiques financières détaillées

---

## 11. API Serverless (Vercel)

### 11.1 Configuration (`vercel.json`)

```json
{
  "rewrites": [
    { "source": "/api/supabase/(.*)", "destination": "/api/supabase-proxy.js?path=$1" },
    { "source": "/api/(.*)", "destination": "/api/$1" },
    { "source": "/(.*)", "destination": "/index.html" }
  ],
  "crons": [
    { "path": "/api/cron/purge-device-tokens", "schedule": "0 3 * * *" }
  ]
}
```

### 11.2 Endpoints

| Endpoint | Méthode | Description |
|---|---|---|
| `/api/notify` | POST | Envoi push notifications (FCM) |
| `/api/device-tokens` | POST | Enregistrement token push |
| `/api/service-requests` | GET/POST | Gestion demandes de service |
| `/api/emailjs-quota` | GET | Vérification quota EmailJS |
| `/api/demo-accounts` | GET | Comptes de démonstration |
| `/api/supabase-proxy` | ALL | Proxy vers Supabase (contournement CORS) |
| `/api/cron/purge-device-tokens` | GET | Purge quotidienne des tokens expirés |

### 11.3 Sécurité API

Toutes les routes API utilisent :
- **Authentification** : Header `Authorization: Bearer <access_token>` Supabase
- **Vérification rôle** : Le middleware `getUserFromAuthHeader()` valide le token via `admin.auth.getUser()`
- **CORS** : Origines autorisées configurées (domaines de production + localhost)
- **Service Role** : Côté API, utilisation de `SUPABASE_SERVICE_ROLE_KEY` pour bypass RLS

---

## 12. Edge Functions Supabase

### 12.1 Liste des fonctions

| Fonction | Trigger | Description |
|---|---|---|
| `create-user` | Invocation | Création compte + email de bienvenue |
| `send-email` | Invocation | Envoi email transactionnel |
| `send-password-reset` | Invocation | Envoi lien reset mot de passe |
| `mission-reminder-48h` | Cron/Invocation | Rappel client 48h avant mission |
| `provider-mission-reminder-24h` | Cron/Invocation | Rappel prestataire 24h avant |
| `quote-signature-reminder` | Cron/Invocation | Relance signature devis en attente |
| `marketing-automation` | Cron | Automation marketing (flyers, offres) |
| `mkt-auto-create-client` | Invocation | Auto-création client depuis lead marketing |
| `mkt-notification-dispatcher` | Invocation | Dispatch notifications marketing |
| `emailjs-quota` | Invocation | Vérification quota EmailJS |
| `run-migrations` | Invocation | Exécution de migrations SQL |

### 12.2 Pattern d'invocation

```typescript
// Invocation depuis le frontend
const { data, error } = await supabase.functions.invoke('nom-fonction', {
  body: { param1: 'value1', param2: 'value2' }
});
```

---

## 13. Moteur de disponibilités

Le moteur de calcul des disponibilités (`utils/availabilityCalculator.ts`) est le composant le plus complexe. Il applique les règles métier strictes.

### 13.1 Constantes

```typescript
AVAILABILITY_OPEN_HOUR = 8    // Ouverture : 8h
AVAILABILITY_CLOSE_HOUR = 17  // Fermeture : 17h
MAX_PRESTATIONS_PER_DAY = 2   // Max 2 prestations/jour/prestataire
TRAVEL_BUFFER_MIN = 30        // 30 min de trajet entre prestations
```

### 13.2 Créneaux autorisés (fixes)

| Durée | Créneaux possibles |
|---|---|
| **6h** | 09:00–15:00, 08:00–16:00 |
| **4h** | 09:00–13:00, 08:00–12:00, 13:00–17:00 |
| **3h** | 09:00–12:00, 08:00–11:00, 13:00–16:00, 13:30–16:30, 14:00–17:00 |

**Règle** : Un prestataire ne peut PAS avoir 2 créneaux de 4h le même jour.

### 13.3 Algorithme de calcul (`computeAvailabilitySlots`)

```
1. Vérifier jour férié Martinique → si oui, retour []
2. Filtrer prestataires :
   a. Spécialité "Ménage" uniquement (isMenageSpecialty)
   b. Statut actif/passif (isProviderActive)
   c. Déduplication par ID
3. Pour chaque créneau autorisé (du plus long au plus court) :
   a. Pour chaque prestataire filtré :
      - Vérifier congé approuvé (leaves)
      - Calculer heures de travail (getProviderWorkingHours)
      - Filtrer indisponibilités programmées (scheduled)
      - Filtrer indisponibilités ponctuelles (oneTime)
      - Vérifier couverture totale du créneau
      - Règle 4h : pas 2 créneaux de 4h/jour
      - Vérifier pas de chevauchement + max 2/jour
   b. Si au moins 1 prestataire libre → créneau disponible
4. Trier par heure de début, puis durée décroissante
```

### 13.4 Modes de disponibilité

| Mode | Comportement |
|---|---|
| `unavailable` (défaut) | Disponible SAUF pendant `nonInterventionHours` |
| `available` | Disponible UNIQUEMENT pendant `availabilityHours` |

### 13.5 Types d'indisponibilités

| Type | Description | Exemple |
|---|---|---|
| `nonInterventionDays` | Jours de repos récurrents (0=Dim...6=Sam) | `[0, 6]` = pas dimanche/samedi |
| `nonInterventionHours` | Plages horaires récurrentes par jour | `{1: [{start: "12:00", end: "14:00"}]}` |
| `scheduledUnavailabilities` | Indisponibilité sur N semaines | `dayOfWeek: 1, weeks: 4, startTime: "09:00"` |
| `oneTimeUnavailabilities` | Indisponibilité ponctuelle (1 date) | `date: "2026-08-15", startTime: "09:00"` |
| `leaves` | Congés approuvés | `startDate → endDate` |

### 13.6 Missions provisoires

Les devis envoyés (`status: 'sent'`, non expirés) avec des `slotsData` bloquent les disponibilités comme des missions planifiées pour éviter le surbooking.

---

## 14. Système de notifications push

### 14.1 Architecture

```
App (admin) → API /api/notify → Firebase FCM → App mobile (client/prestataire)
```

### 14.2 Flux d'enregistrement

1. App mobile démarre → `PushNotifications.register()`
2. Token FCM reçu → `POST /api/device-tokens` (avec Bearer token)
3. Token stocké dans `device_tokens` (user_id, token, platform)
4. Purge automatique quotidienne des tokens expirés (cron Vercel)

### 14.3 Envoi de notification

```javascript
// POST /api/notify
{
  targetUserType: 'client',     // 'admin' | 'client' | 'provider'
  targetUserId: 'uuid',         // ID de l'entité (client.id, provider.id)
  title: 'Rappel mission',
  body: 'Votre mission commence dans 48h',
  data: { link: 'mission:uuid' }  // Deep link
}
```

### 14.4 Deep links

Les notifications supportent des liens de navigation :
- `document:<id>` → `/admin/devis/<id>`
- `mission:<id>` → `/admin/planning/missions/<id>`
- `tab:planning` → `/planning`
- `/path` → Navigation directe

### 14.5 Canaux Android

Un canal par défaut `presta_default_channel` est créé avec :
- Importance maximale (5)
- Son, vibration, LED

---

## 15. Mode hors-ligne et cache

### 15.1 Stratégie de cache

```
┌─────────────────────────────────────────────┐
│           TanStack Query (QueryClient)       │
│  staleTime: 5 min | gcTime: 24h             │
│  networkMode: 'offlineFirst'                │
│  retry: 3 avec backoff exponentiel          │
├─────────────────────────────────────────────┤
│         localForage (IndexedDB)              │
│  Persistance du cache entre sessions        │
│  maxAge: 24h                                │
├─────────────────────────────────────────────┤
│         BroadcastChannel                     │
│  Synchronisation cross-tab                  │
└─────────────────────────────────────────────┘
```

### 15.2 Détection réseau

- **Native** : `@capacitor/network` sur mobile
- **Web** : `navigator.onLine` + ping vers `/favicon.ico`
- **Bandeau offline** : Affiche le nombre d'actions en attente

### 15.3 File d'attente d'actions

Les actions effectuées hors-ligne sont mises en queue :
- `enqueueStartMission()` / `enqueueEndMission()`
- Synchronisation automatique au retour réseau
- Compteur `pendingSyncCount` affiché dans le bandeau

### 15.4 smartFetch

Utilitaire `utils/smartFetch.ts` :
- Tente un fetch réseau
- En cas d'échec, retourne les données en cache
- Retry intelligent avec backoff

---

## 16. PWA et Service Worker

### 16.1 Configuration Workbox (`vite.config.ts`)

```typescript
VitePWA({
  registerType: 'autoUpdate',
  workbox: {
    globPatterns: ['**/*.{js,css,html,png,jpg,jpeg,svg,gif,woff,woff2,ttf,json}'],
    maximumFileSizeToCacheInBytes: 7 * 1024 * 1024,  // 7 MB
    navigateFallback: '/index.html',
    navigateFallbackDenylist: [/^\/api\//, /^\/rest\/v1\//, /^\/auth\/v1\//],
    runtimeCaching: [
      // API Supabase → NetworkFirst (10s timeout, cache 24h)
      // Assets legacy → CacheFirst (30 jours)
    ],
    skipWaiting: true,
    clientsClaim: true,
  }
})
```

### 16.2 Stratégies de cache

| Ressource | Stratégie | Durée |
|---|---|---|
| API Supabase | NetworkFirst | 24h, max 500 entrées |
| Assets legacy (anciens.prestaservicesantilles.com) | CacheFirst | 30 jours |
| Fichiers statiques (JS, CSS, HTML) | StaleWhileRevalidate | - |

### 16.3 Mise à jour

- `checkAndClearCacheOnUpdate()` au démarrage : compare la version locale avec `version.json`
- Si nouvelle version → nettoyage des caches + notification utilisateur (`UpdateNotification`)
- Service Worker en `autoUpdate` → activation immédiate (`skipWaiting`)

---

## 17. Application mobile (Capacitor)

### 17.1 Configuration

```typescript
// capacitor.config.ts
{
  appId: 'com.prestaservicesantilles.app',
  appName: 'Presta Services Antilles',
  webDir: 'dist',
  plugins: {
    SplashScreen: { launchShowDuration: 3000 },
    PushNotifications: { presentationOptions: ['badge', 'sound', 'alert'] },
    StatusBar: { style: 'LIGHT', backgroundColor: '#FFFFFF' },
  }
}
```

### 17.2 Fonctionnalités natives

| Fonctionnalité | Plugin | Usage |
|---|---|---|
| Push notifications | `@capacitor/push-notifications` | Rappels missions, devis |
| Notifications locales | `@capacitor/local-notifications` | Alertes hors-ligne |
| Haptics | `@capacitor/haptics` | Feedback tactile |
| Réseau | `@capacitor/network` | Détection online/offline |
| StatusBar | `@capacitor/status-bar` | Style barre de statut |
| App | `@capacitor/app` | Bouton retour, état app |

### 17.3 Build mobile

```bash
npm run build:cap          # Build pour Capacitor (chemins relatifs)
npx cap sync android       # Synchroniser avec projet Android
npx cap open android       # Ouvrir dans Android Studio
```

### 17.4 Mode Capacitor vs Web

Le `vite.config.ts` détecte le mode :
- **Mode `capacitor`** : `base: './'` (chemins relatifs pour `file://`)
- **Mode web** : `base: undefined` (chemins absolus)

---

## 18. Règles métier

### 18.1 Prestations

| Règle | Détail |
|---|---|
| Max prestations/jour | **2** par prestataire |
| Types de service | Ménage (principal), Bricolage, Autre |
| Filtrage prestataires | Seuls les prestataires spécialisés "Ménage" sont affichés |
| Temps de trajet | **30 minutes** minimum entre 2 prestations |
| Créneaux fixes | 3h, 4h, 6h (voir tableau section 13.2) |
| Règle 4h | Impossible d'avoir 2 créneaux de 4h le même jour |
| Jours fériés | Martinique → bloquent toute réservation |

### 18.2 Devis / Factures

| Règle | Détail |
|---|---|
| TVA | 0%, 2.1%, ou 8.5% |
| Crédit d'impôt | Applicable si `isSap = true` |
| Signature | Électronnique (canvas) par client + admin |
| Conversion | Devis signé → Facture (automatique) |
| Expiration | Les devis expirés ne bloquent plus les créneaux |
| Rappel | Relance automatique pour signature |

### 18.3 Planning

| Règle | Détail |
|---|---|
| Binôme | 2ème prestataire optionnel sur une mission |
| Couleur | orange (assigné), blue (planifié), green (terminé), gray (annulé) |
| Source | `devis` (généré depuis devis) ou `reservation` (réservation directe) |
| Heures supplémentaires | `isOvertime = true` bypass les validations de disponibilité |

### 18.4 Zone horaire

**Toutes les dates et heures sont en timezone Martinique** (`America/Martinique`, UTC-4).

Utilitaires dédiés :
- `src/utils/martiniqueTime.ts`
- `src/utils/dayjsMartinique.ts`
- `getMartiniqueNowISO()`, `getMartiniqueToday()`, `formatMartiniqueDate()`

### 18.5 Email

- Envoi via **EmailJS** (côté frontend) ou **Edge Functions** (côté serveur)
- Interdiction absolue d'envoyer à `prestaservicesantilles.rh@gmail.com`
- Templates : `utils/emailTemplates.ts`

---

## 19. Build, déploiement et versioning

### 19.1 Scripts

```bash
npm run dev              # Dev server local (port 3000)
npm run build            # Build production (bump version + tsc + vite build)
npm run build:cap        # Build pour Capacitor (chemins relatifs)
npm run deploy           # Déploiement via deploy.sh
npm run cap:sync:android # Sync projet Android
npm run bump-version     # Incrémentation version auto
```

### 19.2 Versioning

- `scripts/bump-version.js` : Incrémente automatiquement la version dans `package.json`
- `scripts/version-plugin.ts` : Plugin Vite qui injecte la version dans les meta tags HTML
- `public/version.json` : Fichier de version pour détection de mise à jour
- `VITE_APP_VERSION` et `VITE_BUILD_TIME` : Variables d'environnement injectées au build

### 19.3 Déploiement

**Web (Vercel)** :
```bash
# Déploiement automatique via Git
vercel deploy --prod
```

**Mobile (Android)** :
```bash
npm run build:cap
npx cap sync android
npx cap open android    # Build APK/AAB dans Android Studio
```

**VPS** :
- Scripts dans `scripts/` : `deploy-vps.sh`, `export-for-vps.sh`, `migrate-to-vps.sh`

### 19.4 Proxy Supabase

En production sur Vercel, les requêtes Supabase transitent par `/api/supabase-proxy` :
- Contournement des restrictions CORS
- Masquage de l'URL Supabase réelle
- Configuration dans `vercel.json` : rewrite `/api/supabase/*` → proxy

---

## 20. Guide d'extension : ajouter une fonctionnalité

### 20.1 Ajouter une nouvelle page admin

1. **Créer le composant** dans `components/MaPage.tsx` :
```tsx
import React from 'react';
import { useData } from '../context/DataContext';

const MaPage: React.FC = () => {
  const { clients, missions } = useData();
  // ... votre logique
  return <div>...</div>;
};
export default MaPage;
```

2. **Ajouter la route** dans `App.tsx` (section admin `<Routes>`) :
```tsx
<Route path="/ma-page" element={<MaPage />} />
```

3. **Ajouter le lien** dans `components/Sidebar.tsx` :
```tsx
{ label: 'Ma Page', path: '/ma-page', icon: MonIcone },
```

### 20.2 Ajouter une table Supabase

1. **Créer la migration** dans `supabase/migrations/YYYYMMDDHHMMSS_create_ma_table.sql` :
```sql
CREATE TABLE IF NOT EXISTS ma_table (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  -- colonnes...
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Politiques RLS
ALTER TABLE ma_table ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin full access" ON ma_table
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'super_admin'))
  );
```

2. **Appliquer la migration** via Supabase Dashboard ou Edge Function `run-migrations`

3. **Ajouter le type** dans `types.ts` :
```typescript
export interface MonEntite {
  id: string;
  // ...
}
```

4. **Ajouter au DataContext** : state + fonctions CRUD + chargement initial

### 20.3 Ajouter un module isolé

Suivre le pattern des modules existants (`modules/`) :

```
modules/mon-module/
├── index.ts           # Barrel export
├── types.ts           # Types spécifiques
├── client.ts          # Client API (appels Supabase)
└── ui/
    ├── MaPage.tsx     # Page principale
    └── MonComposant.tsx  # Sous-composants
```

### 20.4 Ajouter une Edge Function

1. Créer `supabase/functions/ma-function/index.ts` :
```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

serve(async (req) => {
  const { param } = await req.json()
  // ... logique
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
```

2. Déployer : `supabase functions deploy ma-function`

3. Appeler depuis le frontend :
```typescript
const { data } = await supabase.functions.invoke('ma-function', {
  body: { param: 'value' }
})
```

### 20.5 Ajouter une API Vercel

1. Créer `api/mon-endpoint.js` :
```javascript
import { getSupabaseAdminClient } from './_lib/supabaseAdmin.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  
  const admin = getSupabaseAdminClient()
  const { data, error } = await admin.from('ma_table').select('*')
  
  res.status(200).json({ data })
}
```

2. Accessible à `https://domaine.vercel.app/api/mon-endpoint`

### 20.6 Conventions de code

| Convention | Détail |
|---|---|
| Nommage fichiers | PascalCase pour composants (`.tsx`), camelCase pour utilitaires (`.ts`) |
| Types | Toujours typer les props et les retours de fonctions |
| Dates | Toujours utiliser `dayjs.tz()` avec `MARTINIQUE_TIMEZONE` |
| IDs | Toujours UUID (`crypto.randomUUID()` ou `gen_random_uuid()`) |
| Erreurs | Toujours `try/catch` avec log console + retour gracieux |
| Supabase | Préférer les RPC pour les opérations complexes (contournement RLS) |
| PowerShell | Utiliser `;` au lieu de `&&` pour chaîner les commandes |

### 20.7 Checklist d'ajout de fonctionnalité

- [ ] Types définis dans `types.ts` ou `modules/*/types.ts`
- [ ] Route ajoutée dans `App.tsx`
- [ ] Lien de navigation dans `Sidebar.tsx` (si admin)
- [ ] Migration SQL créée dans `supabase/migrations/`
- [ ] Politiques RLS configurées
- [ ] Fonctions CRUD ajoutées au `DataContext` (si nécessaire)
- [ ] Gestion du chargement et des erreurs
- [ ] Responsive (mobile + desktop)
- [ ] Timezone Martinique respectée
- [ ] Testé en mode démo

---

## 21. Composants externes détaillés (pages et portails)

En dehors des modules isolés (`modules/`), l'application contient des composants principaux qui constituent l'interface utilisateur. Voici leur documentation détaillée.

### 21.1 Portail Client (`components/ClientPortal.tsx` — 5225 lignes)

**Rôle** : Interface complète dédiée aux clients de l'entreprise.

**Fonctionnalités principales** :
- **Dashboard client** : Vue d'ensemble des missions à venir, dernières factures, notifications
- **Gestion des devis** : Acceptation/refus de devis, signature électronique (canvas)
- **Historique des missions** : Liste filtrée par statut (à venir, en cours, terminées)
- **Téléchargement PDF** : Génération et téléchargement de devis/factures/contrats signés
- **QR Code personnel** : Affichage du QR code de pointage (via `ClientQRCode`)
- **Appel vidéo** : Lancement d'appels vidéo pendant les missions (via `VideoCallManagerImproved`)
- **Messagerie** : Envoi de messages à l'admin
- **Demande de service** : Création de nouvelles demandes (redirige vers `NewServiceRequestPage`)
- **Scan QR** : Pointage entrée/sortie (redirige vers `ScanPage`)
- **Notifications** : Liste et marquage comme lu
- **Parrainage** : Accès aux pages de parrainage (flyers, filleuls)
- **Disponibilités publiques** : Vue des créneaux disponibles

**Vues internes** (navigation par état) :
| Vue | Description |
|---|---|
| `home` | Dashboard principal avec stats rapides |
| `quotes` | Liste des devis (signés, envoyés, refusés) |
| `invoices` | Factures et historique de paiement |
| `missions` | Missions planifiées et en cours |
| `messages` | Conversations avec l'admin |
| `profile` | Informations personnelles, pack, contrat |
| `notifications` | Centre de notifications |

**Dépendances clés** :
- `useData()` → DataContext pour toutes les données
- `computeFreeSlotsUtil`, `computeAvailabilitySlots` → Moteur de disponibilités
- `SignedQuotePDF`, `InvoicePDF`, `ContractPDF` → Génération PDF
- `downloadHtmlAsPdf` → Alternative HTML-to-PDF
- `getServiceTypeFromText` → Détection type de service
- `isHoliday`, `getHolidayName` → Jours fériés Martinique
- `isPackSerenity` → Vérification pack spécifique

**Données utilisées** :
```typescript
clients, documents, missions, simulatedClientId, simulatedProviderId,
signQuoteWithData, addDocument, addNotification, alertPopup, refuseQuote,
requestInvoice, sendClientMessage, cancelMissionByClient, canCancelMission,
notifications, markNotificationRead, activeStream, packs, contracts
```

---

### 21.2 Portail Prestataire (`components/ProviderPortal.tsx` — 2942 lignes)

**Rôle** : Interface complète dédiée aux prestataires de services.

**Fonctionnalités principales** :
- **Dashboard** : Vue des missions assignées avec vue calendrier (jour/semaine/mois)
- **Modes de vue** : `overview` (résumé), `calendar` (calendrier), `horizontal` (swipe jour), `grid` (grille)
- **Gestion des missions** : Démarrage (`enqueueStartMission`), fin (`enqueueEndMission`), annulation
- **Pull-to-refresh** : Rafraîchissement manuel des données (gesture natif)
- **Upload de photos** : Photos de début/fin de mission avec progression (`UploadProgressManager`)
- **Appel vidéo** : Lancement d'appels vidéo pendant les interventions
- **Scan QR** : Pointage entrée/sortie chez les clients
- **Congés** : Demande de congés (via `addLeave`)
- **Notifications** : Centre de notifications
- **Filtre par service** : Filtrage des missions par type (Ménage, Bricolage, etc.)
- **Live stream** : Démarrage/arrêt de diffusion vidéo en direct

**Gestion des uploads** :
```typescript
uploadJobs        // Liste des jobs d'upload en cours
activeUploadJob   // Job actuellement en traitement
isUploadProcessing // Flag de traitement
retryUploadJob    // Relancer un upload échoué
removeUploadJob   // Supprimer un job
clearCompletedUploadJobs // Nettoyer les jobs terminés
```

**Dépendances clés** :
- `enqueueStartMission` / `enqueueEndMission` → Queue hors-ligne pour pointage
- `UploadProgressManager` → UI de progression des uploads
- `VideoCallManagerImproved` → Visioconférence
- `matchesServiceTypeFilterFromText` → Filtrage par type de service
- `usePullToRefresh` → Hook gesture pull-to-refresh

---

### 21.3 Dashboard Admin (`components/Dashboard.tsx` — 1023 lignes)

**Rôle** : Tableau de bord principal de l'interface admin avec KPIs et graphiques.

**Fonctionnalités principales** :
- **Modes de vue** : `COMMERCIAL` (CA, clients), `OPERATIONS` (missions, planning)
- **Filtres temporels** : Jour, semaine, mois, année, tout
- **Filtre prestataire** : Filtrage des données par prestataire spécifique
- **StatCard** : Cartes KPI interactives (CA, missions, clients, devis)
- **Graphiques** : `TurnoverChart` (CA), `ClientsChart` (répartition), `MissionsChart` (statuts)
- **Recherche globale** : Barre de recherche avec `Cmd+K` / `Ctrl+K` (via `GlobalSearchBar`)
- **Supervision vidéo** : Modal de supervision des appels vidéo en cours (via `AdminVideoSupervisor`)
- **Haptic feedback** : Retours tactiles sur mobile
- **Pull-to-refresh** : Rafraîchissement manuel

**Calculs de données** :
- CA = somme des `totalTTC` des factures (filtrées par période)
- Taux conversion = devis signés / devis envoyés × 100
- Missions en cours = count(`status === 'in_progress'`)
- Nouveaux clients = clients créés ce mois

**Dépendances clés** :
- `StatCard` → Composant de carte KPI
- `TurnoverChart`, `ClientsChart`, `MissionsChart` → Graphiques Recharts
- `GlobalSearchBar` → Recherche omnisciente
- `AdminVideoSupervisor` → Supervision vidéo
- `PullToRefresh` → Rafraîchissement mobile

---

### 21.4 Planning (`components/Planning.tsx` — 5943 lignes)

**Rôle** : Vue calendrier hebdomadaire du planning des missions — composant le plus volumineux de l'application.

**Fonctionnalités principales** :
- **Vue calendrier hebdomadaire** : 7 colonnes (desktop) ou liste (mobile)
- **Création de missions** : Formulaire complet (client, prestataire, date, créneau, service)
- **Édition/suppression** : Modification et suppression de missions + suppression en masse
- **Missions provisoires** : Affichage des devis envoyés non expirés comme missions en attente
- **Assignation** : Assignation de prestataires à des missions non pourvues
- **Filtres avancés** : Prestataire, client, statut, plage de dates, recherche textuelle
- **Rappels journaliers** : Configuration de rappels pour les missions du jour
- **Statistiques journalières** : Modal avec synthèse du jour (prestataires planifiés/disponibles)
- **Code couleur journaux** : Jaune (≥60% rempli), orange (≥90%), teal (clos)
- **Indicateurs facturation** : Badge bleu (≥2 réalisées sur même devis), badge violet (pack ultime)
- **Messagerie WhatsApp** : Bouton par prestataire → ouverture `wa.me` avec message pré-rempli
- **Récurrence** : Options de récurrence pour les missions
- **Prestataire externe** : Entrée fictive pour "EDWARD Sylvie" (prestations externalisées)
- **Pull-to-refresh** + **haptic feedback**

**Règles métier implémentées** :
```typescript
ALLOWED_DURATIONS = [3, 4, 6, 7]        // Durées valides en heures
MAX_PROVIDER_DAILY_HOURS = 7             // Plafond journalier
// Chevauchement d'horaires → rejet + message d'erreur
// Statut "clos" = indicateur visuel seulement (non bloquant)
```

**Dépendances clés** :
- `addMission`, `assignProvider`, `assignSecondProvider` → Assignation
- `updateMission`, `deleteMissions` → Modification
- `requestMissionReschedule` → Reprogrammation
- `loadMissionsForRange` → Chargement optimisé par plage
- `convertQuoteToInvoice`, `markInvoicePaid` → Facturation
- `getHolidayName` → Détection jours fériés
- `SearchableSelect` → Select avec recherche
- `matchesServiceTypeFilterFromText` → Filtrage service

---

### 21.5 Devis / Factures (`components/DevisFactures.tsx` — 4636 lignes)

**Rôle** : Gestion complète du cycle devis/factures avec création, envoi, signature, conversion.

**Fonctionnalités principales** :
- **Liste des documents** : Tableau filtrable par statut (brouillon, envoyé, signé, refusé, etc.)
- **Création de devis** : Formulaire multi-étapes avec 2 modes :
  - **Pack** : Sélection d'un pack prédéfini avec quantité
  - **Custom** : Lignes personnalisées (description, prix unitaire, quantité)
- **Créneaux d'intervention** : Ajout de créneaux (date + heure début/heure fin) lors de la création
- **TVA** : 0%, 2.1%, 8.5% avec option crédit d'impôt
- **Envoi de devis** : Envoi par email au client pour signature
- **Signature admin** : L'admin peut signer au nom de l'entreprise
- **Conversion devis → facture** : Automatique après signature
- **Duplication** : Copie d'un devis existant
- **Rappel signature** : Relance automatique pour devis en attente
- **Téléchargement PDF** : Génération via `@react-pdf/renderer`
- **Brouillons persistés** : Sauvegarde automatique via `upsertDocumentDraft`
- **Pagination** : Navigation par pages
- **Filtres multiples** : Statut, recherche, type de service

**Structure du formulaire de devis** :
```typescript
type QuoteDraftFormState = {
  selectedClientId: string,
  serviceType: 'pack' | 'custom',
  serviceCategory: 'Ménage' | 'Bricolage' | 'Autre' | 'Personnalisé',
  selectedPackId: string,
  packQuantity: number,
  customDescription: string,
  unitPrice: number,
  tvaRate: 0 | 2.1 | 8.5,
  taxCreditActive: boolean,
  interventionSlots: InterventionSlot[],
  packSpecificConfig: any,
  customLines: Array<{ id, description, unitPrice, quantity }>
}
```

**Dépendances clés** :
- `addDocument`, `updateDocument`, `deleteDocument`, `duplicateDocument`
- `convertQuoteToInvoice`, `markInvoicePaid`, `updateDocumentStatus`
- `sendDocumentReminder`, `sendQuoteSignatureReminder`
- `signQuoteAsAdmin`, `sendEmail`
- `addContract`, `generateContractFromTemplate`, `downloadContract`
- `SignedQuotePDF` → Composant PDF de devis signé
- `Pagination` → Composant de pagination
- `SearchableSelect` → Select avec recherche

---

### 21.6 Gestion Clients (`components/Clients.tsx` — 1409 lignes)

**Rôle** : Liste et gestion complète des clients (CRM).

**Fonctionnalités principales** :
- **Liste paginée** : 20 clients par page avec recherche
- **Création/édition** : Formulaire complet (nom, adresse, ville, email, téléphone, pack, statut)
- **Suppression** : Suppression simple ou en masse (checkboxes)
- **Filtres** : Par statut (active, new, prospect), par ville, par pack
- **Communes Martinique** : Liste déroulante des 34 communes
- **Reset mot de passe** : Réinitialisation du mot de passe client
- **Heures de fidélité** : Ajout d'heures de fidélité (`addLoyaltyHours`)
- **Gestion des leads** : Conversion de leads marketing en clients (via `clientLeads`)
- **Intégration parrainage** : Création de parrainage valide lors de l'inscription (via `createReferralValidated`)
- **Statut client** : Mise à jour rapide du statut (prospect → new → active)
- **Haptic feedback** : Retours tactiles

**Dépendances clés** :
- `addClient`, `updateClient`, `deleteClients` → CRUD
- `addLoyaltyHours` → Fidélité
- `resetClientPassword` → Réinitialisation
- `createReferralValidated` → Module marketing/parrainage
- `contracts`, `packs`, `documents`, `missions` → Données liées

---

### 21.7 Gestion Prestataires (`components/Providers.tsx` — 1925 lignes)

**Rôle** : Liste et gestion complète des prestataires de services.

**Fonctionnalités principales** :
- **Liste paginée** : 20 prestataires par page avec recherche
- **Création/édition** : Formulaire complet avec 20 spécialités
- **Suppression** : Simple ou en masse
- **Filtres** : Par statut (Active, Inactive, Passive)
- **Tri** : Par inscription, nom, heures, statut, missions planifiées
- **Gestion des jours de repos** : Sélection des jours de non-intervention (0=Dim à 6=Sam)
- **Gestion des congés** : Modal d'ajout/suppression de congés (via `addLeave`, `deleteLeave`)
- **Reset mot de passe** : Réinitialisation du mot de passe prestataire
- **Détails prestataire** : Drawer latéral avec infos, missions, statistiques
- **Mode disponibilité** : Configuration du mode (unavailable/available)
- **Plages horaires** : Configuration des heures de non-intervention

**Spécialités disponibles** :
```
Ménage / Entretien, Bricolage, Plomberie, Électricité, Peinture,
Climatisation, Piscine / Entretien Bassin, Maçonnerie, Menuiserie,
Serrurerie, Aide à domicile, Garde d'enfants, Soutien scolaire,
Assistance administrative, Informatique / Numérique, Coiffure à domicile,
Esthétique à domicile, Livraison de repas, Déménagement, Gardiennage, Autre
```

---

### 21.8 Pages de détail

#### `ClientDetailPage.tsx` (674 lignes)
**Route** : `/clients/:id`

**Onglets** :
| Onglet | Contenu |
|---|---|
| `info` | Informations client (nom, adresse, email, téléphone, pack, statut) |
| `missions` | Missions du client avec filtres (recherche, statut, dates) |
| `documents` | Devis/factures du client avec filtres (recherche, statut, type, dates) |
| `history` | Historique complet (timeline) |

**Actions** : Suppression client, navigation vers mission/document

---

#### `ProviderDetailPage.tsx` (568 lignes)
**Route** : `/providers/:id`

**Onglets** :
| Onglet | Contenu |
|---|---|
| `info` | Informations prestataire (nom, spécialité, contact, statut, note) |
| `missions` | Missions assignées avec filtres (recherche, statut, futur/passé) |
| `stats` | Statistiques (heures travaillées, missions complétées, note moyenne) |

**Actions** : Suppression prestataire, navigation vers missions

---

#### `MissionDetailPage.tsx` (472 lignes)
**Route** : `/planning/missions/:id` et `/admin/planning/missions/:id`

**Fonctionnalités** :
- Affichage complet de la mission (date, horaires, client, prestataire, service)
- Informations client et prestataire (avec liens navigation)
- Changement de statut (planned → in_progress → completed / cancelled)
- Rapport de mission (remarque + photos)
- Suppression de mission

---

#### `DocumentDetailPage.tsx` (504 lignes)
**Route** : `/invoices/:id` et `/admin/devis/:id`

**Fonctionnalités** :
- Affichage complet du document (référence, client, date, montant, TVA, statut)
- Téléchargement PDF (via `downloadHtmlAsPdf`)
- Envoi de rappel au client
- Changement de statut (draft → sent → signed → validated → paid)
- Signature admin (canvas de dessin)
- Aperçu du contenu du devis/facture

---

### 21.9 Secrétariat (`components/Secretariat.tsx` — 3442 lignes)

**Rôle** : Hub administratif multi-fonctions — le composant "couteau suisse" de l'admin.

**Onglets** :
| Onglet | Description |
|---|---|
| `packs` | Gestion des packs de services (CRUD, horaires d'intervention, services SAP) |
| `devis` | Création rapide de devis avec sélection pack/client/créneaux |
| `absences` | Gestion des absences prestataires (congés, indisponibilités) |
| `agenda` | Vue agenda des missions et événements |
| `messaging` | Messagerie admin ↔ clients (envoi/réception) |
| `expenses` | Gestion des dépenses (catégorie, montant, justificatif) |
| `live-videos` | Gestion des appels vidéo en direct (via `LiveVideoManager`) |

**Services SAP supportés** (liste OCR) :
```
Entretien de la maison, Repassage, Préparation de repas, Livraison de repas,
Petit bricolage, Gardiennage, Assistance administrative, Accompagnement personnes âgées,
Aide à la mobilité, Soins d'esthétique, Soutien scolaire, Cours à domicile,
Assistance informatique, Assistance démarches en ligne, Garde d'enfants,
Conduite véhicule personnel, Téléassistance et visio-assistance
```

**Dépendances clés** :
- `LiveVideoManager` → Gestion des appels vidéo
- `ContractPDF`, `SignedQuotePDF` → Génération PDF
- `SearchableSelect` → Select avec recherche
- `PackWithSchedules` → Extension du type Pack avec horaires d'intervention

---

### 21.10 Réservations (`components/Reservations.tsx` — 282 lignes)

**Rôle** : Assistant de réservation intelligent en 3 étapes.

**Workflow** :
```
Étape 1 → Sélection du service (Ménage, Bricolage, etc.)
Étape 2 → Sélection de la date + créneau disponible (via getAvailableSlots)
Étape 3 → Sélection du client + confirmation
```

**Fonctionnement** :
- Utilise `getAvailableSlots(date)` du DataContext pour afficher les créneaux libres
- Les créneaux affichent le prestataire assigné et un score de pertinence
- Crée une mission avec `source: 'reservation'` et `providerId: 'auto-assign'`
- Barre de progression visuelle (3 étapes)

---

### 21.11 QR Code Manager (`components/QRCodeManager.tsx` — 522 lignes)

**Rôle** : Gestion des QR codes de pointage pour les clients.

**Onglets** :
| Onglet | Description |
|---|---|
| `generate` | Génération et impression de QR codes par client |
| `scan` | Scan manuel (sélection client) |
| `history` | Historique des pointages avec filtres (dates, client, prestataire, type) |

**Fonctionnalités** :
- Génération QR code (bibliothèque `qrcode`) avec URL de scan
- Impression via fenêtre popup (format carte)
- Filtrage par rôle : admin voit tous les clients, client voit uniquement le sien
- Historique complet des pointages (entrée/sortie) avec timestamps

**Format URL QR** : `{baseUrl}/#/scan?client={clientId}`

---

### 21.12 Scan Page (`components/ScanPage.tsx` — 408 lignes)

**Rôle** : Page de pointage QR code (entrée/sortie).

**Flux** :
1. Lecture du paramètre `?client={clientId}` dans l'URL
2. Vérification des pointages du jour pour ce client
3. Détermination du type de scan :
   - Pas de scan aujourd'hui → **Entrée**
   - Dernière entrée sans sortie → **Sortie**
   - Sinon → erreur (déjà complet)
4. Enregistrement du scan via `registerScan(clientId)`
5. Affichage du résultat avec animation

**États** : `loading` | `success` | `error` | `unauthorized`

**Dépendances** : `usePullToRefresh`, animations CSS personnalisées

---

### 21.13 Statistiques (`components/Statistics.tsx` — 891 lignes)

**Rôle** : Page d'analyse et de reporting des missions.

**Fonctionnalités** :
- **Filtres temporels** : Jour, semaine, mois, année
- **Filtres par statut** : Toutes, en cours, terminées, planifiées, annulées
- **KPIs** : Nombre de missions, taux d'achèvement, heures totales
- **Top clients** : Clients avec le plus de missions
- **Top prestataires** : Prestataires les plus actifs
- **Filtre service** : Respecte le filtre global de type de service
- **Modals de détail** : Clic sur un client/prestataire/document → modal d'information
- **Normalisation des statuts** : Gère les variantes ("en_cours", "demarree", "in_progress" → `in_progress`)
- **Pagination** : Navigation par pages

---

### 21.14 Financier (`components/Financials.tsx` — 171 lignes)

**Rôle** : Suivi de la trésorerie et ajustements comptables.

**Fonctionnalités** :
- **Journal des opérations** : Liste de toutes les transactions (factures)
- **Filtres** : Toutes, à encaisser, encaissées, remboursements
- **Remboursement** : Création d'un avoir comptable (via `refundTransaction`)
- **Paiement manuel** : Confirmation de réception de paiement (via `markInvoicePaid`)
- **Filtre service** : Respecte le filtre global de type de service

**Données** : Transforme les factures (`documents` avec `type === 'Facture'`) en transactions :
```typescript
{ id, ref, client, amount, type: 'income' | 'refund', status, date }
```

---

### 21.15 Rapports de missions (`components/MissionReports.tsx` — 1271 lignes)

**Rôle** : Consultation des rapports d'intervention avec photos et remarques.

**Fonctionnalités** :
- **Onglets** : Missions en cours / Missions terminées
- **Filtres** : Recherche, date début/fin, client spécifique
- **Détail mission** : Modal avec photos de début/fin, remarques, infos client/prestataire
- **Lightbox images** : Agrandissement des photos
- **Actions** : Validation, annulation, modification de mission
- **Pagination** : 10 éléments par page
- **Normalisation URLs média** : Résout les URLs relatives depuis `mission-media` bucket

**Chargement** : Utilise `getMissionDetails()` du DataContext pour charger les détails complets (photos, remarques)

---

### 21.16 Email Marketing (`components/AdminEmailMarketing.tsx` — 1200 lignes)

**Rôle** : Campagnes d'emailing marketing.

**Onglets** :
| Onglet | Description |
|---|---|
| `compose` | Éditeur d'email HTML avec prévisualisation |
| `history` | Historique des emails envoyés |
| `campaigns` | Gestion des campagnes marketing |

**Éditeur d'email** :
```typescript
interface EmailEditorState {
  name: string,           // Nom de la campagne
  subject: string,        // Objet de l'email
  htmlContent: string,    // Contenu HTML riche
  selectedPackId?: string, // Pack associé (optionnel)
  attachedImages: string[], // URLs d'images jointes
  imageUrlInput?: string  // Input pour ajouter une URL d'image
}
```

**Filtres de ciblage** :
```typescript
interface TargetFilters {
  allClients: boolean,                    // Tous les clients
  minDaysSinceRegistration?: number,      // Ancienneté minimum
  maxDaysSinceRegistration?: number,      // Ancienneté maximum
  specificClientIds: string[],            // Clients spécifiques
  hasMissions?: boolean,                  // A des missions
  missionStatus: string[],                // Statuts des missions
  minDaysSinceLastMission?: number,       // Dernière mission minimum
  maxDaysSinceLastMission?: number        // Dernière mission maximum
}
```

**Dépendances clés** :
- `getMarketingCampaigns`, `getEmailLogs`, `getTargetClients` → Client API marketing email
- `createManualCampaign`, `sendCampaign`, `deleteCampaign` → Actions campagnes
- `sendEmailViaEmailJS` → Envoi via EmailJS
- `htmlToPlainText` → Conversion HTML en texte brut

---

### 21.17 Formulaires de contact (`components/ContactFormsAdmin.tsx` — 150 lignes)

**Rôle** : Gestion des messages reçus via le formulaire de contact public.

**Fonctionnalités** :
- **Liste messages** : Triés par date (plus récent en premier)
- **Recherche** : Par nom, email, sujet, message
- **Marquage lu/non lu** : Auto-marquage à l'ouverture
- **Compteur non lus** : Affiché dans l'en-tête
- **Vue détaillée** : Panel droit avec contenu complet du message
- **Layout split** : Liste à gauche (2/5), détail à droite (3/5)

---

### 21.18 Supervision vidéo admin (`components/AdminVideoSupervisor.tsx` — 359 lignes)

**Rôle** : Supervision des appels vidéo en direct par l'admin.

**Fonctionnalités** :
- **Détection stream actif** : Affiche les infos du stream en cours (prestataire, client)
- **Durée d'appel** : Calcul et affichage du temps écoulé
- **Modes de supervision** :
  - `watch` : Surveillance silencieuse (voir sans participer)
  - `join` : Rejoindre l'appel en tant que participant
- **Terminaison d'appel** : L'admin peut mettre fin à l'appel
- **Auto-rafraîchissement** : Toutes les 5 secondes
- **Notifications vidéo** : Affichage des notifications d'appels vidéo

---

### 21.19 Gestion vidéo en direct (`components/LiveVideoManager.tsx` — 307 lignes)

**Rôle** : Gestion des flux vidéo en direct et historique des enregistrements.

**Fonctionnalités** :
- **Stream en direct** : Lecture du flux actif avec contrôles (play/pause, mute, fullscreen)
- **Filtres enregistrements** : Par client, par prestataire
- **Historique** : Liste des enregistrements vidéo passés
- **Contrôles** : Plein écran, mute, arrêt du stream
- **Infos** : Affichage client/prestataire associé au stream

---

### 21.20 Visioconférence (`components/VideoCallManagerImproved.tsx` — 313 lignes)

**Rôle** : Composant de visioconférence WebRTC avec support LiveKit.

**Technologies** :
- **LiveKit** : Solution principale (via `@livekit/components-react`)
- **WebRTC natif** : Fallback avec `RTCPeerConnection` et serveurs STUN Google

**Fonctionnalités** :
- Activation/désactivation vidéo et audio
- Partage d'écran
- Détection état connexion (`connecting` | `connected` | `ended`)
- Gestion des erreurs (accès caméra/micro refusé)
- Nettoyage des streams à la déconnexion

**Configuration** :
```typescript
const LIVEKIT_SERVER_URL = process.env.NODE_ENV === 'production' 
  ? 'wss://votre-livekit-server.com' 
  : 'ws://localhost:8080';
```

---

### 21.21 Page de contact publique (`components/ContactPage.tsx` — 161 lignes)

**Route** : `/contact` (publique, sans authentification)

**Rôle** : Formulaire de contact accessible à tous les visiteurs.

**Fonctionnement** :
- Formulaire (nom*, email*, téléphone, sujet, message*)
- Validation côté client avant envoi
- Envoi via `submitContactForm()` du DataContext
- Toast de confirmation/erreur
- Design avec logo et dégradés

---

### 21.22 Page de disponibilités publique (`components/PublicAvailabilityPage.tsx` — 798 lignes)

**Route** : `/disponibilites` (publique, sans authentification)

**Rôle** : Vue publique des créneaux disponibles pour réservation.

**Fonctionnalités** :
- **Vue semaine/mois** : Navigation calendrier
- **Calcul disponibilités** : Utilise `computeAvailabilitySlots` du moteur
- **Regroupement** : Slots groupés par horaire (`groupSlotsByTime`)
- **Détection jours fériés** : Affichage du nom du férié
- **Filtrage passé** : Masque les jours passés
- **Infos prestataires** : Nombre de prestataires disponibles par créneau
- **Couleurs par service** : Bleu pour Ménage
- **Contact direct** : Boutons téléphone et email

**Types internes** :
```typescript
type DayAvailability = {
  date: string,
  isToday: boolean,
  isPast: boolean,
  isHoliday?: boolean,
  holidayName?: string,
  availableServices: ServiceAvailability[]
}
```

---

### 21.23 Nouvelle demande de service (`components/NewServiceRequestPage.tsx` — 1322 lignes)

**Route** : `/nouvelle-demande` (portail client)

**Rôle** : Workflow complet de création de demande de service par le client.

**Étapes** :
```
'service' → Sélection du type de service (Ménage, Bricolage, Autre, Personnalisé)
'pack'    → Sélection du pack ou saisie libre
'slots'   → Sélection des créneaux d'intervention (date + heure)
'signature' → Signature électronique du client (canvas)
'confirmation' → Récapitulatif et envoi
```

**Fonctionnalités** :
- Détection automatique du pack (Sérénité ou autre)
- Création via `createCustomerServiceRequest()` du module `serviceRequests`
- Génération automatique du devis associé (via `addDocument`)
- Envoi de message à l'admin (via `sendClientMessage`)
- Gestion des créneaux multiples
- Upload de photos/justificatifs

---

### 21.24 Paramètres (`components/Settings.tsx` — 192 lignes)

**Rôle** : Configuration générale de l'application et de l'entreprise.

**Fonctionnalités** :
- **Logo** : Upload du logo entreprise (base64 en base)
- **Infos société** : Nom, email, téléphone, adresse
- **Contrat générique** : Édition du contenu du contrat type (éditeur riche)
- **Prévisualisation contrat** : Vue du contrat avant sauvegarde
- **Sauvegarde** : Persistance via `updateCompanySettings()`

---

### 21.25 Recherche globale (`components/GlobalSearchBar.tsx` — 464 lignes)

**Rôle** : Barre de recherche omnisciente avec raccourci clavier `Cmd+K` / `Ctrl+K`.

**Types de résultats** :
| Type | Icône | Navigation |
|---|---|---|
| `client` | Users | `/clients/:id` |
| `provider` | Users | `/providers/:id` |
| `document` | FileText | `/admin/devis/:id` |
| `mission` | Briefcase | `/admin/planning/missions/:id` |
| `pack` | Package | — |
| `campaign` | Megaphone | — |
| `feature` | Sparkles | Navigation rapide |

**Fonctionnalités** :
- Recherche fuzzy sur tous les types d'entités
- Actions rapides par résultat (éditer, supprimer, voir, envoyer)
- Navigation par clavier (flèches, Entrée)
- Bus d'événements (`SearchEvents`) pour actions cross-composants

---

### 21.26 Composants PDF (`components/PDFComponents.tsx` — 1602 lignes)

**Rôle** : Composants `@react-pdf/renderer` pour la génération de documents PDF.

**Documents générés** :
| Composant | Usage |
|---|---|
| `SignedQuotePDF` | Devis signé avec cachet et signature |
| `InvoicePDF` | Facture avec détails complets |
| `ContractPDF` | Contrat avec clauses |

**Gestion des signatures** :
- Base64 (data:image/png;base64,...)
- URL distante (https://...)
- Constants locales (`SIGNATURE_BASE64`, `STAMP_SIGNATURE_BASE64`)
- Nettoyage HTML et caractères spéciaux (entités HTML → Unicode)

---

### 21.27 Graphiques (`components/Charts.tsx` — 91 lignes)

**Rôle** : Composants de visualisation de données (Recharts).

**Graphiques disponibles** :
| Composant | Type | Usage |
|---|---|---|
| `TurnoverChart` | LineChart | Évolution du chiffre d'affaires |
| `ClientsChart` | BarChart | Répartition clients (actifs/nouveaux/prospects) |
| `MissionsChart` | PieChart | Répartition missions par statut |

**Palette de couleurs** : `#2A9D8F` (brand-blue), `#F4A261` (brand-orange), `#E76F51` (brand-red), `#264653`, `#E9C46A`

---

### 21.28 Composants mobile (`components/mobile/`)

#### `BottomNavigation.tsx` (170 lignes)
**Rôle** : Barre de navigation inférieure pour mobile.

**Items par rôle** :
| Rôle | Items |
|---|---|
| `provider` | Missions, Scan, Disponibilité |
| `client` | Accueil, Services, Parrainage, Profil |
| `admin` | Dashboard, Planning, QR Scan, Clients, Plus |

**Détection** : Utilise `Capacitor.isNativePlatform()` pour adapter le comportement.

---

#### `Toast.tsx` (116 lignes)
**Rôle** : Système de notifications toast global.

**API** :
```typescript
toast.success(message, duration?)
toast.error(message, duration?)
toast.warning(message, duration?)
toast.info(message, duration?)
```

**Fonctionnement** : Store global avec listeners, feedback haptique automatique.

---

#### `PullToRefresh.tsx` (161 lignes)
**Rôle** : Gesture pull-to-refresh pour mobile.

**Props** :
```typescript
{
  onRefresh: () => Promise<void>,  // Callback de rafraîchissement
  children: ReactNode,
  threshold?: number,              // Seuil de déclenchement (défaut: 80px)
  maxPull?: number,                // Distance max (défaut: 120px)
  indicatorHeight?: number         // Hauteur de l'indicateur (défaut: 60px)
}
```

**Caractéristiques** : Effet de résistance (0.4), feedback haptique au seuil.

---

#### `MobileTransitions.tsx`
**Rôle** : Animations de transition pour les vues mobile (slide, fade).

---

### 21.29 Composants utilitaires

| Composant | Fichier | Lignes | Rôle |
|---|---|---|---|
| `PageLoader` | `PageLoader.tsx` | — | Loader de page avec animation |
| `EnhancedLoader` | `EnhancedLoader.tsx` | — | Loader amélioré avec états |
| `Pagination` | `Pagination.tsx` | — | Composant de pagination réutilisable |
| `SearchableSelect` | `SearchableSelect.tsx` | — | Select avec recherche et filtrage |
| `StatCard` | `StatCard.tsx` | — | Carte statistique pour dashboard |
| `SafeImage` | `SafeImage.tsx` | — | Image avec fallback si erreur de chargement |
| `UpdateNotification` | `UpdateNotification.tsx` | — | Notification de mise à jour disponible |
| `UploadProgressManager` | `UploadProgressManager.tsx` | — | Gestionnaire UI de progression des uploads |
| `ComingSoon` | `ComingSoon.tsx` | — | Page "Bientôt disponible" |
| `DemoAccounts` | `DemoAccounts.tsx` | — | Gestion des comptes de démonstration |
| `Login` | `Login.tsx` | — | Page de connexion |
| `ResetPassword` | `ResetPassword.tsx` | — | Page de réinitialisation mot de passe |
| `Header` | `Header.tsx` | — | En-tête avec notifications et profil |
| `Sidebar` | `Sidebar.tsx` | 937 | Navigation latérale admin (sections collapsibles) |
| `ClientQRCode` | `ClientQRCode.tsx` | — | Affichage QR code personnel client |
| `ScanSuccess` | `ScanSuccess.tsx` | — | Page de confirmation de scan réussi |

---

## Annexes

### A. Fichiers de configuration clés

| Fichier | Rôle |
|---|---|
| `vite.config.ts` | Build, plugins (PWA, React), proxy, chemins |
| `capacitor.config.ts` | App mobile (appId, plugins natifs) |
| `vercel.json` | Rewrites API, cron jobs |
| `tsconfig.json` | Configuration TypeScript |
| `index.html` | Shell HTML (Tailwind CDN, fonts, importmap) |
| `.env` | Variables d'environnement (JAMAIS committer) |

### B. Ports et URLs

| Service | URL | Port |
|---|---|---|
| Dev server Vite | `http://localhost:3000` | 3000 |
| API Vercel (dev) | `http://localhost:3001` | 3001 |
| Proxy `/api` → dev | `http://localhost:3000/api/*` → `:3001` | - |
| Production | `https://prestaservicesantilles.com` | - |
| Supabase (défaut) | `https://outremerfermetures.com/api` | - |

### C. Couleurs de marque

| Nom | Code | Usage |
|---|---|---|
| `brand-blue` | `#2A9D8F` | Boutons principaux, liens |
| `brand-orange` | `#F4A261` | Accents, alertes |
| `brand-red` | `#E76F51` | Erreurs, suppressions |
| `cream-50` | `#FDFCF5` | Fond principal |
| `beige-100` | `#F5F5DC` | Fond secondaire |

### D. Jours fériés Martinique

Le fichier `utils/holidays.ts` implémente les jours fériés français spécifiques à la Martinique :
- Jour de l'An, Lundi de Pâques, Fête du Travail, 8 Mai, Ascension, Lundi de Pentecôte, 14 Juillet, Assomption, 11 Novembre, Noël
- **Abolition de l'esclavage** (22 mai) — spécifique Martinique

### E. Glossaire

| Terme | Signification |
|---|---|
| **SAP** | Services à la Personne (avantages fiscaux) |
| **Pack** | Forfait de prestations (ex: 10h de ménage/mois) |
| **Binôme** | 2 prestataires assignés à la même mission |
| **Créneau** | Plage horaire fixe (3h, 4h, 6h) |
| **Devis envoyé** | Devis avec `status: 'sent'` → bloque les disponibilités |
| **Mission provisoire** | Créneau issu d'un devis envoyé, pas encore confirmé |
| **Lead** | Prospect issu du marketing (flyer, parrainage) |
| **Filleul** | Personne parrainée par un parrain |
| **RPC** | Remote Procedure Call (fonction SQL Supabase) |
| **RLS** | Row Level Security (politiques de sécurité Supabase) |
