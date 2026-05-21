
// app/staff/mode_jeux/components/LaneStatus.tsx
"use client";

import { Wifi, WifiOff, Target, Clock, Users, AlertCircle, Circle, CheckCircle } from "lucide-react";
import { ActiveGame } from "../types/game.types";
import { WebSocketStatus } from "../types/websocket.types";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";

interface LaneStatusProps {
  lanes: Map<number, {
    laneId: number;
    name: string;
    ip: string;
    status: WebSocketStatus;
  }>;
  activeGames: Map<number, ActiveGame>;
  selectedLaneId: number | null;
  refreshTrigger?: number; // ✅ AJOUTÉ : Force le re-render du composant
}

export default function LaneStatus({
  lanes,
  activeGames,
  selectedLaneId,
  refreshTrigger // ✅ AJOUTÉ
}: LaneStatusProps) {

  const getStatusIcon = (status: WebSocketStatus) => {
    switch(status) {
      case 'connected': return <Wifi className="w-3 h-3 text-green-500" />;
      case 'connecting': return <Clock className="w-3 h-3 text-yellow-500 animate-spin" />;
      default: return <WifiOff className="w-3 h-3 text-red-500" />;
    }
  };

  const lanesArray = Array.from(lanes.values());

  if (lanesArray.length === 0) {
    return null;
  }

  // ✅ Force le re-render en utilisant refreshTrigger (même si non utilisé directement)
  // Cela garantit que le composant se met à jour quand refreshTrigger change
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _ = refreshTrigger;

  // Compter les parties en attente de clic joueur (status 'waiting')
  const waitingForPlayerCount = Array.from(activeGames.values()).filter(
    game => game.status === 'waiting'
  ).length;

  // Compter les parties en cours (status 'in_progress')
  const inProgressCount = Array.from(activeGames.values()).filter(
    game => game.status === 'in_progress'
  ).length;

  // Compter les couloirs disponibles (aucune partie active)
  const availableLanesCount = lanesArray.filter(lane => {
    return lane.status === 'connected' && !activeGames.has(lane.laneId);
  }).length;

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white">
          État des couloirs
        </h3>
        <div className="flex items-center gap-2 flex-wrap">
          {waitingForPlayerCount > 0 && (
            <Badge variant="warning" size="sm">
              ⏳ {waitingForPlayerCount} en attente
            </Badge>
          )}
          {inProgressCount > 0 && (
            <Badge variant="info" size="sm">
              🎯 {inProgressCount} en cours
            </Badge>
          )}
          {availableLanesCount > 0 && (
            <Badge variant="success" size="sm">
              ✅ {availableLanesCount} disponibles
            </Badge>
          )}
          <Badge variant="info" size="sm">
            {Array.from(activeGames.values()).length} parties actives
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {lanesArray.map((lane) => {
          const activeGame = activeGames.get(lane.laneId);
          const isSelected = selectedLaneId === lane.laneId;
          const isWaitingForPlayer = activeGame?.status === 'waiting';
          const isInProgress = activeGame?.status === 'in_progress';
          const isAvailable = lane.status === 'connected' && !activeGame;

          return (
            <div
              key={lane.laneId}
              className={`
                p-3 rounded-xl border transition-all
                ${lane.status === 'connected' ? 'border-green-500/30 bg-green-500/5' : 
                  lane.status === 'connecting' ? 'border-yellow-500/30 bg-yellow-500/5' : 
                  'border-red-500/30 bg-red-500/5'}
                ${isSelected ? 'ring-2 ring-red-600' : ''}
                ${isWaitingForPlayer ? 'ring-2 ring-yellow-500 animate-pulse' : ''}
                ${isAvailable ? 'hover:border-green-500/50 hover:bg-green-500/10 cursor-pointer' : ''}
              `}
            >
              {/* En-tête */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] font-black uppercase text-white">
                  #{lane.laneId + 1}
                </span>
                <div className="flex items-center gap-1.5">
                  {isWaitingForPlayer && (
                    <Circle className="w-2 h-2 text-yellow-500 animate-pulse" />
                  )}
                  {isAvailable && (
                    <CheckCircle className="w-2 h-2 text-green-500" />
                  )}
                  {getStatusIcon(lane.status)}
                </div>
              </div>

              {/* Nom */}
              <p className="text-[8px] font-black uppercase text-zinc-400 mb-2">
                {lane.name}
              </p>

              {/* Partie active ou disponible */}
              {activeGame ? (
                <div className={`mt-2 p-2 rounded-lg border transition-all
                  ${isWaitingForPlayer ? 'bg-yellow-500/10 border-yellow-500/30' : 
                    isInProgress ? 'bg-green-500/10 border-green-500/30' : 
                    'bg-black/50 border-white/5'}
                `}>
                  <div className="flex items-center gap-1 mb-1">
                    <Target className={`w-2 h-2 ${isWaitingForPlayer ? 'text-yellow-500' : 'text-red-600'}`} />
                    <span className="text-[7px] font-black uppercase text-white">
                      {activeGame.mode}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <Users className="w-2 h-2 text-zinc-600" />
                      <span className="text-[7px] font-mono text-zinc-600">
                        {activeGame.playerCount}J
                      </span>
                    </div>
                    {isWaitingForPlayer && (
                      <div className="flex items-center gap-1">
                        <AlertCircle className="w-2 h-2 text-yellow-500" />
                        <span className="text-[6px] font-black uppercase text-yellow-500">
                          ATTENTE CLIC
                        </span>
                      </div>
                    )}
                    {isInProgress && (
                      <div className="flex items-center gap-1">
                        <Clock className="w-2 h-2 text-green-500 animate-spin" />
                        <span className="text-[6px] font-black uppercase text-green-500">
                          EN COURS
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className={`mt-2 p-2 rounded-lg border transition-all
                  ${isAvailable ? 'bg-green-500/5 border-green-500/20' : 'bg-black/30 border-white/5'}
                `}>
                  {isAvailable ? (
                    <div className="flex items-center justify-center gap-1">
                      <CheckCircle className="w-2 h-2 text-green-500" />
                      <p className="text-[6px] font-black uppercase text-green-500 text-center">
                        PRÊT
                      </p>
                    </div>
                  ) : (
                    <p className="text-[7px] font-black uppercase text-zinc-700 text-center">
                      Inactif
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
