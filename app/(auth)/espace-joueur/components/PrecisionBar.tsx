import React from 'react';
import './PrecisionBar.css';

interface PrecisionBarProps {
  value: number;
  seuilBas: number;
  seuilHaut: number;
  nbTirs: number;
  maxTirs?: number;
}

export const PrecisionBar: React.FC<PrecisionBarProps> = ({
  value,
  seuilBas,
  seuilHaut,
  nbTirs,
  maxTirs = 100
}) => {
  const percent = Math.min(value / 100, 1);
  const positionPercent = Math.round(percent * 100);
  
  const getPrecisionColorClass = () => {
    if (value < seuilBas) return 'text-precision-low';
    if (value <= seuilHaut) return 'text-precision-mid';
    return 'text-precision-high';
  };

  return (
    <div className="precision-bar-container">
      <div className="precision-bar-header">
        <p className="precision-bar-title">
          PRÉCISION DU CYCLE
        </p>
        <p className="precision-bar-tirs">
          {nbTirs}/{maxTirs} tirs
        </p>
      </div>
      
      <div className="precision-bar-wrapper">
        {/* Dégradé de fond */}
        <div className="precision-bar-gradient" />
        
        {/* Marqueur de position */}
        <div 
          className="precision-bar-marker"
          data-position={`${positionPercent}%`}
        />
        
        {/* Marqueurs de seuils */}
        <div 
          className="precision-bar-seuil"
          data-position={`${seuilBas}%`}
        />
        <div 
          className="precision-bar-seuil"
          data-position={`${seuilHaut}%`}
        />
        
        {/* Texte centré */}
        <div className="precision-bar-text">
          <span className="precision-bar-value">
            {value.toFixed(1)}%
          </span>
        </div>
      </div>
      
      <div className="precision-bar-legend">
        <span>Seuil bas • {seuilBas}%</span>
        <span className={getPrecisionColorClass()}>Actuel • {value.toFixed(1)}%</span>
        <span>Seuil haut • {seuilHaut}%</span>
      </div>
    </div>
  );
};
