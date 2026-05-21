import React from 'react';

interface CibleSimpleProps {
  numero: number;
  zones?: Record<number, number>;
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
}

export const CibleSimple: React.FC<CibleSimpleProps> = ({
  numero,
  zones = {},
  onClick,
  size = 'md'
}) => {
  const sizeClasses = {
    sm: 'w-12 h-12 text-[8px]',
    md: 'w-16 h-16 text-[10px]',
    lg: 'w-24 h-24 text-xs'
  };

  // Déterminer si une zone a été touchée
  const hasHits = Object.values(zones).some(v => v > 0);

  // Déterminer si c'est la cible spéciale (numéro 1)
  const isSpecial = numero === 1;

  return (
    <div
      onClick={onClick}
      className={`
        relative ${sizeClasses[size]} 
        rounded-full border-2 
        ${hasHits ? 'border-red-600' : 'border-zinc-800'}
        bg-zinc-950 flex items-center justify-center
        cursor-pointer transition-all hover:scale-110
        group
      `}
      title={`Cible ${numero}${isSpecial ? ' (spéciale)' : ''}`}
      role="button"
      tabIndex={0}
      aria-label={`Cible ${numero}`}
    >
      {/* Anneaux de la cible - version simplifiée mais reconnaissable */}
      
      {/* Anneau extérieur (gris pour timeout) */}
      <div className={`absolute inset-0 rounded-full border-2 ${hasHits ? 'border-red-600/50' : 'border-zinc-800'}`} />
      
      {/* Anneaux concentriques */}
      <div className="absolute inset-[15%] rounded-full border border-zinc-800" />
      <div className="absolute inset-[30%] rounded-full border border-zinc-800" />
      <div className="absolute inset-[45%] rounded-full border border-zinc-800" />
      
      {/* Centre - rouge si touches, sinon gris */}
      <div className={`absolute inset-[35%] rounded-full ${hasHits ? 'bg-red-600/30' : 'bg-zinc-800/30'}`} />
      
      {/* Pour la cible spéciale (n°1), ajouter 3 petits points bleus */}
      {isSpecial && (
        <>
          <div className="absolute top-[15%] left-[35%] w-[15%] h-[15%] rounded-full bg-blue-600/50" />
          <div className="absolute top-[15%] right-[35%] w-[15%] h-[15%] rounded-full bg-blue-600/50" />
          <div className="absolute bottom-[25%] left-1/2 -translate-x-1/2 w-[15%] h-[15%] rounded-full bg-blue-600/50" />
        </>
      )}
      
      {/* Numéro de la cible */}
      <span className="relative z-10 font-black text-white mix-blend-difference">
        {numero}
      </span>
      
      {/* Badge d'activité */}
      {hasHits && (
        <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-600 rounded-full animate-pulse" />
      )}

      {/* Tooltip au survol */}
      <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-zinc-900 border border-zinc-800 px-2 py-1 rounded text-[8px] font-black uppercase opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-20">
        Cible {numero}
        {isSpecial && <span className="text-red-600 ml-1">★</span>}
      </div>
    </div>
  );
};
