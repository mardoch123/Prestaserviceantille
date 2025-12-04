

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
    role: 'admin' | 'client' | 'provider';
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
  firstName: string;
  lastName: string;
  status: 'Active' | 'Inactive' | 'Passive';
  specialty: string;
  leaves: Leave[]; // In a real DB, this would be a join, but kept here for UI convenience
  hoursWorked: number;
  rating: number;
  phone: string;
  email: string;
  initialPassword?: string; // Stored specifically for admin viewing (not secure for prod, but requested)
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
    frequency: 'Ponctuelle' | 'Hebdomadaire' | 'Bimensuelle' | 'Mensuelle' | 'Régulier';
    quantity?: string; // New field from PDF (nb pièces, m2...)
    location?: string; // New field from PDF (Lieu de réalisation)
    suppliesIncluded: boolean;
    suppliesDetails?: string;
    type: 'ponctuel' | 'regulier';
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
    status: 'draft' | 'active' | 'pending_validation';
    isSap?: boolean;
    validationDate?: string;
    adminSignatureUrl?: string;
    clientSignatureUrl?: string; // Added signature for client
    companyStampUrl?: string;
    validatedAt?: string;
    signedAt?: string;
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
    
    status: 'signed' | 'sent' | 'expired' | 'paid' | 'pending' | 'converted' | 'rejected';
    
    linkedInvoiceId?: string; // Self-referencing FK for converting Quote -> Invoice
    
    // JSONB fields in Supabase
    slotsData?: any[]; 
    frequency?: string;
    recurrenceEndDate?: string;
    
    reviewRequestSent?: boolean;
    signatureData?: string; // URL or Base64
    signatureDate?: string;
    reminderSent?: boolean;
}

// Updated based on DB schema provided in prompt
export interface AppNotification {
    id: string;
    type: 'info' | 'alert' | 'success' | 'message';
    title: string;
    message: string;
    date: string;
    is_read: boolean; // DB column name
    read?: boolean; // UI Alias
    link?: string;
    created_at?: string;
    
    // Target columns added via SQL
    targetUserType?: 'admin' | 'client' | 'provider';
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