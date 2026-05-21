
// app/staff/mode_jeux/components/LaneSelector.tsx

"use client";

import { useState, useMemo } from "react";
import { Wifi, WifiOff, Zap, Power, PowerOff, Edit2, Check, X } from "lucide-react";
import { WebSocketStatus } from "../types/websocket.types";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";

interface LaneSelectorProps {
  lanes: Map<number, {
    laneId: number;
    name: string;
    ip: string;
    status: WebSocketStatus;
  }>;
  selectedLaneId: number | null;
  onSelectLane: (laneId: number) => void;
  onConnectLane: (laneId: number, ip: string) => void;
  onDisconnectLane: (laneId: number) => void;
  onConnectAll: () => void;
  onDisconnectAll: () => void;
  // NOUVEAU : Props pour la gestion des IPs
  onUpdateLaneIp?: (laneId: number, ip: string) => void;
  // ✅ AJOUTÉ : Props pour récupérer l'IP sauvegardée d'un couloir
  getLaneIp?: (laneId: number) => string;
}

export default function LaneSelector({
  lanes,
  selectedLaneId,
  onSelectLane,
  onConnectLane,
  onDisconnectLane,
  onConnectAll,
  onDisconnectAll,
  onUpdateLaneIp,
  getLaneIp  // ✅ NOUVEAU : prop pour récupérer l'IP sauvegardée
}: LaneSelectorProps) {

  // État pour suivre quel couloir est en mode édition
  const [editingLaneId, setEditingLaneId] = useState<number | null>(null);
  const [editingIpValue, setEditingIpValue] = useState<string>("");

  // ✅ NOUVEAU : État pour stocker les IPs locales modifiées (permet l'édition sans valider tout de suite)
  const [localIpsOverrides, setLocalIpsOverrides] = useState<Map<number, string>>(new Map());

  // ✅ CORRECTION : Utilisation de useMemo pour calculer les IPs locales (valeur dérivée)
  const localIps = useMemo(() => {
    const result = new Map<number, string>();
    lanes.forEach((lane, laneId) => {
      // Priorité : 1. override utilisateur, 2. IP sauvegardée via getLaneIp, 3. IP existante dans lanes
      const override = localIpsOverrides.get(laneId);
      if (override !== undefined) {
        result.set(laneId, override);
      } else {
        const savedIp = getLaneIp ? getLaneIp(laneId) : null;
        result.set(laneId, savedIp || lane.ip || '');
      }
    });
    return result;
  }, [lanes, getLaneIp, localIpsOverrides]);

  // ✅ NOUVEAU : Sauvegarder une IP localement (sans validation)
  const updateLocalIp = (laneId: number, ip: string) => {
    setLocalIpsOverrides(prev => {
      const newMap = new Map(prev);
      newMap.set(laneId, ip);
      return newMap;
    });
  };

  const getStatusIcon = (status: WebSocketStatus) => {
    switch(status) {
      case 'connected':
        return <Wifi className="w-4 h-4 text-green-500" />;
      case 'connecting':
        return <Zap className="w-4 h-4 text-yellow-500 animate-pulse" />;
      case 'error':
        return <WifiOff className="w-4 h-4 text-red-500" />;
      default:
        return <WifiOff className="w-4 h-4 text-zinc-600" />;
    }
  };

  const getStatusColor = (status: WebSocketStatus) => {
    switch(status) {
      case 'connected': return 'border-green-500/30 bg-green-500/5';
      case 'connecting': return 'border-yellow-500/30 bg-yellow-500/5';
      case 'error': return 'border-red-500/30 bg-red-500/5';
      default: return 'border-zinc-800 bg-black/50';
    }
  };

  const getStatusText = (status: WebSocketStatus) => {
    switch(status) {
      case 'connected': return 'Connecté';
      case 'connecting': return 'Connexion...';
      case 'error': return 'Erreur';
      default: return 'Déconnecté';
    }
  };

  // Valider le format d'une IP (IPv4 simple)
  const isValidIp = (ip: string): boolean => {
    if (!ip || ip.trim() === "") return false;
    const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipPattern.test(ip)) return false;
    const parts = ip.split('.');
    return parts.every(part => {
      const num = parseInt(part, 10);
      return num >= 0 && num <= 255;
    });
  };

  // Démarrer l'édition de l'IP
  const startEditing = (laneId: number, currentIp: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingLaneId(laneId);
    setEditingIpValue(currentIp);
  };

  // Sauvegarder l'IP modifiée
  const saveIp = (laneId: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (onUpdateLaneIp && isValidIp(editingIpValue)) {
      onUpdateLaneIp(laneId, editingIpValue);
      // ✅ NOUVEAU : Mettre à jour l'IP locale après sauvegarde
      updateLocalIp(laneId, editingIpValue);
    } else if (editingIpValue.trim() !== "" && !isValidIp(editingIpValue)) {
      alert("⚠️ Format IP invalide. Utilisez le format xxx.xxx.xxx.xxx");
    }
    setEditingLaneId(null);
    setEditingIpValue("");
  };

  // Annuler l'édition
  const cancelEditing = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingLaneId(null);
    setEditingIpValue("");
  };

  // Gestion de la touche Entrée dans le champ IP
  const handleKeyDown = (laneId: number, e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      saveIp(laneId);
    } else if (e.key === 'Escape') {
      cancelEditing();
    }
  };

  const lanesArray = Array.from(lanes.values());

  // Gestion du clic sur la carte : sélection + connexion automatique si IP dispo
  const handleCardClick = (lane: typeof lanesArray[0]) => {
    // Si on est en mode édition, ne pas sélectionner
    if (editingLaneId === lane.laneId) return;
    
    onSelectLane(lane.laneId);
    // ✅ MODIFIÉ : Utiliser l'IP locale (sauvegardée) au lieu de lane.ip
    const currentIp = localIps.get(lane.laneId) || lane.ip;
    if (currentIp && lane.status !== 'connected' && lane.status !== 'connecting') {
      onConnectLane(lane.laneId, currentIp);
    } else if (!currentIp) {
      alert(`⚠️ Aucune IP configurée pour le ${lane.name}. Veuillez en saisir une.`);
    }
  };

  // ✅ NOUVEAU : Fonction pour gérer la connexion manuelle
  const handleConnectClick = (lane: typeof lanesArray[0], e: React.MouseEvent) => {
    e.stopPropagation();
    const currentIp = localIps.get(lane.laneId) || lane.ip;
    if (currentIp) {
      onConnectLane(lane.laneId, currentIp);
    } else {
      alert(`⚠️ IP non configurée pour le ${lane.name}. Veuillez en saisir une.`);
    }
  };

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white">
            Couloirs de tir
          </h3>
          <Badge variant="info" size="sm">
            {lanesArray.length} couloirs
          </Badge>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={onConnectAll}
            className="flex items-center gap-1 px-3 py-1.5 bg-green-600/10 border border-green-600/30 rounded-lg text-[9px] font-black uppercase tracking-widest text-green-500 hover:bg-green-600/20 transition-all"
            title="Connecter tous les couloirs"
          >
            <Power className="w-3 h-3" />
            <span>Tous</span>
          </button>
          <button
            onClick={onDisconnectAll}
            className="flex items-center gap-1 px-3 py-1.5 bg-red-600/10 border border-red-600/30 rounded-lg text-[9px] font-black uppercase tracking-widest text-red-500 hover:bg-red-600/20 transition-all"
            title="Déconnecter tous les couloirs"
          >
            <PowerOff className="w-3 h-3" />
            <span>Tous</span>
          </button>
        </div>
      </div>

      {/* Grille des 8 couloirs (2 rangées de 4) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {lanesArray.map((lane) => {
          // ✅ NOUVEAU : Récupérer l'IP locale (sauvegardée) pour l'affichage
          const displayIp = localIps.get(lane.laneId) || lane.ip;
          
          return (
            <div
              key={lane.laneId}
              className={`
                relative p-4 rounded-xl border-2 transition-all cursor-pointer
                ${getStatusColor(lane.status)}
                ${selectedLaneId === lane.laneId && editingLaneId !== lane.laneId ? 'ring-2 ring-red-600 ring-offset-2 ring-offset-black' : ''}
                ${editingLaneId === lane.laneId ? 'ring-2 ring-blue-600 ring-offset-2 ring-offset-black' : ''}
              `}
              onClick={() => handleCardClick(lane)}
            >
              {/* En-tête */}
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-black uppercase tracking-widest text-white">
                  #{lane.laneId + 1}
                </span>
                <div className="flex items-center gap-2">
                  {getStatusIcon(lane.status)}
                </div>
              </div>

              {/* Nom du couloir */}
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">
                {lane.name}
              </p>

              {/* IP - Affichage ou édition */}
              <div className="mb-3">
                {editingLaneId === lane.laneId ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={editingIpValue}
                      onChange={(e) => setEditingIpValue(e.target.value)}
                      onKeyDown={(e) => handleKeyDown(lane.laneId, e)}
                      placeholder="192.168.1.xxx"
                      className="flex-1 bg-black border border-blue-600/50 rounded px-2 py-1 text-[10px] font-mono text-white focus:outline-none focus:border-blue-600"
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                    />
                    <button
                      onClick={(e) => saveIp(lane.laneId, e)}
                      className="p-1 bg-green-600/20 border border-green-600/30 rounded text-green-500 hover:bg-green-600/30 transition-all"
                      title="Valider"
                    >
                      <Check className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => cancelEditing(e)}
                      className="p-1 bg-red-600/20 border border-red-600/30 rounded text-red-500 hover:bg-red-600/30 transition-all"
                      title="Annuler"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-1 group">
                    <p className={`text-[10px] font-mono truncate ${displayIp ? 'text-zinc-400' : 'text-zinc-700'}`}>
                      {displayIp || 'Non configuré'}
                    </p>
                    {onUpdateLaneIp && (
                      <button
                        onClick={(e) => startEditing(lane.laneId, displayIp, e)}
                        className="p-1 opacity-0 group-hover:opacity-100 transition-opacity bg-zinc-800/50 rounded text-zinc-500 hover:text-white hover:bg-zinc-700"
                        title="Modifier l'IP"
                      >
                        <Edit2 className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Statut et bouton de connexion */}
              <div className="flex items-center justify-between">
                <span className={`text-[8px] font-black uppercase ${
                  lane.status === 'connected' ? 'text-green-500' :
                  lane.status === 'connecting' ? 'text-yellow-500' :
                  lane.status === 'error' ? 'text-red-500' : 'text-zinc-600'
                }`}>
                  {getStatusText(lane.status)}
                </span>

                {lane.status !== 'connected' ? (
                  <button
                    onClick={(e) => handleConnectClick(lane, e)}
                    disabled={lane.status === 'connecting' || !displayIp}
                    className="px-2 py-1 bg-green-600/20 border border-green-600/30 rounded text-[8px] font-black uppercase tracking-widest text-green-500 hover:bg-green-600/30 transition-all disabled:opacity-30"
                  >
                    Connecter
                  </button>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDisconnectLane(lane.laneId);
                    }}
                    className="px-2 py-1 bg-red-600/20 border border-red-600/30 rounded text-[8px] font-black uppercase tracking-widest text-red-500 hover:bg-red-600/30 transition-all"
                  >
                    Déco
                  </button>
                )}
              </div>

              {/* Indicateur de sélection */}
              {selectedLaneId === lane.laneId && editingLaneId !== lane.laneId && (
                <div className="absolute inset-0 rounded-xl border-2 border-red-600 pointer-events-none" />
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
