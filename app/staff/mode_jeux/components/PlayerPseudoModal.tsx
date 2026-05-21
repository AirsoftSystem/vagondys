
// app/staff/mode_jeux/components/PlayerPseudoModal.tsx
"use client";

import { useState } from "react";
import { X, User, Shield, RefreshCcw, Search, CheckCircle, AlertCircle } from "lucide-react";
import type { PlayerPseudo, GameModeCode } from "../types/game.types";

interface PlayerPseudoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  gameMode: GameModeCode | null;
  playerPseudos: PlayerPseudo[];
  onUpdatePseudo: (index: number, pseudo: string, accessToken?: string, playerId?: string) => void;
  onReset: () => void;
  onLookupPlayer: (identifier: string, index: number) => Promise<{ success: boolean; pseudo?: string; accessToken?: string; playerId?: string; error?: string }>;
}

export default function PlayerPseudoModal({
  isOpen,
  onClose,
  onConfirm,
  gameMode,
  playerPseudos,
  onUpdatePseudo,
  onReset,
  onLookupPlayer
}: PlayerPseudoModalProps) {
  // États pour la recherche de joueurs
  const [searchingIndex, setSearchingIndex] = useState<number | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchSuccess, setSearchSuccess] = useState<number | null>(null);

  if (!isOpen || !gameMode) return null;

  // Déterminer le nombre de joueurs pour ce mode
  let playerCount = 1;
  
  if (gameMode.startsWith('L')) {
    // LOISIRS: L5m-1J, L10m-2J, L15m-3J, L5m-4J, etc.
    const match = gameMode.match(/-(\d)J$/);
    playerCount = match ? parseInt(match[1]) : 1;
  } 
  else if (gameMode.startsWith('P-')) {
    // PERSO: P-5m, P-10m, P-15m → toujours 1 joueur
    playerCount = 1;
  }
  else if (gameMode === 'C-2J') {
    // COMPETITION: 2 joueurs
    playerCount = 2;
  }
  else if (gameMode === 'N-4J') {
    // NOTORIETE: 4 joueurs
    playerCount = 4;
  }
  else if (gameMode === 'U-1J') {
    // ULTIMATE: 1 joueur
    playerCount = 1;
  }
  else {
    // Par défaut (fallback)
    playerCount = 1;
  }

  // Fonction de recherche d'un joueur
  const handleSearch = async (index: number, identifier: string) => {
    if (!identifier.trim()) {
      setSearchError("Veuillez saisir un email ou pseudo");
      setTimeout(() => setSearchError(null), 3000);
      return;
    }
    
    setSearchingIndex(index);
    setSearchError(null);
    
    const result = await onLookupPlayer(identifier, index);
    
    if (result.success && result.pseudo) {
      onUpdatePseudo(index, result.pseudo, result.accessToken, result.playerId);
      setSearchSuccess(index);
      setTimeout(() => setSearchSuccess(null), 2000);
    } else {
      setSearchError(result.error || "Joueur non trouvé ou compte inactif");
      setTimeout(() => setSearchError(null), 3000);
    }
    
    setSearchingIndex(null);
  };

  // Gestion de la touche Entrée dans le champ de recherche
  const handleKeyDown = (index: number, value: string, e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch(index, value);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div 
        className="absolute inset-0 bg-black/95 backdrop-blur-xl"
        onClick={onClose}
        aria-label="Fermer la modale"
        role="button"
        tabIndex={-1}
      />

      {/* Modale */}
      <div 
        className="relative w-full max-w-2xl bg-neutral-950 border border-white/10 rounded-[2rem] shadow-2xl overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/5 bg-black/50">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-red-600 rounded-2xl shadow-lg shadow-red-900/20" aria-hidden="true">
              <User className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 id="modal-title" className="text-lg font-black uppercase tracking-widest text-white">
                Configuration des <span className="text-red-600">Joueurs</span>
              </h2>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-tighter">
                Mode : {gameMode} — {playerCount} Joueur(s)
              </p>
            </div>
          </div>
          
          <button 
            onClick={onClose}
            className="p-3 hover:bg-white/5 rounded-2xl text-zinc-500 hover:text-white transition-all focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2 focus:ring-offset-black"
            title="Fermer la fenêtre"
            aria-label="Fermer la fenêtre de configuration"
          >
            <X className="w-6 h-6" aria-hidden="true" />
          </button>
        </div>

        {/* Corps */}
        <div className="p-8 space-y-6">
          <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2">
            <Shield className="w-3 h-3 text-red-600" aria-hidden="true" />
            <span>Rechercher par email ou pseudo</span>
          </p>

          {Array.from({ length: playerCount }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <div 
                className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-white font-black"
                aria-hidden="true"
              >
                J{i + 1}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <label htmlFor={`pseudo-${i}`} className="sr-only">
                    Email ou pseudo du Joueur {i + 1}
                  </label>
                  <input
                    id={`pseudo-${i}`}
                    type="text"
                    value={playerPseudos[i]?.pseudo || ''}
                    onChange={(e) => onUpdatePseudo(i, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(i, e.currentTarget.value, e)}
                    placeholder={`Email ou pseudo Joueur ${i + 1}`}
                    className="flex-1 bg-black border border-neutral-900 rounded-xl p-4 text-xs text-white focus:border-red-600 outline-none transition-all font-mono"
                    aria-label={`Email ou pseudo du Joueur ${i + 1}`}
                  />
                  <button
                    onClick={() => handleSearch(i, playerPseudos[i]?.pseudo || '')}
                    disabled={searchingIndex === i || !playerPseudos[i]?.pseudo}
                    className="p-3 bg-blue-600/20 border border-blue-600/30 rounded-xl text-blue-500 hover:bg-blue-600/30 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Rechercher le joueur"
                    aria-label={`Rechercher le joueur ${i + 1}`}
                  >
                    {searchingIndex === i ? (
                      <RefreshCcw className="w-4 h-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Search className="w-4 h-4" aria-hidden="true" />
                    )}
                  </button>
                </div>
                {/* Indicateur de succès */}
                {searchSuccess === i && (
                  <p className="text-[8px] text-green-500 mt-1 flex items-center gap-1">
                    <CheckCircle className="w-2 h-2" aria-hidden="true" />
                    <span>Joueur authentifié ✓</span>
                  </p>
                )}
                {/* Indicateur d'erreur */}
                {searchError && searchError.includes("Joueur non trouvé") && (
                  <p className="text-[8px] text-yellow-500 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-2 h-2" aria-hidden="true" />
                    <span>{searchError}</span>
                  </p>
                )}
              </div>
            </div>
          ))}

          {/* Actions */}
          <div className="flex items-center justify-between gap-4 pt-6 border-t border-white/5">
            <button
              onClick={onReset}
              className="flex items-center gap-2 px-6 py-3 rounded-xl border border-zinc-800 text-zinc-400 hover:text-white hover:border-red-600/50 transition-all text-[9px] font-black uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2 focus:ring-offset-black"
              aria-label="Réinitialiser tous les pseudos"
            >
              <RefreshCcw className="w-3 h-3" aria-hidden="true" />
              <span>Réinitialiser</span>
            </button>
            
            <button
              onClick={onConfirm}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white font-black py-4 rounded-xl uppercase tracking-[0.2em] text-xs transition-all active:scale-95 shadow-xl shadow-red-900/40 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2 focus:ring-offset-black"
              aria-label="Lancer la partie avec les pseudos configurés"
            >
              Lancer la partie
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
