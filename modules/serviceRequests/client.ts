import { supabase } from '../../utils/supabaseClient';
import { sendEmailViaEmailJS } from '../../utils/emailService';
import type { 
  CustomerServiceRequest, 
  CreateCustomerServiceRequestInput,
  RequestedSlot 
} from './types';

// Helper to generate UUID
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Create a new customer service request
 * This is called when a client submits a new service request from their portal
 * Uses API endpoint to bypass RLS policies
 */
export async function createCustomerServiceRequest(
  input: CreateCustomerServiceRequestInput,
  clientInfo: {
    name: string;
    email: string;
    phone?: string | null;
    address?: string | null;
    city?: string | null;
  },
  packName?: string | null
): Promise<CustomerServiceRequest | null> {
  // Use API endpoint to bypass RLS policies
  const response = await fetch('/api/service-requests', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input,
      clientInfo,
      packName,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    console.error('Error creating customer service request:', error);
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  const data = await response.json();
  return data.serviceRequest || null;
}

/**
 * Get all customer service requests (for admin)
 */
export async function getCustomerServiceRequests(
  status?: 'pending' | 'validated' | 'rejected' | 'cancelled'
): Promise<CustomerServiceRequest[]> {
  let query = supabase
    .from('customer_service_requests')
    .select('*')
    .order('created_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching customer service requests:', error);
    throw error;
  }

  return (data || []).map(mapDbToCustomerServiceRequest);
}

/**
 * Get a single customer service request by ID
 */
export async function getCustomerServiceRequestById(
  id: string
): Promise<CustomerServiceRequest | null> {
  const { data, error } = await supabase
    .from('customer_service_requests')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    console.error('Error fetching customer service request:', error);
    throw error;
  }

  if (!data) return null;

  return mapDbToCustomerServiceRequest(data);
}

/**
 * Mark a request as seen by admin (removes it from badge count)
 */
export async function markRequestAsSeen(id: string): Promise<void> {
  const { error } = await supabase
    .from('customer_service_requests')
    .update({ admin_seen_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    console.error('Error marking request as seen:', error);
    throw error;
  }
}

/**
 * Mark multiple requests as seen by admin
 */
export async function markRequestsAsSeen(ids: string[]): Promise<void> {
  if (ids.length === 0) return;

  const { error } = await supabase
    .from('customer_service_requests')
    .update({ admin_seen_at: new Date().toISOString() })
    .in('id', ids);

  if (error) {
    console.error('Error marking requests as seen:', error);
    throw error;
  }
}

/**
 * Validate a customer service request
 * This updates the status and records who validated it
 */
export async function validateCustomerServiceRequest(
  requestId: string,
  adminUserId: string,
  generatedDevisId?: string,
  generatedMissionIds?: string[]
): Promise<CustomerServiceRequest | null> {
  const updates: any = {
    status: 'validated',
    validated_at: new Date().toISOString(),
    validated_by: adminUserId,
  };

  if (generatedDevisId) {
    updates.generated_devis_id = generatedDevisId;
  }

  if (generatedMissionIds && generatedMissionIds.length > 0) {
    updates.generated_mission_ids = generatedMissionIds;
  }

  const { data, error } = await supabase
    .from('customer_service_requests')
    .update(updates)
    .eq('id', requestId)
    .select()
    .single();

  if (error) {
    console.error('Error validating customer service request:', error);
    throw error;
  }

  if (!data) return null;

  return mapDbToCustomerServiceRequest(data);
}

/**
 * Reject a customer service request
 */
export async function rejectCustomerServiceRequest(
  requestId: string,
  adminUserId: string,
  reason?: string
): Promise<CustomerServiceRequest | null> {
  const { data, error } = await supabase
    .from('customer_service_requests')
    .update({
      status: 'rejected',
      validated_at: new Date().toISOString(),
      validated_by: adminUserId,
    })
    .eq('id', requestId)
    .select()
    .single();

  if (error) {
    console.error('Error rejecting customer service request:', error);
    throw error;
  }

  if (!data) return null;

  return mapDbToCustomerServiceRequest(data);
}

/**
 * Get count of unseen pending requests (for badge)
 */
export async function getUnseenPendingRequestCount(): Promise<number> {
  const { count, error } = await supabase
    .from('customer_service_requests')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending')
    .is('admin_seen_at', null);

  if (error) {
    console.error('Error counting unseen pending requests:', error);
    return 0;
  }

  return count || 0;
}

/**
 * Delete a customer service request
 */
export async function deleteCustomerServiceRequest(id: string): Promise<void> {
  const { error } = await supabase
    .from('customer_service_requests')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting customer service request:', error);
    throw error;
  }
}

// Helper function to map database row to CustomerServiceRequest type
function mapDbToCustomerServiceRequest(data: any): CustomerServiceRequest {
  return {
    id: data.id,
    clientId: data.client_id,
    clientName: data.client_name,
    clientEmail: data.client_email,
    clientPhone: data.client_phone,
    clientAddress: data.client_address,
    clientCity: data.client_city,
    serviceType: data.service_type,
    packId: data.pack_id,
    packName: data.pack_name,
    customServiceDescription: data.custom_service_description,
    requestedSlots: (data.requested_slots || []) as RequestedSlot[],
    signatureDataUrl: data.signature_data_url,
    estimatedPrice: data.estimated_price,
    status: data.status,
    adminSeenAt: data.admin_seen_at,
    validatedAt: data.validated_at,
    validatedBy: data.validated_by,
    generatedDevisId: data.generated_devis_id,
    generatedMissionIds: data.generated_mission_ids || [],
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/**
 * Send admin notification email when a new service request is submitted
 * This function should be called after successfully creating a request
 */
export async function sendAdminNewServiceRequestNotification(
  request: CustomerServiceRequest,
  adminEmail: string = 'prestaservices972@gmail.com'
): Promise<boolean> {
  const firstSlot = request.requestedSlots[0];
  const requestedDate = firstSlot?.date || 'Non spécifiée';
  const requestedTime = firstSlot 
    ? `${firstSlot.startTime}-${firstSlot.endTime}` 
    : 'Non spécifié';

  return await sendEmailViaEmailJS(
    adminEmail,
    'Nouvelle demande de service client',
    'admin_new_service_request',
    {
      clientName: request.clientName,
      serviceType: request.serviceType,
      packName: request.packName || 'Non spécifié',
      requestedDate,
      requestedTime,
      link: `https://www.prestaservicesantilles.com/admin/service-requests/${request.id}`
    }
  );
}

