/**
 * Composant Image robuste avec fallback pour connexions lentes
 * Gère automatiquement les timeouts et erreurs de chargement
 */

import React, { useState, useEffect, useCallback } from 'react';

interface SafeImageProps {
  src: string;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
  fallbackSrc?: string;
  placeholder?: React.ReactNode;
  onLoad?: () => void;
  onError?: () => void;
  timeout?: number;
  retryCount?: number;
}

// Logo Presta Services en SVG inline (pas besoin de serveur externe)
const PRESTA_LOGO_SVG = `data:image/svg+xml;base64,${btoa(`
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="60" viewBox="0 0 200 60">
  <rect width="200" height="60" fill="#0d9488"/>
  <text x="100" y="35" text-anchor="middle" font-family="system-ui" font-size="16" fill="white" font-weight="bold">
    PRESTA SERVICES
  </text>
</svg>
`)}`;

// Logo SAP en SVG inline
const SAP_LOGO_SVG = `data:image/svg+xml;base64,${btoa(`
<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60">
  <rect width="60" height="60" fill="#0d9488"/>
  <text x="30" y="38" text-anchor="middle" font-family="system-ui" font-size="20" fill="white" font-weight="bold">SAP</text>
</svg>
`)}`;

const DEFAULT_FALLBACK = `data:image/svg+xml;base64,${btoa(`
<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
  <rect width="100" height="100" fill="#f3f4f6"/>
  <text x="50" y="45" text-anchor="middle" font-family="system-ui" font-size="12" fill="#9ca3af">
    Image
  </text>
  <text x="50" y="60" text-anchor="middle" font-family="system-ui" font-size="10" fill="#9ca3af">
    indisponible
  </text>
</svg>
`)}`;

export const SafeImage: React.FC<SafeImageProps> = ({
  src,
  alt,
  className = '',
  style,
  fallbackSrc = DEFAULT_FALLBACK,
  placeholder,
  onLoad,
  onError,
  timeout = 10000,
  retryCount = 2,
}) => {
  const [currentSrc, setCurrentSrc] = useState<string>(src);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const [isTimedOut, setIsTimedOut] = useState(false);

  // Réessayer avec délai exponentiel
  const retry = useCallback(() => {
    if (retryAttempt < retryCount) {
      setTimeout(() => {
        setRetryAttempt(prev => prev + 1);
        setIsLoading(true);
        setHasError(false);
        setIsTimedOut(false);
        // Ajouter un paramètre pour éviter le cache
        setCurrentSrc(`${src}${src.includes('?') ? '&' : '?'}_retry=${Date.now()}`);
      }, Math.pow(2, retryAttempt) * 1000);
    } else {
      setHasError(true);
      setCurrentSrc(fallbackSrc);
      onError?.();
    }
  }, [src, fallbackSrc, retryAttempt, retryCount, onError]);

  useEffect(() => {
    setCurrentSrc(src);
    setIsLoading(true);
    setHasError(false);
    setRetryAttempt(0);
    setIsTimedOut(false);
  }, [src]);

  useEffect(() => {
    if (!src || hasError) return;

    // Timeout pour détecter les images bloquées
    const timer = setTimeout(() => {
      if (isLoading) {
        setIsTimedOut(true);
        retry();
      }
    }, timeout);

    return () => clearTimeout(timer);
  }, [src, isLoading, timeout, retry]);

  const handleLoad = () => {
    setIsLoading(false);
    setHasError(false);
    onLoad?.();
  };

  const handleError = () => {
    setIsLoading(false);
    retry();
  };

  // Si erreur définitive, afficher le fallback
  if (hasError && !isLoading) {
    return (
      <div 
        className={`${className} bg-gray-100 flex items-center justify-center`}
        style={style}
        title={alt}
      >
        <img
          src={fallbackSrc}
          alt={alt}
          className="w-full h-full object-contain opacity-50"
        />
      </div>
    );
  }

  return (
    <div className={`relative ${className}`} style={style}>
      {/* Placeholder pendant le chargement */}
      {isLoading && placeholder && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
          {placeholder}
        </div>
      )}
      
      {/* Indicateur de retry */}
      {retryAttempt > 0 && isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50/80">
          <span className="text-xs text-gray-500">
            Retry {retryAttempt}/{retryCount}...
          </span>
        </div>
      )}

      <img
        src={currentSrc}
        alt={alt}
        className={`${className} ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
        style={style}
        onLoad={handleLoad}
        onError={handleError}
        loading="lazy"
        decoding="async"
      />
    </div>
  );
};

// Hook pour précharger les images avec gestion d'erreur
export function useImagePreloader() {
  const preload = useCallback((src: string, timeout = 5000): Promise<boolean> => {
    return new Promise((resolve) => {
      const img = new Image();
      const timer = setTimeout(() => {
        resolve(false);
      }, timeout);

      img.onload = () => {
        clearTimeout(timer);
        resolve(true);
      };

      img.onerror = () => {
        clearTimeout(timer);
        resolve(false);
      };

      img.src = src;
    });
  }, []);

  return { preload };
}

// Composant Logo spécifique avec cache local
export const LogoImage: React.FC<{ className?: string; variant?: 'normal' | 'sap' }> = ({ 
  className = '', 
  variant = 'normal' 
}) => {
  const logoSrc = variant === 'sap' ? SAP_LOGO_SVG : PRESTA_LOGO_SVG;

  return (
    <SafeImage
      src={logoSrc}
      alt="Presta Services Antilles"
      className={className}
      timeout={1000}
      retryCount={0}
      fallbackSrc={PRESTA_LOGO_SVG}
    />
  );
};

export default SafeImage;
