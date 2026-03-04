import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { QrCode, Clock, MapPin, User, CheckCircle, XCircle, LogIn, LogOut, RefreshCw, Download, Printer } from 'lucide-react';
import QRCode from 'qrcode';
import { LOGO_BASE64 } from '../src/assets/images';

const ClientQRCode: React.FC = () => {
    const { visitScans, clients, simulatedClientId } = useData();
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

    const getQrDataForClient = (clientId: string) => {
        const publicBaseUrl = (import.meta as any)?.env?.VITE_PUBLIC_BASE_URL || '';
        const baseUrl = String(publicBaseUrl).trim()
            ? String(publicBaseUrl).trim().replace(/\/$/, '')
            : `${window.location.origin}${window.location.pathname.replace(/\/$/, '')}`;
        return `${baseUrl}/#/scan?client=${clientId}`;
    };

    const handlePrintQRCode = async () => {
        if (!client) return;

        const qrData = getQrDataForClient(client.id);
        const qrDataUrl = await QRCode.toDataURL(qrData, {
            width: 700,
            margin: 2,
            errorCorrectionLevel: 'H'
        });

        const printWindow = window.open('', '', 'width=600,height=800');
        if (printWindow) {
            printWindow.document.write(`
                <html>
                <head>
                    <title>QR Code - ${client.name}</title>
                    <style>
                        body { font-family: 'Arial', sans-serif; text-align: center; padding: 40px; }
                        .card { border: 2px solid #333; padding: 40px; border-radius: 20px; display: inline-block; max-width: 400px; }
                        .logo-img { height: 92px; width: auto; margin-bottom: 14px; }
                        .logo-text { font-size: 24px; font-weight: bold; color: #2A9D8F; margin-bottom: 10px; }
                        .title { font-size: 18px; font-weight: bold; margin-bottom: 20px; text-transform: uppercase; }
                        .client { font-size: 16px; margin-bottom: 30px; font-style: italic; }
                        .qr { width: 250px; height: 250px; margin-bottom: 30px; }
                        .instructions { font-size: 12px; color: #666; line-height: 1.5; }
                        @media print {
                            body { margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; height: 100vh; }
                            .no-print { display: none; }
                        }
                    </style>
                </head>
                <body>
                    <div class="card">
                        <img class="logo-img" src="${LOGO_BASE64}" alt="Logo" />
                        <div class="title">Pointage Prestataire</div>
                        <div class="client">Client : ${client.name}</div>
                        <img src="${qrDataUrl}" class="qr" alt="QR Code" />
                        <div class="instructions">
                            1. Ouvrez l'application Presta Services<br/>
                            2. Scannez ce code à votre arrivée (Entrée)<br/>
                            3. Scannez ce code à votre départ (Sortie)<br/>
                            4. Le pointage sera automatiquement enregistré
                        </div>
                    </div>
                    <br/><br/>
                    <button class="no-print" onclick="window.print()">Imprimer</button>
                </body>
                </html>
            `);
            printWindow.document.close();
        }
    };

    const handleDownloadQRCode = async () => {
        if (!qrCodeUrl || loading || !client) return;
        const safeName = String(client?.name || 'client')
            .trim()
            .replace(/\s+/g, '_')
            .replace(/[^a-zA-Z0-9_\-]/g, '');

        try {
            const qrData = getQrDataForClient(client.id);
            const qrDataUrl = await QRCode.toDataURL(qrData, {
                width: 700,
                margin: 2,
                errorCorrectionLevel: 'H'
            });

            const qrImg = new Image();
            qrImg.crossOrigin = 'anonymous';
            qrImg.src = qrDataUrl;
            await new Promise<void>((resolve, reject) => {
                qrImg.onload = () => resolve();
                qrImg.onerror = () => reject(new Error('QR image load failed'));
            });

            const logo = new Image();
            logo.src = LOGO_BASE64;
            const logoLoaded = await new Promise<boolean>((resolve) => {
                logo.onload = () => resolve(true);
                logo.onerror = () => resolve(false);
            });

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            const scale = 2;
            const cardWidth = 400 * scale;
            const cardPadding = 40 * scale;
            const border = 2 * scale;
            const qrSize = 250 * scale;
            const logoHeight = 92 * scale;

            const title = 'Pointage Prestataire';
            const clientLine = `Client : ${client.name}`;
            const instructions = [
                "1. Ouvrez l'application Presta Services",
                '2. Scannez ce code à votre arrivée (Entrée)',
                '3. Scannez ce code à votre départ (Sortie)',
                '4. Le pointage sera automatiquement enregistré'
            ];

            const titleFont = `bold ${18 * scale}px Arial`;
            const clientFont = `italic ${16 * scale}px Arial`;
            const instructionFont = `${12 * scale}px Arial`;

            const gapAfterLogo = 14 * scale;
            const gapAfterTitle = 20 * scale;
            const gapAfterClient = 40 * scale;
            const gapAfterQr = 30 * scale;
            const lineHeight = 16 * scale;

            const contentHeight =
                logoHeight + gapAfterLogo +
                (18 * scale) + gapAfterTitle +
                (16 * scale) + gapAfterClient +
                qrSize + gapAfterQr +
                (instructions.length * lineHeight);

            const cardHeight = cardPadding * 2 + contentHeight;
            canvas.width = cardWidth + border * 2;
            canvas.height = cardHeight + border * 2;

            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.fillStyle = '#333333';
            ctx.fillRect(0, 0, canvas.width, border);
            ctx.fillRect(0, 0, border, canvas.height);
            ctx.fillRect(0, canvas.height - border, canvas.width, border);
            ctx.fillRect(canvas.width - border, 0, border, canvas.height);

            const cx = canvas.width / 2;
            let y = border + cardPadding;

            if (logoLoaded && logo.width > 0 && logo.height > 0) {
                const targetH = logoHeight;
                const targetW = Math.max(1, Math.round((logo.width / logo.height) * targetH));
                ctx.drawImage(logo, Math.round(cx - targetW / 2), Math.round(y), targetW, targetH);
            }
            y += logoHeight + gapAfterLogo;

            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';

            ctx.font = titleFont;
            ctx.fillStyle = '#0f172a';
            ctx.fillText(title.toUpperCase(), cx, y);
            y += (18 * scale) + gapAfterTitle;

            ctx.font = clientFont;
            ctx.fillStyle = '#0f172a';
            ctx.fillText(clientLine, cx, y);
            y += (16 * scale) + gapAfterClient;

            ctx.drawImage(qrImg, Math.round(cx - qrSize / 2), Math.round(y), qrSize, qrSize);
            y += qrSize + gapAfterQr;

            ctx.font = instructionFont;
            ctx.fillStyle = '#666666';
            instructions.forEach((line) => {
                ctx.fillText(line, cx, y);
                y += lineHeight;
            });

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
                                    <div className="w-40 h-3 bg-slate-200 rounded animate-pulse" />
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

                            <button
                                onClick={handlePrintQRCode}
                                disabled={loading || !qrCodeUrl}
                                className={`mt-3 ml-0 sm:ml-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition border ${loading || !qrCodeUrl
                                    ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
                            >
                                <Printer className="w-4 h-4" />
                                Imprimer mon QRCode
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
