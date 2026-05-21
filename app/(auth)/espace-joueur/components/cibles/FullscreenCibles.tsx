import React, { useState } from 'react';
import { ArrowLeft, Maximize2, Grid3x3 } from 'lucide-react';
import { CibleDetail } from './CibleDetail';
import { FlowerCibleCamembertWidget } from './FlowerCibleCamembertWidget';
import { FleurDeCiblesWidget } from './FleurDeCiblesWidget';
import './FullscreenCibles.css';

interface FullscreenCiblesProps {
  stats: Record<number, {
    total: number;
    timeouts: number;
    perZone: Record<number, number>;
  }>;
  onClose: () => void;
}

export const FullscreenCibles: React.FC<FullscreenCiblesProps> = ({
  stats,
  onClose
}) => {
  const [selectedCible, setSelectedCible] = useState<number | null>(null);
  const [zoomMode, setZoomMode] = useState<'fleur' | 'grille'>('fleur');
  const [visualisationMode, setVisualisationMode] = useState<'camembert' | 'zones'>('camembert');

  // Calcul du pourcentage de précision pour une cible
  const getPrecisionWidth = (cibleStat: { total: number; timeouts: number }) => {
    if (cibleStat.total === 0) return '0%';
    const precision = ((cibleStat.total - (cibleStat.timeouts || 0)) / cibleStat.total) * 100;
    return `${Math.round(precision)}%`;
  };

  // Convertir les stats pour FlowerCibleCamembertWidget
  const getCamembertStats = () => {
    const camembertStats: Record<number, number[]> = {};
    for (let i = 0; i < 13; i++) {
      const cibleStat = stats[i];
      if (!cibleStat) {
        camembertStats[i] = [];
        continue;
      }
      
      // Calculer les pourcentages par zone
      const total = cibleStat.total;
      if (total === 0) {
        camembertStats[i] = [];
      } else {
        const values: number[] = [];
        // Pour cible 1 (spéciale) : 5 zones + timeout
        if (i === 0) {
          const points = [250, 200, 150, 100, 0];
          points.forEach(pt => {
            values.push(((cibleStat.perZone[pt] || 0) / total) * 100);
          });
          values.push((cibleStat.timeouts / total) * 100); // timeout
        } else {
          // Autres cibles : 6 zones + timeout
          const points = [50, 25, 15, 10, 5, 0];
          points.forEach(pt => {
            values.push(((cibleStat.perZone[pt] || 0) / total) * 100);
          });
          values.push((cibleStat.timeouts / total) * 100); // timeout
        }
        camembertStats[i] = values;
      }
    }
    return camembertStats;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      
      {/* Barre de contrôle */}
      <div className="bg-zinc-950 border-b border-zinc-900 px-6 py-4 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors text-[10px] font-black uppercase tracking-widest"
            title="Retour à l'espace joueur"
            aria-label="Retour"
          >
            <ArrowLeft size={16} />
            RETOUR
          </button>
          <div className="w-px h-4 bg-zinc-900" />
          <h1 className="text-sm font-black uppercase tracking-widest text-white">
            ANALYSE DES CIBLES
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {/* Bouton pour changer le mode de visualisation */}
          <button
            onClick={() => setVisualisationMode(visualisationMode === 'camembert' ? 'zones' : 'camembert')}
            className="flex items-center gap-2 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-[9px] font-black uppercase tracking-widest text-zinc-400 hover:text-white transition-all"
            title={visualisationMode === 'camembert' ? 'Voir les zones' : 'Voir les camemberts'}
            aria-label={visualisationMode === 'camembert' ? 'Vue zones' : 'Vue camemberts'}
          >
            {visualisationMode === 'camembert' ? 'Zones' : 'Camemberts'}
          </button>
          
          {/* Bouton pour changer le mode d'affichage (fleur/grille) */}
          <button
            onClick={() => setZoomMode(zoomMode === 'fleur' ? 'grille' : 'fleur')}
            className="flex items-center gap-2 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-[9px] font-black uppercase tracking-widest text-zinc-400 hover:text-white transition-all"
            title={zoomMode === 'fleur' ? 'Voir en grille' : 'Voir en fleur'}
            aria-label={zoomMode === 'fleur' ? 'Vue grille' : 'Vue fleur'}
          >
            {zoomMode === 'fleur' ? <Grid3x3 size={14} /> : <Maximize2 size={14} />}
            {zoomMode === 'fleur' ? 'Vue Grille' : 'Vue Fleur'}
          </button>
        </div>
      </div>

      {/* Contenu */}
      <div className="flex-1 overflow-auto p-8">
        <div className="max-w-7xl mx-auto">
          
          {/* Mode d'affichage - Fleur */}
          {zoomMode === 'fleur' && (
            <div className="relative">
              {visualisationMode === 'camembert' ? (
                <FlowerCibleCamembertWidget
                  stats={getCamembertStats()}
                  onCibleClick={(num) => setSelectedCible(num)}
                  showWordCible={true}
                />
              ) : (
                <FleurDeCiblesWidget
                  stats={stats}
                  onCibleClick={(num) => setSelectedCible(num)}
                />
              )}
              
              {/* Légende (conservée) */}
              <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4 text-[8px] font-black uppercase">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-600 rounded-full" />
                  <span className="text-zinc-500">Zone centrale (250 pts)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-600 rounded-full" />
                  <span className="text-zinc-500">Anneaux bleus</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-black border border-zinc-700 rounded-full" />
                  <span className="text-zinc-500">Zone noire (0 pt)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-zinc-700 rounded-full" />
                  <span className="text-zinc-500">Timeout</span>
                </div>
              </div>
            </div>
          )}

          {/* Mode d'affichage - Grille */}
          {zoomMode === 'grille' && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 13 }).map((_, i) => {
                const cibleNum = i + 1;
                const cibleStat = stats[i] || { total: 0, timeouts: 0, perZone: {} };
                
                return (
                  <button
                    key={cibleNum}
                    onClick={() => setSelectedCible(cibleNum)}
                    className="bg-zinc-950 border border-zinc-900 rounded-2xl p-6 hover:border-red-600/50 transition-all group text-left"
                    title={`Voir le détail de la cible ${cibleNum}`}
                    aria-label={`Cible ${cibleNum}`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-2xl font-black text-white">#{cibleNum}</span>
                      {cibleNum === 1 && (
                        <span className="text-[8px] font-black uppercase text-red-600 border border-red-600/30 px-2 py-1 rounded">
                          SPÉCIALE
                        </span>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between text-[9px]">
                        <span className="text-zinc-600">Tirs</span>
                        <span className="text-white font-mono">{cibleStat.total}</span>
                      </div>
                      <div className="flex justify-between text-[9px]">
                        <span className="text-zinc-600">Timeouts</span>
                        <span className="text-red-500 font-mono">{cibleStat.timeouts}</span>
                      </div>
                      <div className="cible-progress-bar">
                        <div 
                          className="cible-progress-bar-fill"
                          data-width={getPrecisionWidth(cibleStat)}
                        />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal de détail */}
      {selectedCible !== null && (
        <CibleDetail
          numero={selectedCible}
          stats={stats[selectedCible - 1] || { total: 0, timeouts: 0, perZone: {} }}
          onClose={() => setSelectedCible(null)}
        />
      )}
    </div>
  );
};
