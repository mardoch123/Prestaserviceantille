import React from 'react';
import { Construction } from 'lucide-react';

const ComingSoon: React.FC<{ title: string }> = ({ title }) => {
  return (
    <div className="p-8 h-full flex flex-col items-center justify-center text-slate-400">
      <Construction className="w-16 h-16 mb-4 text-brand-orange opacity-50" />
      <h2 className="text-2xl font-bold text-slate-600 mb-2">{title}</h2>
      <p>Cette section est en cours de développement.</p>
    </div>
  );
};

export default ComingSoon;