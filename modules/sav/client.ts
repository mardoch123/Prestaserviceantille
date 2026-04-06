// Client API pour le module SAV

import { supabase, isSupabaseConfigured } from '../../utils/supabaseClient';
import {
  SAVRecord,
  SatisfactionSurvey,
  CreateSAVInput,
  CreateSatisfactionSurveyInput,
  SAVStats,
  SAVFilters,
} from './types';

// ====== SAV Records ======

export async function getSAVRecords(filters?: SAVFilters): Promise<SAVRecord[]> {
  if (!isSupabaseConfigured) return [];

  try {
    // Récupérer les SAV records classiques via RPC
    const { data: savData, error: savError } = await supabase
      .rpc('get_sav_records');

    if (savError) {
      console.error('[SAV] Error fetching SAV records via RPC:', savError);
    }

    // Récupérer aussi les enquêtes de satisfaction
    const { data: surveyData, error: surveyError } = await supabase
      .rpc('get_satisfaction_surveys');

    if (surveyError) {
      console.error('[SAV] Error fetching satisfaction surveys via RPC:', surveyError);
    }

    // Transformer les SAV records
    let records = (savData || []).map(transformSAVRecordFromDB);
    
    // Transformer les enquêtes en format SAVRecord (virtuel)
    const surveyRecords = (surveyData || []).map((s: any) => ({
      id: s.id,
      missionId: s.mission_id,
      clientId: s.client_id,
      clientName: s.client_name,
      packName: s.pack_name,
      status: 'completed' as const,
      savType: 'satisfaction_survey' as const,
      description: `Enquête - Qualité: ${s.quality_rating}, Propreté: ${s.cleanliness_rating}, Recommandation: ${s.recommendation_rating}`,
      priority: 'medium' as const,
      createdAt: s.created_at,
      updatedAt: s.updated_at,
      createdBy: s.created_by,
      investigatorName: s.investigator_name,
      completedAt: s.created_at,
    } as unknown as SAVRecord));

    // Combiner les deux listes
    records = [...records, ...surveyRecords];
    
    // Appliquer les filtres côté client
    if (filters) {
      if (filters.type && filters.type !== 'all') {
        records = records.filter((r: SAVRecord) => r.savType === filters.type);
      }
      if (filters.status && filters.status !== 'all') {
        records = records.filter((r: SAVRecord) => r.status === filters.status);
      }
      if (filters.priority && filters.priority !== 'all') {
        records = records.filter((r: SAVRecord) => r.priority === filters.priority);
      }
      if (filters.clientName) {
        records = records.filter((r: SAVRecord) => 
          r.clientName.toLowerCase().includes(filters.clientName!.toLowerCase())
        );
      }
    }
    
    // Trier par date de création (plus récent en premier)
    records.sort((a: SAVRecord, b: SAVRecord) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    return records;
  } catch (err) {
    console.error('[SAV] Exception in getSAVRecords:', err);
    return [];
  }
}

export async function getSAVRecordById(id: string): Promise<SAVRecord | null> {
  if (!isSupabaseConfigured) return null;

  // Utiliser la fonction RPC pour contourner RLS
  const { data, error } = await supabase
    .rpc('get_sav_record_by_id', { p_id: id });

  if (error || !data) {
    console.error('[SAV] Error fetching SAV record via RPC:', error);
    return null;
  }

  return transformSAVRecordFromDB(data);
}

export async function createSAVRecord(
  input: CreateSAVInput,
  userId: string,
  investigatorName: string
): Promise<SAVRecord | null> {
  if (!isSupabaseConfigured) return null;

  const { data: mission } = await supabase
    .from('missions')
    .select('*, clients:client_id(*)')
    .eq('id', input.missionId)
    .single();

  if (!mission) {
    console.error('[SAV] Mission not found:', input.missionId);
    return null;
  }

  // Utiliser la fonction RPC pour contourner RLS
  const { data: savId, error } = await supabase
    .rpc('create_sav_record', {
      p_mission_id: input.missionId,
      p_client_id: mission.client_id,
      p_client_name: mission.client_name || mission.clients?.name || 'Client inconnu',
      p_client_address: mission.clients?.address,
      p_client_phone: mission.clients?.phone,
      p_client_email: mission.clients?.email,
      p_mission_date: mission.date,
      p_mission_service: mission.service,
      p_pack_name: mission.pack_name || 'Non spécifié',
      p_provider_name: mission.provider_name,
      p_sav_type: input.savType,
      p_description: input.description,
      p_priority: input.priority || 'medium',
      p_created_by: userId,
      p_investigator_name: investigatorName
    });

  if (error || !savId) {
    console.error('[SAV] Error creating SAV record via RPC:', error);
    return null;
  }

  // Récupérer l'enregistrement créé via RPC
  const { data, error: fetchError } = await supabase
    .rpc('get_sav_record_by_id', { p_id: savId });

  if (fetchError || !data) {
    console.error('[SAV] Error fetching created SAV record:', fetchError);
    return null;
  }

  return transformSAVRecordFromDB(data);
}

export async function updateSAVStatus(
  savId: string,
  status: SAVRecord['status']
): Promise<boolean> {
  if (!isSupabaseConfigured) return false;

  // Utiliser la fonction RPC pour contourner RLS
  const { data, error } = await supabase
    .rpc('update_sav_status', {
      p_sav_id: savId,
      p_status: status
    });

  if (error) {
    console.error('[SAV] Error updating SAV status via RPC:', error);
    return false;
  }

  return data === true;
}

export async function deleteSAVRecord(savId: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;

  const { error } = await supabase
    .from('sav_records')
    .delete()
    .eq('id', savId);

  if (error) {
    console.error('[SAV] Error deleting SAV record:', error);
    return false;
  }

  return true;
}

export async function deleteSatisfactionSurvey(surveyId: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;

  const { error } = await supabase
    .from('satisfaction_surveys')
    .delete()
    .eq('id', surveyId);

  if (error) {
    console.error('[SAV] Error deleting satisfaction survey:', error);
    return false;
  }

  return true;
}

// ====== Satisfaction Surveys ======

export async function getSatisfactionSurveys(missionId?: string): Promise<SatisfactionSurvey[]> {
  if (!isSupabaseConfigured) return [];

  // Utiliser la fonction RPC pour contourner RLS
  const { data, error } = await supabase
    .rpc('get_satisfaction_surveys', { p_mission_id: missionId || null });

  if (error) {
    console.error('[SAV] Error fetching satisfaction surveys via RPC:', error);
    return [];
  }

  return (data || []).map(transformSurveyFromDB);
}

export async function getSatisfactionSurveyById(id: string): Promise<SatisfactionSurvey | null> {
  if (!isSupabaseConfigured) return null;

  // Utiliser la fonction RPC pour contourner RLS
  const { data, error } = await supabase
    .rpc('get_satisfaction_survey_by_id', { p_id: id });

  if (error || !data) {
    console.error('[SAV] Error fetching satisfaction survey via RPC:', error);
    return null;
  }

  return transformSurveyFromDB(data);
}

export async function createSatisfactionSurvey(
  input: CreateSatisfactionSurveyInput,
  userId: string
): Promise<SatisfactionSurvey | null> {
  if (!isSupabaseConfigured) {
    return null;
  }

  try {
    // Utiliser la fonction RPC pour contourner RLS
    const { data: surveyId, error } = await supabase
      .rpc('create_satisfaction_survey', {
        p_mission_id: input.missionId,
        p_client_id: input.clientId,
        p_client_name: input.clientName,
        p_pack_name: input.packName,
        p_quality_rating: input.qualityRating,
        p_cleanliness_rating: input.cleanlinessRating,
        p_recommendation_rating: input.recommendationRating,
        p_additional_comments: input.additionalComments || null,
        p_created_by: userId,
        p_investigator_name: input.investigatorName
      });

    if (error || !surveyId) {
      console.error('[SAV] Error creating satisfaction survey via RPC:', error);
      return null;
    }

    // Récupérer l'enregistrement créé via RPC
    const { data, error: fetchError } = await supabase
      .rpc('get_satisfaction_survey_by_id', { p_id: surveyId });

    if (fetchError || !data) {
      console.error('[SAV] Error fetching created survey:', fetchError);
      return null;
    }

    return transformSurveyFromDB(data);
  } catch (err) {
    console.error('[SAV] Exception in createSatisfactionSurvey:', err);
    return null;
  }
}

export async function updateSurveyImageUrl(
  surveyId: string,
  imageUrl: string
): Promise<boolean> {
  if (!isSupabaseConfigured) return false;

  // Utiliser la fonction RPC pour contourner RLS
  const { data, error } = await supabase
    .rpc('update_survey_image_url', {
      p_survey_id: surveyId,
      p_image_url: imageUrl
    });

  if (error) {
    console.error('[SAV] Error updating survey image URL via RPC:', error);
    return false;
  }

  return data === true;
}

// ====== Stats & Counts ======

export async function getSAVStats(): Promise<SAVStats> {
  if (!isSupabaseConfigured) {
    return {
      totalPending: 0,
      totalCompleted: 0,
      totalInProgress: 0,
      byType: { satisfaction_survey: 0, complaint: 0, incident: 0, follow_up: 0 },
      byPriority: { low: 0, medium: 0, high: 0, urgent: 0 },
      satisfactionAverage: { quality: 0, cleanliness: 0, recommendation: 0 },
    };
  }

  try {
    // Utiliser la fonction RPC pour contourner RLS
    const { data: rpcData, error: rpcError } = await supabase
      .rpc('get_full_sav_stats');

    if (rpcError) {
      console.error('[SAV] Error fetching stats via RPC:', rpcError);
      throw rpcError;
    }

    const data = rpcData || {};

    // Calculer les moyennes de satisfaction
    const surveys = data.surveys || [];
    const calculateAverage = (ratings: string[]) => {
      const scores = ratings.map(r => {
        if (r === 'excellent' || r === 'très_propre' || r === 'oui') return 3;
        if (r === 'bon' || r === 'correctement_propre' || r === 'peut_être') return 2;
        return 1;
      });
      return scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    };

    return {
      totalPending: data.pending || 0,
      totalCompleted: data.completed || 0,
      totalInProgress: data.in_progress || 0,
      byType: data.by_type || { satisfaction_survey: 0, complaint: 0, incident: 0, follow_up: 0 },
      byPriority: { low: 0, medium: 0, high: 0, urgent: 0 }, // À calculer si nécessaire
      satisfactionAverage: {
        quality: calculateAverage(surveys.map((s: any) => s.quality_rating)),
        cleanliness: calculateAverage(surveys.map((s: any) => s.cleanliness_rating)),
        recommendation: calculateAverage(surveys.map((s: any) => s.recommendation_rating)),
      },
    };
  } catch (error) {
    console.error('[SAV] Error fetching stats:', error);
    return {
      totalPending: 0,
      totalCompleted: 0,
      totalInProgress: 0,
      byType: { satisfaction_survey: 0, complaint: 0, incident: 0, follow_up: 0 },
      byPriority: { low: 0, medium: 0, high: 0, urgent: 0 },
      satisfactionAverage: { quality: 0, cleanliness: 0, recommendation: 0 },
    };
  }
}

export async function getCompletedMissionsWithoutSAVCount(): Promise<number> {
  if (!isSupabaseConfigured) return 0;

  // Essayer d'abord avec 'completed'
  let count = 0;
  
  // Utiliser la fonction RPC pour récupérer les mission_id avec SAV
  const { data: savMissionIds, error: rpcError } = await supabase
    .rpc('get_sav_mission_ids');
  
  if (rpcError) {
    console.error('[SAV] Error fetching SAV mission IDs via RPC:', rpcError);
  }
  
  const missionIdsWithSav = (savMissionIds || []).map((r: any) => r.mission_id);
  
  let query = supabase
    .from('missions')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'completed');
  
  if (missionIdsWithSav.length > 0) {
    query = query.not('id', 'in', `(${missionIdsWithSav.join(',')})`);
  }
  
  const { count: completedCount, error } = await query;
  
  if (!error && completedCount) {
    count = completedCount;
  }
  
  // Si 0, essayer avec d'autres statuts possibles
  if (count === 0) {
    const possibleStatuses = ['terminee', 'done', 'finished', 'validated', 'termine', 'fini'];
    
    for (const status of possibleStatuses) {
      let altQuery = supabase
        .from('missions')
        .select('*', { count: 'exact', head: true })
        .eq('status', status);
      
      if (missionIdsWithSav.length > 0) {
        altQuery = altQuery.not('id', 'in', `(${missionIdsWithSav.join(',')})`);
      }
      
      const { count: altCount, error: altError } = await altQuery;
      
      if (!altError && altCount) {
        count += altCount;
      }
    }
  }

  return count;
}

