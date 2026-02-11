import React, { useEffect, useMemo, useState } from 'react';
import { useData } from '../context/DataContext';
import { supabase } from '../utils/supabaseClient';

type DemoRole = 'admin' | 'client' | 'provider';

type DemoAccount = {
  id: string;
  authUserId: string;
  email: string;
  role: DemoRole;
  createdAt: string;
};

const DemoAccounts: React.FC = () => {
  const { currentUser, isDemoMode, demoRole, exitDemoMode } = useData();
  const [selectedRole, setSelectedRole] = useState<DemoRole>('client');

  const [demoAccounts, setDemoAccounts] = useState<DemoAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [lastCreated, setLastCreated] = useState<{ email: string; password: string } | null>(null);

  const canAccess = useMemo(() => {
    return currentUser?.role === 'admin' || currentUser?.role === 'super_admin';
  }, [currentUser?.role]);

  const apiBase = useMemo(() => {
    const raw = (import.meta as any)?.env?.VITE_API_BASE || '';
    const normalizedBase = String(raw || '').trim().replace(/\/$/, '');
    let base = normalizedBase;
    if (base) {
      base = base.endsWith('/api') ? base : `${base}/api`;
    }

    if (typeof window !== 'undefined') {
      try {
        if (base) {
          const origin = new URL(base).origin;
          if (origin !== window.location.origin) {
            base = `${window.location.origin}/api`;
          }
        } else {
          base = `${window.location.origin}/api`;
        }
      } catch {
        base = `${window.location.origin}/api`;
      }
    }

    return base;
  }, []);

  const getApiUrl = (path: string) => {
    const p = String(path || '').startsWith('/') ? String(path || '') : `/${path}`;
    if (apiBase) return `${apiBase}${p}`;
    return `/api${p}`;
  };

  const getAccessToken = async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || '';
  };

  const loadAccounts = async () => {
    setLoadingAccounts(true);
    setError('');
    try {
      const token = await getAccessToken();
      if (!token) {
        setError('Session invalide. Veuillez vous reconnecter.');
        return;
      }

      const res = await fetch(getApiUrl('/demo-accounts'), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        cache: 'no-store',
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        const details = typeof payload?.details === 'string' ? payload.details : '';
        if (res.status === 401 && details) {
          setError(details);
        } else if (res.status === 403) {
          setError('Accès interdit (admin requis).');
        } else {
          setError(payload?.error || 'Erreur lors du chargement');
        }
        return;
      }

      const list = Array.isArray(payload?.accounts) ? payload.accounts : [];
      const mapped: DemoAccount[] = list
        .map((a: any) => ({
          id: String(a?.id || ''),
          authUserId: String(a?.auth_user_id || ''),
          email: String(a?.email || ''),
          role: String(a?.role || 'client') as DemoRole,
          createdAt: String(a?.created_at || ''),
        }))
        .filter((a: DemoAccount) => !!a.id);
      setDemoAccounts(mapped);
    } catch (e: any) {
      setError(String(e?.message || e || 'Erreur lors du chargement'));
    } finally {
      setLoadingAccounts(false);
    }
  };

  useEffect(() => {
    if (!canAccess) return;
    void loadAccounts();
  }, [canAccess]);

  if (!canAccess) {
    return (
      <div className="p-8 h-full overflow-y-auto">
        <div className="max-w-2xl mx-auto bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-xl font-bold text-slate-800">Accès refusé</h2>
          <p className="text-sm text-slate-600 mt-2">Cette page est réservée aux administrateurs.</p>
        </div>
      </div>
    );
  }

  const handleCreate = async () => {
    setActionLoading(true);
    setError('');
    setLastCreated(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        setError('Session invalide. Veuillez vous reconnecter.');
        return;
      }

      const res = await fetch(getApiUrl('/demo-accounts'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        cache: 'no-store',
        body: JSON.stringify({ role: selectedRole }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(payload?.error || 'Erreur lors de la création');
        return;
      }

      if (payload?.email && payload?.password) {
        setLastCreated({ email: String(payload.email), password: String(payload.password) });
      }

      await loadAccounts();
    } catch (e: any) {
      setError(String(e?.message || e || 'Erreur lors de la création'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleExit = async () => {
    await exitDemoMode();
  };

  const handleDeleteAccount = async (id: string) => {
    const ok = window.confirm('Supprimer ce compte test ?');
    if (!ok) return;

    setActionLoading(true);
    setError('');
    try {
      const token = await getAccessToken();
      if (!token) {
        setError('Session invalide. Veuillez vous reconnecter.');
        return;
      }

      const res = await fetch(getApiUrl(`/demo-accounts?id=${encodeURIComponent(id)}`), {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        cache: 'no-store',
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(payload?.error || 'Erreur lors de la suppression');
        return;
      }

      await loadAccounts();
    } catch (e: any) {
      setError(String(e?.message || e || 'Erreur lors de la suppression'));
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="p-8 h-full overflow-y-auto bg-cream-50/50">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-xl font-bold text-slate-800">Comptes test (Mode démo)</h2>
          <p className="text-sm text-slate-600 mt-2">
            Les comptes test n'affichent aucune donnée réelle et toutes les actions d'écriture sont bloquées.
          </p>

          {isDemoMode && (
            <div className="mt-4 p-4 rounded-lg border border-orange-200 bg-orange-50">
              <p className="text-sm font-bold text-orange-800">Mode démo actif</p>
              <p className="text-xs text-orange-700 mt-1">Rôle démo : {demoRole || '—'}</p>
              <button
                type="button"
                onClick={handleExit}
                className="mt-3 px-4 py-2 rounded-lg text-sm font-bold bg-white border border-orange-300 text-orange-700 hover:bg-orange-100 transition"
              >
                Quitter le mode démo
              </button>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h3 className="text-lg font-bold text-slate-800">Créer un compte test (vrai compte)</h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
            <button
              type="button"
              onClick={() => setSelectedRole('admin')}
              className={`px-4 py-3 rounded-lg text-sm font-bold border transition ${selectedRole === 'admin'
                ? 'bg-brand-blue text-white border-brand-blue'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
            >
              Admin (démo)
            </button>
            <button
              type="button"
              onClick={() => setSelectedRole('client')}
              className={`px-4 py-3 rounded-lg text-sm font-bold border transition ${selectedRole === 'client'
                ? 'bg-brand-blue text-white border-brand-blue'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
            >
              Client (démo)
            </button>
            <button
              type="button"
              onClick={() => setSelectedRole('provider')}
              className={`px-4 py-3 rounded-lg text-sm font-bold border transition ${selectedRole === 'provider'
                ? 'bg-brand-blue text-white border-brand-blue'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
            >
              Prestataire (démo)
            </button>
          </div>

          <button
            type="button"
            onClick={handleCreate}
            disabled={actionLoading}
            className="mt-5 w-full sm:w-auto px-6 py-3 rounded-lg text-sm font-bold bg-green-600 text-white hover:bg-green-700 transition disabled:opacity-60"
          >
            Créer le compte test
          </button>

          {error ? (
            <div className="mt-4 p-4 rounded-lg border border-red-200 bg-red-50">
              <p className="text-sm font-bold text-red-800">Erreur</p>
              <p className="text-xs text-red-700 mt-1">{error}</p>
            </div>
          ) : null}

          {lastCreated ? (
            <div className="mt-4 p-4 rounded-lg border border-green-200 bg-green-50">
              <p className="text-sm font-bold text-green-800">Compte créé</p>
              <p className="text-xs text-green-700 mt-1">Email : <span className="font-bold">{lastCreated.email}</span></p>
              <p className="text-xs text-green-700 mt-1">Mot de passe : <span className="font-bold">{lastCreated.password}</span></p>
              <p className="text-[11px] text-green-700 mt-2">Copie ces identifiants maintenant : le mot de passe ne sera plus récupérable après.</p>
            </div>
          ) : null}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-lg font-bold text-slate-800">Comptes test disponibles</h3>
            <span className="text-xs font-bold text-slate-500">{demoAccounts.length}</span>
          </div>

          {loadingAccounts ? (
            <p className="text-sm text-slate-600 mt-3">Chargement...</p>
          ) : demoAccounts.length === 0 ? (
            <p className="text-sm text-slate-600 mt-3">Aucun compte test créé pour le moment.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {demoAccounts.map((acc) => {
                const isActive = isDemoMode && demoRole === acc.role;
                return (
                  <div key={acc.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-lg border border-slate-200 bg-slate-50">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-slate-800">{acc.email}</p>
                        {isActive ? (
                          <span className="px-2 py-1 text-xs font-bold rounded-full bg-orange-100 text-orange-700 border border-orange-200">Actif</span>
                        ) : null}
                      </div>
                      <p className="text-xs text-slate-500 mt-1">Rôle: {acc.role}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleDeleteAccount(acc.id)}
                        disabled={actionLoading}
                        className="px-4 py-2 rounded-lg text-sm font-bold bg-white border border-red-300 text-red-700 hover:bg-red-50 transition disabled:opacity-60"
                      >
                        Supprimer
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DemoAccounts;
