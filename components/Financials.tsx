

import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { 
  Euro, 
  Filter, 
  TrendingUp, 
  ArrowDownRight, 
  ArrowUpRight,
  FileText,
  RotateCcw,
  CheckCircle
} from 'lucide-react';

const Financials: React.FC = () => {
  const { documents, refundTransaction, markInvoicePaid } = useData();
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const location = useLocation();

  useEffect(() => {
    if (location.state) {
        const state = location.state as { filter?: string };
        if (state.filter) setFilterStatus(state.filter);
    }
  }, [location]);

  const filteredTransactions = useMemo(() => {
    // Transform Documents (Invoices) into Transactions for display
    const transactions = documents
        .filter(d => d.type === 'Facture') 
        .map(d => ({
            id: d.id,
            ref: d.ref,
            client: d.clientName,
            amount: Math.abs(d.totalTTC),
            type: d.totalTTC < 0 ? 'refund' : 'income',
            status: d.status,
            date: d.date
        }));

    if (filterStatus === 'all') return transactions;
    if (filterStatus === 'refund') return transactions.filter(t => t.type === 'refund');
    
    return transactions.filter(t => t.status === filterStatus && t.type === 'income');
  }, [filterStatus, documents]);

  const handleRefund = (ref: string, amount: number) => {
      const confirm = window.confirm(`Rembourser ${amount}€ pour la facture ${ref} ? Cela créera un avoir comptable.`);
      if (confirm) {
          refundTransaction(ref, amount);
      }
  };

  const handleManualPayment = (id: string) => {
      if(window.confirm("Confirmer la réception du paiement ?")) {
          markInvoicePaid(id);
      }
  };

  return (
    <div className="p-8 h-full overflow-y-auto bg-white/40">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h2 className="text-3xl font-serif font-bold text-slate-800">Financier</h2>
          <p className="text-sm text-slate-500 mt-1">Suivi de la trésorerie et ajustements comptables</p>
        </div>
        
        <div className="flex items-center bg-white rounded-lg shadow-sm border border-beige-200 p-1">
            <Filter className="w-4 h-4 text-slate-400 ml-2 mr-2" />
            <select 
                value={filterStatus} 
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-transparent text-sm font-bold text-slate-700 p-2 outline-none cursor-pointer"
            >
                <option value="all">Toutes transactions</option>
                <option value="pending">À encaisser</option>
                <option value="paid">Encaissées</option>
                <option value="refund">Remboursements</option>
            </select>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
         <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-cream-50/50">
            <h3 className="font-bold text-slate-700">Journal des opérations</h3>
            <span className="text-xs text-slate-500">{filteredTransactions.length} écriture(s) trouvée(s)</span>
         </div>

         <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 uppercase bg-slate-50/80 border-b border-slate-100">
                    <tr>
                        <th className="px-6 py-4 font-bold">Date</th>
                        <th className="px-6 py-4 font-bold">Référence</th>
                        <th className="px-6 py-4 font-bold">Client</th>
                        <th className="px-6 py-4 font-bold">Type</th>
                        <th className="px-6 py-4 font-bold text-center">Statut</th>
                        <th className="px-6 py-4 font-bold text-right">Montant</th>
                        <th className="px-6 py-4 font-bold text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {filteredTransactions.length === 0 ? (
                        <tr><td colSpan={7} className="text-center p-8 text-slate-400">Aucune transaction enregistrée.</td></tr>
                    ) : (
                        filteredTransactions.map(t => (
                            <tr key={t.id} className="hover:bg-cream-50 transition-colors group">
                                <td className="px-6 py-4 font-mono text-slate-500">{t.date}</td>
                                <td className="px-6 py-4 font-bold text-slate-700 flex items-center gap-2">
                                    <FileText className="w-3 h-3 text-slate-400" />
                                    {t.ref}
                                </td>
                                <td className="px-6 py-4 text-slate-700">{t.client}</td>
                                <td className="px-6 py-4">
                                    {t.type === 'income' ? (
                                        <span className="flex items-center gap-1 text-xs text-green-600"><ArrowDownRight className="w-3 h-3"/> Recette</span>
                                    ) : (
                                        <span className="flex items-center gap-1 text-xs text-red-600"><ArrowUpRight className="w-3 h-3"/> Remboursement</span>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-center">
                                    {t.status === 'paid' && <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-bold border border-green-200">Réglé</span>}
                                    {t.status === 'pending' && <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded-full text-xs font-bold border border-orange-200">En attente</span>}
                                    {t.status === 'rejected' && <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs font-bold border border-red-200">Annulé</span>}
                                </td>
                                <td className={`px-6 py-4 text-right font-bold ${t.type === 'refund' ? 'text-red-500' : 'text-slate-700'}`}>
                                    {t.type === 'refund' ? '-' : '+'} {t.amount.toFixed(2)} €
                                </td>
                                <td className="px-6 py-4 text-right flex justify-end gap-2">
                                    {t.status === 'pending' && t.type === 'income' && (
                                        <button 
                                            onClick={() => handleManualPayment(t.id)}
                                            className="text-green-600 hover:text-green-800 p-1 rounded hover:bg-green-50 flex items-center gap-1 text-xs font-bold border border-transparent hover:border-green-200"
                                            title="Marquer comme payé (Virement externe)"
                                        >
                                            <CheckCircle className="w-4 h-4"/> Encaisser
                                        </button>
                                    )}
                                    
                                    {t.type === 'income' && t.status === 'paid' && (
                                        <button 
                                            onClick={() => handleRefund(t.ref, t.amount)}
                                            className="text-slate-400 hover:text-red-500 p-1 rounded hover:bg-red-50"
                                            title="Rembourser le client"
                                        >
                                            <RotateCcw className="w-4 h-4" />
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
         </div>
      </div>
    </div>
  );
};

export default Financials;