import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle, Loader2, X } from 'lucide-react';
import { useData } from '../../../context/DataContext';
import { supabase, isSupabaseConfigured } from '../../../utils/supabaseClient';
import { getMartiniqueToday } from '../../../src/utils/martiniqueTime';
import { createReferralValidated } from '../referralClient';

const AdminReferralLeadsPage: React.FC = () => {
  const { currentUser, addClient, refreshData, companySettings, addNotification } = useData();
  const [leadUpdatingId, setLeadUpdatingId] = useState<string | null>(null);
  const [selectedLeadDetails, setSelectedLeadDetails] = useState<any | null>(null);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [leads, setLeads] = useState<any[]>([]);
  const [leadsError, setLeadsError] = useState<string | null>(null);

  const loadPendingLeads = async () => {
    if (!isSupabaseConfigured) return;
    if (currentUser?.role !== 'admin' && currentUser?.role !== 'super_admin') {
      setLeads([]);
      setLeadsError(null);
      return;
    }

    setLoadingLeads(true);
    setLeadsError(null);
    try {
      const { data, error } = await supabase.rpc('mkt_admin_list_pending_client_leads', { p_limit: 2000 });
      if (error) {
        setLeads([]);
        setLeadsError(String(error.message || error));
        return;
      }
      if (data && (data as any).ok === true) {
        const items = (data as any).items;
        if (Array.isArray(items)) {
          setLeads(items as any);

          // Mark unseen leads as seen by admin (best-effort)
          try {
            const unseenIds = (items as any[])
              .filter((l: any) => !l?.admin_seen_at)
              .map((l: any) => l?.id)
              .filter(Boolean);
            if (unseenIds.length) {
              await supabase
                .from('client_leads')
                .update({ admin_seen_at: new Date().toISOString() })
                .in('id', unseenIds);
            }
          } catch {
            // ignore
          }
          return;
        }
      }
      setLeads([]);
    } catch {
      setLeads([]);
      setLeadsError('Impossible de charger les leads.');
    } finally {
      setLoadingLeads(false);
    }
  };

  useEffect(() => {
    loadPendingLeads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, currentUser?.role]);

  const pendingLeads = useMemo(() => {
    if (currentUser?.role !== 'admin' && currentUser?.role !== 'super_admin') return [] as any[];
    return (leads || []).filter((l: any) => String(l?.status || '').toLowerCase() === 'pending');
  }, [leads, currentUser?.role]);

  const validateLead = async (lead: any) => {
    if (!lead?.id) return;
    if (leadUpdatingId) return;
    if (!isSupabaseConfigured) return;

    setLeadUpdatingId(String(lead.id));
    try {
      const fullName = String(lead.full_name || lead.fullName || '').trim();
      const email = String(lead.email || '').trim();
      const phone = String(lead.phone || '').trim();
      const address = String(lead.address || '').trim();
      const city = String(lead.city || '').trim();
      const referralCode = String(lead.referral_code || lead.referralCode || '').trim();

      if (!fullName || !email) {
        alert('Lead invalide (nom/email manquant).');
        return;
      }

      const password = await addClient({
        name: fullName,
        city: city || '-',
        address: address || '-',
        phone: phone || '-',
        email,
        pack: '-',
        status: 'active',
        since: getMartiniqueToday(),
        packsConsumed: 0,
        loyaltyHoursAvailable: 0,
      } as any);

      if (!password) {
        alert('Création du client échouée.');
        return;
      }

      let createdClientId: string | null = null;
      try {
        const { data: createdClient } = await supabase
          .from('clients')
          .select('id')
          .eq('email', email)
          .order('since', { ascending: false })
          .limit(1)
          .maybeSingle();
        createdClientId = (createdClient as any)?.id || null;
      } catch {
        createdClientId = null;
      }

      if (referralCode) {
        try {
          await createReferralValidated({
            referral_code: referralCode,
            referred_full_name: fullName,
            referred_email: email,
            referred_phone: phone || null,
            referred_client_id: createdClientId,
            source_request_id: null,
          });
        } catch {
          // ignore
        }
      }

      try {
        await supabase
          .from('client_leads')
          .update({
            status: 'validated',
            validated_at: new Date().toISOString(),
            validated_by: currentUser?.id || null,
            created_client_id: createdClientId,
          })
          .eq('id', lead.id);
      } catch {
        // ignore
      }

      try {
        const subject = 'Nouveau client validé (lead)';
        const ctx = {
          lead_id: lead.id,
          client_email: email,
          client_name: fullName,
          client_phone: phone,
          city,
          address,
          referral_code: referralCode || null,
          created_client_id: createdClientId,
        };

        await supabase.from('mkt_notification_outbox').insert({
          channel: 'email',
          template: 'lead_client_validated',
          to_user_type: 'admin',
          to_user_id: null,
          to_email: companySettings?.email || null,
          title: subject,
          body: subject,
          data: ctx,
        });

        if (referralCode) {
          const { data: refData } = await supabase.rpc('mkt_get_referrer_public_by_code', { p_referral_code: referralCode });
          const refEmail = String((refData as any)?.email || '').trim();
          const referrerId = String((refData as any)?.id || '').trim();
          if (refEmail) {
            await supabase.from('mkt_notification_outbox').insert({
              channel: 'email',
              template: 'lead_client_validated_referrer',
              to_user_type: 'client',
              to_user_id: null,
              to_email: refEmail,
              title: 'Votre filleul a été validé',
              body: 'Votre filleul a été validé.',
              data: ctx,
            });
          }

          // In-app notification for referrer (if we can resolve a target user id)
          if (referrerId) {
            try {
              const { data: refRow } = await supabase
                .from('mkt_referrers')
                .select('auth_user_id')
                .eq('id', referrerId)
                .maybeSingle();
              const authUserId = String((refRow as any)?.auth_user_id || '').trim();
              if (authUserId) {
                await addNotification(
                  'client',
                  'success',
                  'Filleul validé',
                  `Ton filleul ${fullName || ''} a été validé.`.trim(),
                  authUserId,
                  '/parrainage/mes-filleuls'
                );
              }
            } catch {
              // ignore
            }
          }
        }
      } catch {
        // ignore
      }

      await refreshData();
      await loadPendingLeads();
    } catch (e: any) {
      alert(String(e?.message || 'Erreur lors de la validation du lead.'));
    } finally {
      setLeadUpdatingId(null);
    }
  };

  const rejectLead = async (lead: any) => {
    if (!lead?.id) return;
    if (leadUpdatingId) return;
    if (!isSupabaseConfigured) return;

    setLeadUpdatingId(String(lead.id));
    try {
      const fullName = String(lead.full_name || lead.fullName || '').trim();
      const referralCode = String(lead.referral_code || lead.referralCode || '').trim();
      await supabase
        .from('client_leads')
        .update({
          status: 'rejected',
          validated_at: new Date().toISOString(),
          validated_by: currentUser?.id || null,
        })
        .eq('id', lead.id);

      if (referralCode) {
        try {
          const { data: refData } = await supabase.rpc('mkt_get_referrer_public_by_code', { p_referral_code: referralCode });
          const referrerId = String((refData as any)?.id || '').trim();
          if (referrerId) {
            const { data: refRow } = await supabase
              .from('mkt_referrers')
              .select('auth_user_id')
              .eq('id', referrerId)
              .maybeSingle();
            const authUserId = String((refRow as any)?.auth_user_id || '').trim();
            if (authUserId) {
              await addNotification(
                'client',
                'alert',
                'Filleul refusé',
                `Le filleul ${fullName || ''} a été refusé.`.trim(),
                authUserId,
                '/parrainage/mes-filleuls'
              );
            }
          }
        } catch {
          // ignore
        }
      }

      await refreshData();
      await loadPendingLeads();
    } finally {
      setLeadUpdatingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-cream-50 font-sans">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-800">Filleuls en attente</h1>
            <div className="text-xs text-slate-500">Demandes à valider</div>
          </div>
        </div>

        <div className="mt-6 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left p-3 font-extrabold">Filleul</th>
                  <th className="text-left p-3 font-extrabold">Contact</th>
                  <th className="text-left p-3 font-extrabold">Ville</th>
                  <th className="text-left p-3 font-extrabold">Adresse</th>
                  <th className="text-left p-3 font-extrabold">Code parrain</th>
                  <th className="text-right p-3 font-extrabold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loadingLeads ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-slate-500">Chargement...</td>
                  </tr>
                ) : null}
                {!loadingLeads && leadsError ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-red-600 font-bold">{leadsError}</td>
                  </tr>
                ) : null}
                {pendingLeads.map((l: any) => (
                  <tr key={l.id} className="border-t border-slate-100">
                    <td className="p-3">
                      <button
                        type="button"
                        onClick={() => setSelectedLeadDetails(l)}
                        className="font-extrabold text-slate-800 hover:underline text-left"
                        title="Voir détail"
                      >
                        {l.full_name || '—'}
                      </button>
                      <div className="text-xs text-slate-500">Statut: {String(l.status || '')}</div>
                    </td>
                    <td className="p-3">
                      <div className="text-slate-700">{l.email || '—'}</div>
                      <div className="text-xs text-slate-500">{l.phone || '—'}</div>
                    </td>
                    <td className="p-3 text-slate-700">{l.city || '—'}</td>
                    <td className="p-3 text-slate-700">{l.address || '—'}</td>
                    <td className="p-3 text-slate-700">{l.referral_code || '—'}</td>
                    <td className="p-3 text-right">
                      <div className="inline-flex gap-2">
                        <button
                          type="button"
                          onClick={() => validateLead(l)}
                          disabled={leadUpdatingId === String(l.id)}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-green-600 text-white font-extrabold hover:bg-green-700 disabled:opacity-60"
                        >
                          {leadUpdatingId === String(l.id) ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                          Valider
                        </button>
                        <button
                          type="button"
                          onClick={() => rejectLead(l)}
                          disabled={leadUpdatingId === String(l.id)}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-red-600 text-white font-extrabold hover:bg-red-700 disabled:opacity-60"
                        >
                          {leadUpdatingId === String(l.id) ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                          Refuser
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!loadingLeads && !pendingLeads.length ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-slate-500">Aucun filleul en attente.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {selectedLeadDetails ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-cream-50">
              <div>
                <div className="text-sm font-extrabold text-slate-800">Détail filleul (lead)</div>
                <div className="text-xs text-slate-500">En attente de validation</div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLeadDetails(null)}
                className="p-2 hover:bg-slate-200 rounded-full transition"
                title="Fermer"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-6 space-y-3 text-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-xs font-bold text-slate-500">Nom</div>
                  <div className="font-bold text-slate-800">{selectedLeadDetails.full_name || '—'}</div>
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-500">Code parrain</div>
                  <div className="font-bold text-slate-800">{selectedLeadDetails.referral_code || '—'}</div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-xs font-bold text-slate-500">Email</div>
                  <div className="text-slate-700 break-words">{selectedLeadDetails.email || '—'}</div>
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-500">Téléphone</div>
                  <div className="text-slate-700">{selectedLeadDetails.phone || '—'}</div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-xs font-bold text-slate-500">Ville</div>
                  <div className="text-slate-700">{selectedLeadDetails.city || '—'}</div>
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-500">Adresse</div>
                  <div className="text-slate-700">{selectedLeadDetails.address || '—'}</div>
                </div>
              </div>
              <div>
                <div className="text-xs font-bold text-slate-500">Type de service</div>
                <div className="text-slate-700">{selectedLeadDetails.service_type || '—'}</div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default AdminReferralLeadsPage;
