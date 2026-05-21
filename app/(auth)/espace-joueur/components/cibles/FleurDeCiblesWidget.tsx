// app/(auth)/espace-joueur/components/cibles/FleurDeCiblesWidget.tsx

import React from 'react';
import { Crosshair } from 'lucide-react';
import './FleurDeCiblesWidget.css';

// ==========================================
// Types
// ==========================================
interface CibleZoneProps {
  numero: number;
  activeZones: Set<number>; // Indices des zones actives (0-5 pour cible normale, 0-4 pour cible 1)
  size?: number;
  onClick?: () => void;
}

interface FleurDeCiblesWidgetProps {
  stats?: Record<number, {
    perZone: Record<number, number>;
    timeouts: number;
  }>;
  onCibleClick?: (index: number) => void;
  size?: number;
}

// ==========================================
// Constantes (copiées de Flutter)
// ==========================================
// Fractions des cercles (du centre vers l'extérieur)
const ZONE_FRACTIONS = [0.18, 0.32, 0.48, 0.62, 0.76, 0.92, 1.0];

// Points par zone pour cible 1
const POINTS_CIBLE_1 = [250, 200, 150, 100, 0, -1]; // -1 pour timeout

// Points par zone pour autres cibles
const POINTS_CIBLES = [50, 25, 10, 15, 5, 0, -1];

