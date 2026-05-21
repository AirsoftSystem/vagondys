
// app/staff/mode_jeux/components/GameModeSection.tsx
"use client";

import { GameCategory, GameModeCode } from "../types/game.types";
import GameModeButton from "./GameModeButton";

// ✅ Définition locale du type LoisirsLevel puisqu'il n'est pas exporté par game.types.ts
interface LoisirsLevel {
  distance: string;
  modes: GameModeCode[];
}

interface GameModeSectionProps {
  category: GameCategory;
  levels?: LoisirsLevel[];
  modes?: GameModeCode[];
  isConnected: boolean;
  selectedLaneId: number | null;
  onSelectMode: (mode: GameModeCode) => void;
  disabled?: boolean;        // ✅ NOUVEAU : pour ULTIMATE
  alertMessage?: string;     // ✅ NOUVEAU : message pour mode désactivé
}

export default function GameModeSection({
  category,
  levels,
  modes,
  isConnected,
  selectedLaneId,
  onSelectMode,
  disabled = false,          // ✅ NOUVEAU : valeur par défaut
  alertMessage = "Mode en développement"  // ✅ NOUVEAU : message par défaut
}: GameModeSectionProps) {

  const getCategoryColor = () => {
    switch(category) {
      case 'PERSO': return 'text-cyan-500 border-cyan-500/20 bg-cyan-500/5';
      case 'LOISIRS': return 'text-blue-500 border-blue-500/20 bg-blue-500/5';
      case 'COMPETITION': return 'text-red-500 border-red-500/20 bg-red-500/5';
      case 'NOTORIETE': return 'text-yellow-500 border-yellow-500/20 bg-yellow-500/5';
      case 'ULTIMATE': return 'text-purple-500 border-purple-500/20 bg-purple-500/5';
      default: return 'text-zinc-500 border-zinc-500/20 bg-zinc-500/5';
    }
  };

  const getCategoryIcon = () => {
    switch(category) {
      case 'PERSO': return '🎮';
      case 'LOISIRS': return '🎯';
      case 'COMPETITION': return '⚔️';
      case 'NOTORIETE': return '⭐';
      case 'ULTIMATE': return '👑';
      default: return '•';
    }
  };

  return (
    <div className="flex flex-col md:flex-row gap-6 py-6 border-b border-white/5 last:border-0">
      {/* En-tête de catégorie */}
      <div className="md:w-48 shrink-0">
        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border ${getCategoryColor()}`}>
          <span className="text-sm">{getCategoryIcon()}</span>
          <p className="text-[10px] font-black uppercase tracking-[0.2em]">
            {category}
          </p>
        </div>
      </div>

      {/* Contenu */}
      <div className="flex-1">
        {/* Mode avec niveaux (PERSO et LOISIRS) */}
        {levels && (
          <div className="space-y-6">
            {levels.map((level) => (
              <div key={level.distance}>
                <p className="text-[9px] font-black uppercase text-purple-500 mb-3 tracking-widest">
                  {level.distance}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {level.modes.map((mode: GameModeCode) => (
                    <GameModeButton
                      key={mode}
                      mode={mode}
                      label={mode}
                      isConnected={isConnected}
                      selectedLaneId={selectedLaneId}
                      onSelect={() => onSelectMode(mode)}
                      disabled={disabled}
                      alertMessage={alertMessage}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Mode simple (COMPETITION, NOTORIETE, ULTIMATE) */}
        {modes && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {modes.map((mode: GameModeCode) => (
              <GameModeButton
                key={mode}
                mode={mode}
                label={mode}
                isConnected={isConnected}
                selectedLaneId={selectedLaneId}
                onSelect={() => onSelectMode(mode)}
                disabled={disabled}
                alertMessage={alertMessage}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
