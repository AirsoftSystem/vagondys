
// app/staff/mode_jeux/page.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { useGameModes } from "./hooks/useGameModes";
import GameHeader from "./components/GameHeader";
import LaneSelector from "./components/LaneSelector";
import GameModeSection from "./components/GameModeSection";
import LaneStatus from "./components/LaneStatus";
import PlayerPseudoModal from "./components/PlayerPseudoModal";
import { GameCategory, GameModeCode } from "./types/game.types";
import { WebSocketStatus } from "./types/websocket.types";

// ✅ Définition locale du type LoisirsLevel (non exporté par game.types)
interface LoisirsLevel {
  distance: string;
  modes: GameModeCode[];
}

// Configuration des sections de jeu
const GAME_SECTIONS: {
  label: GameCategory;
  levels?: LoisirsLevel[];
  modes?: GameModeCode[];
  disabled?: boolean;
  alertMessage?: string;
}[] = [
  // ========== 1. MODE PERSO (1 joueur, 3 distances) ==========
  {
    label: 'PERSO',
    levels: [
      { 
        distance: '5m', 
        modes: ['P-5m'] 
      },
      { 
        distance: '10m', 
        modes: ['P-10m'] 
      },
      { 
        distance: '15m', 
        modes: ['P-15m'] 
      }
    ]
  },
  // ========== 2. MODE LOISIRS (1 à 4 joueurs, 3 distances) ==========
  {
    label: 'LOISIRS',
    levels: [
      { 
        distance: '5m', 
        modes: ['L5m-1J', 'L5m-2J', 'L5m-3J', 'L5m-4J'] 
      },
      { 
        distance: '10m', 
        modes: ['L10m-1J', 'L10m-2J', 'L10m-3J', 'L10m-4J'] 
      },
      { 
        distance: '15m', 
        modes: ['L15m-1J', 'L15m-2J', 'L15m-3J', 'L15m-4J'] 
      }
    ]
  },
  // ========== 3. MODE COMPETITION (2 joueurs) ==========
  {
    label: 'COMPETITION',
    modes: ['C-2J']
  },
  // ========== 4. MODE NOTORIETE (4 joueurs) ==========
  {
    label: 'NOTORIETE',
    modes: ['N-4J']
  },
  // ========== 5. MODE ULTIMATE (1 joueur, désactivé temporairement) ==========
  {
    label: 'ULTIMATE',
    modes: ['U-1J'],
    disabled: true,
    alertMessage: "Mode en développement"
  }
];

