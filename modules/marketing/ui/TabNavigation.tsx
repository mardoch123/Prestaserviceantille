import React, { useState } from 'react';
import { cn } from '../../../lib/utils';

interface Tab {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  badge?: number;
}

interface TabNavigationProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  variant?: 'default' | 'pills' | 'underline';
  className?: string;
}

export const TabNavigation: React.FC<TabNavigationProps> = ({
  tabs,
  activeTab,
  onTabChange,
  variant = 'default',
  className,
}) => {
  const variants = {
    default: {
      container: 'bg-white rounded-2xl shadow-sm border border-slate-100 p-1.5',
      tab: (isActive: boolean) =>
        cn(
          'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-extrabold transition-all duration-200',
          isActive
            ? 'bg-brand-blue text-white shadow-md'
            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
        ),
    },
    pills: {
      container: 'flex gap-2',
      tab: (isActive: boolean) =>
        cn(
          'flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-extrabold transition-all duration-200',
          isActive
            ? 'bg-brand-orange text-white shadow-lg shadow-brand-orange/30'
            : 'bg-white text-slate-600 border border-slate-200 hover:border-brand-orange/50 hover:text-brand-orange'
        ),
    },
    underline: {
      container: 'border-b border-slate-200',
      tab: (isActive: boolean) =>
        cn(
          'flex items-center gap-2 px-4 py-3 text-sm font-extrabold transition-all duration-200 relative',
          isActive
            ? 'text-brand-blue'
            : 'text-slate-500 hover:text-slate-700'
        ),
    },
  };

  const currentVariant = variants[variant];

  return (
    <div className={cn(currentVariant.container, className)}>
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        const Icon = tab.icon;

        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={currentVariant.tab(isActive)}
          >
            {Icon && <Icon className={cn('w-4 h-4', isActive ? 'text-current' : 'text-slate-400')} />}
            <span>{tab.label}</span>
            {tab.badge !== undefined && tab.badge > 0 && (
              <span
                className={cn(
                  'ml-1 px-2 py-0.5 text-xs rounded-full',
                  isActive
                    ? 'bg-white/20 text-white'
                    : 'bg-brand-orange text-white'
                )}
              >
                {tab.badge > 99 ? '99+' : tab.badge}
              </span>
            )}
            {variant === 'underline' && isActive && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-blue rounded-full" />
            )}
          </button>
        );
      })}
    </div>
  );
};

interface TabPanelProps {
  children: React.ReactNode;
  className?: string;
}

export const TabPanel: React.FC<TabPanelProps> = ({ children, className }) => {
  return (
    <div className={cn('animate-in fade-in slide-in-from-bottom-2 duration-300', className)}>
      {children}
    </div>
  );
};

export default TabNavigation;
