import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Bell, ExternalLink } from 'lucide-react';
import { useData } from '../context/DataContext';
import { supabase } from '../utils/supabaseClient';

const AdminNotificationDetails: React.FC = () => {
  const navigate = useNavigate();
  const { notificationId } = useParams();
  const { notifications, markNotificationRead, getDocumentDetails, getMissionDetails, documents } = useData();
  const [marked, setMarked] = useState(false);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [remoteNotif, setRemoteNotif] = useState<any | null>(null);
  const [stickyNotif, setStickyNotif] = useState<any | null>(null);
  const [relatedDocId, setRelatedDocId] = useState<string | null>(null);
  const [relatedMissionId, setRelatedMissionId] = useState<string | null>(null);

  const localNotif = useMemo(() => {
    const id = String(notificationId || '').trim();
    if (!id) return null;
    return notifications.find(n => String((n as any)?.id || '') === id) || null;
  }, [notifications, notificationId]);

  useEffect(() => {
    if (!localNotif) return;
    setStickyNotif((prev: any) => prev || localNotif);
  }, [localNotif]);

  const notif = remoteNotif || stickyNotif || localNotif;

  useEffect(() => {
    const id = String(notificationId || '').trim();
    if (!id) return;
    let active = true;
    setRemoteLoading(true);
    (async () => {
      try {
        const res: any = await supabase
          .from('notifications')
          .select('*')
          .eq('id', id)
          .single();
        if (!active) return;
        if (res?.data) {
          const n = res.data;
          setRemoteNotif({
            ...n,
            read: n.is_read ?? n.read,
            targetUserType: n.target_user_type || n.targetUserType || n.target_user_role,
            targetUserId: n.target_user_id || n.targetUserId,
            created_at: n.created_at || n.date,
            date: n.date || n.created_at,
            link: n.link,
          });
        }
      } catch {
      } finally {
        if (!active) return;
        setRemoteLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [notificationId]);

  useEffect(() => {
    if (!notif || marked) return;
    setMarked(true);
    try {
      markNotificationRead((notif as any).id);
    } catch {
    }
  }, [notif, marked, markNotificationRead]);

  useEffect(() => {
    if (!notif) return;

    const uuidRegex = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;
    const text = `${String((notif as any)?.title || '')} ${String((notif as any)?.message || '')} ${String((notif as any)?.link || '')}`;
    const link = String((notif as any)?.link || '').trim();

    const docIdFromLink = link.startsWith('document:') ? String(link.split(':')[1] || '').trim() : '';
    const missionIdFromLink = link.startsWith('mission:') ? String(link.split(':')[1] || '').trim() : '';
    const uuidFromText = (text.match(uuidRegex)?.[0] || '').trim();

    const tryResolve = async () => {
      if (docIdFromLink) {
        setRelatedDocId(docIdFromLink);
        return;
      }
      if (missionIdFromLink) {
        setRelatedMissionId(missionIdFromLink);
        return;
      }

      const docs = Array.isArray(documents) ? documents : [];
      const message = String((notif as any)?.message || '').toLowerCase();
      const title = String((notif as any)?.title || '').toLowerCase();

      if (docs.length > 0 && (title.includes('devis') || message.includes('devis'))) {
        const found = docs.find((d: any) => {
          const ref = String(d?.ref || '').trim();
          if (!ref) return false;
          return message.includes(ref.toLowerCase()) || title.includes(ref.toLowerCase());
        });
        if (found?.id) {
          setRelatedDocId(String(found.id));
          return;
        }
      }

      if (uuidFromText) {
        const doc = await getDocumentDetails(uuidFromText);
        if (doc?.id) {
          setRelatedDocId(String(doc.id));
          return;
        }
        const mission = await getMissionDetails(uuidFromText);
        if (mission?.id) {
          setRelatedMissionId(String(mission.id));
          return;
        }
      }
    };

    tryResolve();
  }, [notif, getDocumentDetails, getMissionDetails, documents]);

  const primaryLink = useMemo(() => {
    const link = String((notif as any)?.link || '').trim();
    if (!link) return null;
    if (link.startsWith('/')) return { label: 'Ouvrir', path: link };
    if (link.startsWith('document:')) {
      const id = String(link.split(':')[1] || '').trim();
      if (!id) return null;
      return { label: 'Voir le devis', path: `/admin/devis/${id}` };
    }
    if (link.startsWith('mission:')) {
      const id = String(link.split(':')[1] || '').trim();
      if (!id) return null;
      return { label: 'Voir la mission', path: `/admin/planning/missions/${id}` };
    }
    if (link === 'tab:planning') return { label: 'Aller au planning', path: '/planning' };
    if (link === 'tab:live-videos') return { label: 'Supervision Live', path: '/secretariat' };
    if (link === 'tab:contact-forms') return { label: 'Voir les contacts', path: '/contact-forms' };
    if (link === 'tab:absences') return { label: 'Voir les absences', path: '/secretariat' };
    if (link === 'tab:docs') return { label: 'Voir les devis/factures', path: '/invoices' };
    return null;
  }, [notif]);

  return (
    <div className="h-full overflow-y-auto p-6 md:p-8 bg-cream-50/50">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-start gap-3">
            <button type="button" onClick={() => navigate(-1)} className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 transition" title="Retour" aria-label="Retour"><ArrowLeft className="w-5 h-5 text-slate-600" /></button>
            <div>
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center"><Bell className="w-5 h-5 text-slate-600" /></div>
                <div>
                  <h1 className="text-xl md:text-2xl font-serif font-bold text-slate-800">Détail notification</h1>
                  <p className="text-xs text-slate-500 mt-1">Admin</p>
                </div>
              </div>
            </div>
          </div>
          {primaryLink ? (
            <button type="button" onClick={() => navigate(primaryLink.path)} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-blue text-white font-bold hover:opacity-95 transition">
              <ExternalLink className="w-4 h-4" />
              {primaryLink.label}
            </button>
          ) : null}
        </div>

        {!notif && remoteLoading ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
            <p className="text-slate-700 font-bold">Chargement…</p>
            <p className="text-sm text-slate-500 mt-1">Récupération depuis la base de données.</p>
          </div>
        ) : null}

        {!notif && !remoteLoading ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
            <p className="text-slate-700 font-bold">Notification introuvable</p>
            <p className="text-sm text-slate-500 mt-1">Elle a peut-être été supprimée ou non synchronisée.</p>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className="text-xs font-bold px-2 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">{String((notif as any)?.type || 'info').toUpperCase()}</span>
              <span className="text-xs text-slate-400">{String((notif as any)?.created_at || (notif as any)?.date || '')}</span>
            </div>
            <h2 className="text-lg font-bold text-slate-800">{String((notif as any)?.title || '—')}</h2>
            <p className="text-sm text-slate-600 mt-2 whitespace-pre-wrap">{String((notif as any)?.message || '—')}</p>
            {(notif as any)?.link ? (
              <div className="mt-4 text-xs text-slate-500">
                <span className="font-bold">Lien :</span> {String((notif as any).link)}
              </div>
            ) : null}

            {(relatedDocId || relatedMissionId || primaryLink) ? (
              <div className="mt-6 pt-5 border-t border-slate-100">
                <p className="text-xs font-bold text-slate-500 uppercase">Contexte</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {relatedDocId ? (
                    <button type="button" onClick={() => navigate(`/admin/devis/${relatedDocId}`)} className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold hover:opacity-95 transition">Voir le devis</button>
                  ) : null}
                  {relatedMissionId ? (
                    <button type="button" onClick={() => navigate(`/admin/planning/missions/${relatedMissionId}`)} className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold hover:opacity-95 transition">Voir la mission</button>
                  ) : null}
                  {primaryLink && !primaryLink.path.startsWith('/admin/') ? (
                    <button type="button" onClick={() => navigate(primaryLink.path)} className="px-4 py-2 rounded-xl bg-slate-100 text-slate-800 font-bold hover:bg-slate-200 transition">{primaryLink.label}</button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminNotificationDetails;
