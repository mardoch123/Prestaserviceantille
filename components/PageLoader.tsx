import React from 'react';

interface PageLoaderProps {
  message?: string;
}

const PageLoader: React.FC<PageLoaderProps> = ({ message = 'Chargement des données…' }) => (
  <div className="flex flex-col items-center justify-center h-full min-h-[300px] gap-4 text-slate-500">
    <div className="w-10 h-10 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
    <p className="text-sm font-medium">{message}</p>
  </div>
);

export default PageLoader;
