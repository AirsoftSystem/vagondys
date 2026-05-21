
// app/staff/mode_jeux/hooks/useWebSocketManager.ts

"use client";

import { useState, useCallback, useEffect, useRef } from 'react';
import { 
  LaneWebSocket, 
  WebSocketStatus, 
  WebSocketIncomingMessage,
  LaneConfig
} from '../types/websocket.types';

const PING_INTERVAL = 30000; // 30 secondes

// ✅ Clé pour le stockage local de l'état des connexions
const LANES_CONNECTED_STORAGE_KEY = 'vagondys_lanes_connected';

// Interface pour stocker l'état de connexion des couloirs
interface LaneConnectedState {
  laneId: number;
  connected: boolean;
  lastIp: string;
}

// ✅ Fonctions de persistance de l'état des connexions
function loadLanesConnectedState(): LaneConnectedState[] {
  if (typeof window === 'undefined') return [];
  try {
    const saved = localStorage.getItem(LANES_CONNECTED_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch {
    console.error('Erreur chargement état des connexions');
  }
  return [];
}

function saveLanesConnectedState(states: LaneConnectedState[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LANES_CONNECTED_STORAGE_KEY, JSON.stringify(states));
  } catch {
    console.error('Erreur sauvegarde état des connexions');
  }
}

function updateLaneConnectedState(laneId: number, connected: boolean, ip: string) {
  const states = loadLanesConnectedState();
  const existingIndex = states.findIndex(s => s.laneId === laneId);
  
  if (existingIndex >= 0) {
    states[existingIndex] = { laneId, connected, lastIp: ip };
  } else {
    states.push({ laneId, connected, lastIp: ip });
  }
  
  saveLanesConnectedState(states);
}

function wasLaneConnected(laneId: number): boolean {
  const states = loadLanesConnectedState();
  const state = states.find(s => s.laneId === laneId);
  return state?.connected || false;
}

export function useWebSocketManager(initialLanes: LaneConfig[]) {
  const [selectedLaneId, setSelectedLaneId] = useState<number | null>(null);
  const [messageHandlers, setMessageHandlers] = useState<Map<number, ((data: WebSocketIncomingMessage) => void)[]>>(new Map());
  
  // Ref pour éviter les reconnexions multiples
  const autoReconnectDoneRef = useRef(false);
  const initializedRef = useRef(false);
  
  // ✅ SOLUTION : Initialisation directe dans useState avec une fonction
  const [lanes, setLanes] = useState<Map<number, LaneWebSocket>>(() => {
    const initialMap = new Map();
    initialLanes.forEach(lane => {
      initialMap.set(lane.id, {
        laneId: lane.id,
        name: lane.name,
        socket: null,
        status: 'disconnected',
        ip: lane.ip,
        reconnectAttempts: 0,
        lastPingTime: 0,
        lastPongTime: 0,
        messageHandlers: []
      });
    });
    return initialMap;
  });

  // Référence pour éviter les problèmes de closure dans les callbacks
  const connectLaneRef = useRef<((laneId: number, ip: string) => Promise<boolean>) | null>(null);

  // ✅ Fonction pour marquer un couloir comme déconnecté (avec persistance)
  const markLaneDisconnected = useCallback((laneId: number, isVoluntary: boolean = false) => {
    setLanes(prev => {
      const updated = new Map(prev);
      const l = updated.get(laneId);
      if (l) {
        l.status = 'disconnected';
        if (l.socket) {
          if (!isVoluntary) {
            // Fermeture involontaire, fermer le socket
            try {
              l.socket.close();
            } catch {
              // Ignorer les erreurs de fermeture
            }
          }
          l.socket = null;
        }
      }
      return updated;
    });
    
    // ✅ Sauvegarder l'état déconnecté DANS TOUS LES CAS (volontaire ou non)
    updateLaneConnectedState(laneId, false, '');
  }, []);

  // ✅ Définition de connectLane avec persistance d'état
  const connectLane = useCallback(async (laneId: number, ip: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setLanes(prev => {
        const newLanes = new Map(prev);
        const lane = newLanes.get(laneId);
        
        if (!lane || lane.status === 'connected') {
          resolve(lane?.status === 'connected');
          return prev;
        }

        lane.status = 'connecting';
        lane.ip = ip;
        newLanes.set(laneId, lane);

        try {
          const wsUrl = `ws://${ip}:8765`;
          console.log(`🌐 Connexion WebSocket à ${wsUrl}`);
          
          const socket = new WebSocket(wsUrl);

          socket.onopen = () => {
            console.log(`✅ WebSocket connecté pour couloir ${laneId}`);
            setLanes(current => {
              const updated = new Map(current);
              const l = updated.get(laneId);
              if (l) {
                l.status = 'connected';
                l.socket = socket;
                l.reconnectAttempts = 0;
              }
              return updated;
            });
            // ✅ Sauvegarder l'état connecté APRÈS ouverture réelle
            updateLaneConnectedState(laneId, true, ip);
            resolve(true);
          };

          socket.onclose = (_event) => {
            console.log(`🔌 WebSocket déconnecté pour couloir ${laneId}`);
            // ✅ Vérifier si c'est une fermeture volontaire (code 1000) ou involontaire
            const isVoluntary = (_event?.code === 1000);
            markLaneDisconnected(laneId, isVoluntary);
          };

          socket.onerror = (error) => {
            console.error(`❌ Erreur WebSocket couloir ${laneId}:`, error);
            setLanes(current => {
              const updated = new Map(current);
              const l = updated.get(laneId);
              if (l) l.status = 'error';
              return updated;
            });
            resolve(false);
          };

          socket.onmessage = (event) => {
            try {
              const data = JSON.parse(event.data);
              const handlers = messageHandlers.get(laneId) || [];
              handlers.forEach(handler => handler(data));
            } catch {
              console.error('Erreur parsing message');
            }
          };

        } catch (error) {
          console.error(`❌ Erreur connexion couloir ${laneId}:`, error);
          resolve(false);
        }

        return newLanes;
      });
    });
  }, [messageHandlers, markLaneDisconnected]);

  // ✅ RECONNEXION AUTOMATIQUE : Effet qui se déclenche au montage
  useEffect(() => {
    if (autoReconnectDoneRef.current) return;
    if (initializedRef.current) return;
    
    initializedRef.current = true;
    
    console.log('🔄 Vérification des couloirs à reconnecter...');
    
    const reconnectSequentially = async () => {
      for (let laneId = 0; laneId < initialLanes.length; laneId++) {
        if (wasLaneConnected(laneId)) {
          const lane = lanes.get(laneId);
          const ipToUse = lane?.ip || initialLanes[laneId]?.ip;
          
          if (ipToUse) {
            console.log(`🔄 Reconnexion automatique du couloir ${laneId + 1} avec IP ${ipToUse}`);
            await new Promise(resolve => setTimeout(resolve, 300));
            connectLane(laneId, ipToUse);
          } else {
            console.log(`⚠️ Couloir ${laneId + 1} était connecté mais aucune IP sauvegardée`);
          }
        }
      }
    };
    
    reconnectSequentially();
  }, [connectLane, lanes, initialLanes]);

  // Mettre à jour la réf quand connectLane change
  useEffect(() => {
    connectLaneRef.current = connectLane;
  }, [connectLane]);

  // Fonction pour déconnecter un couloir (volontaire)
  const disconnectLane = useCallback((laneId: number) => {
    setLanes(prev => {
      const newLanes = new Map(prev);
      const lane = newLanes.get(laneId);
      if (lane && lane.socket) {
        // ✅ Fermeture volontaire avec code 1000
        lane.socket.close(1000, 'Fermeture volontaire');
        lane.socket = null;
        lane.status = 'disconnected';
      }
      return newLanes;
    });
    // ✅ Sauvegarder l'état déconnecté (fermeture volontaire)
    updateLaneConnectedState(laneId, false, '');
  }, []);

  // Fonction pour envoyer une commande à un couloir
  const sendCommand = useCallback((laneId: number, type: string, message: string): boolean => {
    const lane = lanes.get(laneId);
    if (!lane || lane.status !== 'connected' || !lane.socket) {
      console.warn(`⚠️ Couloir ${laneId} non connecté`);
      return false;
    }

    try {
      const simpleCommands = ['ARM', 'START', 'NEXT', 'RESET', 'PERSO', 'COMPETITION', 'NOTORIETE'];
      const isSimpleCommand = simpleCommands.includes(type) || type.startsWith('LOISIR_') || type.startsWith('PSEUDOS_');
      
      if (isSimpleCommand) {
        lane.socket.send(type);
        console.log(`📤 [Couloir ${laneId}] Commande envoyée: ${type}`);
      } else {
        const command = JSON.stringify({ type, message });
        lane.socket.send(command);
        console.log(`📤 [Couloir ${laneId}] Commande envoyée:`, command);
      }
      return true;
    } catch (error) {
      console.error(`❌ Erreur envoi commande couloir ${laneId}:`, error);
      return false;
    }
  }, [lanes]);

  // Fonction pour ajouter un handler de message pour un couloir
  const addMessageHandler = useCallback((laneId: number, handler: (data: WebSocketIncomingMessage) => void) => {
    setMessageHandlers(prev => {
      const newMap = new Map(prev);
      const handlers = newMap.get(laneId) || [];
      newMap.set(laneId, [...handlers, handler]);
      return newMap;
    });

    return () => {
      setMessageHandlers(prev => {
        const newMap = new Map(prev);
        const handlers = newMap.get(laneId) || [];
        newMap.set(laneId, handlers.filter(h => h !== handler));
        return newMap;
      });
    };
  }, []);

  // Ping toutes les 30 secondes sur les connexions actives
  useEffect(() => {
    const interval = setInterval(() => {
      lanes.forEach((lane, laneId) => {
        if (lane.status === 'connected' && lane.socket) {
          const now = Date.now();
          if (now - lane.lastPingTime > PING_INTERVAL) {
            sendCommand(laneId, 'ping', JSON.stringify({ time: now }));
            setLanes(prev => {
              const updated = new Map(prev);
              const l = updated.get(laneId);
              if (l) l.lastPingTime = now;
              return updated;
            });
          }

          if (lane.lastPongTime > 0 && now - lane.lastPongTime > 60000) {
            console.warn(`⚠️ Timeout couloir ${laneId}, reconnexion...`);
            disconnectLane(laneId);
            connectLane(laneId, lane.ip);
          }
        }
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [lanes, disconnectLane, connectLane, sendCommand]);

  // Fonction pour obtenir le statut d'un couloir
  const getLaneStatus = useCallback((laneId: number): WebSocketStatus => {
    return lanes.get(laneId)?.status || 'disconnected';
  }, [lanes]);

  // Fonction pour sélectionner un couloir
  const selectLane = useCallback((laneId: number) => {
    setSelectedLaneId(laneId);
  }, []);

  // Fonction pour connecter tous les couloirs
  const connectAllLanes = useCallback(async () => {
    const promises: Promise<boolean>[] = [];
    lanes.forEach((lane, laneId) => {
      if (lane.ip) {
        promises.push(connectLane(laneId, lane.ip));
      }
    });
    return Promise.all(promises);
  }, [lanes, connectLane]);

  // Fonction pour déconnecter tous les couloirs
  const disconnectAllLanes = useCallback(() => {
    lanes.forEach((_, laneId) => {
      disconnectLane(laneId);
    });
  }, [lanes, disconnectLane]);

  return {
    lanes,
    selectedLaneId,
    getLaneStatus,
    connectLane,
    disconnectLane,
    sendCommand,
    addMessageHandler,
    selectLane,
    connectAllLanes,
    disconnectAllLanes
  };
}
