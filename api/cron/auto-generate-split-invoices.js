/**
 * Cron API : Génération automatique des factures fractionnées en attente
 * 
 * Vérifie tous les devis signés avec une configuration de facturation fractionnée
 * et génère automatiquement les factures pour les tranches prêtes.
 * 
 * Déclencheurs :
 * - À la signature d'un devis (tranches trigger='signature')
 * - Après complétion d'une mission (tranches trigger='completion')
 * - Via cron planifié (toutes les heures)
 * 
 * Endpoint : GET/POST /api/cron/auto-generate-split-invoices
 * Header : x-cron-secret (optionnel, selon config CRON_SECRET)
 */

import { getSupabaseAdminClient } from '../_lib/supabaseAdmin.js';

function isAuthorizedCron(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // allow if not configured
  const header = req.headers['x-cron-secret'] || req.headers['X-Cron-Secret'] || '';
  return String(header) === String(secret);
}

/**
 * Calcule la configuration de facturation fractionnée
 * (version serveur simplifiée, miroir de utils/splitBilling.ts)
 */
function calculateSplitBillingConfig(totalSessions, totalAmount) {
  if (totalSessions <= 0) return null;

  let sessionsPerSplit, billingMode, splits = [];

  if (totalSessions === 1) {
    sessionsPerSplit = 1;
    billingMode = 'at_signature';
    splits = [{ index: 0, sessions: [1], status: 'pending', amount: totalAmount, trigger: 'signature' }];
    return { totalSessions, sessionsPerSplit, totalSplits: 1, billingMode, splits };
  }

  if (totalSessions === 2) {
    sessionsPerSplit = 1;
    billingMode = 'mixed';
    const amountPerSplit = totalAmount / 2;
    splits = [
      { index: 0, sessions: [1], status: 'pending', amount: Math.round(amountPerSplit * 100) / 100, trigger: 'signature' },
      { index: 1, sessions: [2], status: 'pending', amount: Math.round(amountPerSplit * 100) / 100, trigger: 'completion', triggerSession: 2 }
    ];
    return { totalSessions, sessionsPerSplit, totalSplits: 2, billingMode, splits };
  }

  sessionsPerSplit = totalSessions <= 12 ? 2 : 3;
  billingMode = totalSessions <= 12 ? 'mixed' : 'after_completion';

  const totalSplits = Math.ceil(totalSessions / sessionsPerSplit);
  const amountPerSplit = totalAmount / totalSplits;

  for (let i = 0; i < totalSplits; i++) {
    const startSession = i * sessionsPerSplit + 1;
    const endSession = Math.min((i + 1) * sessionsPerSplit, totalSessions);
    const sessions = Array.from({ length: endSession - startSession + 1 }, (_, idx) => startSession + idx);
    const trigger = billingMode === 'at_signature' ? 'signature' :
                    billingMode === 'after_completion' ? 'completion' :
                    i === 0 ? 'signature' : 'completion';
    splits.push({
      index: i, sessions, status: 'pending',
      amount: Math.round(amountPerSplit * 100) / 100,
      trigger, triggerSession: trigger === 'completion' ? endSession : undefined
    });
  }

  // Ajuster le dernier montant
  if (splits.length > 0) {
    const sumWithoutLast = splits.slice(0, -1).reduce((sum, s) => sum + s.amount, 0);
    splits[splits.length - 1].amount = Math.round((totalAmount - sumWithoutLast) * 100) / 100;
  }

  return { totalSessions, sessionsPerSplit, totalSplits, billingMode, splits };
}

/**
 * Vérifie si une tranche est prête à être facturée
 */
function isSplitReadyForInvoicing(split, completedSessions) {
  if (split.status !== 'pending') return false;
  if (split.trigger === 'signature') return true;
  const maxSessionInSplit = Math.max(...split.sessions);
  return completedSessions >= maxSessionInSplit;
}

/**
 * Génère une référence de facture fractionnée
 */
