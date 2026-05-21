
// app/staff/mode_jeux/components/GameModeButton.tsx
"use client";

import { Target, Users, AlertTriangle } from "lucide-react";
import { GameModeCode } from "../types/game.types";

interface GameModeButtonProps {
  mode: GameModeCode;
  label: string;
  isConnected: boolean;
  selectedLaneId: number | null;
  onSelect: () => void;
  disabled?: boolean;        // ✅ NOUVEAU : pour ULTIMATE
  alertMessage?: string;     // ✅ NOUVEAU : message pour mode désactivé
}

export default function GameModeButton({
  mode,
  label,
  isConnected,
  selectedLaneId,
  onSelect,
  disabled = false,          // ✅ NOUVEAU : valeur par défaut
  alertMessage = "Mode en développement"
}: GameModeButtonProps) {
  
  // ✅ CORRECTION : Extraire le nombre de joueurs selon le mode
  let playerCount = 1;
  
  if (mode.startsWith('L')) {
    // LOISIRS: L5m-1J, L10m-2J, L15m-3J, etc.
    const match = mode.match(/-(\d)J$/);
    playerCount = match ? parseInt(match[1]) : 1;
  } 
  else if (mode.startsWith('P')) {
    // PERSO: P-5m, P-10m, P-15m → toujours 1 joueur
    playerCount = 1;
  }
  else if (mode === 'C-2J') {
    // COMPETITION: 2 joueurs
    playerCount = 2;
  }
  else if (mode === 'N-4J') {
    // NOTORIETE: 4 joueurs
    playerCount = 4;
  }
  else if (mode === 'U-1J') {
    // ULTIMATE: 1 joueur (mais désactivé)
    playerCount = 1;
  }
  else {
    playerCount = 1;
  }
  
  // ✅ CORRECTION : Couleurs par catégorie
  const getCategoryColor = () => {
    if (mode.startsWith('P')) return 'text-cyan-500 border-cyan-500/20';      // PERSO
    if (mode.startsWith('L')) return 'text-blue-500 border-blue-500/20';      // LOISIRS
    if (mode === 'C-2J') return 'text-red-500 border-red-500/20';             // COMPETITION
    if (mode === 'N-4J') return 'text-yellow-500 border-yellow-500/20';       // NOTORIETE
    if (mode === 'U-1J') return 'text-purple-500 border-purple-500/20';       // ULTIMATE
    return 'text-zinc-500';
  };

  // ✅ CORRECTION : Gestion du disabled (connexion + mode désactivé)
  const isDisabled = !isConnected || selectedLaneId === null || disabled;

  // ✅ CORRECTION : Gestion du clic avec alert si mode désactivé
  const handleClick = () => {
    if (disabled) {
      alert(alertMessage);
      return;
    }
    onSelect();
  };

  // ✅ CORRECTION : Tooltip adapté
  const getTooltip = () => {
    if (disabled) return alertMessage;
    if (!isConnected) return "Connexion au serveur requise";
    if (selectedLaneId === null) return "Sélectionnez un couloir";
    return `Lancer ${label}`;
  };

  return (
    <button
      onClick={handleClick}
      disabled={isDisabled}
      className={`
        group relative bg-black border rounded-xl p-4 transition-all 
        disabled:opacity-40 disabled:cursor-not-allowed
        ${getCategoryColor()} hover:border-red-600/50
        text-left w-full
      `}
      title={getTooltip()}
    >
      <div className="flex items-start justify-between mb-3">
        {/* ✅ CORRECTION : Icône différente pour mode désactivé */}
        {disabled ? (
          <AlertTriangle className={`w-4 h-4 text-yellow-500`} />
        ) : (
          <Target className={`w-4 h-4 ${getCategoryColor()} group-hover:scale-110 transition-transform`} />
        )}
        <div className="flex items-center gap-1 text-[8px] font-black uppercase text-zinc-600">
          <Users className="w-3 h-3" />
          <span>{playerCount}J</span>
        </div>
      </div>
      
      <p className="text-xs font-black uppercase tracking-widest text-white mb-1">
        {label}
      </p>
      <p className="text-[8px] font-mono text-zinc-600">
        {mode}
      </p>

      {/* Indicateur de sélection de couloir (uniquement si connecté et non désactivé) */}
      {!isDisabled && !disabled && selectedLaneId !== null && (
        <div className="absolute top-2 right-2">
          <span className="text-[8px] font-black text-green-500">
            ✓ C{selectedLaneId + 1}
          </span>
        </div>
      )}
      
      {/* ✅ CORRECTION : Badge "Bientôt" pour ULTIMATE */}
      {disabled && (
        <div className="absolute top-2 right-2">
          <span className="text-[8px] font-black text-yellow-500 bg-yellow-500/20 px-1.5 py-0.5 rounded">
            Bientôt
          </span>
        </div>
      )}
      
      {/* Effet de survol */}
      <div className="absolute inset-0 rounded-xl bg-red-600/0 group-hover:bg-red-600/5 transition-colors pointer-events-none" />
    </button>
  );
}
