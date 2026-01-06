import React, { useState, useEffect, useRef } from 'react';
import { 
    Bell, 
    Settings, 
    LogOut, 
    User, 
    ChevronDown, 
    Camera, 
    Video, 
    X,
    Menu,
    Eye,
    Briefcase,
    RefreshCw
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { useNavigate } from 'react-router-dom';
import { MARTINIQUE_TIMEZONE } from '../src/utils/martiniqueTime';

interface HeaderProps {
    onMenuClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const { notifications, markNotificationRead, currentUser, logout, missions } = useData();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showMobileNotifications, setShowMobileNotifications] = useState(false);
  const [selectedMissionReportId, setSelectedMissionReportId] = useState<string | null>(null);
  const [martiniqueClock, setMartiniqueClock] = useState('');
  const navigate = useNavigate();
  const notificationRef = useRef<HTMLDivElement>(null);

  // Fermer le menu notifications au clic externe
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };

    if (showNotifications) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNotifications]);

  useEffect(() => {
    if (currentUser?.role !== 'admin') return;

    const getTime = () => {
      return new Date().toLocaleTimeString('fr-FR', {
        timeZone: MARTINIQUE_TIMEZONE,
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    };

    setMartiniqueClock(getTime());
    const intervalId = window.setInterval(() => {
      setMartiniqueClock(getTime());
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [currentUser?.role]);

  const adminNotifs = notifications
    .filter(n => n.targetUserType === 'admin' && !n.read)
    .slice()
    .sort((a, b) => new Date(b.created_at || b.date).getTime() - new Date(a.created_at || a.date).getTime());
  const unreadCount = adminNotifs.length;

  const handleRefresh = () => {
      window.location.reload();
  };

  const handleLogout = () => {
      logout(true);
      navigate('/'); 
  };

  const handleNotificationClick = (notif: any) => {
      markNotificationRead(notif.id);
      setShowNotifications(false);
      
      // Redirections intelligentes selon le type de notification
      if (notif.link && notif.link.startsWith('mission:')) {
          const missionId = notif.link.split(':')[1];
          setSelectedMissionReportId(missionId);
      } else if (notif.link === 'tab:planning') {
          navigate('/planning');
      } else if (notif.link === 'tab:messaging' || (typeof notif.link === 'string' && notif.link.startsWith('tab:messaging:'))) {
          const parts = String(notif.link || '').split(':');
          const clientId = parts.length >= 3 ? parts.slice(2).join(':') : undefined;
          navigate('/secretariat', { state: { tab: 'messaging', clientId } });
      } else if (notif.link === 'tab:live-videos') {
          navigate('/secretariat', { state: { tab: 'live-videos' } });
      } else if (notif.link === 'tab:docs') {
          navigate('/invoices', { state: { filter: 'devis' } });
      } else if (notif.link && notif.link.startsWith('document:')) {
          const documentId = notif.link.split(':')[1];
          navigate('/invoices', { state: { documentId, filter: 'devis' } });
      } else if (notif.title && notif.title.toLowerCase().includes('devis')) {
          navigate('/invoices', { state: { filter: 'devis' } });
      } else if (notif.title && (notif.title.toLowerCase().includes('planning') || notif.title.toLowerCase().includes('créneau') || notif.title.toLowerCase().includes('verrouillé'))) {
          navigate('/planning');
      } else if (notif.title && notif.title.toLowerCase().includes('message')) {
          navigate('/secretariat', { state: { tab: 'messaging' } });
      } else if (notif.title && notif.title.toLowerCase().includes('prestataire')) {
          navigate('/providers');
      } else if (notif.title && notif.title.toLowerCase().includes('client')) {
          navigate('/clients');
      }
  };

  const selectedMission = missions.find(m => m.id === selectedMissionReportId);

  return (
    <header className="h-16 bg-white border-b border-beige-200 flex items-center justify-between px-4 md:px-8 shrink-0 z-20 relative">
      <div className="flex items-center gap-3">
          <button 
            onClick={onMenuClick}
            className="p-2 md:hidden text-slate-500 hover:bg-slate-100 rounded-lg transition"
          >
              <Menu className="w-6 h-6" />
          </button>
          
          <div>
            <h1 className="text-lg font-serif font-bold text-slate-700 hidden md:block">
              Bonjour, <span className="text-brand-blue">{currentUser?.name || 'Utilisateur'}</span>
            </h1>
            <h1 className="text-lg font-serif font-bold text-slate-700 md:hidden">
              Presta Services
            </h1>
            <p className="text-xs text-slate-400 hidden md:block">Espace de gestion {currentUser?.role === 'admin' ? 'Secrétariat' : currentUser?.role}</p>
          </div>
      </div>

      <div className="flex items-center gap-4 md:gap-6">
        {currentUser?.role === 'admin' && (
          <div className="hidden sm:flex items-center gap-2 text-xs font-bold text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1">
            <span>Heure Martinique :</span>
            <span className="font-mono text-slate-700">{martiniqueClock}</span>
          </div>
        )}

        {currentUser?.role === 'admin' && (
          <div className="sm:hidden flex items-center text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
            <span className="font-mono text-slate-700">{martiniqueClock}</span>
          </div>
        )}

        {/* Bouton d'actualisation pour mobile */}
        <button 
            onClick={handleRefresh}
            className="md:hidden p-2 text-slate-400 hover:text-brand-blue transition-colors rounded-full hover:bg-cream-50"
            title="Actualiser la page"
        >
            <RefreshCw className="w-5 h-5" />
        </button>

        {currentUser?.role === 'admin' && (
            <div className="relative" ref={notificationRef}>
                <button onClick={() => {
                    if (window.innerWidth < 768) {
                        setShowMobileNotifications(true);
                    } else {
                        setShowNotifications(!showNotifications);
                    }
                }} className="relative p-2 text-slate-400 hover:text-brand-orange transition-colors rounded-full hover:bg-cream-50">
                    <Bell className="w-5 h-5" />
                    {unreadCount > 0 && (<span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white animate-pulse"></span>)}
                </button>
                {showNotifications && (
                    <div className="absolute top-full right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-xl border border-slate-100 z-[9999] overflow-hidden md:right-0 md:left-auto left-0 right-0 md:w-80">
                        <div className="bg-slate-50 px-3 sm:px-4 py-2 sm:py-3 border-b border-slate-100 flex justify-between items-center">
                            <span className="font-bold text-xs sm:text-sm text-slate-700">Notifications Admin</span>
                            <span className="text-xs text-slate-500">{unreadCount} non lues</span>
                        </div>
                        <div className="max-h-48 sm:max-h-64 overflow-y-auto">
                            {adminNotifs.length === 0 ? (
                                <div className="p-3 sm:p-4 text-center text-xs text-slate-400">Aucune notification.</div>
                            ) : (
                                adminNotifs.map(notif => (
                                    <div key={notif.id} onClick={() => handleNotificationClick(notif)} className={`p-2 sm:p-3 border-b border-slate-50 cursor-pointer hover:bg-cream-50 transition ${!notif.read ? 'bg-blue-50/50' : ''}`}>
                                        <div className="flex justify-between items-start mb-1">
                                            <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${notif.type === 'alert' ? 'bg-red-100 text-red-600' : notif.type === 'success' ? 'bg-green-100 text-green-600' : notif.type === 'message' ? 'bg-purple-100 text-purple-600' : 'bg-slate-100 text-slate-600'}`}>{notif.title}</span>
                                            <span className="text-[10px] text-slate-400">{notif.date}</span>
                                        </div>
                                        <p className="text-xs text-slate-600 line-clamp-2">{notif.message}</p>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>
        )}
        <div className="h-8 w-px bg-slate-100 hidden md:block"></div>
        <div className="flex items-center gap-3 cursor-pointer group relative">
          <div className="w-9 h-9 rounded-full bg-brand-blue/10 flex items-center justify-center border border-brand-blue/20 text-brand-blue font-bold shadow-sm"><User className="w-5 h-5" /></div>
          <div className="hidden md:block text-left"><p className="text-sm font-bold text-slate-700 group-hover:text-brand-blue transition-colors">{currentUser?.name}</p><p className="text-[10px] text-slate-400 capitalize">{currentUser?.role}</p></div>
          <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-transform group-hover:translate-y-0.5 hidden md:block" />
          <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all transform origin-top-right z-50 p-1">
             <button onClick={() => navigate('/settings')} className="w-full text-left px-4 py-2 text-sm text-slate-600 hover:bg-cream-50 rounded-lg flex items-center gap-2"><Settings className="w-4 h-4" /> Paramètres</button>
             <button onClick={handleLogout} className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-50 rounded-lg flex items-center gap-2"><LogOut className="w-4 h-4" /> Déconnexion</button>
          </div>
        </div>
      </div>

      {selectedMission && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in duration-200 max-h-[90vh] flex flex-col">
                  <div className="p-4 border-b bg-cream-50 flex justify-between items-center">
                      <h3 className="font-bold text-lg text-slate-800">Rapport de Mission</h3>
                      <button onClick={() => setSelectedMissionReportId(null)} className="p-2 rounded-full bg-slate-200"><X className="w-4 h-4"/></button>
                  </div>
                  <div className="p-6 overflow-y-auto">
                      <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
                          <div><span className="text-xs text-slate-500 uppercase block">Client</span><span className="font-bold">{selectedMission.clientName}</span></div>
                          <div><span className="text-xs text-slate-500 uppercase block">Prestataire</span><span className="font-bold">{selectedMission.providerName}</span></div>
                          <div><span className="text-xs text-slate-500 uppercase block">Date</span><span className="font-bold">{selectedMission.date} ({selectedMission.startTime} - {selectedMission.endTime})</span></div>
                          <div><span className="text-xs text-slate-500 uppercase block">Statut</span><span className="font-bold text-green-600 uppercase">{selectedMission.status}</span></div>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-lg mb-6 border border-slate-200">
                          <h4 className="font-bold text-slate-700 mb-2">Remarque Prestataire</h4>
                          <p className="text-slate-600 italic">{selectedMission.endRemark || 'Aucune remarque.'}</p>
                      </div>
                      <h4 className="font-bold text-slate-700 mb-3 flex items-center gap-2"><Camera className="w-4 h-4"/> Photos du chantier</h4>
                      {selectedMission.endPhotos && selectedMission.endPhotos.length > 0 ? (
                          <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                              {selectedMission.endPhotos.map((url, i) => (
                                  <div key={i} className="aspect-square rounded-lg overflow-hidden border border-slate-200">
                                      <img src={url} alt="Preuve chantier" className="w-full h-full object-cover hover:scale-110 transition-transform duration-500" />
                                  </div>
                              ))}
                          </div>
                      ) : (
                          <p className="text-slate-400 text-sm">Aucune photo disponible.</p>
                      )}
                      {selectedMission.endVideo && (
                          <div className="mt-6">
                               <h4 className="font-bold text-slate-700 mb-3 flex items-center gap-2"><Video className="w-4 h-4"/> Vidéo</h4>
                               <div className="aspect-video bg-black rounded-lg flex items-center justify-center text-white">
                                   (Simulateur Vidéo Player)
                               </div>
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}

    {/* Modal Mobile pour les notifications Admin */}
    {showMobileNotifications && (
      <div className="md:hidden fixed inset-0 z-50 flex items-end justify-center bg-black/50">
        <div className="bg-white w-full max-h-[80vh] rounded-t-2xl shadow-xl overflow-hidden animate-in slide-in-from-bottom duration-300">
          <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex justify-between items-center">
            <h3 className="font-bold text-slate-700">Notifications</h3>
            <button 
              onClick={() => setShowMobileNotifications(false)}
              className="p-2 rounded-full hover:bg-slate-100 transition"
            >
              <X className="w-5 h-5 text-slate-600" />
            </button>
          </div>
          <div className="overflow-y-auto max-h-[60vh] p-4">
            {adminNotifs.length === 0 ? (
              <div className="text-center text-slate-400 py-8">Aucune notification</div>
            ) : (
              adminNotifs.map(notif => (
                <div key={notif.id} onClick={() => {
                  handleNotificationClick(notif);
                  setShowMobileNotifications(false);
                }} className={`p-3 mb-2 rounded-lg border border-slate-100 cursor-pointer hover:bg-slate-50 transition ${!notif.read ? 'bg-blue-50/50' : ''}`}>
                  <div className="flex justify-between items-start mb-1">
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${notif.type === 'alert' ? 'bg-red-100 text-red-600' : notif.type === 'success' ? 'bg-green-100 text-green-600' : notif.type === 'message' ? 'bg-purple-100 text-purple-600' : 'bg-slate-100 text-slate-600'}`}>
                      {notif.title}
                    </span>
                    <span className="text-[10px] text-slate-400">{notif.date}</span>
                  </div>
                  <p className="text-xs text-slate-600 line-clamp-2">{notif.message}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    )}
    </header>
  );
};

export default Header;