function generateSplitInvoiceRef(baseRef, splitIndex, totalSplits) {
  const invoiceRef = baseRef.replace(/^DEV/i, 'FAC');
  return `${invoiceRef}-${String(splitIndex + 1).padStart(2, '0')}-${String(totalSplits).padStart(2, '0')}`;
}

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!isAuthorizedCron(req)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const admin = getSupabaseAdminClient();
    const now = new Date().toISOString();
    const today = now.split('T')[0];

    // 1. Récupérer tous les devis signés avec splitBillingConfig
    const { data: quotesWithConfig, error: quotesError } = await admin
      .from('documents')
      .select('id, ref, type, status, client_id, client_name, category, description, service_type, unit_price, quantity, tva_rate, total_ht, total_ttc, tax_credit_enabled, slots_data, pack_id, split_billing_config, total_sessions, signature_date, created_at')
      .eq('type', 'Devis')
      .eq('status', 'signed')
      .not('split_billing_config', 'is', null);

    if (quotesError) {
      console.error('[cron/split-invoices] Error fetching quotes:', quotesError);
      res.status(500).json({ error: quotesError.message });
      return;
    }

    // 2. Récupérer aussi les devis signés SANS config (à configurer)
    const { data: quotesWithoutConfig } = await admin
      .from('documents')
      .select('id, ref, type, status, client_id, client_name, category, description, service_type, unit_price, quantity, tva_rate, total_ht, total_ttc, tax_credit_enabled, slots_data, pack_id, total_sessions, signature_date, created_at')
      .eq('type', 'Devis')
      .eq('status', 'signed')
      .is('split_billing_config', null);

    let configuredCount = 0;
    let generatedCount = 0;
    let errors = [];

    // 2a. Configurer les devis sans config
    if (quotesWithoutConfig && quotesWithoutConfig.length > 0) {
      for (const quote of quotesWithoutConfig) {
        try {
          const totalSessions = quote.total_sessions || quote.slots_data?.length || quote.quantity || 1;
          const totalAmount = quote.total_ttc || 0;
          const config = calculateSplitBillingConfig(totalSessions, totalAmount);
          if (!config) continue;

          await admin.from('documents').update({
            split_billing_config: config,
            total_sessions: totalSessions
          }).eq('id', quote.id);

          quote.split_billing_config = config;
          configuredCount++;
        } catch (e) {
          errors.push(`Config ${quote.ref}: ${e.message}`);
        }
      }
    }

    // 3. Combiner tous les devis avec config
    const allQuotes = [...(quotesWithConfig || []), ...(quotesWithoutConfig || [])].filter(q => q.split_billing_config);

    // 4. Pour chaque devis, vérifier et générer les factures prêtes
    for (const quote of allQuotes) {
      try {
        const config = quote.split_billing_config;
        if (!config || !config.splits) continue;

        // Compter les sessions complétées pour ce devis
        const { data: quoteMissions } = await admin
          .from('missions')
          .select('id, status, date')
          .eq('source_document_id', quote.id);

        const today = new Date().toISOString().split('T')[0];
        const completedSessions = (quoteMissions || []).filter(m => 
          m.status === 'completed' || (m.date && m.date <= today && m.status !== 'cancelled')
        ).length;

        // Vérifier chaque tranche
        for (const split of config.splits) {
          if (!isSplitReadyForInvoicing(split, completedSessions)) continue;

          // Vérifier si la facture existe déjà
          const invoiceRef = generateSplitInvoiceRef(quote.ref, split.index, config.totalSplits);
          const { data: existingInvoice } = await admin
            .from('documents')
            .select('id')
            .eq('ref', invoiceRef)
            .maybeSingle();

          if (existingInvoice) {
            // Marquer la tranche comme facturée si ce n'est pas déjà fait
            if (split.status === 'pending') {
              split.status = 'invoiced';
              split.invoiceId = existingInvoice.id;
            }
            continue;
          }

          // Générer la facture
          const invoiceId = generateUUID();
          const splitAmount = split.amount;
          const tvaRate = quote.tva_rate || 0;
          const splitAmountHT = splitAmount / (1 + tvaRate / 100);

          const invoiceData = {
            id: invoiceId,
            ref: invoiceRef,
            type: 'Facture',
            status: 'pending',
            date: today,
            client_id: quote.client_id,
            client_name: quote.client_name,
            category: quote.category,
            description: `${quote.description} - Tranche ${split.index + 1}/${config.totalSplits} (Sessions ${split.sessions.join('-')})`,
            service_type: quote.service_type,
            unit_price: splitAmount,
            quantity: split.sessions.length,
            tva_rate: tvaRate,
            total_ht: splitAmountHT,
            total_ttc: splitAmount,
            tax_credit_enabled: quote.tax_credit_enabled,
            linked_invoice_id: quote.id,
            parent_quote_id: quote.id,
            split_index: split.index,
            total_splits: config.totalSplits,
            covered_sessions: split.sessions,
            total_sessions: config.totalSessions,
            slots_data: quote.slots_data?.filter((_, idx) => split.sessions.includes(idx + 1)),
            pack_id: quote.pack_id,
            is_read: false
          };

          const { error: insertError } = await admin.from('documents').insert(invoiceData);
          if (insertError) {
            errors.push(`Insert ${invoiceRef}: ${insertError.message}`);
            continue;
          }

          // Marquer la tranche comme facturée
          split.status = 'invoiced';
          split.invoiceId = invoiceId;
          split.invoicedAt = now;
          generatedCount++;
        }

        // Mettre à jour la config du devis
        await admin.from('documents').update({
          split_billing_config: config
        }).eq('id', quote.id);

      } catch (e) {
        errors.push(`Quote ${quote.ref}: ${e.message}`);
      }
    }

    // 5. Créer une notification admin si des factures ont été générées
    if (generatedCount > 0 || configuredCount > 0) {
      try {
        await admin.from('notifications').insert({
          id: generateUUID(),
          target: 'admin',
          type: 'success',
          title: 'Facturation Auto-Générée',
          message: `${configuredCount} pack(s) configuré(s), ${generatedCount} facture(s) générée(s) automatiquement.`,
          link: 'tab:invoices-split',
          read: false,
          created_at: now
        });
      } catch (e) {
        console.warn('[cron/split-invoices] Failed to create notification:', e.message);
      }
    }

    const result = {
      ok: true,
      configured: configuredCount,
      generated: generatedCount,
      quotesProcessed: allQuotes.length,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: now
    };

    console.log('[cron/split-invoices] Result:', result);
    res.status(200).json(result);

  } catch (e) {
    console.error('[cron/split-invoices] error', e);
    res.status(500).json({ error: 'Internal error', details: e.message });
  }
}
