
import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { 
  LayoutDashboard, 
  BarChart2, 
  Users, 
  Briefcase, 
  FileText, 
  Calendar, 
  Clock, 
  PhoneCall 
} from 'lucide-react';
import { NavItem } from '../types';
import { useData } from '../context/DataContext';

const navItems: NavItem[] = [
  { label: 'Tableau de bord', path: '/', icon: LayoutDashboard },
  { label: 'Statistiques', path: '/statistics', icon: BarChart2 },
  { label: 'Clients', path: '/clients', icon: Users },
  { label: 'Prestataires', path: '/providers', icon: Briefcase },
  { label: 'Devis/Factures', path: '/invoices', icon: FileText },
  { label: 'Planning', path: '/planning', icon: Calendar },
  { label: 'Réservations', path: '/reservations', icon: Clock },
  { label: 'Secrétariat', path: '/secretariat', icon: PhoneCall },
];

const Sidebar: React.FC = () => {
  const location = useLocation();
  const { companySettings } = useData();

  return (
    <aside className="w-64 bg-cream-200/50 border-r border-beige-200 h-full flex flex-col">
      <div className="p-6 flex flex-col items-center">
        {/* Dynamic Logo from Settings */}
        {companySettings.logoUrl ? (
             <div className="w-24 h-24 mb-2 flex items-center justify-center">
                <img src={companySettings.logoUrl} alt="Logo" className="w-full h-full object-contain" />
             </div>
        ) : (
            <div className="w-20 h-20 rounded-full bg-white border-2 border-brand-orange flex items-center justify-center mb-2 shadow-sm overflow-hidden">
               <span className="text-brand-blue font-bold text-xs text-center">PRESTA<br/>SERVICES<br/>ANTILLES</span>
            </div>
        )}
        <h1 className="text-lg font-serif font-bold text-slate-800">SIMPLIFIEZ</h1>
        <p className="text-xs text-slate-500">VOTRE QUOTIDIEN</p>
      </div>

      <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                isActive
                  ? 'bg-white text-brand-blue shadow-sm'
                  : 'text-slate-600 hover:bg-white/50 hover:text-slate-800'
              }`}
            >
              <item.icon className={`mr-3 h-5 w-5 ${isActive ? 'text-brand-orange' : 'text-slate-400'}`} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      
      <div className="p-4 border-t border-beige-200">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-slate-200"></div>
          <div className="text-xs">
            <p className="font-bold">Admin User</p>
            <p className="text-slate-500">Connecté</p>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
