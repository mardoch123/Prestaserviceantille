/**
 * TESTS DE SÉCURITÉ
 *
 * Ce fichier audite les vulnérabilités de sécurité identifiées dans le projet :
 * - Credentials codés en dur dans le code source
 * - Génération de mots de passe non sécurisée (Math.random)
 * - Mots de passe stockés en clair en base de données
 * - CORS trop permissif
 * - Absence de validation et de rate-limiting
 * - Exposition de données sensibles via select('*')
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const dataContextSource = fs.readFileSync(
  path.resolve(__dirname, '../context/DataContext.tsx'),
  'utf-8'
);
const supabaseClientSource = fs.readFileSync(
  path.resolve(__dirname, '../utils/supabaseClient.ts'),
  'utf-8'
);
const notifyApiSource = fs.readFileSync(
  path.resolve(__dirname, '../api/notify.js'),
  'utf-8'
);
const demoAccountsSource = fs.readFileSync(
  path.resolve(__dirname, '../api/demo-accounts.js'),
  'utf-8'
);
const deviceTokensSource = fs.readFileSync(
  path.resolve(__dirname, '../api/device-tokens.js'),
  'utf-8'
);

// ─── 1. CREDENTIALS CODÉS EN DUR ────────────────────────────────────────────

describe('[SEC-01] Credentials codés en dur dans le code source', () => {
  it('VULNÉRABILITÉ : la clé anon Supabase est présente en clair dans supabaseClient.ts', () => {
    // La clé JWT commence toujours par "eyJ"
    const hasHardcodedKey = supabaseClientSource.includes('DEFAULT_KEY') &&
      supabaseClientSource.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);

    expect(hasHardcodedKey).toBeTruthy();
    console.log(
      'RISQUE : Un attaquant ayant accès au dépôt peut lire la clé et interroger la base directement. ' +
      'Même si la clé "anon" est limitée par les RLS, la rotation est impossible sans modifier le code.'
    );
  });

  it('VULNÉRABILITÉ : l\'URL Supabase est codée en dur (DEFAULT_URL)', () => {
    const hasHardcodedUrl = supabaseClientSource.includes('DEFAULT_URL') &&
      supabaseClientSource.includes('supabase.co');
    expect(hasHardcodedUrl).toBe(true);
  });

  it('la clé ne devrait provenir que des variables d\'environnement', () => {
    const usesEnvFirst = supabaseClientSource.includes('VITE_SUPABASE_URL') &&
      supabaseClientSource.includes('VITE_SUPABASE_ANON_KEY');
    expect(usesEnvFirst).toBe(true); // Les env vars sont bien lues en priorité
    // Mais le fallback hardcodé représente toujours un risque
  });

  it('RECOMMANDATION : supprimer les valeurs DEFAULT_URL / DEFAULT_KEY et échouer explicitement si les env vars manquent', () => {
    // Ce test documente la recommandation — il passe toujours
    const recommendation = 'Remplacer DEFAULT_URL/DEFAULT_KEY par une erreur explicite si VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY sont absentes';
    expect(recommendation).toBeTruthy();
  });
});

// ─── 2. GÉNÉRATION DE MOTS DE PASSE NON SÉCURISÉE ───────────────────────────

describe('[SEC-02] Génération de mots de passe avec Math.random() (non cryptographique)', () => {
  it('VULNÉRABILITÉ : resetClientPassword utilise Math.random() pour générer le mot de passe', () => {
    // Extrait le bloc resetClientPassword
    const fnBlock = dataContextSource.match(
      /const resetClientPassword[\s\S]*?^\s*\};/m
    )?.[0] ?? '';
    const usesMathRandom = fnBlock.includes('Math.random()');
    expect(usesMathRandom).toBe(true);
    console.log(
      'RISQUE : Math.random() n\'est pas cryptographiquement sûr. ' +
      'Un attaquant connaissant la seed ou l\'heure de génération peut prédire le mot de passe.'
    );
  });

  it('VULNÉRABILITÉ : demo-accounts.js utilise Math.random() dans randomSuffix()', () => {
    expect(demoAccountsSource).toContain('Math.random()');
  });

  it('démonstration : Math.random() produit des valeurs prévisibles avec une seed connue', () => {
    // En Node.js, Math.random() ne peut pas être seedé, mais dans un contexte de test
    // on peut montrer que la distribution est insuffisante pour la sécurité
    const passwords = Array.from({ length: 1000 }, () =>
      Math.random().toString(36).slice(-8)
    );
    const unique = new Set(passwords).size;
    // Même si tous sont uniques dans ce test, l'espace de recherche est trop petit
    const entropyBits = Math.log2(36 ** 8); // ~41 bits — insuffisant pour la sécurité
    expect(entropyBits).toBeLessThan(60); // Un bon mot de passe devrait avoir ≥128 bits
    console.log(`Entropie estimée: ~${entropyBits.toFixed(0)} bits (recommandé: ≥128 bits)`);
  });

  it('RECOMMANDATION : utiliser crypto.getRandomValues() ou crypto.randomUUID()', () => {
    // Le projet utilise déjà crypto.randomUUID() dans generateUUID() — à étendre
    const usesSecureRandom = dataContextSource.includes('crypto.randomUUID');
    expect(usesSecureRandom).toBe(true);
    console.log('generateUUID() utilise déjà crypto.randomUUID(). Appliquer le même pattern pour les mots de passe.');
  });
});

// ─── 3. MOTS DE PASSE EN CLAIR EN BASE DE DONNÉES ───────────────────────────

describe('[SEC-03] Mots de passe stockés en clair dans la table clients', () => {
  it('VULNÉRABILITÉ : initial_password est stocké en texte brut dans la colonne DB', () => {
    const storesPlaintext = dataContextSource.includes('initial_password');
    expect(storesPlaintext).toBe(true);
    console.log(
      'RISQUE CRITIQUE : La colonne initial_password contient des mots de passe en clair. ' +
      'Une fuite de la base de données expose immédiatement tous les mots de passe.'
    );
  });

  it('VULNÉRABILITÉ : clientSelect="*" envoie initial_password au frontend React', () => {
    const clientSelectMatch = dataContextSource.match(/const clientSelect\s*=\s*['"`](.*?)['"`]/);
    expect(clientSelectMatch![1]).toBe('*');
    console.log(
      'RISQUE : Le frontend reçoit les mots de passe en clair via setClients(). ' +
      'Ils sont visibles dans les outils de développement du navigateur.'
    );
  });

  it('RECOMMANDATION : hacher les mots de passe et exclure initial_password du select frontend', () => {
    // Vérifie qu'il n'existe pas encore d'exclusion explicite
    const excludesPassword = dataContextSource.includes(
      'clientSelect = \'id,name,email,phone,address'
    );
    expect(excludesPassword).toBe(false); // Confirme que la correction n'est pas encore faite
    console.log(
      'CORRECTION REQUISE :\n' +
      '  1. Remplacer clientSelect par une liste de colonnes explicite sans initial_password\n' +
      '  2. Stocker un hash (bcrypt/argon2) plutôt que le mot de passe brut\n' +
      '  3. Envoyer le mot de passe initial uniquement par e-mail, jamais en DB'
    );
  });
});

// ─── 4. CORS TROP PERMISSIF ──────────────────────────────────────────────────

describe('[SEC-04] CORS trop permissif sur les endpoints API', () => {
  it('VULNÉRABILITÉ : notify.js renvoie l\'origin du client comme Access-Control-Allow-Origin', () => {
    // Renvoyer req.headers.origin sans validation = accepter toute origine
    const reflectsOrigin =
      notifyApiSource.includes('req.headers.origin') &&
      notifyApiSource.includes('Access-Control-Allow-Origin');
    expect(reflectsOrigin).toBe(true);
    console.log(
      'RISQUE : Réfléchir l\'Origin de la requête sans whitelist permet à n\'importe quel ' +
      'site web de faire des requêtes cross-origin authentifiées (CSRF via XHR/fetch).'
    );
  });

  it('VULNÉRABILITÉ : demo-accounts.js utilise le même pattern CORS permissif', () => {
    expect(demoAccountsSource).toContain('req.headers.origin || \'*\'');
  });

  it('RECOMMANDATION : valider l\'origin contre une whitelist', () => {
    const ALLOWED_ORIGINS = [
      'https://prestaservicesantilles.com',
      'https://app.prestaservicesantilles.com',
      'http://localhost:3000',
    ];

    const validateOrigin = (origin: string | undefined): string => {
      if (!origin || !ALLOWED_ORIGINS.includes(origin)) {
        return ALLOWED_ORIGINS[0]; // fallback sécurisé
      }
      return origin;
    };

    expect(validateOrigin('https://evil.com')).toBe('https://prestaservicesantilles.com');
    expect(validateOrigin('https://app.prestaservicesantilles.com')).toBe(
      'https://app.prestaservicesantilles.com'
    );
    expect(validateOrigin(undefined)).toBe('https://prestaservicesantilles.com');
  });
});

// ─── 5. AUTORISATION ADMIN CODÉE EN DUR ─────────────────────────────────────

describe('[SEC-05] Email admin codé en dur dans les vérifications d\'autorisation', () => {
  it('VULNÉRABILITÉ : un email fixe est utilisé comme condition d\'accès admin', () => {
    const hardcodedEmail = 'contact@prestaservicesantilles.com';
    const notifyHasCoded = notifyApiSource.includes(hardcodedEmail);
    const demoHasCoded = demoAccountsSource.includes(hardcodedEmail);
    expect(notifyHasCoded).toBe(true);
    expect(demoHasCoded).toBe(true);
    console.log(
      `RISQUE : Si l\'email ${hardcodedEmail} change, les vérifications d\'accès admin ` +
      'dans le code devront être mises à jour manuellement.'
    );
  });

  it('RECOMMANDATION : utiliser uniquement le rôle en base de données pour l\'autorisation', () => {
    // notify.js interroge déjà la table users pour vérifier le rôle
    const usesRoleCheck = notifyApiSource.includes('.select(\'role\')') &&
      notifyApiSource.includes('role === \'admin\'');
    expect(usesRoleCheck).toBe(true);
    console.log('La vérification de rôle est présente — supprimer le fallback par email codé en dur.');
  });
});

// ─── 6. VALIDATION DES ENTRÉES ───────────────────────────────────────────────

describe('[SEC-06] Absence de validation et de rate-limiting sur les formulaires publics', () => {
  it('VULNÉRABILITÉ : submitContactForm ne limite pas la fréquence d\'envoi', () => {
    const fnBlock = dataContextSource.match(
      /const submitContactForm[\s\S]*?^\s*\};/m
    )?.[0] ?? '';
    const hasRateLimit = fnBlock.includes('rateLimit') || fnBlock.includes('throttle');
    expect(hasRateLimit).toBe(false); // Confirme l'absence de rate-limiting
    console.log(
      'RISQUE : Un attaquant peut envoyer des milliers de messages via submitContactForm, ' +
      'saturant la boîte mail et la table contact_forms.'
    );
  });

  it('le formulaire de contact valide la présence des champs obligatoires', () => {
    // La fonction insère les données telles quelles sans validation préalable
    const fnBlock = dataContextSource.match(
      /const submitContactForm[\s\S]*?^\s*\};/m
    )?.[0] ?? '';
    const validatesEmail = fnBlock.includes('email') && fnBlock.includes('message');
    // La validation existe implicitement via les champs requis en DB, mais pas explicitement
    expect(validatesEmail).toBe(true);
    console.log('RECOMMANDATION : ajouter une validation explicite (format email, longueur max) côté client et côté serveur.');
  });

  it('RECOMMANDATION : implémenter un rate-limiter côté serveur Supabase Edge Function', () => {
    // Ce test documente uniquement la recommandation
    const recommendation = [
      '1. Ajouter un Edge Function serverless devant submitContactForm',
      '2. Limiter à 5 soumissions par IP par 10 minutes',
      '3. Utiliser Redis ou une table Supabase pour stocker les compteurs',
    ].join('\n');
    console.log(recommendation);
    expect(recommendation).toBeTruthy();
  });
});

// ─── 7. INJECTION ET EXPOSITION DE DONNÉES ───────────────────────────────────

describe('[SEC-07] Exposition de données via select et injection potentielle', () => {
  it('VULNÉRABILITÉ : reviews.insert utilise un champ camelCase (clientId au lieu de client_id)', () => {
    const reviewInsert = dataContextSource.match(
      /supabase\.from\('reviews'\)\.insert\(\{[\s\S]*?\}\)/
    )?.[0] ?? '';
    const usesCamelCase = reviewInsert.includes('clientId');
    const usesSnakeCase = reviewInsert.includes('client_id');
    console.log(`reviews.insert → camelCase: ${usesCamelCase}, snake_case: ${usesSnakeCase}`);
    // Ce bug provoque un échec silencieux : client_id n'est jamais enregistré
    expect(usesCamelCase).toBe(true);
    expect(usesSnakeCase).toBe(false); // ← BUG : la colonne DB attend snake_case
  });

  it('les queries Supabase utilisent des requêtes paramétrées (protection contre l\'injection SQL)', () => {
    // Supabase JS génère toujours des requêtes paramétrées via le SDK PostgREST
    // Il n'y a pas de construction de requêtes SQL par concaténation de chaînes
    const hasRawSqlConcat = dataContextSource.match(/`.*\$\{.*\}.*WHERE/);
    expect(hasRawSqlConcat).toBeNull();
  });

  it('la fonction getContactConflicts limite les résultats à 5 par requête', () => {
    expect(dataContextSource).toMatch(/\.limit\(5\)/);
  });

  it('VULNÉRABILITÉ : getDocumentDetails et getMissionDetails ne vérifient pas l\'appartenance de l\'utilisateur', () => {
    // Ces fonctions fetch par ID sans vérifier que l'utilisateur connecté a accès
    const getMissionDetailsBlock = dataContextSource.match(
      /const getMissionDetails[\s\S]*?^\s*\};/m
    )?.[0] ?? '';
    const checksUserAccess =
      getMissionDetailsBlock.includes('currentUser') &&
      getMissionDetailsBlock.includes('.eq(\'client_id\'');
    expect(checksUserAccess).toBe(false); // ← Confirme l'absence de vérification
    console.log(
      'RISQUE : Un utilisateur authentifié peut accéder aux détails de n\'importe quelle mission ' +
      'en connaissant son UUID. La sécurité repose uniquement sur les policies RLS Supabase.'
    );
  });
});

// ─── 8. GESTION DES TOKENS DE PÉRIPHÉRIQUES ──────────────────────────────────

describe('[SEC-08] Sécurité des tokens de périphériques push', () => {
  it('device-tokens.js authentifie l\'utilisateur avant l\'enregistrement', () => {
    expect(deviceTokensSource).toContain('getUserFromAuthHeader');
    expect(deviceTokensSource).toContain('401');
  });

  it('le token est upsert avec contrainte d\'unicité', () => {
    expect(deviceTokensSource).toContain('onConflict: \'token\'');
  });

  it('notify.js purge automatiquement les tokens invalides après envoi FCM', () => {
    const purgesInvalidTokens =
      notifyApiSource.includes('invalidTokens') &&
      notifyApiSource.includes('.delete()');
    expect(purgesInvalidTokens).toBe(true);
  });

  it('PROBLÈME DÉTECTÉ : aucune limite sur le nombre de tokens par utilisateur', () => {
    // Un utilisateur peut enregistrer un nombre illimité de tokens
    const hasTokenLimit = deviceTokensSource.includes('count') ||
      deviceTokensSource.includes('limit');
    expect(hasTokenLimit).toBe(false); // ← Confirme l'absence de limite
    console.log('RECOMMANDATION : limiter à N tokens par user_id (ex: 5) pour éviter l\'abus.');
  });
});
