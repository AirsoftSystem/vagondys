// app/(auth)/espace-joueur/components/ScoreChart.tsx

import React from 'react';
import { MatchRecord } from '../types';
import { TrendingUp } from 'lucide-react';
import './ScoreChart.css';

interface ScoreChartProps {
  history: MatchRecord[];
  maxPoints?: number;
}

export const ScoreChart: React.FC<ScoreChartProps> = ({ 
  history, 
  maxPoints = 1200 
}) => {
  // Prendre les 10 dernières parties
  const recentHistory = [...history].slice(-10);
  
  if (recentHistory.length === 0) {
    return (
      <div className="score-chart-empty">
        <div className="score-chart-empty-content">
          <TrendingUp className="w-5 h-5 text-zinc-700" />
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600">
            ÉVOLUTION DES SCORES
          </p>
        </div>
        <div className="score-chart-empty-message">
          <p className="score-chart-empty-text">
            Aucune donnée d&apos;historique
          </p>
        </div>
      </div>
    );
  }

  // Calculer le score max pour l'échelle
  const maxScore = Math.max(...recentHistory.map(m => m.score), maxPoints);

  return (
    <div className="score-chart-container">
      <div className="score-chart-header">
        <div className="score-chart-title">
          <TrendingUp className="w-4 h-4 text-red-600" />
          <p className="score-chart-title-text">
            ÉVOLUTION DES SCORES
          </p>
        </div>
        <p className="score-chart-subtitle">
          10 DERNIÈRES PARTIES
        </p>
      </div>
      
      <div className="score-chart-wrapper">
        {/* Grille de fond */}
        <div className="score-chart-grid">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="score-chart-grid-line" />
          ))}
        </div>
        
        {/* Barres du graphique */}
        <div className="score-chart-bars">
          {recentHistory.map((match, idx) => {
            const height = Math.round((match.score / maxScore) * 100);
            const date = new Date(match.date);
            
            return (
              <div key={idx} className="score-chart-bar-wrapper">
                {/* Barre */}
                <div 
                  className="score-chart-bar score-chart-bar-minheight"
                  data-height={`${height}%`}
                >
                  {/* Tooltip */}
                  <div className="score-chart-tooltip">
                    {match.score} pts
                  </div>
                </div>
                
                {/* Date */}
                <span className="score-chart-date">
                  {date.getDate()}/{date.getMonth() + 1}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Légende */}
      <div className="score-chart-legend">
        <span>Score moyen: {Math.round(recentHistory.reduce((acc, m) => acc + m.score, 0) / recentHistory.length)} pts</span>
        <span>Meilleur: {Math.max(...recentHistory.map(m => m.score))} pts</span>
      </div>
    </div>
  );
};
