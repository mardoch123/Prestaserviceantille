import React from 'react';

interface PageLoaderProps {
  message?: string;
}

const PageLoader: React.FC<PageLoaderProps> = ({ message = 'Chargement des données…' }) => (
  <div className="flex flex-col items-center justify-center h-full min-h-[300px] gap-4 text-slate-500">
    <div className="w-full max-w-md px-6">
      <div className="animate-pulse space-y-3">
        <div className="h-5 bg-slate-200 rounded w-2/3 mx-auto" />
        <div className="h-10 bg-slate-200 rounded" />
        <div className="h-10 bg-slate-200 rounded" />
        <div className="h-10 bg-slate-200 rounded" />
      </div>
    </div>
    <p className="text-sm font-medium">{message}</p>
  </div>
);

export default PageLoader;
