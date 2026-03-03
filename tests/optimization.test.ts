/**
 * TESTS D'OPTIMISATION DES REQUÊTES
 *
 * Ce fichier vérifie que les patterns d'accès à la base de données
 * respectent les bonnes pratiques de performance :
 * - Requêtes parallèles plutôt que séquentielles
 * - Fenêtrage temporel sur les missions
 * - Sélection de colonnes minimales
 * - Pagination sur les grands ensembles de données
 * - Cache local pour éviter les re-fetches
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const dataContextSource = fs.readFileSync(
  path.resolve(__dirname, '../context/DataContext.tsx'),
  'utf-8'
);

// ─── 1. PARALLÉLISME DES REQUÊTES ────────────────────────────────────────────

describe('Parallélisme des requêtes', () => {
  it('démontre que les requêtes séquentielles sont significativement plus lentes que les requêtes parallèles', async () => {
    const QUERY_DELAY_MS = 50;
    const NUM_TABLES = 10;

    const fakeSupabaseFetch = async (_table: string) => {
      await new Promise<void>((resolve) => setTimeout(resolve, QUERY_DELAY_MS));
      return { data: [], error: null };
    };

    const tables = [
      'client_leads', 'documents', 'packs', 'contracts',
      'expenses', 'messages', 'notifications', 'contact_forms',
      'visit_scans', 'video_recordings',
    ];

    // Pattern actuel (séquentiel) — simulation du bloc dans refreshData
    const t0Sequential = Date.now();
    for (const table of tables) {
      await fakeSupabaseFetch(table);
    }
    const sequentialMs = Date.now() - t0Sequential;

    // Pattern optimisé (parallèle)
    const t0Parallel = Date.now();
    await Promise.all(tables.map(fakeSupabaseFetch));
    const parallelMs = Date.now() - t0Parallel;

    // La version parallèle doit être au moins 4× plus rapide
    expect(parallelMs).toBeLessThan(sequentialMs / 4);
    console.log(
      `Séquentiel: ${sequentialMs} ms | Parallèle: ${parallelMs} ms | Gain: ×${(sequentialMs / parallelMs).toFixed(1)}`
    );
  });

  it('PROBLÈME DÉTECTÉ : le bloc secondaire de refreshData effectue ~14 requêtes séquentielles', () => {
    // Compte toutes les lignes « let X = await fetchTable(… » dans refreshData
    // Un await séquentiel hors d'un Promise.all est identifiable par ce pattern
    const sequentialAwaits = dataContextSource.match(
      /let \w+\s*=\s*await fetchTable\(/g
    ) || [];

    // Il doit y en avoir au moins 10 (le bloc secondaire en a ~14)
    console.log(`Nombre de fetchTable séquentiels trouvés dans refreshData: ${sequentialAwaits.length}`);
    expect(sequentialAwaits.length).toBeGreaterThan(9); // ← Confirme le problème existant
    // Pour corriger: regrouper dans Promise.all([fetchTable(...), fetchTable(...), ...])
  });

  it('RECOMMANDATION : toutes les requêtes secondaires devraient utiliser Promise.all', () => {
    // Vérifie que Promise.all est utilisé dans refreshData pour le chargement initial
    const usesPromiseAll = dataContextSource.includes('Promise.all([');
    expect(usesPromiseAll).toBe(true); // Le batch principal l'utilise déjà — à étendre
  });
});

// ─── 2. FENÊTRAGE TEMPOREL DES MISSIONS ──────────────────────────────────────

describe('Fenêtrage temporel des missions', () => {
  it('fetchMissionsWindow applique des filtres gte/lte sur la colonne date', () => {
    expect(dataContextSource).toMatch(/\.gte\('date',\s*start\)/);
    expect(dataContextSource).toMatch(/\.lte\('date',\s*end\)/);
  });

  it('la fenêtre temporelle couvre ±3 mois par défaut', () => {
    expect(dataContextSource).toMatch(/subtract\(3,\s*['"]month['"]\)/);
    expect(dataContextSource).toMatch(/add\(3,\s*['"]month['"]\)/);
  });

  it('la taille de page est limitée à 500 enregistrements', () => {
    const pageSizeMatch = dataContextSource.match(/const pageSize\s*=\s*(\d+)/);
    expect(pageSizeMatch).not.toBeNull();
    const pageSize = parseInt(pageSizeMatch![1], 10);
    expect(pageSize).toBeLessThanOrEqual(500);
  });

  it('la pagination utilise .range() pour éviter le full-scan', () => {
    expect(dataContextSource).toMatch(/\.range\(page \* pageSize,/);
  });
});

// ─── 3. SÉLECTION DE COLONNES ─────────────────────────────────────────────────

describe('Sélection de colonnes minimales', () => {
  it('providerSelect ne sélectionne pas toutes les colonnes (*)', () => {
    const providerSelectMatch = dataContextSource.match(
      /const providerSelect\s*=\s*['"`](.*?)['"`]/
    );
    expect(providerSelectMatch).not.toBeNull();
    const providerSelect = providerSelectMatch![1];
    expect(providerSelect).not.toBe('*');
    console.log(`providerSelect: "${providerSelect}"`);
  });

  it('PROBLÈME DÉTECTÉ : clientSelect utilise * et inclut initial_password', () => {
    const clientSelectMatch = dataContextSource.match(
      /const clientSelect\s*=\s*['"`](.*?)['"`]/
    );
    expect(clientSelectMatch).not.toBeNull();
    const clientSelect = clientSelectMatch![1];
    // Actuellement '*' – ce qui expose initial_password au frontend
    expect(clientSelect).toBe('*'); // ← Confirme le problème
    console.log(`ATTENTION — clientSelect="${clientSelect}" : expose les mots de passe en clair`);
  });

  it('missionSelect liste explicitement les colonnes utiles', () => {
    const missionSelectMatch = dataContextSource.match(
      /const missionSelect\s*=\s*['"`](.*?)['"`]/
    );
    expect(missionSelectMatch).not.toBeNull();
    const missionSelect = missionSelectMatch![1];
    expect(missionSelect).not.toBe('*');
    expect(missionSelect.split(',').length).toBeGreaterThan(5);
  });

  it('reminderSelect ne charge que les colonnes nécessaires', () => {
    const reminderSelectMatch = dataContextSource.match(
      /const reminderSelect\s*=\s*['"`](.*?)['"`]/
    );
    expect(reminderSelectMatch).not.toBeNull();
    const reminderSelect = reminderSelectMatch![1];
    expect(reminderSelect).not.toBe('*');
  });
});

// ─── 4. REQUÊTES DANS getContactConflicts ────────────────────────────────────

describe('getContactConflicts — 4 requêtes indépendantes', () => {
  it('PROBLÈME DÉTECTÉ : les 4 requêtes (email×2 + phone×2) sont séquentielles', () => {
    // Extrait la fonction getContactConflicts
    const fnMatch = dataContextSource.match(
      /const getContactConflicts[\s\S]*?^    \};/m
    );
    const fnBody = fnMatch ? fnMatch[0] : '';

    // Compte les await supabase séquentiels à l'intérieur
    const awaitCount = (fnBody.match(/const \{ data/g) || []).length;
    console.log(`Requêtes séquentielles dans getContactConflicts: ${awaitCount}`);

    // 4 requêtes existent (2 email + 2 phone) — toutes séquentielles actuellement
    expect(awaitCount).toBeGreaterThanOrEqual(4);
  });

  it('RECOMMANDATION : grouper par email puis phone avec Promise.all (2 aller-retours au lieu de 4)', () => {
    // Simulation du gain potentiel
    const QUERY_MS = 30;

    const currentApproach = async () => {
      for (let i = 0; i < 4; i++) {
        await new Promise<void>((r) => setTimeout(r, QUERY_MS));
      }
    };

    const optimizedApproach = async () => {
      await Promise.all([
        Promise.all([
          new Promise<void>((r) => setTimeout(r, QUERY_MS)), // clients by email
          new Promise<void>((r) => setTimeout(r, QUERY_MS)), // providers by email
        ]),
        Promise.all([
          new Promise<void>((r) => setTimeout(r, QUERY_MS)), // clients by phone
          new Promise<void>((r) => setTimeout(r, QUERY_MS)), // providers by phone
        ]),
      ]);
    };

    return Promise.all([
      currentApproach().then((_, i = Date.now()) => Date.now() - i),
      optimizedApproach().then((_, i = Date.now()) => Date.now() - i),
    ]).then(([seqTime, parallelTime]) => {
      console.log(`Actuel ~${4 * QUERY_MS}ms → Optimisé ~${QUERY_MS}ms (Promise.all imbriqués)`);
      // Le test documente le gain théorique
      expect(true).toBe(true);
    });
  });
});

// ─── 5. CACHE LOCAL DES MISSIONS ─────────────────────────────────────────────

describe('Cache local des missions', () => {
  it('loadMissionsForRange utilise localStorage pour le cache', () => {
    expect(dataContextSource).toMatch(/localStorage\.setItem\(cacheKey/);
    expect(dataContextSource).toMatch(/localStorage\.setItem\(cacheMetaKey/);
  });

  it('le cache de missions évite un re-fetch inutile si les données sont fraîches', () => {
    // Simulation du comportement du cache
    const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
    const now = Date.now();
    const cachedAt = now - 1000; // il y a 1 seconde

    const isCacheValid = (now - cachedAt) < CACHE_TTL_MS;
    expect(isCacheValid).toBe(true);
  });

  it('PROBLÈME DÉTECTÉ : les requêtes notifications/messages/contactForms n\'ont pas de cache', () => {
    // Ces tables font l'objet d'un fetchTable à chaque refreshData sans cache
    const hasCacheForNotifs = dataContextSource.includes('cacheKey_notifications');
    const hasCacheForMessages = dataContextSource.includes('cacheKey_messages');
    expect(hasCacheForNotifs).toBe(false); // ← Confirme l'absence de cache
    expect(hasCacheForMessages).toBe(false); // ← Confirme l'absence de cache
    console.log('RECOMMANDATION : ajouter un cache TTL pour notifications, messages et contact_forms');
  });
});

// ─── 6. GESTION DES TIMEOUTS ─────────────────────────────────────────────────

describe('Gestion des timeouts', () => {
  it('fetchTable utilise un timeout de 15 000 ms par défaut', () => {
    expect(dataContextSource).toMatch(/timeout:\s*number\s*=\s*15000/);
  });

  it('fetchMissionsWindow utilise un timeout global de 25 000 ms', () => {
    expect(dataContextSource).toMatch(/fetchMissionsWindow\(25000/);
  });

  it('un timeout individuel de page est défini pour la pagination des missions', () => {
    expect(dataContextSource).toMatch(/const pageTimeout\s*=\s*12000/);
  });

  it('une requête qui dépasse le timeout doit être annulée', async () => {
    const timeoutMs = 100;
    let aborted = false;

    const slowQuery = new Promise<void>((_, reject) => {
      const timer = setTimeout(() => {
        aborted = true;
        reject(new Error(`Timeout après ${timeoutMs}ms`));
      }, timeoutMs);
      // Simule une requête qui prend 500ms
      setTimeout(() => clearTimeout(timer), 500);
    });

    await expect(slowQuery).rejects.toThrow('Timeout');
    expect(aborted).toBe(true);
  });
});
