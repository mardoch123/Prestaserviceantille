import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
    CheckCircle, 
    XCircle, 
    Clock, 
    AlertTriangle, 
    Loader2, 
    Calendar, 
    MapPin, 
    User, 
    ShieldCheck, 
    ArrowRight,
    Sparkles
} from 'lucide-react';
import { supabase } from '../utils/supabaseClient';
import { getMissionValidationToken } from '../utils/emailTemplates';
import { getMartiniqueNowISO } from '../src/utils/martiniqueTime';

export const MissionValidationPage: React.FC = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const missionId = searchParams.get('id') || '';
    const initialAction = searchParams.get('action'); // 'done' | 'not_done' | null
    const token = searchParams.get('token') || '';

    const [loading, setLoading] = useState<boolean>(true);
    const [submitting, setSubmitting] = useState<boolean>(false);
    const [mission, setMission] = useState<any | null>(null);
    const [statusResult, setStatusResult] = useState<'success_done' | 'success_not_done' | 'already_processed' | 'error' | null>(null);
    const [errorMessage, setErrorMessage] = useState<string>('');

    // Charger la mission et valider le token
    useEffect(() => {
        let isMounted = true;

        const loadAndProcess = async () => {
            if (!missionId) {
                if (isMounted) {
                    setErrorMessage('Identifiant de prestation manquant.');
                    setStatusResult('error');
                    setLoading(false);
                }
                return;
            }

            try {
                // 1. Récupérer la mission
                const { data, error } = await supabase
                    .from('missions')
                    .select('*')
                    .eq('id', missionId)
                    .single();

                if (error || !data) {
                    if (isMounted) {
                        setErrorMessage('Prestation introuvable ou lien invalide.');
                        setStatusResult('error');
                        setLoading(false);
                    }
                    return;
                }

                // 2. Vérification du token de sécurité
                const expectedToken = getMissionValidationToken(data.id, data.date);
                if (token && token !== expectedToken) {
                    console.warn('[MissionValidation] Token invalide fourni:', token, 'attendu:', expectedToken);
                }

                if (isMounted) {
                    setMission(data);
                }

                // 3. Si la mission est déjà terminée
                if (data.status === 'completed') {
                    if (isMounted) {
                        setStatusResult('already_processed');
                        setLoading(false);
                    }
                    return;
                }

                // 4. Si une action directe était fournie dans l'URL ('done' ou 'not_done')
                if (initialAction === 'done' || initialAction === 'not_done') {
                    await handleAction(initialAction, data);
                } else {
                    if (isMounted) {
                        setLoading(false);
                    }
                }
            } catch (err: any) {
                console.error('[MissionValidation] Erreur:', err);
                if (isMounted) {
                    setErrorMessage(err?.message || 'Une erreur est survenue lors de la validation.');
                    setStatusResult('error');
                    setLoading(false);
                }
            }
        };

        loadAndProcess();

        return () => {
            isMounted = false;
        };
    }, [missionId, initialAction, token]);

    // Traitement de l'action Fait / Pas fait
    const handleAction = async (action: 'done' | 'not_done', targetMission?: any) => {
        const m = targetMission || mission;
        if (!m) return;

        setSubmitting(true);
        const nowISO = getMartiniqueNowISO();

        try {
            if (action === 'done') {
                // 1. Mettre à jour la table missions en status completed
                const { error: updateMissionErr } = await supabase
                    .from('missions')
                    .update({
                        status: 'completed',
                        color: 'green',
                        completed_at: nowISO,
                        end_remark: m.end_remark ? `${m.end_remark} (Confirmé via email le ${new Date().toLocaleDateString('fr-FR')})` : 'Confirmé réalisé par le prestataire via email'
                    })
                    .eq('id', m.id);

                if (updateMissionErr) {
                    console.error('[MissionValidation] Erreur update mission:', updateMissionErr);
                }

                // 2. Synchroniser le slot correspondant dans le devis si applicable
                const quoteId = m.source_document_id || m.sourceDocumentId;
                if (quoteId) {
                    try {
                        const { data: doc } = await supabase
                            .from('documents')
                            .select('*')
                            .eq('id', quoteId)
                            .single();

                        if (doc && Array.isArray(doc.slots_data)) {
                            const updatedSlots = doc.slots_data.map((slot: any) => {
                                if (slot.date === m.date && (!slot.startTime || slot.startTime === m.start_time || slot.startTime === m.startTime)) {
                                    return { ...slot, sessionStatus: 'completed' };
                                }
                                return slot;
                            });

                            await supabase
                                .from('documents')
                                .update({ slots_data: updatedSlots })
                                .eq('id', quoteId);
                        }
                    } catch (syncErr) {
                        console.warn('[MissionValidation] Erreur synchronisation devis:', syncErr);
                    }
                }

                // 3. Enregistrer une notification pour l'administrateur
                try {
                    await supabase.from('notifications').insert({
                        target_user_type: 'admin',
                        type: 'success',
                        title: 'Prestation validée par le prestataire',
                        message: `Le prestataire ${m.provider_name || 'assigné'} a confirmé la réalisation de l'intervention du ${m.date} pour ${m.client_name || 'le client'}.`,
                        link: `/admin/planning`,
                        created_at: nowISO,
                        read: false
                    });
                } catch (notifErr) {
                    console.warn('[MissionValidation] Erreur notification admin:', notifErr);
                }

                setStatusResult('success_done');
            } else {
                // Action 'not_done' (Pas fait)
                const { error: updateErr } = await supabase
                    .from('missions')
                    .update({
                        cancellation_reason: 'Non réalisée - signalé par le prestataire suite à la notification automatique',
                        end_remark: 'Signalé non réalisé par le prestataire via le bouton email'
                    })
                    .eq('id', m.id);

                if (updateErr) {
                    console.error('[MissionValidation] Erreur update non réalisée:', updateErr);
                }

                // Alerte urgente pour l'administration
                try {
                    await supabase.from('notifications').insert({
                        target_user_type: 'admin',
                        type: 'alert',
                        title: '⚠️ Prestation signalée non réalisée',
                        message: `Le prestataire ${m.provider_name || 'assigné'} a indiqué que la séance du ${m.date} (${m.start_time || ''}) pour ${m.client_name || 'le client'} n'a PAS été réalisée.`,
                        link: `/admin/planning`,
                        created_at: nowISO,
                        read: false
                    });
                } catch (notifErr) {
                    console.warn('[MissionValidation] Erreur notif admin not_done:', notifErr);
                }

                setStatusResult('success_not_done');
            }
        } catch (err: any) {
            console.error('[MissionValidation] Exception:', err);
            setErrorMessage(err?.message || 'Erreur lors de la mise à jour.');
            setStatusResult('error');
        } finally {
            setSubmitting(false);
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex flex-col justify-center items-center p-4 sm:p-6">
            <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-slate-200/80 overflow-hidden">
                
                {/* En-tête avec marque */}
                <div className="bg-gradient-to-r from-blue-700 via-brand-blue to-indigo-700 p-6 text-white text-center relative">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md mb-3 border border-white/20 shadow-inner">
                        <ShieldCheck className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-xl font-bold tracking-tight">Presta Services Antilles</h1>
                    <p className="text-xs text-blue-100 mt-1">Confirmation d'intervention prestataire</p>
                </div>

                {/* Corps de la page */}
                <div className="p-6">
                    {loading || submitting ? (
                        <div className="py-12 text-center space-y-4">
                            <Loader2 className="w-10 h-10 animate-spin text-brand-blue mx-auto" />
                            <p className="text-sm font-medium text-slate-600">
                                {submitting ? 'Enregistrement de votre réponse...' : 'Chargement des informations...'}
                            </p>
                        </div>
                    ) : statusResult === 'success_done' ? (
                        <div className="py-6 text-center space-y-4">
                            <div className="w-16 h-16 rounded-full bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-600 mx-auto shadow-sm animate-bounce">
                                <CheckCircle className="w-10 h-10" />
                            </div>
                            <div className="space-y-1">
                                <h2 className="text-xl font-bold text-slate-800">Prestation Validée !</h2>
                                <p className="text-sm text-slate-600">
                                    Merci pour votre confirmation. Votre intervention a été enregistrée avec succès comme <strong>réalisée</strong>.
                                </p>
                            </div>

                            {mission && (
                                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-left text-xs text-slate-600 space-y-2 mt-4">
                                    <div className="flex items-center gap-2">
                                        <User className="w-4 h-4 text-slate-400 shrink-0" />
                                        <span>Client : <strong className="text-slate-800">{mission.client_name}</strong></span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                                        <span>Date : <strong className="text-slate-800">{mission.date}</strong></span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                                        <span>Horaires : <strong className="text-slate-800">{mission.start_time} - {mission.end_time}</strong></span>
                                    </div>
                                </div>
                            )}

                            <div className="pt-4">
                                <button
                                    onClick={() => navigate('/login')}
                                    className="w-full py-3 px-4 bg-brand-blue hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
                                >
                                    Accéder à mon espace prestataire
                                </button>
                            </div>
                        </div>
                    ) : statusResult === 'success_not_done' ? (
                        <div className="py-6 text-center space-y-4">
                            <div className="w-16 h-16 rounded-full bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-600 mx-auto shadow-sm">
                                <AlertTriangle className="w-9 h-9" />
                            </div>
                            <div className="space-y-1">
                                <h2 className="text-xl font-bold text-slate-800">Information enregistrée</h2>
                                <p className="text-sm text-slate-600">
                                    Vous avez indiqué que cette intervention n'a <strong>pas été réalisée</strong>.
                                </p>
                                <p className="text-xs text-slate-500 mt-2">
                                    L'équipe administrative a été alertée afin de faire le point et reprogrammer si nécessaire.
                                </p>
                            </div>

                            {mission && (
                                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-left text-xs text-slate-600 space-y-2 mt-4">
                                    <div className="flex items-center gap-2">
                                        <User className="w-4 h-4 text-slate-400 shrink-0" />
                                        <span>Client : <strong className="text-slate-800">{mission.client_name}</strong></span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                                        <span>Date : <strong className="text-slate-800">{mission.date}</strong></span>
                                    </div>
                                </div>
                            )}

                            <div className="pt-4">
                                <button
                                    onClick={() => navigate('/login')}
                                    className="w-full py-3 px-4 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition"
                                >
                                    Fermer
                                </button>
                            </div>
                        </div>
                    ) : statusResult === 'already_processed' ? (
                        <div className="py-6 text-center space-y-4">
                            <div className="w-16 h-16 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 mx-auto shadow-sm">
                                <CheckCircle className="w-10 h-10" />
                            </div>
                            <div className="space-y-1">
                                <h2 className="text-lg font-bold text-slate-800">Déjà validée</h2>
                                <p className="text-sm text-slate-600">
                                    Cette prestation a déjà été enregistrée comme <strong>terminée et validée</strong>.
                                </p>
                            </div>
                            <div className="pt-4">
                                <button
                                    onClick={() => navigate('/login')}
                                    className="w-full py-3 px-4 bg-brand-blue hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition"
                                >
                                    Aller sur l'espace prestataire
                                </button>
                            </div>
                        </div>
                    ) : statusResult === 'error' ? (
                        <div className="py-6 text-center space-y-4">
                            <div className="w-16 h-16 rounded-full bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-600 mx-auto shadow-sm">
                                <XCircle className="w-10 h-10" />
                            </div>
                            <div className="space-y-1">
                                <h2 className="text-lg font-bold text-slate-800">Impossible de valider</h2>
                                <p className="text-sm text-slate-600">{errorMessage || 'Une erreur est survenue.'}</p>
                            </div>
                            <div className="pt-4">
                                <button
                                    onClick={() => navigate('/login')}
                                    className="w-full py-3 px-4 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition"
                                >
                                    Retour à l'accueil
                                </button>
                            </div>
                        </div>
                    ) : (
                        /* Choix manuel : 2 boutons simples Fait / Pas fait */
                        <div className="space-y-5">
                            <div className="text-center space-y-1">
                                <h2 className="text-lg font-bold text-slate-800">Avez-vous réalisé cette prestation ?</h2>
                                <p className="text-xs text-slate-500">
                                    Merci de confirmer en cliquant sur l'un des deux boutons ci-dessous :
                                </p>
                            </div>

                            {mission && (
                                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs text-slate-600 space-y-2">
                                    <div className="flex items-center gap-2">
                                        <User className="w-4 h-4 text-slate-400 shrink-0" />
                                        <span>Client : <strong className="text-slate-800">{mission.client_name}</strong></span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Sparkles className="w-4 h-4 text-slate-400 shrink-0" />
                                        <span>Prestation : <strong className="text-slate-800">{mission.service}</strong></span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                                        <span>Date : <strong className="text-slate-800">{mission.date}</strong></span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                                        <span>Créneau : <strong className="text-slate-800">{mission.start_time} - {mission.end_time}</strong></span>
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => handleAction('done')}
                                    disabled={submitting}
                                    className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 active:scale-95"
                                >
                                    <CheckCircle className="w-5 h-5" />
                                    <span>FAIT</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => handleAction('not_done')}
                                    disabled={submitting}
                                    className="w-full py-3.5 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 active:scale-95"
                                >
                                    <XCircle className="w-5 h-5" />
                                    <span>PAS FAIT</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer discret */}
                <div className="bg-slate-50 border-t border-slate-100 p-4 text-center text-[11px] text-slate-400">
                    Presta Services Antilles — Système sécurisé d'émargement et suivi
                </div>
            </div>
        </div>
    );
};

export default MissionValidationPage;
