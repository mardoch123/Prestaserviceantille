import React, { useMemo, useState } from 'react';
import { useData } from '../context/DataContext';
import { Mail, Phone, Sparkles, Send, MapPin } from 'lucide-react';

const ContactPage: React.FC = () => {
    const { companySettings, submitContactForm } = useData();

    const [form, setForm] = useState({
        name: '',
        email: '',
        phone: '',
        subject: '',
        message: ''
    });

    const [submitting, setSubmitting] = useState(false);
    const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({ show: false, message: '', type: 'success' });

    const canSubmit = useMemo(() => {
        return !!form.name.trim() && !!form.email.trim() && !!form.message.trim() && !submitting;
    }, [form, submitting]);

    const showToast = (message: string, type: 'success' | 'error') => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast({ show: false, message: '', type }), 3500);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
            showToast('Merci de renseigner votre nom, email et message.', 'error');
            return;
        }

        try {
            setSubmitting(true);
            await submitContactForm({
                name: form.name.trim(),
                email: form.email.trim(),
                phone: form.phone.trim(),
                subject: form.subject.trim(),
                message: form.message.trim()
            });
            showToast('Message envoyé. Merci ! On revient vers vous rapidement.', 'success');
            setForm({ name: '', email: '', phone: '', subject: '', message: '' });
        } catch (err: any) {
            showToast('Erreur lors de l’envoi. Réessayez dans un instant.', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-cream-50 relative overflow-hidden">
            <div className="absolute -top-24 -left-24 w-72 h-72 bg-brand-orange/20 rounded-full blur-3xl" />
            <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-brand-blue/20 rounded-full blur-3xl" />

            <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/80 border border-slate-200 text-slate-600 text-xs font-bold">
                            <Sparkles className="w-4 h-4 text-brand-orange" />
                            Contact
                        </div>
                        <h1 className="text-3xl sm:text-4xl font-serif font-bold text-slate-800 mt-3">
                            Une question ? Une idée ? Un petit bonjour ?
                        </h1>
                        <p className="text-slate-600 mt-2 max-w-2xl">
                            Écris-nous, on adore lire vos messages. Promis, on répond vite (et avec le sourire).
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                    <div className="lg:col-span-2 bg-white/80 backdrop-blur rounded-2xl border border-slate-200 shadow-sm p-6">
                        <h2 className="font-bold text-slate-800 mb-4">Nos coordonnées</h2>

                        <div className="space-y-3 text-sm">
                            <div className="flex items-start gap-3">
                                <Mail className="w-5 h-5 text-brand-blue mt-0.5" />
                                <div>
                                    <div className="font-bold text-slate-700">Email</div>
                                    <div className="text-slate-600 break-words">{companySettings.email}</div>
                                </div>
                            </div>

                            <div className="flex items-start gap-3">
                                <Phone className="w-5 h-5 text-brand-blue mt-0.5" />
                                <div>
                                    <div className="font-bold text-slate-700">Téléphone</div>
                                    <div className="text-slate-600">{companySettings.phone}</div>
                                </div>
                            </div>

                            <div className="flex items-start gap-3">
                                <MapPin className="w-5 h-5 text-brand-blue mt-0.5" />
                                <div>
                                    <div className="font-bold text-slate-700">Adresse</div>
                                    <div className="text-slate-600">{companySettings.address}</div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 p-4 rounded-xl bg-slate-50 border border-slate-200">
                            <p className="text-xs text-slate-600">
                                Astuce : si c’est urgent, indique « URGENT » dans l’objet et laisse un numéro où te joindre.
                            </p>
                        </div>
                    </div>

                    <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                        <h2 className="font-bold text-slate-800 mb-4">Écris-nous</h2>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-600">Nom *</label>
                                    <input
                                        value={form.name}
                                        onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                                        className="w-full mt-1 border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-brand-blue"
                                        placeholder="Votre nom"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-600">Email *</label>
                                    <input
                                        value={form.email}
                                        onChange={(e) => setForm(prev => ({ ...prev, email: e.target.value }))}
                                        className="w-full mt-1 border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-brand-blue"
                                        placeholder="vous@exemple.com"
                                        type="email"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-600">Téléphone</label>
                                    <input
                                        value={form.phone}
                                        onChange={(e) => setForm(prev => ({ ...prev, phone: e.target.value }))}
                                        className="w-full mt-1 border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-brand-blue"
                                        placeholder="06 96 00 00 00"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-600">Objet</label>
                                    <input
                                        value={form.subject}
                                        onChange={(e) => setForm(prev => ({ ...prev, subject: e.target.value }))}
                                        className="w-full mt-1 border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-brand-blue"
                                        placeholder="De quoi s’agit-il ?"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-600">Message *</label>
                                <textarea
                                    value={form.message}
                                    onChange={(e) => setForm(prev => ({ ...prev, message: e.target.value }))}
                                    className="w-full mt-1 border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-brand-blue min-h-[140px]"
                                    placeholder="Écrivez ici votre message…"
                                />
                            </div>

                            <div className="flex items-center justify-between gap-3 flex-col sm:flex-row">
                                <p className="text-xs text-slate-500">
                                    En envoyant ce formulaire, vous acceptez d’être recontacté(e) par notre équipe.
                                </p>
                                <button
                                    type="submit"
                                    disabled={!canSubmit}
                                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-brand-blue text-white px-5 py-2.5 rounded-lg font-bold text-sm hover:bg-teal-700 transition disabled:opacity-50"
                                >
                                    <Send className="w-4 h-4" />
                                    {submitting ? 'Envoi…' : 'Envoyer'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>

            <div className={`fixed bottom-6 right-6 z-[100] transition-all duration-500 transform ${toast.show ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0 pointer-events-none'}`}>
                <div className={`px-6 py-4 rounded-lg shadow-2xl flex items-center gap-3 border ${toast.type === 'error' ? 'bg-red-800 text-white border-red-700' : 'bg-green-800 text-white border-green-700'}`}>
                    <div>
                        <p className="text-xs opacity-95 font-bold">{toast.message}</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ContactPage;
