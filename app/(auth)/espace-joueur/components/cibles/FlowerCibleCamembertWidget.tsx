// app/(auth)/espace-joueur/components/cibles/FlowerCibleCamembertWidget.tsx

import React from 'react';
import { Crosshair } from 'lucide-react';
import './FlowerCibleCamembertWidget.css';

// ==========================================
// Types
// ==========================================
interface CibleCamembertProps {
  numero: number;
  values: number[]; // Pourcentages par zone (6 ou 5 zones selon cible)
  size?: number;
}

interface FlowerCibleCamembertWidgetProps {
  stats?: Record<number, number[]>; // [cibleIndex][zoneIndex] = pourcentage
  onCibleClick?: (index: number) => void;
  showWordCible?: boolean;
}

// ==========================================
// Palette de couleurs (identique au Flutter)
// ==========================================
const ZONE_COLORS: Record<number, string> = {
  0: '#E53935',      // Rouge (raté)
  5: '#FFA726',      // Orange
  10: '#FFF176',     // Jaune
  15: '#43A047',     // Vert
  25: '#90CAF9',     // Bleu clair
  50: '#1E88E5',     // Bleu
  100: '#00BCD4',    // Cyan
  150: '#E040FB',    // Magenta
  200: '#00BCD4',    // Cyan
  250: '#8E24AA',    // Violet
};

const TIMEOUT_COLOR = '#757575'; // Gris pour Timeout

// ==========================================
// Points par cible (identique au Flutter)
// ==========================================
const POINTS_CIBLE_1 = [250, 200, 150, 100, 0];
const POINTS_CIBLES = [50, 25, 15, 10, 5, 0];

