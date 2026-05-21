import React from 'react';
import { CibleSimple } from './CibleSimple';
import { Crosshair } from 'lucide-react';
import './FleurCibles.css';

interface FleurCiblesProps {
  stats?: Record<number, { perZone: Record<number, number> }>;
  onCibleClick?: (index: number) => void;
}

export const FleurCibles: React.FC<FleurCiblesProps> = ({
  stats = {},
  onCibleClick
}) => {
  return (
    <div className="fleur-cibles-container">
      {/* Lignes de connexion */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        <line x1="50%" y1="50%" x2="50%" y2="30%" stroke="#27272a" strokeWidth="1" strokeDasharray="4 4" />
        <line x1="50%" y1="50%" x2="70%" y2="50%" stroke="#27272a" strokeWidth="1" strokeDasharray="4 4" />
        <line x1="50%" y1="50%" x2="50%" y2="70%" stroke="#27272a" strokeWidth="1" strokeDasharray="4 4" />
        <line x1="50%" y1="50%" x2="30%" y2="50%" stroke="#27272a" strokeWidth="1" strokeDasharray="4 4" />
      </svg>

      {/* Cibles avec positions CSS pures */}
      {Array.from({ length: 13 }).map((_, index) => {
        const cibleNum = index + 1;
        
        return (
          <div
            key={cibleNum}
            className={`cible-position cible-position-${cibleNum}`}
          >
            <CibleSimple
              numero={cibleNum}
              zones={stats[index]?.perZone}
              onClick={() => onCibleClick?.(cibleNum)}
              size="sm"
            />
          </div>
        );
      })}

      {/* Titre */}
      <div className="cible-titre">
        <Crosshair className="w-4 h-4 text-red-600" />
        <span className="text-[8px] font-black uppercase tracking-widest text-zinc-500">
          ANALYSE DES 13 CIBLES
        </span>
      </div>
    </div>
  );
};
