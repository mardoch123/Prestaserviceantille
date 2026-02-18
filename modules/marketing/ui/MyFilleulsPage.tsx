import React, { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../../../context/DataContext';
import { listMyPendingClientLeads, listMyReferrals, listPendingClientLeadsByCode } from '../client';
import type { ClientLead, MktReferral } from '../types';
import MarketingPublicShell from './MarketingPublicShell';

const statusLabel = (s: string) => {
  switch (String(s || '')) {
    case 'pending':
      return 'En attente';
    case 'validated':
      return 'Validé';
    case 'rewarded':
      return 'Récompensé';
    case 'rejected':
      return 'Refusé';
    case 'blocked':
      return 'Bloqué';
    default:
      return String(s || '');
  }
};

const MyFilleulsPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, companySettings } = useData();

  const isLoggedIn = useMemo(() => !!currentUser?.id, [currentUser?.id]);

  const [loading, setLoading] = useState(true);
  const [pendingLeads, setPendingLeads] = useState<ClientLead[]>([]);
  const [rows, setRows] = useState<MktReferral[]>([]);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      if (!isLoggedIn) {
        if (mounted) {
          setRows([]);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      try {
        let [leads, r] = await Promise.all([listMyPendingClientLeads(), listMyReferrals()]);
        if (!mounted) return;

        // Fallback: if the app uses localStorage-based login (no Supabase session), auth.uid() is null,
        // so authenticated RLS policies will hide rows. In that case, use a public RPC by referral code.
        if (!Array.isArray(leads) || leads.length === 0) {
          try {
            const code = String(localStorage.getItem('mkt_client_referral_code') || '').trim();
            if (code) {
              const publicLeads = await listPendingClientLeadsByCode(code);
              if (Array.isArray(publicLeads) && publicLeads.length > 0) {
                leads = publicLeads;
              }
            }
          } catch {
            // ignore
          }
        }
        setPendingLeads(leads);
        setRows(r);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    run();

    return () => {
      mounted = false;
    };
  }, [isLoggedIn]);

  return (
    <MarketingPublicShell
      title="Mes filleuls"
      subtitle="Parrainage"
      onBack={() => navigate(-1)}
      logoUrl={companySettings?.logoUrl}
      brandName={companySettings?.name}
      maxWidthClassName="max-w-4xl"
    >
      {loading ? (
        <div className="mt-8 flex items-center gap-2 text-slate-600">
          <Loader2 className="w-5 h-5 animate-spin" />
          Chargement...
        </div>
      ) : (
        <>
          <div className="mt-6">
            <div className="text-sm font-extrabold text-slate-800">En attente de validation</div>
            <div className="text-xs text-slate-500">Ces filleuls seront validés par un administrateur.</div>
            <div className="mt-3 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="text-left p-3 font-extrabold">Nom</th>
                      <th className="text-left p-3 font-extrabold">Contact</th>
                      <th className="text-left p-3 font-extrabold">Statut</th>
                      <th className="text-right p-3 font-extrabold">Créé le</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingLeads.map((l) => (
                      <tr key={l.id} className="border-t border-slate-100">
                        <td className="p-3 font-extrabold text-slate-800">{l.full_name || '—'}</td>
                        <td className="p-3 text-slate-700">
                          <div>{l.email || '—'}</div>
                          <div className="text-xs text-slate-500">{l.phone || '—'}</div>
                        </td>
                        <td className="p-3 text-slate-700">En attente</td>
                        <td className="p-3 text-right text-slate-700">{(l as any).created_at ? new Date((l as any).created_at).toLocaleDateString() : '—'}</td>
                      </tr>
                    ))}
                    {!pendingLeads.length ? (
                      <tr>
                        <td colSpan={4} className="p-6 text-center text-slate-500">Aucun filleul en attente.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="mt-8">
            <div className="text-sm font-extrabold text-slate-800">Historique des filleuls</div>
            <div className="text-xs text-slate-500">Filleuls validés et suivi des prestations payées.</div>
            <div className="mt-3 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="text-left p-3 font-extrabold">Nom</th>
                      <th className="text-left p-3 font-extrabold">Contact</th>
                      <th className="text-left p-3 font-extrabold">Statut</th>
                      <th className="text-right p-3 font-extrabold">Prestations payées</th>
                      <th className="text-right p-3 font-extrabold">Créé le</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id} className="border-t border-slate-100">
                        <td className="p-3 font-extrabold text-slate-800">{r.referred_full_name || '—'}</td>
                        <td className="p-3 text-slate-700">
                          <div>{r.referred_email || '—'}</div>
                          <div className="text-xs text-slate-500">{r.referred_phone || '—'}</div>
                        </td>
                        <td className="p-3 text-slate-700">{statusLabel(String((r as any).status || ''))}</td>
                        <td className="p-3 text-right font-extrabold text-slate-800">{Number((r as any).paid_invoices_count || 0)}</td>
                        <td className="p-3 text-right text-slate-700">{(r as any).created_at ? new Date((r as any).created_at).toLocaleDateString() : '—'}</td>
                      </tr>
                    ))}
                    {!rows.length ? (
                      <tr>
                        <td colSpan={5} className="p-6 text-center text-slate-500">Aucun filleul validé pour le moment.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </MarketingPublicShell>
  );
};

export default MyFilleulsPage;
