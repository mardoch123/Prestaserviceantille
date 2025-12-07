
import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { 
    Search, 
    Filter, 
    Calendar, 
    User, 
    Eye, 
    CheckCircle, 
    X, 
    Camera, 
    Video, 
    MessageSquare, 
    MapPin,
    Clock,
    AlertTriangle,
    Download
} from 'lucide-react';
import { Mission } from '../types';

const MissionReports: React.FC = () => {
    const { missions } = useData();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedMission, setSelectedMission] = useState<Mission | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [lightboxImage, setLightboxImage] = useState<string | null>(null);

    // Filter only completed missions
    const completedMissions = useMemo(() => {
        let result = missions.filter(m => m.status === 'completed');
        
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            result = result.filter(m => 
                m.clientName.toLowerCase().includes(query) || 
                (m.providerName && m.providerName.toLowerCase().includes(query)) ||
                m.service.toLowerCase().includes(query)
            );
        }
        
        // Sort by date desc
        return result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [missions, searchQuery]);

    const openReport = (mission: Mission) => {
        setSelectedMission(mission);
        setIsModalOpen(true);
    };

    const closeReport = () => {
        setIsModalOpen(false);
        setTimeout(() => setSelectedMission(null), 300);
    };

    const handleDownloadAllImages = (urls: string[]) => {
      // Simple loop simulation for multiple downloads
      urls.forEach((url, i) => {
          setTimeout(() => {
              const link = document.createElement('a');
              link.href = url;
              link.download = `Preuve_Mission_${i+1}.jpg`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
          }, i * 300);
      });
    };

    return (
        <div className="p-8 h-full overflow-y-auto bg-white/40 relative">
            <div className="flex justify-between items-end mb-8">
                <div>
                    <h2 className="text-3xl font-serif font-bold text-slate-800">Rapports de Mission</h2>
                    <p className="text-sm text-slate-500">Validation des fins de chantier et preuves multimédias</p>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-slate-700 font-bold">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span>{completedMissions.length} Missions terminées</span>
                </div>
                
                <div className="relative w-full md:w-96">
                    <input 
                        type="text" 
                        placeholder="Rechercher (Client, Prestataire, Service)..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 bg-slate-50 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue outline-none"
                    />
                    <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                </div>
            </div>

            {/* Missions List */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500 border-b border-slate-100">
                        <tr>
                            <th className="px-6 py-4">Date & Heure</th>
                            <th className="px-6 py-4">Client / Lieu</th>
                            <th className="px-6 py-4">Prestataire</th>
                            <th className="px-6 py-4">Service</th>
                            <th className="px-6 py-4 text-center">Photos</th>
                            <th className="px-6 py-4 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {completedMissions.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="p-12 text-center text-slate-400">
                                    <div className="flex flex-col items-center gap-2">
                                        <Filter className="w-8 h-8 opacity-20" />
                                        <span>Aucun rapport de fin de mission trouvé.</span>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            completedMissions.map(m => (
                                <tr key={m.id} className="hover:bg-cream-50 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-slate-700">{m.date}</div>
                                        <div className="text-xs text-slate-500">{m.startTime} - {m.endTime}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-slate-800">{m.clientName}</div>
                                        <div className="flex items-center gap-1 text-[10px] text-slate-500">
                                            <MapPin className="w-3 h-3" /> Domicile
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
                                                {m.providerName?.charAt(0)}
                                            </div>
                                            <span className="text-slate-700 font-medium">{m.providerName}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="bg-blue-50 text-brand-blue px-2 py-1 rounded text-xs font-bold">{m.service}</span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex justify-center items-center gap-2">
                                            {m.endPhotos && m.endPhotos.length > 0 ? (
                                                <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-[10px] font-bold border border-green-200 flex items-center gap-1">
                                                    <Camera className="w-3 h-3" /> {m.endPhotos.length}
                                                </span>
                                            ) : (
                                                <span className="bg-red-50 text-red-400 px-2 py-1 rounded-full text-[10px] font-bold">0</span>
                                            )}
                                            {m.endVideo && (
                                                <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded-full text-[10px] font-bold border border-purple-200">
                                                    <Video className="w-3 h-3" />
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button 
                                            onClick={() => openReport(m)}
                                            className="bg-brand-blue text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-teal-700 transition shadow-sm flex items-center gap-2 ml-auto"
                                        >
                                            <Eye className="w-3 h-3" /> Voir Détails
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* REPORT DETAIL MODAL */}
            {isModalOpen && selectedMission && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col animate-in fade-in zoom-in duration-200 overflow-hidden">
                        
                        {/* Header */}
                        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                            <div>
                                <div className="flex items-center gap-3">
                                    <h3 className="text-xl font-bold text-slate-800">Rapport de Fin de Mission</h3>
                                    <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider border border-green-200">Terminée</span>
                                </div>
                                <p className="text-sm text-slate-500 flex items-center gap-2 mt-1">
                                    <Calendar className="w-4 h-4" /> {selectedMission.date} 
                                    <span className="text-slate-300">|</span> 
                                    <Clock className="w-4 h-4" /> {selectedMission.startTime} - {selectedMission.endTime}
                                </p>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={closeReport} className="p-2 text-slate-500 hover:bg-slate-200 rounded-full transition">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 bg-slate-100">
                            
                            {/* Info Card */}
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div>
                                    <span className="text-xs font-bold text-slate-400 uppercase block mb-1">Client</span>
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-brand-orange text-white flex items-center justify-center font-bold">{selectedMission.clientName.charAt(0)}</div>
                                        <span className="font-bold text-slate-800">{selectedMission.clientName}</span>
                                    </div>
                                </div>
                                <div>
                                    <span className="text-xs font-bold text-slate-400 uppercase block mb-1">Prestataire</span>
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-600">{selectedMission.providerName?.charAt(0)}</div>
                                        <span className="font-bold text-slate-800">{selectedMission.providerName}</span>
                                    </div>
                                </div>
                                <div>
                                    <span className="text-xs font-bold text-slate-400 uppercase block mb-1">Service</span>
                                    <span className="font-bold text-brand-blue text-lg">{selectedMission.service}</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* BEFORE WORK */}
                                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                                    <div className="bg-orange-50 border-b border-orange-100 px-4 py-3 flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                                        <h4 className="font-bold text-orange-800">Avant Chantier</h4>
                                    </div>
                                    <div className="p-4 flex-1">
                                        {/* Remark */}
                                        <div className="mb-4">
                                            <span className="text-xs font-bold text-slate-400 uppercase block mb-1">Remarque Début</span>
                                            <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-100 italic">
                                                {selectedMission.startRemark || "Aucune remarque signalée."}
                                            </p>
                                        </div>

                                        {/* Photos */}
                                        <div>
                                            <span className="text-xs font-bold text-slate-400 uppercase block mb-2 flex items-center gap-2">
                                                <Camera className="w-3 h-3"/> Photos ({selectedMission.startPhotos?.length || 0})
                                            </span>
                                            {selectedMission.startPhotos && selectedMission.startPhotos.length > 0 ? (
                                                <div className="grid grid-cols-3 gap-2">
                                                    {selectedMission.startPhotos.map((url, i) => (
                                                        <div key={i} className="aspect-square rounded-lg overflow-hidden border border-slate-200 group relative cursor-pointer" onClick={() => setLightboxImage(url)}>
                                                            <img src={url} alt="Start" className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors"></div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="text-center p-4 bg-slate-50 rounded-lg border border-dashed border-slate-200 text-slate-400 text-xs">
                                                    Aucune photo prise au début.
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* AFTER WORK */}
                                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                                    <div className="bg-green-50 border-b border-green-100 px-4 py-3 flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-green-600"></span>
                                        <h4 className="font-bold text-green-800">Fin de Chantier</h4>
                                    </div>
                                    <div className="p-4 flex-1">
                                        {/* Remark */}
                                        <div className="mb-4">
                                            <span className="text-xs font-bold text-slate-400 uppercase block mb-1">Remarque Fin</span>
                                            <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-100 italic">
                                                {selectedMission.endRemark || "R.A.S - Mission terminée."}
                                            </p>
                                        </div>

                                        {/* Photos */}
                                        <div>
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2">
                                                    <Camera className="w-3 h-3"/> Photos ({selectedMission.endPhotos?.length || 0})
                                                </span>
                                                {selectedMission.endPhotos && selectedMission.endPhotos.length > 0 && (
                                                    <button onClick={() => handleDownloadAllImages(selectedMission.endPhotos!)} className="text-xs text-brand-blue hover:underline flex items-center gap-1">
                                                        <Download className="w-3 h-3"/> Tout télécharger
                                                    </button>
                                                )}
                                            </div>
                                            {selectedMission.endPhotos && selectedMission.endPhotos.length > 0 ? (
                                                <div className="grid grid-cols-3 gap-2">
                                                    {selectedMission.endPhotos.map((url, i) => (
                                                        <div key={i} className="aspect-square rounded-lg overflow-hidden border border-slate-200 group relative cursor-pointer" onClick={() => setLightboxImage(url)}>
                                                            <img src={url} alt="End" className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="text-center p-4 bg-red-50 rounded-lg border border-dashed border-red-200 text-red-400 text-xs font-bold">
                                                    <AlertTriangle className="w-4 h-4 mx-auto mb-1"/>
                                                    Photos manquantes !
                                                </div>
                                            )}
                                        </div>

                                        {/* Video */}
                                        {selectedMission.endVideo && (
                                            <div className="mt-4 pt-4 border-t border-slate-100">
                                                <span className="text-xs font-bold text-slate-400 uppercase block mb-2 flex items-center gap-2">
                                                    <Video className="w-3 h-3"/> Vidéo de fin
                                                </span>
                                                <div className="aspect-video bg-black rounded-lg flex items-center justify-center text-white relative overflow-hidden group">
                                                    <p className="text-xs font-bold z-10">Lecture Vidéo</p>
                                                    {/* In a real scenario, <video src={selectedMission.endVideo} ... /> */}
                                                    <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-20 transition-opacity"></div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                        </div>
                        <div className="p-4 bg-white border-t border-slate-200 flex justify-end">
                            <button onClick={closeReport} className="px-6 py-2 bg-slate-800 text-white rounded-lg font-bold hover:bg-slate-700 transition">
                                Fermer
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Lightbox Modal */}
            {lightboxImage && (
                <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setLightboxImage(null)}>
                    <button 
                        onClick={() => setLightboxImage(null)}
                        className="absolute top-4 right-4 text-white p-2 hover:bg-white/20 rounded-full transition"
                    >
                        <X className="w-8 h-8" />
                    </button>
                    <img 
                        src={lightboxImage} 
                        alt="Full size" 
                        className="max-w-full max-h-full object-contain rounded-lg shadow-2xl animate-in zoom-in duration-200"
                        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking image
                    />
                </div>
            )}
        </div>
    );
};

export default MissionReports;