export async function getCompletedMissionsWithoutSAV(): Promise<any[]> {
  if (!isSupabaseConfigured) {
    console.log('[SAV] Supabase not configured');
    return [];
  }

  try {
    // Récupérer les missions qui ont déjà un SAV via RPC
    const { data: savMissionIds, error: rpcError } = await supabase
      .rpc('get_sav_mission_ids');
    
    if (rpcError) {
      console.error('[SAV] Error fetching SAV mission IDs via RPC:', rpcError);
    }

    const missionIdsWithSav = (savMissionIds || []).map((r: any) => r.mission_id);
    console.log('[SAV] Missions with SAV:', missionIdsWithSav.length);

    // Essayer d'abord avec 'completed'
    let completedMissions: any[] = [];
    
    // Requête simplifiée sans jointure
    let query = supabase
      .from('missions')
      .select('*')
      .eq('status', 'completed');

    if (missionIdsWithSav.length > 0) {
      query = query.not('id', 'in', `(${missionIdsWithSav.join(',')})`);
    }

    const { data: completedData, error: completedError } = await query.order('date', { ascending: false });

    if (completedError) {
      console.error('[SAV] Error fetching completed missions:', completedError);
    } else {
      console.log('[SAV] Completed missions found:', completedData?.length || 0);
      completedMissions = completedData || [];
    }

    // Si vide, essayer avec d'autres statuts
    if (completedMissions.length === 0) {
      const possibleStatuses = ['terminee', 'done', 'finished', 'validated', 'termine', 'fini', 'complete', 'terminé'];
      
      for (const status of possibleStatuses) {
        let altQuery = supabase
          .from('missions')
          .select('*')
          .eq('status', status);

        if (missionIdsWithSav.length > 0) {
          altQuery = altQuery.not('id', 'in', `(${missionIdsWithSav.join(',')})`);
        }

        const { data: altData, error: altError } = await altQuery.order('date', { ascending: false });

        if (!altError && altData && altData.length > 0) {
          console.log(`[SAV] Found ${altData.length} missions with status '${status}'`);
          completedMissions = [...completedMissions, ...altData];
        }
      }
    }

    // Éliminer les doublons
    const uniqueMissions = completedMissions.filter((mission, index, self) =>
      index === self.findIndex((m) => m.id === mission.id)
    );

    console.log('[SAV] Total unique missions without SAV:', uniqueMissions.length);
    
    // Si toujours vide, récupérer TOUTES les missions pour déboguer
    if (uniqueMissions.length === 0) {
      const { data: allMissions } = await supabase
        .from('missions')
        .select('id, status, date, client_name')
        .limit(10);
      console.log('[SAV] Sample missions in DB:', allMissions);
    }

    return uniqueMissions;
  } catch (error) {
    console.error('[SAV] Exception in getCompletedMissionsWithoutSAV:', error);
    return [];
  }
}

