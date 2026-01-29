

import { LucideIcon } from "lucide-react";

export interface NavItem {
    label: string;
    path: string;
    icon: LucideIcon;
}

export interface User {
    id: string; // UUID
    name: string;
    email: string;
    role: 'admin' | 'super_admin' | 'client' | 'provider';
    relatedEntityId?: string; // UUID linkage to Client or Provider table
}

export enum DashboardViewMode {
    COMMERCIAL = 'Activité commerciale',
    TRACKING = 'Suivi des prestations',
    PROVIDERS = 'Suivi des prestataires',
    FINANCIAL = 'Financier'
}

export interface StatCardProps {
    title: string;
    value?: string | number;
    subtext?: string;
    bgColor?: string;
    icon?: LucideIcon;
    onClick?: () => void;
}

export interface Leave {
    id: string;
    providerId: string; // FK
    startDate: string;
    endDate: string;
    startTime?: string;
    endTime?: string;
    status: 'pending' | 'approved' | 'rejected';
}

export interface Provider {
    id: string;
    firstName: string; // first_name en DB
    lastName: string; // last_name en DB
    status: 'Active' | 'Inactive' | 'Passive'; // USER-DEFINED provider_status
    specialty: string;
    leaves: Leave[]; // In a real DB, this would be a join, but kept here for UI convenience
    hoursWorked: number; // hours_worked en DB
    rating: number; // rating en DB
    phone: string; // phone en DB
    email: string; // email en DB
    initialPassword?: string; // Stored specifically for admin viewing (not secure for prod, but requested)
    isActive?: boolean; // Champ pour vérifier si le prestataire est actif (dérivé de status)
    nonInterventionDays?: number[]; // 0=Dimanche ... 6=Samedi
}

// DTO for creating a provider (no ID)
export type CreateProviderDTO = Omit<Provider, 'id' | 'leaves' | 'hoursWorked' | 'rating'>;

export interface Client {
    id: string;
    name: string;
    address: string;
    pack: string;
    city: string;
    email: string;
    phone: string;
    status: 'active' | 'new' | 'prospect';
    since: string;
    packsConsumed: number;
    loyaltyHoursAvailable: number;
    hasLeftReview?: boolean;
    initialPassword?: string; // Stored specifically for admin viewing
}

// DTO for creating a client
export type CreateClientDTO = Omit<Client, 'id'>;

export interface ScheduleOption {
    id: string;
    label: string;
    days: number;
    hoursPerDay: number;
}

export interface Pack {
    id: string;
    name: string;
    mainService: string;
    description: string;
    hours: number;
    frequency: 'Ponctuelle' | 'Hebdomadaire' | 'Bimensuelle' | 'Mensuelle' | 'regulier';
    quantity?: string; // New field from PDF (nb pièces, m2...)
    location?: string; // New field from PDF (Lieu de réalisation)
    date?: string; // Date pour les packs ponctuels
    suppliesIncluded: boolean;
    suppliesDetails?: string;
    type: 'ponctuel' | 'regulier';
    priceTTC: number;
    priceHT: number;
    priceTaxCredit: number;
    contractType: string;
    isSap?: boolean;
    schedules?: ScheduleOption[];
}

export interface Contract {
    id: string;
    name: string;
    content: string;
    packId?: string; // FK
    clientId?: string; // FK to client for direct association
    status: 'draft' | 'active' | 'pending_validation';
    isSap?: boolean;
    validationDate?: string;
    adminSignatureUrl?: string;
    clientSignatureUrl?: string; // Added signature for client
    companyStampUrl?: string;
    validatedAt?: string;
    signedAt?: string;
    // Validation workflow fields
    validationStatus?: 'draft' | 'pending_validation' | 'validated' | 'rejected';
    validatedBy?: string; // User ID of super admin who validated
    validationRequestedAt?: string;
    validationRequestedBy?: string; // User ID who requested validation
    isModifiable?: boolean; // Champ pour permettre la modification après création
    // Nouveaux champs pour contrat générique
    isGeneric?: boolean; // Indique si c'est le contrat générique
    quoteId?: string; // ID du devis associé
    generatedAt?: string; // Date de génération du contrat personnalisé
    // Champs additionnels pour le PDF ContractPDF
    createdAt?: string;
    duration?: string;
    amount?: number;
    paymentTerms?: string;
    object?: string;
    services?: Array<{
        name: string;
        description: string;
    }>;
    clientSignature?: string; // Alias pour clientSignatureUrl
}

export interface GenericContract {
    id: string;
    name: string;
    content: string; // Contenu du contrat générique avec placeholders
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    createdBy: string; // ID de l'admin qui l'a créé/modifié
}

export interface Mission {
    id: string;
    dayIndex?: number; // Helper for UI, likely calculated in DB view
    date: string; // ISO Date YYYY-MM-DD
    startTime: string; // HH:mm
    endTime: string; // HH:mm
    duration: number;

    clientId?: string; // FK - Essential for DB
    clientName: string; // Denormalized for easier display, or joined

    providerId: string | null; // FK
    providerName?: string; // Denormalized

