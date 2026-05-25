import React, { createContext, useContext, useReducer, ReactNode, useCallback } from 'react';
import { Provider, Mission } from '../../types';
import dayjs from 'dayjs';
import { getMartiniqueNow } from '../utils/dayjsMartinique';
import { 
  getPrestatairesDisponibles, 
  getPrestationsOfDay, 
  getProviderDayInfo,
  getAllBillingStatuses,
  getDayColorStatus,
  BillingStatus,
  ProviderDayInfo
} from '../utils/planningDataLayer';

interface PlanningState {
  currentDate: dayjs.Dayjs;
  selectedProviderId: string | null;
  mode: 'new' | 'old';
  loading: boolean;
  error: string | null;
  closedDays: Set<string>;
  pendingWhatsAppMessages: number;
}

type PlanningAction =
  | { type: 'SET_DATE'; payload: dayjs.Dayjs }
  | { type: 'SET_SELECTED_PROVIDER'; payload: string | null }
  | { type: 'SET_MODE'; payload: 'new' | 'old' }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'TOGGLE_CLOSED_DAY'; payload: string }
  | { type: 'SET_PENDING_MESSAGES'; payload: number }
  | { type: 'RESET' };

const initialState: PlanningState = {
  currentDate: getMartiniqueNow(),
  selectedProviderId: null,
  mode: 'new',
  loading: false,
  error: null,
  closedDays: new Set(),
  pendingWhatsAppMessages: 0,
};

const planningReducer = (state: PlanningState, action: PlanningAction): PlanningState => {
  switch (action.type) {
    case 'SET_DATE':
      return { ...state, currentDate: action.payload, selectedProviderId: null };
    case 'SET_SELECTED_PROVIDER':
      return { ...state, selectedProviderId: action.payload };
    case 'SET_MODE':
      return { ...state, mode: action.payload };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'TOGGLE_CLOSED_DAY': {
      const newClosedDays = new Set(state.closedDays);
      if (newClosedDays.has(action.payload)) {
        newClosedDays.delete(action.payload);
      } else {
        newClosedDays.add(action.payload);
      }
      return { ...state, closedDays: newClosedDays };
    }
    case 'SET_PENDING_MESSAGES':
      return { ...state, pendingWhatsAppMessages: action.payload };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
};

interface PlanningContextValue {
  state: PlanningState;
  dispatch: React.Dispatch<PlanningAction>;
  actions: {
    changerJour: (date: dayjs.Dayjs | string) => void;
    basculerMode: () => void;
    cloturerJour: (providerId: string) => void;
    rouvrirJour: (providerId: string) => void;
    setSelectedProvider: (providerId: string | null) => void;
    setLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;
    incrementPendingMessages: () => void;
    decrementPendingMessages: () => void;
  };
  computed: {
    getAvailableProviders: (providers: Provider[]) => Provider[];
    getDayMissions: (missions: Mission[]) => Mission[];
    getProviderInfo: (provider: Provider, missions: Mission[]) => ProviderDayInfo;
    getBillingStatuses: (missions: Mission[]) => BillingStatus[];
    getDayColor: (providerId: string, missions: Mission[]) => string;
    isDayClosed: (providerId: string) => boolean;
  };
}

const PlanningContext = createContext<PlanningContextValue | undefined>(undefined);

interface PlanningProviderProps {
  children: ReactNode;
}

export const PlanningProvider: React.FC<PlanningProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(planningReducer, initialState);

  const actions = {
    changerJour: useCallback((date: dayjs.Dayjs | string) => {
      const newDate = typeof date === 'string' ? dayjs(date) : date;
      dispatch({ type: 'SET_DATE', payload: newDate });
    }, []),

    basculerMode: useCallback(() => {
      dispatch({ type: 'SET_MODE', payload: state.mode === 'new' ? 'old' : 'new' });
    }, [state.mode]),

    cloturerJour: useCallback((providerId: string) => {
      const key = `${providerId}-${state.currentDate.format('YYYY-MM-DD')}`;
      dispatch({ type: 'TOGGLE_CLOSED_DAY', payload: key });
    }, [state.currentDate]),

    rouvrirJour: useCallback((providerId: string) => {
      const key = `${providerId}-${state.currentDate.format('YYYY-MM-DD')}`;
      dispatch({ type: 'TOGGLE_CLOSED_DAY', payload: key });
    }, [state.currentDate]),

    setSelectedProvider: useCallback((providerId: string | null) => {
      dispatch({ type: 'SET_SELECTED_PROVIDER', payload: providerId });
    }, []),

    setLoading: useCallback((loading: boolean) => {
      dispatch({ type: 'SET_LOADING', payload: loading });
    }, []),

    setError: useCallback((error: string | null) => {
      dispatch({ type: 'SET_ERROR', payload: error });
    }, []),

    incrementPendingMessages: useCallback(() => {
      dispatch({ type: 'SET_PENDING_MESSAGES', payload: state.pendingWhatsAppMessages + 1 });
    }, [state.pendingWhatsAppMessages]),

    decrementPendingMessages: useCallback(() => {
      dispatch({ type: 'SET_PENDING_MESSAGES', payload: Math.max(0, state.pendingWhatsAppMessages - 1) });
    }, [state.pendingWhatsAppMessages]),
  };

  const computed = {
    getAvailableProviders: useCallback((providers: Provider[]) => {
      return getPrestatairesDisponibles(providers, state.currentDate);
    }, [state.currentDate]),

    getDayMissions: useCallback((missions: Mission[]) => {
      return getPrestationsOfDay(missions, state.currentDate);
    }, [state.currentDate]),

    getProviderInfo: useCallback((provider: Provider, missions: Mission[]) => {
      return getProviderDayInfo(provider, missions, state.currentDate);
    }, [state.currentDate]),

    getBillingStatuses: useCallback((missions: Mission[]) => {
      return getAllBillingStatuses(missions);
    }, []),

    getDayColor: useCallback((providerId: string, missions: Mission[]) => {
      return getDayColorStatus(providerId, missions, state.currentDate, state.closedDays);
    }, [state.currentDate, state.closedDays]),

    isDayClosed: useCallback((providerId: string) => {
      const key = `${providerId}-${state.currentDate.format('YYYY-MM-DD')}`;
      return state.closedDays.has(key);
    }, [state.currentDate, state.closedDays]),
  };

  return (
    <PlanningContext.Provider value={{ state, dispatch, actions, computed }}>
      {children}
    </PlanningContext.Provider>
  );
};

export const usePlanning = (): PlanningContextValue => {
  const context = useContext(PlanningContext);
  if (!context) {
    throw new Error('usePlanning must be used within a PlanningProvider');
  }
  return context;
};

export const usePlanningState = () => {
  const { state } = usePlanning();
  return state;
};

export const usePlanningActions = () => {
  const { actions } = usePlanning();
  return actions;
};

export const usePlanningComputed = () => {
  const { computed } = usePlanning();
  return computed;
};
