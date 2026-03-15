import React, { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle, Info, XCircle, X } from 'lucide-react';
import { triggerHaptic } from '../../hooks/useHaptic';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastOptions {
  message: string;
  type?: ToastType;
  duration?: number;
}

// Store global pour les toasts
let toastListeners: ((toast: Toast) => void)[] = [];

export const showToast = (options: ToastOptions) => {
  const toast: Toast = {
    id: Math.random().toString(36).substr(2, 9),
    message: options.message,
    type: options.type || 'info',
    duration: options.duration || 3000,
  };
  
  toastListeners.forEach(listener => listener(toast));
  
  // Haptic feedback
  if (toast.type === 'success') triggerHaptic('success');
  else if (toast.type === 'error') triggerHaptic('error');
  else triggerHaptic('light');
};

export const toast = {
  success: (message: string, duration?: number) => 
    showToast({ message, type: 'success', duration }),
  error: (message: string, duration?: number) => 
    showToast({ message, type: 'error', duration }),
  warning: (message: string, duration?: number) => 
    showToast({ message, type: 'warning', duration }),
  info: (message: string, duration?: number) => 
    showToast({ message, type: 'info', duration }),
};

const toastIcons = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertCircle,
  info: Info,
};

const toastStyles = {
  success: 'bg-emerald-500 text-white',
  error: 'bg-red-500 text-white',
  warning: 'bg-amber-500 text-white',
  info: 'bg-blue-500 text-white',
};

export const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const handleToast = (newToast: Toast) => {
      setToasts(prev => [...prev, newToast]);
      
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== newToast.id));
      }, newToast.duration);
    };

    toastListeners.push(handleToast);
    return () => {
      toastListeners = toastListeners.filter(l => l !== handleToast);
    };
  }, []);

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none max-w-sm">
      {toasts.map(toast => {
        const Icon = toastIcons[toast.type];
        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg ${toastStyles[toast.type]} backdrop-blur-sm toast-enter`}
            style={{ 
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
              WebkitTapHighlightColor: 'transparent',
              animation: 'slideInRight 0.3s ease-out',
            }}
          >
            <Icon className="w-5 h-5 flex-shrink-0" />
            <p className="flex-1 text-sm font-medium">{toast.message}</p>
            <button 
              onClick={() => removeToast(toast.id)}
              className="p-1 rounded-full hover:bg-white/20 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default ToastContainer;
