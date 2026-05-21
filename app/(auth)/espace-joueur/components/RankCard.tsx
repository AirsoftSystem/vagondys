import React from 'react';
import { Award, AlertTriangle } from 'lucide-react';

interface RankCardProps {
  rank: string;
  stars: number;
  maxStars: number;
  progress: number;
  demotionRule?: string;
}

export const RankCard: React.FC<RankCardProps> = ({
  rank,
  stars,
  maxStars,
  progress,
  demotionRule
}) => {
  const progressPercent = Math.round(progress * 100);

  return (
    <div className="bg-zinc-950 border border-zinc-900 rounded-3xl p-8 relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
        <Award size={120} className="text-red-600" />
      </div>
      
      <div className="flex items-start gap-6">
        <div className="w-24 h-24 bg-red-600/10 border border-red-600/30 rounded-2xl flex items-center justify-center">
          <Award size={48} className="text-red-600" />
        </div>
        
        <div className="flex-1">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">
            GRADE ACTUEL
          </p>
          <h2 className="text-3xl font-black italic text-white uppercase tracking-tighter mb-2">
            {rank}
          </h2>
          
          {/* Étoiles */}
          <div className="flex items-center gap-1 mb-4">
            {Array.from({ length: maxStars }).map((_, i) => (
              <svg
                key={i}
                className={`w-4 h-4 ${i < stars ? 'text-yellow-500' : 'text-zinc-700'}`}
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            ))}
          </div>
          
          {/* Progression - avec data-progress attribute */}
          <div className="space-y-2">
            <div className="flex justify-between text-[8px] font-bold uppercase">
              <span className="text-zinc-500">Progression vers prochain grade</span>
              <span className="text-white">{progressPercent}%</span>
            </div>
            <div className="w-full h-1 bg-zinc-900 rounded-full overflow-hidden">
              <div 
                className="h-full bg-red-600 rounded-full transition-all duration-300 rank-progress-bar"
                data-progress={progressPercent}
              />
            </div>
          </div>
        </div>
      </div>
      
      {/* Règles de démotion */}
      {demotionRule && demotionRule !== "Aucune" && (
        <div className="mt-6 pt-4 border-t border-zinc-900 flex items-center gap-2 text-[8px] font-bold uppercase">
          <AlertTriangle size={10} className="text-yellow-600" />
          <span className="text-zinc-600">Démotion : {demotionRule}</span>
        </div>
      )}
    </div>
  );
};
