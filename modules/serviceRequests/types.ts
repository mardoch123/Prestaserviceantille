export type CustomerServiceRequestStatus = 'pending' | 'validated' | 'rejected' | 'cancelled';

export type RequestedSlot = {
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  duration: number; // in hours
};

export type CustomerServiceRequest = {
  id: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string | null;
  clientAddress: string | null;
  clientCity: string | null;
  
  // Service details
  serviceType: string;
  packId: string | null;
  packName: string | null;
  customServiceDescription: string | null;
  
  // Requested slots
  requestedSlots: RequestedSlot[];
  
  // Signature
  signatureDataUrl: string | null; // Base64 signature image
  
  // Pricing
  estimatedPrice: number | null;
  
  // Status tracking
  status: CustomerServiceRequestStatus;
  adminSeenAt: string | null;
  validatedAt: string | null;
  validatedBy: string | null;
  
  // Linked entities after validation
  generatedDevisId: string | null;
  generatedMissionIds: string[] | null;
  
  // Metadata
  createdAt: string;
  updatedAt: string;
};

export type CreateCustomerServiceRequestInput = {
  clientId: string;
  serviceType: string;
  packId?: string | null;
  customServiceDescription?: string | null;
  requestedSlots: RequestedSlot[];
  signatureDataUrl: string;
  estimatedPrice?: number | null;
};

export type ValidateRequestInput = {
  requestId: string;
  adminUserId: string;
};