    service: string;
    status: 'planned' | 'in_progress' | 'completed' | 'cancelled';
    color: 'orange' | 'blue' | 'green' | 'gray';
    source?: 'devis' | 'reservation';

    startPhotos?: string[]; // URLs to Storage
    endPhotos?: string[]; // URLs to Storage
    startVideo?: string;
    endVideo?: string;
    startRemark?: string;
    endRemark?: string;

    cancellationReason?: string;
    lateCancellation?: boolean;
    reminder48hSent?: boolean;
    reminder72hSent?: boolean; // New reminder flag
    reportSent?: boolean;
    sourceDocumentId?: string;
}

export interface MissionChangeRequest {
    id: string;
    missionId: string;
    clientId: string;

    oldDate: string;
    oldStartTime: string;
    oldEndTime: string;

    newDate: string;
    newStartTime: string;
    newEndTime: string;

    status: 'pending' | 'approved' | 'rejected';
    createdAt: string;
    respondedAt?: string;
}

// DTO for creating a mission
export type CreateMissionDTO = Omit<Mission, 'id'>;

export interface Reminder {
    id: string;
    date: string;
    text: string;
    notifyEmail: boolean;
    completed: boolean;
}

export interface Document {
    id: string;
    ref: string; // Unique Reference
    clientId: string; // FK
    clientName: string;

    date: string;
    type: 'Devis' | 'Facture';
    category: 'pack' | 'custom';
    description: string;

    unitPrice: number;
    quantity: number;
    tvaRate: 0 | 2.1 | 8.5;
    totalHT: number;
    totalTTC: number;
    taxCreditEnabled: boolean;
    hasTaxCredit?: boolean; // Champ pour indiquer si le crédit d'impôt est activé

    status: 'signed' | 'sent' | 'expired' | 'paid' | 'pending' | 'converted' | 'rejected' | 'draft';

    linkedInvoiceId?: string; // Self-referencing FK for converting Quote -> Invoice

    // JSONB fields in Supabase
    slotsData?: any[];
    frequency?: string;
    recurrenceEndDate?: string;

    reviewRequestSent?: boolean;
    signatureData?: string; // URL or Base64
    signatureDate?: string;
    reminderSent?: boolean;
    
    // Nouvelles propriétés pour les signatures
    clientSignatureUrl?: string;
    signedAt?: string;
    packId?: string; // FK vers le pack associé
}

// Updated based on DB schema provided in prompt
export interface AppNotification {
    id: string;
    type?: 'info' | 'alert' | 'success' | 'message'; // Optionnel car non utilisé dans l'insertion
    title: string;
    message: string;
    date: string;
    is_read: boolean; // DB column name
    read?: boolean; // UI Alias
    link?: string;
    created_at?: string;

    // Target columns added via SQL
    targetUserType?: 'admin' | 'super_admin' | 'client' | 'provider';
    targetUserId?: string;
}

export interface Message {
    id: string;
    sender: 'client' | 'admin';
    text: string;
    date: string; // Timestamp
    clientId: string; // FK
    read?: boolean;
}

export interface ContactForm {
    id: string;
    name: string;
    email: string;
    phone?: string;
    subject?: string;
    message: string;
    createdAt: string;
    isRead: boolean;
}

export type CreateContactFormDTO = Omit<ContactForm, 'id' | 'createdAt' | 'isRead'>;

export interface Review {
    id: string;
    clientId: string; // FK
    rating: number;
    comment: string;
    date: string;
}

export interface StreamSession {
    id: string;
    providerId: string; // FK
    clientId: string; // FK
    status: 'active' | 'ended';
    startTime: string;
    streamUrl?: string; // URL du flux vidéo
}

export interface VideoRecording {
    id: string;
    sessionId: string;
    providerId: string;
    clientId: string;
    status: 'recording' | 'processing' | 'ready' | 'failed';
    startTime: string;
    endTime?: string;
    recordingUrl?: string;
    replayUrl?: string;
    duration: number; // en secondes
    fileSize: number; // en octets
    thumbnailUrl?: string;
    accessToken?: string; // Token d'accès temporaire
    expiresAt?: string; // Date d'expiration du token
    url?: string; // URL de la vidéo finale
}

export interface VideoAccessToken {
    id: string;
    recordingId: string;
    userId: string; // Client ou Provider
    token: string;
    expiresAt: string;
    createdAt: string;
    permissions: 'view' | 'download'; // Permissions accordés
}

export interface Expense {
    id: string;
    date: string;
    category: 'fournitures' | 'carburant' | 'administratif' | 'autre';
    description: string;
    amount: number;
    proofUrl?: string; // Storage URL
}

export interface CompanySettings {
    name: string;
    address: string;
    siret: string;
    email: string;
    phone: string;
    tvaRateDefault: number;
    emailNotifications: boolean;
    loyaltyRewardHours: number;
    logoUrl?: string; // Storage URL or Base64
}

export interface VisitScan {
    id: string;
    clientId: string;
    scannerId: string; // User ID
    scannerName: string;
    scanType: 'entry' | 'exit';
    timestamp: string;
    locationData?: any; // JSON for coordinates
}