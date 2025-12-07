import React from 'react';
import { StatCardProps } from '../types';

const StatCard: React.FC<StatCardProps> = ({ title, value, subtext, bgColor = 'bg-slate-100', icon: Icon, onClick }) => {
  return (
    <div 
      onClick={onClick}
      className={`${bgColor} p-6 rounded-xl shadow-sm border border-slate-100 flex flex-col justify-center items-center text-center h-32 transition-transform hover:scale-105 ${onClick ? 'cursor-pointer hover:shadow-md ring-offset-2 focus:ring-2' : ''}`}
    >
      {Icon && (
        <div className="mb-2 p-2 rounded-full bg-white/40 text-slate-700 shadow-sm">
          <Icon className="w-5 h-5 opacity-80" />
        </div>
      )}
      <h3 className="font-bold text-slate-800 text-sm mb-1">{title}</h3>
      {value && <p className="text-xl font-bold text-brand-blue">{value}</p>}
      {subtext && <p className="text-xs text-slate-500 mt-1 italic">{subtext}</p>}
    </div>
  );
};

export default StatCard;