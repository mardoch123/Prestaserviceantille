// Types pour le module SAV (Service Après-Vente)

export type SatisfactionRating = 'excellent' | 'bon' | 'a_améliorer';
export type CleanlinessRating = 'très_propre' | 'correctement_propre' | 'à_améliorer';
export type RecommendationRating = 'oui' | 'peut_être' | 'non';

export interface SatisfactionSurvey {
  id: string;
  missionId: string;
  clientId: string;
  clientName: string;
  packName: string;
  
  // Questions du questionnaire
  qualityRating: SatisfactionRating;
  cleanlinessRating: CleanlinessRating;
  recommendationRating: RecommendationRating;
  
  // Informations complémentaires
  additionalComments?: string;
  
  // Métadonnées
  createdAt: string;
  updatedAt: string;
  createdBy: string; // ID de l'enquêteur
  investigatorName: string; // Nom de l'enquêteur
  
  // Image du formulaire générée
  formImageUrl?: string;
}

export interface SAVRecord {
  id: string;
  missionId: string;
  clientId: string;
  clientName: string;
  clientAddress?: string;
  clientPhone?: string;
  clientEmail?: string;
  
  // Informations de la mission
  missionDate: string;
  missionService: string;
  packName: string;
  providerName?: string;
  
  // Statut du SAV
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  
  // Type de SAV
  savType: 'satisfaction_survey' | 'complaint' | 'incident' | 'follow_up';
  
  // Description du problème ou sujet
  description: string;
  
  // Questionnaire de satisfaction (si applicable)
  satisfactionSurvey?: SatisfactionSurvey;
  
  // Actions prises
  actions?: SAVAction[];
  
  // Métadonnées
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  investigatorName: string;
  completedAt?: string;
  
  // Priorité
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

export interface SAVAction {
  id: string;
  savId: string;
  action: string;
  status: 'pending' | 'completed';
  createdAt: string;
  completedAt?: string;
  createdBy: string;
}

export interface CreateSAVInput {
  missionId: string;
  savType: SAVRecord['savType'];
  description: string;
  priority?: SAVRecord['priority'];
}

export interface CreateSatisfactionSurveyInput {
  missionId: string;
  clientId: string;
  clientName: string;
  packName: string;
  qualityRating: SatisfactionRating;
  cleanlinessRating: CleanlinessRating;
  recommendationRating: RecommendationRating;
  additionalComments?: string;
  investigatorName: string;
}

export interface SAVStats {
  totalPending: number;
  totalCompleted: number;
  totalInProgress: number;
  byType: {
    satisfaction_survey: number;
    complaint: number;
    incident: number;
    follow_up: number;
  };
  byPriority: {
    low: number;
    medium: number;
    high: number;
    urgent: number;
  };
  satisfactionAverage: {
    quality: number;
    cleanliness: number;
    recommendation: number;
  };
}

export type SAVFilterType = 'all' | 'satisfaction_survey' | 'complaint' | 'incident' | 'follow_up';
export type SAVFilterStatus = 'all' | 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type SAVFilterPriority = 'all' | 'low' | 'medium' | 'high' | 'urgent';

export interface SAVFilters {
  type: SAVFilterType;
  status: SAVFilterStatus;
  priority: SAVFilterPriority;
  dateFrom?: string;
  dateTo?: string;
  clientName?: string;
}
