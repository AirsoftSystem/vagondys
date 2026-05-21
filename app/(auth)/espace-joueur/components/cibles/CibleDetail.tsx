import React from 'react';
import { X, Target, Clock, Crosshair, Activity } from 'lucide-react';
import { ZONE_COLORS, POINTS_CIBLE_1, POINTS_CIBLES } from './types';
import './CibleDetail.css';

interface CibleDetailProps {
  numero: number;
  stats: {
    total: number;
    timeouts: number;
    perZone: Record<number, number>;
  };
  onClose: () => void;
}

export const CibleDetail: React.FC<CibleDetailProps> = ({
  numero,
  stats,
  onClose
}) => {
  const isSpecial = numero === 1;
  const pointsList = isSpecial ? POINTS_CIBLE_1 : POINTS_CIBLES;
  const totalTirs = stats.total || 0;
  const timeouts = stats.timeouts || 0;
  const tirsReussis = totalTirs - timeouts;

  // Calcul du pourcentage de précision
  const precision = totalTirs > 0 ? ((tirsReussis / totalTirs) * 100).toFixed(1) : '0.0';

  // Fonction pour obtenir la classe de couleur
  const getProgressBarColor = (points: number) => {
    if (points === -1) return 'progress-bar-zinc';
    if (points === 0) return 'progress-bar-black';
    if (points <= 5) return 'progress-bar-orange';
    if (points <= 10) return 'progress-bar-yellow';
    if (points <= 15) return 'progress-bar-green';
    if (points <= 25) return 'progress-bar-blue';
    if (points <= 50) return 'progress-bar-blue';
    if (points <= 100) return 'progress-bar-cyan';
    if (points <= 150) return 'progress-bar-purple';
    if (points <= 200) return 'progress-bar-cyan';
    if (points <= 250) return 'progress-bar-purple';
    return 'progress-bar-red';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95 backdrop-blur-md">
      <div className="bg-zinc-950 border border-zinc-800 w-full max-w-4xl rounded-3xl overflow-hidden shadow-2xl">
        
        {/* En-tête */}
        <div className="bg-zinc-900/50 p-6 border-b border-zinc-800 flex justify-between items-start">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Target className="w-5 h-5 text-red-600" />
              <span className="text-red-600 font-black uppercase tracking-[0.3em] text-[10px]">
                ANALYSE DÉTAILLÉE
              </span>
            </div>
            <h2 className="text-4xl font-black italic uppercase text-white leading-none">
              CIBLE {numero}
              {isSpecial && <span className="text-red-600 text-2xl ml-3">• SPÉCIALE</span>}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="cible-detail-close-btn"
            title="Fermer la fenêtre"
            aria-label="Fermer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Corps */}
        <div className="p-6 grid md:grid-cols-2 gap-8">
          
          {/* Colonne gauche - Visualisation */}
          <div className="space-y-6">
            <div className="bg-black border border-zinc-900 rounded-2xl p-8 flex items-center justify-center">
              <div className="relative w-64 h-64">
                {/* Représentation simplifiée de la cible */}
                <div className="absolute inset-0 rounded-full border-4 border-zinc-800" />
                <div className="absolute inset-[15%] rounded-full border-4 border-zinc-800" />
                <div className="absolute inset-[30%] rounded-full border-4 border-zinc-800" />
                <div className="absolute inset-[45%] rounded-full border-4 border-zinc-800" />
                
                {/* Centre (pour cible spéciale) */}
                {isSpecial && (
                  <div className="absolute inset-[35%] rounded-full bg-red-600/20 border-2 border-red-600" />
                )}
                
                {/* Pour la cible spéciale, ajouter 3 points bleus */}
                {isSpecial && (
                  <>
                    <div className="absolute top-[15%] left-[35%] w-[10%] h-[10%] rounded-full bg-blue-600/50" />
                    <div className="absolute top-[15%] right-[35%] w-[10%] h-[10%] rounded-full bg-blue-600/50" />
                    <div className="absolute bottom-[25%] left-1/2 -translate-x-1/2 w-[10%] h-[10%] rounded-full bg-blue-600/50" />
                  </>
                )}
                
                {/* Numéro */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-6xl font-black text-white mix-blend-difference">
                    {numero}
                  </span>
                </div>
              </div>
            </div>

            {/* Stats globales */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-black border border-zinc-900 rounded-xl p-4 text-center">
                <Clock className="w-4 h-4 text-zinc-600 mx-auto mb-2" />
                <p className="text-[8px] font-black uppercase text-zinc-600">TOTAL TIRS</p>
                <p className="text-2xl font-black text-white">{totalTirs}</p>
              </div>
              <div className="bg-black border border-zinc-900 rounded-xl p-4 text-center">
                <Activity className="w-4 h-4 text-zinc-600 mx-auto mb-2" />
                <p className="text-[8px] font-black uppercase text-zinc-600">PRÉCISION</p>
                <p className="text-2xl font-black text-green-500">{precision}%</p>
              </div>
            </div>
          </div>

          {/* Colonne droite - Détail des zones */}
          <div className="space-y-6">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2">
              <Crosshair size={14} className="text-red-600" />
              RÉPARTITION PAR ZONE
            </h3>

            {/* Liste des zones */}
            <div className="space-y-3 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
              {pointsList.map((points) => {
                const count = stats.perZone[points] || 0;
                const percentage = totalTirs > 0 ? ((count / totalTirs) * 100).toFixed(1) : '0.0';
                const zoneColor = ZONE_COLORS[points] || ZONE_COLORS[0];
                const progressColor = getProgressBarColor(points);
                
                return (
                  <div key={points} className="bg-black border border-zinc-900 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${zoneColor.bg}`} />
                        <span className="text-[10px] font-black uppercase">
                          {points === 0 ? 'RATÉ' : `${points} PTS`}
                        </span>
                      </div>
                      <span className="text-sm font-black text-white">{count}</span>
                    </div>
                    
                    {/* Barre de progression */}
                    <div className="progress-bar-container">
                      <div 
                        className={`progress-bar ${progressColor}`}
                        data-width={`${percentage}%`}
                      />
                    </div>
                    
                    <div className="flex justify-between mt-1 text-[8px] font-mono text-zinc-600">
                      <span>{percentage}%</span>
                      <span>{count} tirs</span>
                    </div>
                  </div>
                );
              })}

              {/* Timeout */}
              <div className="bg-black border border-zinc-900 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-zinc-700" />
                    <span className="text-[10px] font-black uppercase">TIMEOUT</span>
                  </div>
                  <span className="text-sm font-black text-white">{timeouts}</span>
                </div>
                
                <div className="progress-bar-container">
                  <div 
                    className="progress-bar progress-bar-zinc"
                    data-width={totalTirs > 0 ? `${(timeouts / totalTirs) * 100}%` : '0%'}
                  />
                </div>
                
                <div className="flex justify-between mt-1 text-[8px] font-mono text-zinc-600">
                  <span>{totalTirs > 0 ? ((timeouts / totalTirs) * 100).toFixed(1) : '0'}%</span>
                  <span>{timeouts} tirs</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Pied */}
        <div className="bg-black border-t border-zinc-900 p-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-3 bg-red-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white hover:text-black transition-all"
            title="Fermer la fenêtre"
            aria-label="Fermer"
          >
            FERMER
          </button>
        </div>
      </div>
    </div>
  );
};
