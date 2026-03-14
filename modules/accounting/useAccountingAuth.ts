// Accounting Module - Auth Hook for Code Protection
// This module provides secure access to accounting features

import { useState, useEffect, useCallback } from 'react';

// Secure accounting access code - In production, this should come from environment variables
const ACCOUNTING_ACCESS_CODE = 'COMPTA2024!';
const SESSION_STORAGE_KEY = 'accounting_auth_session';
const SESSION_DURATION_MS = 1000 * 60 * 60; // 1 hour session

interface AuthSession {
  authenticated: boolean;
  expiresAt: number | null;
}

export interface AccountingAuthState {
  isAuthenticated: boolean;
  authenticate: (code: string) => boolean;
  logout: () => void;
  error: string | null;
  clearError: () => void;
  sessionTimeLeft: number | null;
}

export function useAccountingAuth(): AccountingAuthState {
  const [authState, setAuthState] = useState<AuthSession>(() => {
    try {
      const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (stored) {
        const parsed: AuthSession = JSON.parse(stored);
        if (parsed.expiresAt && parsed.expiresAt > Date.now()) {
          return parsed;
        }
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
      }
    } catch {
      // Ignore storage errors
    }
    return { authenticated: false, expiresAt: null };
  });

  const [error, setError] = useState<string | null>(null);

  // Update session time left for UI display
  const [sessionTimeLeft, setSessionTimeLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!authState.authenticated || !authState.expiresAt) {
      setSessionTimeLeft(null);
      return;
    }

    const updateTimeLeft = () => {
      const left = authState.expiresAt! - Date.now();
      if (left <= 0) {
        logout();
        return;
      }
      setSessionTimeLeft(left);
    };

    updateTimeLeft();
    const interval = setInterval(updateTimeLeft, 1000);
    return () => clearInterval(interval);
  }, [authState]);

  const authenticate = useCallback((code: string): boolean => {
    if (code === ACCOUNTING_ACCESS_CODE) {
      const expiresAt = Date.now() + SESSION_DURATION_MS;
      const newState: AuthSession = { authenticated: true, expiresAt };
      setAuthState(newState);
      setError(null);
      try {
        sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(newState));
      } catch {
        // Ignore storage errors
      }
      return true;
    }
    setError('Code d\'accès incorrect. Veuillez réessayer.');
    return false;
  }, []);

  const logout = useCallback(() => {
    setAuthState({ authenticated: false, expiresAt: null });
    setSessionTimeLeft(null);
    try {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    isAuthenticated: authState.authenticated,
    authenticate,
    logout,
    error,
    clearError,
    sessionTimeLeft,
  };
}

// Format milliseconds to readable time
export function formatTimeLeft(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}
