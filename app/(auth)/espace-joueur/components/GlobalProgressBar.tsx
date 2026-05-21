import React from 'react';
import './GlobalProgressBar.css';

interface Grade {
  id: number;
  name: string;
  maxStars: number;
}

interface GlobalProgressBarProps {
  grades: Grade[];
  currentGradeId: number;
  precisionProgress: number;
  currentGradeMaxStars: number;
}

export const GlobalProgressBar: React.FC<GlobalProgressBarProps> = ({
  grades,
  currentGradeId,
  precisionProgress,
  currentGradeMaxStars
}) => {
  // Calculer le nombre total d'étoiles
  const totalStars = grades.reduce((sum, g) => sum + g.maxStars, 0);
  
  // Calculer les étoiles avant le grade actuel
  let starsBefore = 0;
  for (const g of grades) {
    if (g.id === currentGradeId) break;
    starsBefore += g.maxStars;
  }
  
  // Étoiles complétées dans le grade actuel
  const completedInGrade = precisionProgress * currentGradeMaxStars;
  
  // Pourcentage total de progression (basé sur le nombre d'étoiles)
  const percent = Math.min((starsBefore + completedInGrade) / totalStars, 1);
  const progressPercent = Math.round(percent * 100);

  // Calculer les pourcentages pour chaque grade (proportionnel au nombre d'étoiles)
  const getGradePercentages = () => {
    return grades.map(g => (g.maxStars / totalStars) * 100);
  };

  // Calculer les positions cumulées en pourcentage
  const getCumulativePercentages = () => {
    const cumulative: number[] = [];
    let sum = 0;
    for (const g of grades) {
      sum += (g.maxStars / totalStars) * 100;
      cumulative.push(sum);
    }
    return cumulative;
  };

  const gradePercentages = getGradePercentages();
  const cumulativePercentages = getCumulativePercentages();

  return (
    <div className="global-progress-container">
      <div className="global-progress-header">
        <p className="global-progress-title">
          PROGRESSION GLOBALE
        </p>
        <p className="global-progress-grade">
          Grade {currentGradeId}/{grades.length}
        </p>
      </div>
      
      <div className="global-progress-bar-wrapper">
        {/* Barre de progression */}
        <div 
          className="global-progress-fill"
          data-progress={progressPercent}
        />
        
        {/* Séparateurs de grades dans la barre - positionnés en pourcentage */}
        <div className="global-progress-separators">
          {grades.map((g, idx) => (
            <div
              key={g.id}
              className="global-progress-separator"
              data-percent={gradePercentages[idx]}
              data-cumulative={cumulativePercentages[idx]}
              data-index={idx}
              data-width={gradePercentages[idx]}
            >
              {/* Trait vertical de séparation entre les grades */}
              {idx < grades.length - 1 && (
                <div className="global-progress-separator-line" />
              )}
            </div>
          ))}
        </div>
        
        {/* Texte centré */}
        <div className="global-progress-text">
          <span className="global-progress-percent">
            {progressPercent}%
          </span>
        </div>
      </div>
    </div>
  );
};