export default function StaffModeJeuxPage() {
  const {
    // États
    agentCity,
    agentEmail,
    
    // WebSockets
    lanes,
    selectedLaneId,
    getLaneStatus,
    connectLane,
    disconnectLane,
    selectLane,
    connectAllLanes,
    disconnectAllLanes,
    
    // Gestion des IPs (déjà disponible dans useGameModes)
    updateLaneIp,
    getLaneIp,
    
    // Jeu
    selectedGameMode,
    playerPseudos,
    isPseudoModalOpen,
    setIsPseudoModalOpen,
    activeGames,
    serverResponse,
    refreshTrigger, // Force le refresh UI
    
    // Actions
    launchGameMode,
    confirmGameLaunch,
    updatePlayerPseudo,
    resetAllPseudos,
    
    // ✅ AJOUTÉ : Fonction de recherche de joueur
    lookupPlayer,
  } = useGameModes();

  // État local pour l'IP saisie manuellement par l'agent
  const [manualIp, setManualIp] = useState<string>('');
  // État pour forcer le re-render des composants enfants
  const [uiRefreshKey, setUiRefreshKey] = useState<number>(0);
  // Ref pour suivre le dernier refreshTrigger traité
  const lastRefreshTriggerRef = useRef<number>(0);

  // Effet pour réagir au refreshTrigger et forcer le refresh UI
  useEffect(() => {
    if (refreshTrigger > 0 && refreshTrigger !== lastRefreshTriggerRef.current) {
      lastRefreshTriggerRef.current = refreshTrigger;
      // Utiliser setTimeout pour déferrer l'appel à setState
      setTimeout(() => {
        setUiRefreshKey(prev => prev + 1);
        console.log(`🔄 Refresh UI déclenché (trigger: ${refreshTrigger})`);
      }, 0);
    }
  }, [refreshTrigger]);

  const isConnected = selectedLaneId !== null && getLaneStatus(selectedLaneId) === 'connected';

  const handleSelectMode = (mode: GameModeCode) => {
    // Vérifier si le mode est désactivé (ULTIMATE)
    const section = GAME_SECTIONS.find(s => 
      s.modes?.includes(mode) || s.levels?.some(l => l.modes.includes(mode))
    );
    
    if (section?.disabled) {
      alert(section.alertMessage || "Ce mode n'est pas encore disponible");
      return;
    }
    
    launchGameMode(mode, selectedLaneId || undefined);
  };

  // Fonction helper pour convertir le statut
  const getHeaderStatus = (): 'connected' | 'disconnected' | 'connecting' => {
    if (selectedLaneId === null) return 'disconnected';
    const status = getLaneStatus(selectedLaneId);
    if (status === 'error') return 'disconnected';
    return status as 'connected' | 'disconnected' | 'connecting';
  };

  // Gestion de la connexion manuelle depuis le header
  const handleManualConnect = () => {
    if (selectedLaneId === null) {
      alert('⚠️ Veuillez d’abord sélectionner un couloir');
      return;
    }
    if (!manualIp.trim()) {
      alert('⚠️ Veuillez saisir une adresse IP');
      return;
    }
    // ✅ CORRECTION : Sauvegarder l'IP avant de se connecter
    updateLaneIp(selectedLaneId, manualIp);
    connectLane(selectedLaneId, manualIp);
  };

  // Déconnexion du couloir sélectionné
  const handleManualDisconnect = () => {
    if (selectedLaneId !== null) {
      disconnectLane(selectedLaneId);
    }
  };

  return (
    <main className="min-h-screen bg-black text-white p-4 md:p-8 font-sans relative overflow-hidden">
      
      {/* Effet de fond */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-red-600/5 blur-[150px] pointer-events-none" />

      <div className="max-w-7xl mx-auto relative z-10 space-y-8">

        {/* Header avec IP manuelle fonctionnelle */}
        <GameHeader
          status={getHeaderStatus()}
          serverIp={manualIp}
          agentCity={agentCity}
          agentEmail={agentEmail}
          onIpChange={setManualIp}
          onConnect={handleManualConnect}
          onDisconnect={handleManualDisconnect}
          isConnecting={false}
        />

        {/* Message de réponse du serveur */}
        {serverResponse && (
          <div className="bg-green-600/10 border border-green-600/30 rounded-xl p-4">
            <p className="text-[10px] font-black uppercase text-green-500">
              ✓ {serverResponse}
            </p>
          </div>
        )}

        {/* Sélecteur des 8 couloirs */}
        <LaneSelector
          key={`lane-selector-${uiRefreshKey}`}
          lanes={lanes as Map<number, { laneId: number; name: string; ip: string; status: WebSocketStatus; }>}
          selectedLaneId={selectedLaneId}
          onSelectLane={selectLane}
          onConnectLane={connectLane}
          onDisconnectLane={disconnectLane}
          onConnectAll={connectAllLanes}
          onDisconnectAll={disconnectAllLanes}
          // ✅ NOUVEAU : Props pour la gestion des IPs
          onUpdateLaneIp={updateLaneIp}
          getLaneIp={getLaneIp}
        />

        {/* État des couloirs */}
        <LaneStatus
          key={`lane-status-${uiRefreshKey}`}
          lanes={lanes as Map<number, { laneId: number; name: string; ip: string; status: WebSocketStatus; }>}
          activeGames={activeGames}
          selectedLaneId={selectedLaneId}
          refreshTrigger={refreshTrigger}
        />

        {/* Sections de jeu */}
        <div className="space-y-4">
          {GAME_SECTIONS.map((section) => (
            <GameModeSection
              key={`${section.label}-${uiRefreshKey}`}
              category={section.label}
              levels={section.levels}
              modes={section.modes}
              isConnected={isConnected}
              selectedLaneId={selectedLaneId}
              onSelectMode={handleSelectMode}
              disabled={section.disabled}
              alertMessage={section.alertMessage}
            />
          ))}
        </div>

        {/* Modale de configuration des pseudos */}
        <PlayerPseudoModal
          isOpen={isPseudoModalOpen}
          onClose={() => setIsPseudoModalOpen(false)}
          onConfirm={confirmGameLaunch}
          gameMode={selectedGameMode}
          playerPseudos={playerPseudos}
          onUpdatePseudo={updatePlayerPseudo}
          onReset={resetAllPseudos}
          onLookupPlayer={lookupPlayer}
        />

        {/* Footer */}
        <footer className="pt-8 border-t border-neutral-900 text-center">
          <p className="text-[8px] uppercase tracking-[0.4em] text-neutral-800">
            VAGONDYS OFFICIAL SYSTEM — 8 COULOIRS DE TIR — COMMANDE À DISTANCE
          </p>
        </footer>
      </div>
    </main>
  );
}