// ====== Transformers ======

function transformSAVRecordFromDB(data: any): SAVRecord {
  return {
    id: data.id,
    missionId: data.mission_id,
    clientId: data.client_id,
    clientName: data.client_name,
    clientAddress: data.client_address,
    clientPhone: data.client_phone,
    clientEmail: data.client_email,
    missionDate: data.mission_date,
    missionService: data.mission_service,
    packName: data.pack_name,
    providerName: data.provider_name,
    status: data.status,
    savType: data.sav_type,
    description: data.description,
    priority: data.priority,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    createdBy: data.created_by,
    investigatorName: data.investigator_name,
    completedAt: data.completed_at,
  };
}

function transformSurveyFromDB(data: any): SatisfactionSurvey {
  return {
    id: data.id,
    missionId: data.mission_id,
    clientId: data.client_id,
    clientName: data.client_name,
    packName: data.pack_name,
    qualityRating: data.quality_rating,
    cleanlinessRating: data.cleanliness_rating,
    recommendationRating: data.recommendation_rating,
    additionalComments: data.additional_comments,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    createdBy: data.created_by,
    investigatorName: data.investigator_name,
    formImageUrl: data.form_image_url,
  };
}

// ====== Storage ======

export async function uploadSurveyImage(
  surveyId: string,
  imageBlob: Blob
): Promise<string | null> {
  if (!isSupabaseConfigured) return null;

  const fileName = `survey-${surveyId}-${Date.now()}.png`;
  const filePath = `sav/surveys/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(filePath, imageBlob, {
      contentType: 'image/png',
      cacheControl: '3600',
    });

  if (uploadError) {
    console.error('[SAV] Error uploading survey image:', uploadError);
    return null;
  }

  const { data } = supabase.storage.from('documents').getPublicUrl(filePath);

  if (data?.publicUrl) {
    await updateSurveyImageUrl(surveyId, data.publicUrl);
  }

  return data?.publicUrl || null;
}
