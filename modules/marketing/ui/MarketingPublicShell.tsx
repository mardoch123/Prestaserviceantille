import React from 'react';
import { ArrowLeft } from 'lucide-react';

type Props = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  logoUrl?: string | null;
  brandName?: string | null;
  rightActions?: React.ReactNode;
  children: React.ReactNode;
  maxWidthClassName?: string;
};

const MarketingPublicShell: React.FC<Props> = ({
  title,
  subtitle,
  onBack,
  logoUrl,
  brandName,
  rightActions,
  children,
  maxWidthClassName,
}) => {
  return (
    <div className="min-h-screen bg-cream-50 font-sans">
      <div className={(maxWidthClassName || 'max-w-5xl') + ' mx-auto px-4 py-6'}>
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              {onBack ? (
                <button
                  onClick={onBack}
                  className="inline-flex items-center gap-2 text-sm font-bold text-slate-700 hover:text-slate-900"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Retour
                </button>
              ) : (
                <div />
              )}
            </div>

            <div className="flex-1 flex flex-col items-center text-center">
              {logoUrl ? (
                <div className="w-full flex items-center justify-center">
                  <img src={logoUrl} alt="Logo" className="h-12 sm:h-14 w-auto object-contain" />
                </div>
              ) : null}
              {brandName ? <div className="mt-1 text-xs font-extrabold text-slate-700">{brandName}</div> : null}
              <h1 className="mt-2 text-xl sm:text-2xl font-extrabold text-slate-800 leading-snug">{title}</h1>
              {subtitle ? <div className="text-sm text-slate-600 mt-1">{subtitle}</div> : null}
            </div>

            <div className="flex items-center justify-end gap-2 min-w-[48px]">
              {rightActions ? <div className="hidden sm:flex items-center gap-2">{rightActions}</div> : null}
            </div>
          </div>

          {rightActions ? <div className="flex sm:hidden items-center justify-center gap-2">{rightActions}</div> : null}

          <div>{children}</div>
        </div>
      </div>
    </div>
  );
};

export default MarketingPublicShell;