// ==========================================
// Composant : Cible centrale (spéciale)
// ==========================================
const CibleCentrale: React.FC<CibleZoneProps> = ({
  numero,
  activeZones,
  size = 120,
  onClick
}) => {
  const center = size / 2;
  const radius = size * 0.42;
  const outerStrokeWidth = radius * 0.16;
  const innerBlackRadius = radius - outerStrokeWidth / 2;
  const smallRadius = innerBlackRadius * 0.23;

  // Déterminer les classes en fonction de l'activité
  const getZoneClass = (zoneIndex: number, baseClass: string) => {
    return activeZones.has(zoneIndex) ? baseClass : `${baseClass}-inactive`;
  };

  return (
    <div
      className="cible-centrale-container"
      data-size={size}
      onClick={onClick}
      title={`Cible ${numero}`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Zone noire (zone 4) */}
        <circle
          cx={center}
          cy={center}
          r={innerBlackRadius}
          className={getZoneClass(4, 'cible-zone-noire')}
        />
        
        {/* Anneau gris (zone 5 - timeout) */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          className={getZoneClass(5, 'cible-anneau-gris')}
          strokeWidth={outerStrokeWidth}
        />
        
        {/* 3 points bleus (zones 1-3) */}
        {[0, 1, 2].map((i) => {
          const angle = -Math.PI / 2 + i * 2 * Math.PI / 3;
          const cx = center + innerBlackRadius * 0.55 * Math.cos(angle);
          const cy = center + innerBlackRadius * 0.55 * Math.sin(angle);
          const zoneIndex = i + 1;
          
          return (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={smallRadius}
              className={getZoneClass(zoneIndex, 'cible-point-bleu')}
            />
          );
        })}
        
        {/* Point rouge central (zone 0) */}
        <circle
          cx={center}
          cy={center}
          r={smallRadius}
          className={getZoneClass(0, 'cible-point-rouge')}
        />
        
        {/* Numéro de la cible */}
        <text
          x={center}
          y={center}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#ffffff"
          fontSize={radius * 0.35}
          fontWeight="bold"
          className="mix-blend-difference"
        >
          {numero}
        </text>
      </svg>

      {/* Tooltip au survol */}
      <div className="cible-tooltip">
        Cible {numero}
      </div>
    </div>
  );
};

// ==========================================
// Composant : Cible normale (avec anneaux)
// ==========================================
const CibleNormale: React.FC<CibleZoneProps> = ({
  numero,
  activeZones,
  size = 120,
  onClick
}) => {
  const center = size / 2;
  const radius = size * 0.42;

  // Déterminer les classes en fonction de l'activité
  const getZoneClass = (zoneIndex: number, baseClass: string) => {
    return activeZones.has(zoneIndex) ? baseClass : `${baseClass}-inactive`;
  };

  return (
    <div
      className="cible-normale-container"
      data-size={size}
      onClick={onClick}
      title={`Cible ${numero}`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Anneau 0 (rouge) - centre */}
        <circle
          cx={center}
          cy={center}
          r={radius * ZONE_FRACTIONS[0]}
          className={getZoneClass(0, 'cible-anneau-rouge')}
        />
        
        {/* Anneau 1 (bleu) */}
        <circle
          cx={center}
          cy={center}
          r={radius * ZONE_FRACTIONS[1]}
          className={getZoneClass(1, 'cible-anneau-bleu')}
        />
        
        {/* Anneau 2 (rouge) */}
        <circle
          cx={center}
          cy={center}
          r={radius * ZONE_FRACTIONS[2]}
          className={getZoneClass(2, 'cible-anneau-rouge')}
        />
        
        {/* Anneau 3 (bleu) */}
        <circle
          cx={center}
          cy={center}
          r={radius * ZONE_FRACTIONS[3]}
          className={getZoneClass(3, 'cible-anneau-bleu')}
        />
        
        {/* Anneau 4 (rouge) */}
        <circle
          cx={center}
          cy={center}
          r={radius * ZONE_FRACTIONS[4]}
          className={getZoneClass(4, 'cible-anneau-rouge')}
        />
        
        {/* Anneau 5 (noir) */}
        <circle
          cx={center}
          cy={center}
          r={radius * ZONE_FRACTIONS[5]}
          className={getZoneClass(5, 'cible-anneau-noir')}
        />
        
        {/* Anneau 6 (gris - timeout) */}
        <circle
          cx={center}
          cy={center}
          r={radius * ZONE_FRACTIONS[6]}
          className={getZoneClass(6, 'cible-anneau-gris')}
        />
        
        {/* Numéro de la cible */}
        <text
          x={center}
          y={center}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#ffffff"
          fontSize={radius * 0.35}
          fontWeight="bold"
          className="mix-blend-difference"
        >
          {numero}
        </text>
      </svg>

      {/* Tooltip au survol */}
      <div className="cible-tooltip">
        Cible {numero}
      </div>
    </div>
  );
};

// ==========================================
// Fonction utilitaire pour calculer les zones actives
// ==========================================
const computeActiveZones = (
  cibleIndex: number,
  perZone: Record<number, number>,
  timeouts: number
): Set<number> => {
  const zones = new Set<number>();
  
  if (cibleIndex === 1) {
    // Cible 1 : vérifier chaque zone
    for (let i = 0; i < POINTS_CIBLE_1.length; i++) {
      const points = POINTS_CIBLE_1[i];
      if ((perZone[points] || 0) > 0) {
        zones.add(i);
      }
    }
    // Timeout (zone 5)
    if (timeouts > 0) {
      zones.add(5);
    }
  } else {
    // Autres cibles
    for (let i = 0; i < POINTS_CIBLES.length; i++) {
      const points = POINTS_CIBLES[i];
      if ((perZone[points] || 0) > 0) {
        zones.add(i);
      }
    }
    // Timeout (zone 6)
    if (timeouts > 0) {
      zones.add(6);
    }
  }
  
  return zones;
};

// ==========================================
// Composant principal
// ==========================================
export const FleurDeCiblesWidget: React.FC<FleurDeCiblesWidgetProps> = ({
  stats = {},
  onCibleClick,
  size = 400
}) => {
  // Positions des cibles (comme dans le widget Flutter)
  const radius = size * 0.06; // rayon visuel de chaque cible
  const crossRadius = radius * 3.2; // 4 en croix
  const circleRadius = radius * 6.4; // 8 en cercle
  const center = size / 2;

  const positions = [
    // Centre (cible 1)
    { x: center, y: center },
    
    // Anneau intérieur (cibles 2-5)
    { x: center, y: center - crossRadius }, // haut
    { x: center + crossRadius, y: center }, // droite
    { x: center, y: center + crossRadius }, // bas
    { x: center - crossRadius, y: center }, // gauche
    
    // Anneau extérieur (cibles 6-13) - ordre spécifique
    { x: center, y: center - circleRadius }, // haut
    { x: center + circleRadius * 0.7, y: center - circleRadius * 0.7 }, // haut-droite
    { x: center + circleRadius, y: center }, // droite
    { x: center + circleRadius * 0.7, y: center + circleRadius * 0.7 }, // bas-droite
    { x: center, y: center + circleRadius }, // bas
    { x: center - circleRadius * 0.7, y: center + circleRadius * 0.7 }, // bas-gauche
    { x: center - circleRadius, y: center }, // gauche
    { x: center - circleRadius * 0.7, y: center - circleRadius * 0.7 }, // haut-gauche
  ];

  // Numéros des cibles dans l'ordre des positions
  const numeros = [1, 2, 3, 4, 5, 12, 13, 6, 7, 8, 9, 10, 11];

  return (
    <div className="fleur-cibles-widget-container">
      
      {/* Lignes de connexion */}
      <svg className="fleur-cibles-lignes">
        <line className="fleur-cibles-ligne" x1="50%" y1="50%" x2="50%" y2={`${(center - crossRadius) / size * 100}%`} />
        <line className="fleur-cibles-ligne" x1="50%" y1="50%" x2={`${(center + crossRadius) / size * 100}%`} y2="50%" />
        <line className="fleur-cibles-ligne" x1="50%" y1="50%" x2="50%" y2={`${(center + crossRadius) / size * 100}%`} />
        <line className="fleur-cibles-ligne" x1="50%" y1="50%" x2={`${(center - crossRadius) / size * 100}%`} y2="50%" />
      </svg>

      {/* Cibles */}
      {positions.map((pos, index) => {
        const cibleNum = numeros[index];
        const cibleStat = stats[cibleNum - 1] || { perZone: {}, timeouts: 0 };
        const activeZones = computeActiveZones(cibleNum, cibleStat.perZone, cibleStat.timeouts);
        
        const Component = cibleNum === 1 ? CibleCentrale : CibleNormale;
        
        return (
          <div
            key={cibleNum}
            className="cible-position"
            data-left={pos.x - radius}
            data-top={pos.y - radius}
            data-width={radius * 2}
            data-height={radius * 2}
            onClick={() => onCibleClick?.(cibleNum)}
          >
            <Component
              numero={cibleNum}
              activeZones={activeZones}
              size={radius * 2}
            />
          </div>
        );
      })}

      {/* Titre */}
      <div className="fleur-cibles-titre">
        <Crosshair className="w-4 h-4 text-red-600" />
        <span className="fleur-cibles-titre-texte">
          ZONES DES CIBLES TIRÉES
        </span>
      </div>

      {/* Légende des couleurs */}
      <div className="fleur-cibles-legende">
        <div className="fleur-cibles-legende-item">
          <div className="fleur-cibles-legende-couleur rouge" />
          <span>Zone rouge</span>
        </div>
        <div className="fleur-cibles-legende-item">
          <div className="fleur-cibles-legende-couleur bleu" />
          <span>Zone bleue</span>
        </div>
        <div className="fleur-cibles-legende-item">
          <div className="fleur-cibles-legende-couleur noir" />
          <span>Zone noire (0 pt)</span>
        </div>
        <div className="fleur-cibles-legende-item">
          <div className="fleur-cibles-legende-couleur gris" />
          <span>Timeout</span>
        </div>
      </div>
    </div>
  );
};
