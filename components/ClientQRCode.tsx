import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { QrCode, Clock, MapPin, User, CheckCircle, XCircle, LogIn, LogOut, RefreshCw, Download } from 'lucide-react';
import QRCode from 'qrcode';

const ClientQRCode: React.FC = () => {
    const { visitScans, currentUser, clients, simulatedClientId } = useData();
    const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
    const [clientScans, setClientScans] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Obtenir le client actuel
    const client = clients.find(c => c.id === simulatedClientId);

    useEffect(() => {
        const generateQRCode = async () => {
            if (!client) {
                setLoading(false);
                return;
            }

            try {
                // Générer le QR code avec l'ID du client
                const publicBaseUrl = (import.meta as any)?.env?.VITE_PUBLIC_BASE_URL || '';
                const baseUrl = String(publicBaseUrl).trim()
                    ? String(publicBaseUrl).trim().replace(/\/$/, '')
                    : `${window.location.origin}${window.location.pathname.replace(/\/$/, '')}`;
                const qrData = `${baseUrl}/#/scan?client=${client.id}`;
                const url = await QRCode.toDataURL(qrData, {
                    width: 256,
                    margin: 2,
                    color: {
                        dark: '#1e293b',
                        light: '#ffffff'
                    }
                });
                setQrCodeUrl(url);
            } catch (error) {
                console.error('Erreur génération QR code:', error);
            }

            setLoading(false);
        };

        generateQRCode();
    }, [client]);

    useEffect(() => {
        // Récupérer les scans du client effectués par les prestataires et admins uniquement
        if (client && visitScans) {
            const scans = visitScans
                .filter(scan => {
                    // Filtrer par client
                    if (scan.clientId !== client.id) return false;
                    
                    // Filtrer pour n'afficher que les scans par prestataires et admins
                    // On utilise scannerName pour déterminer le rôle car scannerId correspond à l'ID utilisateur
                    // Les scans par le client lui-même ont généralement un scannerName qui correspond au nom du client
                    return scan.scannerName !== client.name; // Exclure les auto-scans du client
                })
                .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            setClientScans(scans);
        }
    }, [client, visitScans]);

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getScanIcon = (type: string) => {
        return type === 'entry' ? LogIn : LogOut;
    };

    const getScanColor = (type: string) => {
        return type === 'entry' ? 'text-green-600' : 'text-red-600';
    };

    const getScanBgColor = (type: string) => {
        return type === 'entry' ? 'bg-green-50' : 'bg-red-50';
    };

    const getScanBorderColor = (type: string) => {
        return type === 'entry' ? 'border-green-200' : 'border-red-200';
    };

    const handleDownloadQRCode = async () => {
        if (!qrCodeUrl || loading || !client) return;
        const safeName = String(client?.name || 'client')
            .trim()
            .replace(/\s+/g, '_')
            .replace(/[^a-zA-Z0-9_\-]/g, '');

        try {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.src = qrCodeUrl;
            await new Promise<void>((resolve, reject) => {
                img.onload = () => resolve();
                img.onerror = () => reject(new Error('QR image load failed'));
            });

            const padding = 32;
            const titleText = 'Scannez ce code pour enregistrer votre présence';
            const subtitleText = `Client : ${client.name}`;

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            const wrapText = (text: string, maxWidth: number, font: string): string[] => {
                ctx.font = font;
                const words = String(text || '').split(/\s+/).filter(Boolean);
                const lines: string[] = [];
                let line = '';

                for (const word of words) {
                    const test = line ? `${line} ${word}` : word;
                    if (ctx.measureText(test).width <= maxWidth) {
                        line = test;
                    } else {
                        if (line) lines.push(line);
                        line = word;
                    }
                }
                if (line) lines.push(line);
                return lines.length ? lines : [String(text || '')];
            };

            // Canvas size: QR + padding + text block
            const qrSize = img.width || 256;
            const maxTextWidth = qrSize + padding * 2 - 24;
            const titleFont = 'bold 18px Arial';
            const subtitleFont = '14px Arial';
            const titleLines = wrapText(titleText, maxTextWidth, titleFont);
            const titleLineHeight = 22;
            const headerTop = 18;
            const titleBlockHeight = titleLines.length * titleLineHeight;
            const subtitleTop = headerTop + titleBlockHeight + 10;
            const headerHeight = Math.max(90, subtitleTop + 20);
            canvas.width = qrSize + padding * 2;
            canvas.height = headerHeight + qrSize + padding;

            // Background
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Text
            ctx.fillStyle = '#0f172a';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';

            ctx.font = titleFont;
            titleLines.forEach((line, i) => {
                ctx.fillText(line, canvas.width / 2, headerTop + i * titleLineHeight);
            });

            ctx.font = subtitleFont;
            ctx.fillStyle = '#334155';
            ctx.fillText(subtitleText, canvas.width / 2, subtitleTop);

            // QR image
            ctx.drawImage(img, padding, headerHeight, qrSize, qrSize);

            const finalPng = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.href = finalPng;
            link.download = `QRCode_${safeName || 'client'}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error('Erreur téléchargement QR code:', error);
            const link = document.createElement('a');
            link.href = qrCodeUrl;
            link.download = `QRCode_${safeName || 'client'}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    if (!client) {
        return (
            <div className="max-w-4xl mx-auto space-y-6">
                <div className="text-center py-12">
                    <User className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <h2 className="text-xl font-semibold text-slate-600">Client non trouvé</h2>
                    <p className="text-slate-500 mt-2">Veuillez vous reconnecter pour accéder à votre code QR.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4">
            {/* Section Code QR */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <QrCode className="w-6 h-6 text-brand-blue" />
                        <h2 className="text-xl font-bold text-slate-800">Mon Code QR</h2>
                    </div>
                    
                    <div className="grid md:grid-cols-2 gap-6">
                        {/* Code QR */}
                        <div className="text-center">
                            {loading ? (
                                <div className="w-64 h-64 bg-slate-100 rounded-lg flex items-center justify-center">
                                    <RefreshCw className="w-8 h-8 text-slate-400 animate-spin" />
                                </div>
                            ) : (
                                <div className="inline-block">
                                    <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-50 to-blue-50 border border-slate-200 shadow-sm">
                                        <div className="px-4 py-2 rounded-xl bg-white border border-slate-200 mb-4">
                                            <div className="text-sm font-bold text-slate-800">{client.name}</div>
                                            <div className="text-xs text-slate-500">ID: {client.id.slice(0, 8)}…</div>
                                        </div>
                                        <div className="p-4 bg-white rounded-xl border-2 border-slate-200">
                                            <img src={qrCodeUrl} alt="Code QR" className="w-56 h-56" />
                                        </div>
                                        <div className="mt-4 text-left text-xs text-slate-600 space-y-1">
                                            <div className="flex items-center gap-2">
                                                <MapPin className="w-4 h-4 text-slate-400" />
                                                <span className="truncate max-w-[18rem]">{client.address || 'Adresse non spécifiée'}</span>
                                            </div>
                                            {client.email ? (
                                                <div className="flex items-center gap-2">
                                                    <CheckCircle className="w-4 h-4 text-slate-400" />
                                                    <span className="truncate max-w-[18rem]">{client.email}</span>
                                                </div>
                                            ) : null}
                                            {client.phone ? (
                                                <div className="flex items-center gap-2">
                                                    <CheckCircle className="w-4 h-4 text-slate-400" />
                                                    <span className="truncate max-w-[18rem]">{client.phone}</span>
                                                </div>
                                            ) : null}
                                        </div>
                                    </div>
                                </div>
                            )}
                            <p className="text-sm text-slate-500 mt-4">
                                Présentez ce code QR pour votre pointage
                            </p>

                            <button
                                onClick={handleDownloadQRCode}
                                disabled={loading || !qrCodeUrl}
                                className={`mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition border ${loading || !qrCodeUrl
                                    ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                                    : 'bg-brand-blue text-white border-brand-blue hover:bg-blue-700'}`}
                            >
                                <Download className="w-4 h-4" />
                                Télécharger mon QRCode
                            </button>
                        </div>
                        
                        {/* Informations du client */}
                        <div className="space-y-4">
                            <div className="bg-slate-50 rounded-lg p-4">
                                <h3 className="font-semibold text-slate-800 mb-3">Informations</h3>
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <User className="w-4 h-4 text-slate-400" />
                                        <span className="text-sm text-slate-600">
                                            {client.name}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <MapPin className="w-4 h-4 text-slate-400" />
                                        <span className="text-sm text-slate-600">
                                            {client.address || 'Adresse non spécifiée'}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Clock className="w-4 h-4 text-slate-400" />
                                        <span className="text-sm text-slate-600">
                                            Client ID: {client.id.slice(0, 8)}...
                                        </span>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="bg-blue-50 rounded-lg p-4">
                                <h3 className="font-semibold text-blue-800 mb-2">Comment ça marche ?</h3>
                                <ul className="text-sm text-blue-700 space-y-1">
                                    <li>• Affichez ce code QR à l'entrée du site</li>
                                    <li>• Chaque scan enregistre un passage</li>
                                    <li>• Historique disponible ci-dessous</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Section Historique */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-200">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Clock className="w-6 h-6 text-brand-blue" />
                            <h2 className="text-xl font-bold text-slate-800">Historique de Pointage (Prestataires & Admins)</h2>
                        </div>
                        <span className="text-sm text-slate-500">
                            {clientScans.length} pointage{clientScans.length > 1 ? 's' : ''}
                        </span>
                    </div>
                </div>
                
                <div className="p-6">
                    {clientScans.length === 0 ? (
                        <div className="text-center py-8">
                            <Clock className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                            <p className="text-slate-500">Aucun pointage enregistré par les prestataires</p>
                            <p className="text-sm text-slate-400 mt-1">
                                Les pointages effectués par les prestataires et admins apparaîtront ici
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {clientScans.map((scan, index) => (
                                <div
                                    key={scan.id}
                                    className={`flex items-center justify-between p-4 rounded-lg border ${getScanBgColor(scan.scanType)} ${getScanBorderColor(scan.scanType)}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-full bg-white`}>
                                            {scan.scanType === 'entry' ? (
                                                <LogIn className={`w-5 h-5 ${getScanColor(scan.scanType)}`} />
                                            ) : (
                                                <LogOut className={`w-5 h-5 ${getScanColor(scan.scanType)}`} />
                                            )}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium text-slate-800">
                                                    {scan.scanType === 'entry' ? 'Entrée' : 'Sortie'}
                                                </span>
                                                {index === 0 && (
                                                    <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full">
                                                        Dernier pointage
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm text-slate-600">
                                                {formatDate(scan.timestamp)}
                                            </p>
                                            {scan.scannerName && (
                                                <p className="text-xs text-slate-500">
                                                Enregistré par: {scan.scannerName}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <div className={`p-2 rounded-full ${getScanBgColor(scan.scanType)}`}>
                                        {scan.scanType === 'entry' ? (
                                            <CheckCircle className="w-5 h-5 text-green-600" />
                                        ) : (
                                            <XCircle className="w-5 h-5 text-red-600" />
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ClientQRCode;