// ==========================================
// Composant : Camembert individuel
// ==========================================
const CibleCamembert: React.FC<CibleCamembertProps> = ({
  numero,
  values,
  size = 120
}) => {
  const isCible1 = numero === 1;
  const points = isCible1 ? POINTS_CIBLE_1 : POINTS_CIBLES;
  const center = size / 2;
  const radius = size * 0.35;
  const innerRadius = size * 0.15;

  // Filtrer les valeurs pour n'avoir que celles > 0
  const activeParts = values
    .map((val, idx) => ({ val, idx, points: idx < points.length ? points[idx] : -1 }))
    .filter(part => part.val > 0);

  // Si aucune valeur active, afficher un cercle gris
  if (activeParts.length === 0) {
    return (
      <div
        className="cible-camembert-container"
        data-size={size}
        title={`Cible ${numero}`}
        onClick={() => {}}
      >
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle
            cx={center}
            cy={center}
            r={radius}
            className="cible-camembert-fond"
          />
          <text
            x={center}
            y={center}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#ffffff"
            fontSize={size * 0.2}
            fontWeight="bold"
          >
            {numero}
          </text>
        </svg>
      </div>
    );
  }

  // Calcul des angles pour le camembert
  let startAngle = 0;
  const parts = [];

  for (let i = 0; i < activeParts.length; i++) {
    const part = activeParts[i];
    const angle = (part.val / 100) * 360;
    const endAngle = startAngle + angle;
    
    // Conversion en radians
    const startRad = (startAngle - 90) * Math.PI / 180;
    const endRad = (endAngle - 90) * Math.PI / 180;
    
    // Calcul des points pour le chemin SVG
    const x1 = center + radius * Math.cos(startRad);
    const y1 = center + radius * Math.sin(startRad);
    const x2 = center + radius * Math.cos(endRad);
    const y2 = center + radius * Math.sin(endRad);
    
    const largeArcFlag = angle > 180 ? 1 : 0;
    
    // Déterminer la couleur
    let color;
    if (part.points === -1) {
      color = TIMEOUT_COLOR;
    } else {
      color = ZONE_COLORS[part.points] || '#FFFFFF';
    }
    
    // Chemin SVG pour la portion
    const path = [
      `M ${center} ${center}`,
      `L ${x1} ${y1}`,
      `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
      'Z'
    ].join(' ');
    
    parts.push(
      <path
        key={i}
        d={path}
        fill={color}
        stroke="#18181b"
        strokeWidth="1"
      />
    );
    
    startAngle = endAngle;
  }

  return (
    <div
      className="cible-camembert-container group"
      data-size={size}
      title={`Cible ${numero}`}
      onClick={() => {}}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Fond */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          className="cible-camembert-fond"
        />
        
        {/* Parts du camembert */}
        {parts}
        
        {/* Cercle intérieur */}
        <circle
          cx={center}
          cy={center}
          r={innerRadius}
          className="cible-camembert-centre"
        />
        
        {/* Numéro de la cible */}
        <text
          x={center}
          y={center}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#ffffff"
          fontSize={size * 0.2}
          fontWeight="bold"
          className="mix-blend-difference"
        >
          {numero}
        </text>
      </svg>
      
      {/* Tooltip au survol */}
      <div className="cible-camembert-tooltip">
        Cible {numero}
      </div>
    </div>
  );
};

// ==========================================
// Composant principal : Fleur de cibles
// ==========================================
export const FlowerCibleCamembertWidget: React.FC<FlowerCibleCamembertWidgetProps> = ({
  stats = {},
  onCibleClick,
  showWordCible = false
}) => {
  // Générer des données par défaut si aucune stats fournie
  const defaultStats: Record<number, number[]> = {};
  for (let i = 0; i < 13; i++) {
    defaultStats[i] = i === 0 
      ? Array(POINTS_CIBLE_1.length + 1).fill(0) // 5 zones + timeout
      : Array(POINTS_CIBLES.length + 1).fill(0);  // 6 zones + timeout
  }
  
  const effectiveStats = { ...defaultStats, ...stats };

  // Positions des cibles (en pourcentages du conteneur)
  const positions = [
    // Centre (cible 1)
    { top: '50%', left: '50%' },
    
    // Anneau intérieur (cibles 2-5)
    { top: '30%', left: '50%' }, // haut
    { top: '50%', left: '70%' }, // droite
    { top: '70%', left: '50%' }, // bas
    { top: '50%', left: '30%' }, // gauche
    
    // Anneau extérieur (cibles 6-13)
    { top: '20%', left: '50%' }, // haut
    { top: '30%', left: '70%' }, // haut-droite
    { top: '50%', left: '80%' }, // droite
    { top: '70%', left: '70%' }, // bas-droite
    { top: '80%', left: '50%' }, // bas
    { top: '70%', left: '30%' }, // bas-gauche
    { top: '50%', left: '20%' }, // gauche
    { top: '30%', left: '30%' }, // haut-gauche
  ];

  // Tailles des cibles (plus petites pour la fleur)
  const cibleSize = 80;

  // Fonction pour obtenir la classe de couleur en fonction des points
  const getColorClass = (points: number): string => {
    switch(points) {
      case 250: return 'couleur-250';
      case 200: return 'couleur-200';
      case 150: return 'couleur-150';
      case 100: return 'couleur-100';
      case 50: return 'couleur-50';
      case 25: return 'couleur-25';
      case 15: return 'couleur-15';
      case 10: return 'couleur-10';
      case 5: return 'couleur-5';
      case 0: return 'couleur-0';
      default: return 'couleur-timeout';
    }
  };

  return (
    <div className="flower-cibles-container">
      
      {/* Lignes de connexion (effet de fleur) */}
      <svg className="flower-cibles-lignes">
        {/* Lignes vers l'anneau intérieur */}
        <line className="flower-cibles-ligne" x1="50%" y1="50%" x2="50%" y2="30%" />
        <line className="flower-cibles-ligne" x1="50%" y1="50%" x2="70%" y2="50%" />
        <line className="flower-cibles-ligne" x1="50%" y1="50%" x2="50%" y2="70%" />
        <line className="flower-cibles-ligne" x1="50%" y1="50%" x2="30%" y2="50%" />
        
        {/* Lignes vers l'anneau extérieur */}
        <line className="flower-cibles-ligne" x1="50%" y1="30%" x2="50%" y2="20%" />
        <line className="flower-cibles-ligne" x1="70%" y1="50%" x2="80%" y2="50%" />
        <line className="flower-cibles-ligne" x1="50%" y1="70%" x2="50%" y2="80%" />
        <line className="flower-cibles-ligne" x1="30%" y1="50%" x2="20%" y2="50%" />
        
        <line className="flower-cibles-ligne" x1="30%" y1="30%" x2="30%" y2="70%" />
        <line className="flower-cibles-ligne" x1="70%" y1="30%" x2="70%" y2="70%" />
      </svg>

      {/* Cibles positionnées */}
      {positions.map((pos, index) => {
        const cibleNum = index + 1;
        
        return (
          <div
            key={cibleNum}
            className="flower-cibles-position"
            data-top={pos.top}
            data-left={pos.left}
            onClick={() => onCibleClick?.(cibleNum)}
          >
            <CibleCamembert
              numero={cibleNum}
              values={effectiveStats[index] || []}
              size={cibleSize}
            />
          </div>
        );
      })}

      {/* Titre */}
      <div className="flower-cibles-titre">
        <Crosshair className="w-4 h-4 text-red-600" />
        <span className="flower-cibles-titre-texte">
          {showWordCible ? 'POURCENTAGE DE CIBLES' : 'ANALYSE DES 13 CIBLES'}
        </span>
      </div>

      {/* Légende des couleurs (en bas) */}
      <div className="flower-cibles-legende">
        <div className="flower-cibles-legende-item">
          <div className={`flower-cibles-legende-couleur ${getColorClass(250)}`} />
          <span>250</span>
        </div>
        <div className="flower-cibles-legende-item">
          <div className={`flower-cibles-legende-couleur ${getColorClass(200)}`} />
          <span>200</span>
        </div>
        <div className="flower-cibles-legende-item">
          <div className={`flower-cibles-legende-couleur ${getColorClass(150)}`} />
          <span>150</span>
        </div>
        <div className="flower-cibles-legende-item">
          <div className={`flower-cibles-legende-couleur ${getColorClass(100)}`} />
          <span>100</span>
        </div>
        <div className="flower-cibles-legende-item">
          <div className={`flower-cibles-legende-couleur ${getColorClass(50)}`} />
          <span>50</span>
        </div>
        <div className="flower-cibles-legende-item">
          <div className={`flower-cibles-legende-couleur ${getColorClass(25)}`} />
          <span>25</span>
        </div>
        <div className="flower-cibles-legende-item">
          <div className={`flower-cibles-legende-couleur ${getColorClass(15)}`} />
          <span>15</span>
        </div>
        <div className="flower-cibles-legende-item">
          <div className={`flower-cibles-legende-couleur ${getColorClass(10)}`} />
          <span>10</span>
        </div>
        <div className="flower-cibles-legende-item">
          <div className={`flower-cibles-legende-couleur ${getColorClass(5)}`} />
          <span>5</span>
        </div>
        <div className="flower-cibles-legende-item">
          <div className={`flower-cibles-legende-couleur ${getColorClass(0)}`} />
          <span>0</span>
        </div>
        <div className="flower-cibles-legende-item">
          <div className="flower-cibles-legende-couleur couleur-timeout" />
          <span>T.O.</span>
        </div>
      </div>
    </div>
  );
};
