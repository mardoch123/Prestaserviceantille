import { useEffect, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

interface SearchSelectionState {
  selectedItemId?: string;
  selectedItemType?: string;
  selectedItemData?: any;
}

interface UseSearchSelectionOptions<T> {
  onSelectItem?: (id: string, data: T) => void;
  clearOnNavigate?: boolean;
}

/**
 * Hook to handle search result selection
 * Listens for both navigation state and custom events from GlobalSearchBar
 */
export function useSearchSelection<T = any>(options: UseSearchSelectionOptions<T> = {}) {
  const location = useLocation();
  const navigate = useNavigate();
  const [selectedItem, setSelectedItem] = useState<{ id: string; data: T } | null>(null);

  const clearSelection = useCallback(() => {
    setSelectedItem(null);
    // Clear the state from URL to prevent re-triggering on refresh
    if (location.state?.selectedItemId) {
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);

  useEffect(() => {
    // Handle navigation state (from GlobalSearchBar navigate)
    const state = location.state as SearchSelectionState;
    if (state?.selectedItemId && state?.selectedItemData) {
      setSelectedItem({
        id: state.selectedItemId,
        data: state.selectedItemData
      });
      
      if (options.onSelectItem) {
        options.onSelectItem(state.selectedItemId, state.selectedItemData);
      }

      // Clear state after processing if requested
      if (options.clearOnNavigate !== false) {
        navigate(location.pathname, { replace: true, state: {} });
      }
    }
  }, [location, navigate, options]);

  useEffect(() => {
    // Listen for custom search-select events
    const handleSearchSelect = (event: CustomEvent) => {
      const { id, type, data } = event.detail || {};
      if (id && data) {
        setSelectedItem({ id, data });
        if (options.onSelectItem) {
          options.onSelectItem(id, data);
        }
      }
    };

    window.addEventListener('search-select', handleSearchSelect as EventListener);
    return () => {
      window.removeEventListener('search-select', handleSearchSelect as EventListener);
    };
  }, [options]);

  return {
    selectedItem,
    clearSelection,
    setSelectedItem
  };
}

export default useSearchSelection;
