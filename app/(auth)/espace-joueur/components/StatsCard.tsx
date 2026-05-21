import React from 'react';
import { LucideIcon } from 'lucide-react';
import { formatNumber } from '../utils/formatters';

interface StatsCardProps {
  title: string;
  value: string | number;
  subValue?: string;
  icon: LucideIcon;
  color?: string;
  trend?: 'up' | 'down' | 'neutral';
}

export const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  subValue,
  icon: Icon,
  color = 'text-red-600',
  trend
}) => {
  const formattedValue = typeof value === 'number' ? formatNumber(value) : value;
  
  const trendColor = {
    up: 'text-green-500',
    down: 'text-red-500',
    neutral: 'text-yellow-500'
  }[trend || 'neutral'];

  return (
    <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-6 hover:border-red-600/50 transition-all group">
      <div className="flex items-start justify-between mb-4">
        <Icon className={`w-5 h-5 ${color} group-hover:scale-110 transition-transform`} />
        {trend && (
          <span className={`text-[8px] font-black uppercase tracking-widest ${trendColor}`}>
            {trend === 'up' && '▲'}
            {trend === 'down' && '▼'}
            {trend === 'neutral' && '●'}
          </span>
        )}
      </div>
      
      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">
        {title}
      </p>
      
      <p className="text-2xl font-black italic text-white mb-1">
        {formattedValue}
      </p>
      
      {subValue && (
        <p className="text-[9px] font-mono text-zinc-600">
          {subValue}
        </p>
      )}
    </div>
  );
};
