import React, { useMemo, useState } from 'react';
import { useData } from '../context/DataContext';
import { formatMartiniqueDateTime } from '../src/utils/martiniqueTime';
import { Mail, Search, CheckCircle2, Eye } from 'lucide-react';

const ContactFormsAdmin: React.FC = () => {
    const { contactForms, markContactFormRead } = useData();

    const [search, setSearch] = useState('');
    const [selectedId, setSelectedId] = useState<string | null>(null);

    const filtered = useMemo(() => {
        const q = String(search || '').trim().toLowerCase();
        const base = !q
            ? (contactForms || [])
            : (contactForms || []).filter(f => {
                const hay = `${f.name} ${f.email} ${f.phone || ''} ${f.subject || ''} ${f.message}`.toLowerCase();
                return hay.includes(q);
            });

        return base.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [contactForms, search]);

    const unreadCount = useMemo(() => (contactForms || []).filter(f => !f.isRead).length, [contactForms]);

    const selected = useMemo(() => (contactForms || []).find(f => f.id === selectedId) || null, [contactForms, selectedId]);

    const open = async (id: string) => {
        setSelectedId(id);
        const f = (contactForms || []).find(x => x.id === id);
        if (f && !f.isRead) {
            await markContactFormRead(id);
        }
    };

    return (
        <div className="p-8 h-full overflow-y-auto bg-white/40 relative">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                    <h2 className="text-3xl font-serif font-bold text-slate-800">Formulaires de contact</h2>
                    <p className="text-sm text-slate-500 mt-1">{unreadCount} non lu(s)</p>
                </div>

                <div className="relative w-full sm:w-96">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Rechercher (nom, email, message...)"
                        className="w-full border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-sm outline-none focus:border-brand-blue"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 min-h-[600px]">
                <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-4 border-b bg-slate-50 flex items-center justify-between">
                        <div className="font-bold text-slate-700 flex items-center gap-2">
                            <Mail className="w-4 h-4" />
                            Messages
                        </div>
                        <div className="text-xs font-bold text-slate-500">{filtered.length}</div>
                    </div>

                    <div className="max-h-[520px] overflow-y-auto">
                        {filtered.length === 0 ? (
                            <div className="p-6 text-center text-slate-400 text-sm">Aucun formulaire.</div>
                        ) : (
                            filtered.map(f => (
                                <button
                                    key={f.id}
                                    onClick={() => open(f.id)}
                                    className={`w-full text-left p-4 border-b hover:bg-blue-50 transition ${selectedId === f.id ? 'bg-blue-100 border-l-4 border-l-brand-blue' : ''}`}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="font-bold text-slate-800 text-sm truncate">{f.name}</div>
                                            <div className="text-xs text-slate-500 truncate">{f.email}</div>
                                            <div className="text-xs text-slate-500 truncate">{f.subject || 'Sans objet'}</div>
                                        </div>
                                        <div className="shrink-0 text-right">
                                            <div className={`text-[10px] ${f.isRead ? 'text-slate-400' : 'text-brand-blue font-bold'}`}>
                                                {f.isRead ? 'Lu' : 'Nouveau'}
                                            </div>
                                            <div className="text-[10px] text-slate-400">
                                                {formatMartiniqueDateTime(f.createdAt)}
                                            </div>
                                        </div>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>

                <div className="lg:col-span-3 bg-white rounded-xl shadow-sm border border-slate-200">
                    {!selected ? (
                        <div className="h-full min-h-[600px] flex flex-col items-center justify-center text-slate-400">
                            <Eye className="w-12 h-12 mb-2 opacity-20" />
                            <p>Sélectionnez un message</p>
                        </div>
                    ) : (
                        <div className="p-6">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <h3 className="text-xl font-bold text-slate-800">{selected.subject || 'Sans objet'}</h3>
                                    <p className="text-sm text-slate-500 mt-1">Reçu le {formatMartiniqueDateTime(selected.createdAt)}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    {!selected.isRead && (
                                        <button
                                            onClick={() => markContactFormRead(selected.id)}
                                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold bg-green-600 text-white hover:bg-green-700"
                                        >
                                            <CheckCircle2 className="w-4 h-4" />
                                            Marquer lu
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="p-4 rounded-lg border border-slate-200 bg-slate-50">
                                    <div className="text-xs font-bold text-slate-600">Nom</div>
                                    <div className="text-sm text-slate-800 mt-1">{selected.name}</div>
                                </div>
                                <div className="p-4 rounded-lg border border-slate-200 bg-slate-50">
                                    <div className="text-xs font-bold text-slate-600">Email</div>
                                    <div className="text-sm text-slate-800 mt-1 break-words">{selected.email}</div>
                                </div>
                                <div className="p-4 rounded-lg border border-slate-200 bg-slate-50 sm:col-span-2">
                                    <div className="text-xs font-bold text-slate-600">Téléphone</div>
                                    <div className="text-sm text-slate-800 mt-1">{selected.phone || '-'}</div>
                                </div>
                            </div>

                            <div className="mt-6 p-5 rounded-xl border border-slate-200 bg-white">
                                <div className="text-xs font-bold text-slate-600 mb-2">Message</div>
                                <div className="text-sm text-slate-800 whitespace-pre-wrap break-words">{selected.message}</div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ContactFormsAdmin;
