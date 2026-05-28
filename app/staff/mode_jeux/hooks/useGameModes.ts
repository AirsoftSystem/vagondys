
// app/staff/mode_jeux/hooks/useGameModes.ts

"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  GameModeCode, 
  PlayerPseudo,
  ActiveGame,
  PlayerCount
} from '../types/game.types';
import { useWebSocketManager } from './useWebSocketManager';
import { createStaffClient } from '@/lib/supabase/client';

// Clé pour le stockage local des IPs
const LANES_IPS_STORAGE_KEY = 'vagondys_lanes_ips';

// ✅ Clé pour le stockage local de l'état des connexions
const LANES_CONNECTED_STORAGE_KEY = 'vagondys_lanes_connected';

// Nombre fixe de couloirs (8)
const FIXED_LANE_COUNT = 8;

// Interface pour stocker les IPs des couloirs
interface LaneIpConfig {
  laneId: number;
  ip: string;
  name: string;
}

// Interface pour stocker l'état de connexion des couloirs
interface LaneConnectedState {
  laneId: number;
  connected: boolean;
  lastIp: string;
}

// Obtenir les noms par défaut des couloirs
function getDefaultLaneName(laneId: number): string {
  return `Couloir ${laneId + 1}`;
}

// Obtenir la configuration par défaut des couloirs (tous vides)
function getDefaultLanesConfig(): LaneIpConfig[] {
  const config: LaneIpConfig[] = [];
  for (let i = 0; i < FIXED_LANE_COUNT; i++) {
    config.push({
      laneId: i,
      ip: '',
      name: getDefaultLaneName(i)
    });
  }
  return config;
}

// Fonction pour charger les IPs sauvegardées ou utiliser les valeurs par défaut
function loadLanesIps(): LaneIpConfig[] {
  const defaultConfig = getDefaultLanesConfig();
  
  if (typeof window === 'undefined') {
    return defaultConfig;
  }
  
  try {
    const saved = localStorage.getItem(LANES_IPS_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length === FIXED_LANE_COUNT) {
        const isValid = parsed.every((lane: unknown, idx: number) => {
          const l = lane as LaneIpConfig;
          return l && typeof l.laneId === 'number' && l.laneId === idx && typeof l.ip === 'string';
        });
        if (isValid) {
          return parsed;
        }
      }
      console.warn('Données localStorage corrompues, réinitialisation...');
      localStorage.removeItem(LANES_IPS_STORAGE_KEY);
    }
  } catch (e) {
    console.error('Erreur chargement IPs depuis localStorage:', e);
  }
  
  return defaultConfig;
}

// Fonction pour sauvegarder les IPs (garantit 8 couloirs)
function saveLanesIps(lanes: LaneIpConfig[]) {
  if (typeof window === 'undefined') return;
  
  let validLanes: LaneIpConfig[];
  if (lanes.length !== FIXED_LANE_COUNT) {
    validLanes = getDefaultLanesConfig();
    for (let i = 0; i < Math.min(lanes.length, FIXED_LANE_COUNT); i++) {
      if (lanes[i] && typeof lanes[i].laneId === 'number') {
        validLanes[i].ip = lanes[i].ip || '';
      }
    }
  } else {
    validLanes = lanes;
  }
  
  try {
    localStorage.setItem(LANES_IPS_STORAGE_KEY, JSON.stringify(validLanes));
  } catch (e) {
    console.error('Erreur sauvegarde IPs dans localStorage:', e);
  }
}

// Charger l'état des connexions sauvegardées
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
  } catch (e) {
    console.error('Erreur chargement état des connexions:', e);
  }
  return [];
}

// Sauvegarder l'état des connexions
function saveLanesConnectedState(states: LaneConnectedState[]) {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(LANES_CONNECTED_STORAGE_KEY, JSON.stringify(states));
  } catch (e) {
    console.error('Erreur sauvegarde état des connexions:', e);
  }
}

// Mettre à jour l'état d'un couloir spécifique
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

// Vérifier si un couloir était connecté avant fermeture
function wasLaneConnected(laneId: number): boolean {
  const states = loadLanesConnectedState();
  const state = states.find(s => s.laneId === laneId);
  return state?.connected || false;
}

// Récupérer la dernière IP connue pour un couloir
function getLastKnownIp(laneId: number): string {
  const states = loadLanesConnectedState();
  const state = states.find(s => s.laneId === laneId);
  return state?.lastIp || '';
}

// Générer la configuration des couloirs dynamiquement (toujours 8 couloirs)
function getLanesConfig(): { id: number; name: string; ip: string; enabled: boolean }[] {
  const savedIps = loadLanesIps();
  const config: { id: number; name: string; ip: string; enabled: boolean }[] = [];
  
  for (let i = 0; i < FIXED_LANE_COUNT; i++) {
    const saved = savedIps[i];
    config.push({
      id: i,
      name: saved?.name || getDefaultLaneName(i),
      ip: saved?.ip || '',
      enabled: true
    });
  }
  
  return config;
}

export function useGameModes() {
  const [agentCity, setAgentCity] = useState<string | null>(null);
  const [agentCountry, setAgentCountry] = useState<string>('FR');
  const [agentEmail, setAgentEmail] = useState<string | null>(null);
  
  // États pour le jeu
  const [selectedGameMode, setSelectedGameMode] = useState<GameModeCode | null>(null);
  const [isPseudoModalOpen, setIsPseudoModalOpen] = useState(false);
  const [playerPseudos, setPlayerPseudos] = useState<PlayerPseudo[]>([
    { index: 0, pseudo: '', isAuthenticated: false },
    { index: 1, pseudo: '', isAuthenticated: false },
    { index: 2, pseudo: '', isAuthenticated: false },
    { index: 3, pseudo: '', isAuthenticated: false },
  ]);
  const [serverResponse, setServerResponse] = useState<string | null>(null);
  const [activeGames, setActiveGames] = useState<Map<number, ActiveGame>>(new Map());
  const [lanesConfigVersion, setLanesConfigVersion] = useState(0);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  // Ref pour éviter les reconnexions multiples au chargement
  const autoReconnectDoneRef = useRef(false);
  
  // ✅ ÉTAT POUR SAVOIR SI LES WEBSOCKETS SONT PRÊTS
  const [isWebSocketManagerReady, setIsWebSocketManagerReady] = useState(false);

  // ✅ NOUVEAU : Token STAFF pour l'authentification (stocké après login)
  const [staffToken, setStaffToken] = useState<string | null>(null);

  // Fonction pour mettre à jour l'IP d'un couloir
  const updateLaneIp = useCallback((laneId: number, ip: string) => {
    if (laneId < 0 || laneId >= FIXED_LANE_COUNT) return;
    
    const savedIps = loadLanesIps();
    const updatedIps = [...savedIps];
    if (updatedIps[laneId]) {
      updatedIps[laneId] = { ...updatedIps[laneId], ip: ip.trim() };
      saveLanesIps(updatedIps);
      setLanesConfigVersion(prev => prev + 1);
    }
  }, []);

  // Fonction pour obtenir l'IP actuelle d'un couloir
  const getLaneIp = useCallback((laneId: number): string => {
    if (laneId < 0 || laneId >= FIXED_LANE_COUNT) return '';
    const savedIps = loadLanesIps();
    return savedIps[laneId]?.ip || '';
  }, []);

  // Générer la configuration actuelle des lanes
  const currentLanesConfig = getLanesConfig();

  // Initialisation du WebSocket Manager
  const {
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
  } = useWebSocketManager(currentLanesConfig);

  // ✅ Surveiller la disponibilité des lanes pour savoir quand le manager est prêt
  useEffect(() => {
    if (lanes.size === FIXED_LANE_COUNT) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsWebSocketManagerReady(true);
      console.log('✅ WebSocket Manager prêt');
    }
  }, [lanes.size]);

  // Effet pour réagir aux changements de version des IPs
  useEffect(() => {
    // Force la mise à jour
  }, [lanesConfigVersion]);

  // ✅ Effet pour la reconnexion automatique (après que le manager soit prêt)
  useEffect(() => {
    // Ne rien faire si le manager n'est pas prêt
    if (!isWebSocketManagerReady) return;
    
    // Éviter les exécutions multiples
    if (autoReconnectDoneRef.current) return;
    autoReconnectDoneRef.current = true;
    
    console.log('🔄 Tentative de reconnexion automatique des couloirs...');
    
    // Fonction de reconnexion séquentielle
    const reconnectSequentially = async () => {
      for (let laneId = 0; laneId < FIXED_LANE_COUNT; laneId++) {
        // Vérifier si ce couloir était connecté avant fermeture
        if (wasLaneConnected(laneId)) {
          const savedIp = getLaneIp(laneId);
          const lastIp = getLastKnownIp(laneId);
          const ipToUse = savedIp || lastIp;
          
          if (ipToUse) {
            console.log(`🔄 Reconnexion automatique du couloir ${laneId + 1} avec IP ${ipToUse}`);
            // Attendre 300ms entre chaque tentative
            await new Promise(resolve => setTimeout(resolve, 300));
            connectLane(laneId, ipToUse);
          } else {
            console.log(`⚠️ Couloir ${laneId + 1} était connecté mais aucune IP sauvegardée`);
          }
        }
      }
    };
    
    reconnectSequentially();
  }, [isWebSocketManagerReady, connectLane, getLaneIp]);

  // ✅ Récupérer l'agent connecté (Version Option B - plus de getStationConfig)
  useEffect(() => {
    const fetchAgentAndConfig = async () => {
      try {
        const supabase = createStaffClient();
        const { data: { user }, error } = await supabase.auth.getUser();
        
        if (error || !user?.email) {
          console.error('Agent non authentifié');
          return;
        }

        setAgentEmail(user.email);
        
        // ✅ Récupérer le token STAFF pour les appels API
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session?.access_token) {
          setStaffToken(sessionData.session.access_token);
          // Stocker dans localStorage pour la modale
          localStorage.setItem('staff_access_token', sessionData.session.access_token);
        }
        
        const email = user.email.toLowerCase();
        let city = 'NANTES';
        let country = 'FR';
        
        if (email.includes('nantes')) { city = 'NANTES'; country = 'FR'; }
        else if (email.includes('paris')) { city = 'PARIS'; country = 'FR'; }
        else if (email.includes('lyon')) { city = 'LYON'; country = 'FR'; }
        else if (email.includes('marseille')) { city = 'MARSEILLE'; country = 'FR'; }
        else if (email.includes('bordeaux')) { city = 'BORDEAUX'; country = 'FR'; }
        else if (email.includes('lille')) { city = 'LILLE'; country = 'FR'; }
        else if (email.includes('toulouse')) { city = 'TOULOUSE'; country = 'FR'; }
        else if (email.includes('madrid')) { city = 'MADRID'; country = 'ES'; }
        
        setAgentCity(city);
        setAgentCountry(country);
        
      } catch (error) {
        console.error('Erreur récupération agent:', error);
      }
    };
    
    fetchAgentAndConfig();
  }, []);

  // ✅ lookupPlayer (version simplifiée sans stationConfig)
  // Le paramètre playerIndex est conservé pour compatibilité API mais non utilisé actuellement
  const lookupPlayer = useCallback(async (identifier: string, playerIndex: number) => {
    // playerIndex est conservé pour compatibilité mais non utilisé dans cette version
    if (playerIndex !== undefined) {
      // Log optionnel pour debug (pas d'impact fonctionnel)
      console.log(`🔍 lookupPlayer pour le joueur index ${playerIndex}`);
    }
    
    if (!identifier.trim()) {
      return { success: false, error: "Identifiant requis" };
    }

    try {
      // Récupérer le token STAFF depuis localStorage ou état
      const token = staffToken || localStorage.getItem('staff_access_token');
      if (!token) {
        return { success: false, error: "Session STAFF expirée. Veuillez vous reconnecter." };
      }

      const city = agentCity || "NANTES";
      const country = agentCountry || "FR";
      
      const response = await fetch(`/api/player/token?identifier=${encodeURIComponent(identifier)}&city=${city}&country=${country}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (!response.ok || !data.success) {
        return { success: false, error: data.error || "Joueur non trouvé ou compte inactif" };
      }
      
      return {
        success: true,
        pseudo: data.player.pseudo || data.player.full_name,
        accessToken: data.access_token,
        playerId: data.player.id
      };
    } catch (error) {
      console.error('Erreur lookupPlayer:', error);
      return { success: false, error: "Erreur réseau. Vérifiez votre connexion." };
    }
  }, [agentCity, agentCountry, staffToken]);

  // Configuration des handlers de messages pour chaque couloir
  useEffect(() => {
    const unsubscribers: (() => void)[] = [];

    for (let laneId = 0; laneId < FIXED_LANE_COUNT; laneId++) {
      const unsubscribe = addMessageHandler(laneId, (data) => {
        console.log(`📥 [Couloir ${laneId}] Message reçu:`, data);
        
        if (data.type === 'pong') {
          setServerResponse(`Pong reçu (couloir ${laneId})`);
        } else if ((data as { type: string }).type === 'log') {
          const log = (data as { content?: string }).content;
          
          if (log && log.includes('🔫 JEU EN COURS - LED ÉTEINTE')) {
            console.log(`🎯 [Couloir ${laneId}] Partie démarrée - passage à in_progress`);
            setActiveGames(prev => {
              const newMap = new Map(prev);
              const game = newMap.get(laneId);
              if (game && game.status === 'waiting') {
                game.status = 'in_progress';
                newMap.set(laneId, game);
              }
              return newMap;
            });
            setServerResponse(`🎯 Couloir ${laneId + 1} - Partie en cours`);
            setRefreshTrigger(prev => prev + 1);
          }
          
          const finishMatch = log && log.match(/🏁 (\S+) \| Score: (\d+) \| Temps: ([\d.]+)s/);
          if (finishMatch) {
            console.log(`🏁 [Couloir ${laneId}] Partie terminée - envoi RESET au Raspberry Pi`);
            
            sendCommand(laneId, 'RESET', '');
            
            setActiveGames(prev => {
              const newMap = new Map(prev);
              newMap.delete(laneId);
              return newMap;
            });
            setServerResponse(`✅ Couloir ${laneId + 1} - Partie terminée`);
            setSelectedGameMode(null);
            setRefreshTrigger(prev => prev + 1);
          }
        } else if (data.type === 'servo_up') {
          setServerResponse(`Servo ${data.servoIndex} levé (couloir ${laneId})`);
        } else if (data.type === 'score') {
          setActiveGames(prev => {
            const newMap = new Map(prev);
            const game = newMap.get(laneId);
            if (game) {
              game.scores.set(data.playerIndex, data.score);
              newMap.set(laneId, game);
            }
            return newMap;
          });
        }
      });
      unsubscribers.push(unsubscribe);
    }

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [addMessageHandler, sendCommand]);

  // ✅ Logger le lancement dans la base STAFF (Version Option B - client direct)
  const logGameLaunch = useCallback(async (
    gameMode: GameModeCode, 
    pseudos: PlayerPseudo[], 
    laneId: number
  ) => {
    if (!agentEmail || !agentCity) {
      console.warn('Email agent ou ville manquant');
      return;
    }
    
    try {
      // ✅ Option B : Utilisation directe de createStaffClient (client unique)
      const supabase = createStaffClient(agentCity, agentCountry);
      
      await supabase.from('game_launches').insert({
        agent_email: agentEmail,
        game_mode: gameMode,
        lane_id: laneId,
        player_pseudos: pseudos,
        created_at: new Date().toISOString(),
        city: agentCity,
        country: agentCountry,
      });
      
      console.log(`✅ Lancement enregistré dans ${agentCity} - Couloir ${laneId + 1}`);
    } catch (error) {
      console.error('Erreur sauvegarde lancement:', error);
    }
  }, [agentEmail, agentCity, agentCountry]);

  // Fonction pour lancer un mode de jeu
  const launchGameMode = useCallback((gameMode: GameModeCode, laneId?: number) => {
    const targetLaneId = laneId ?? selectedLaneId;
    
    if (targetLaneId === null) {
      alert('⚠️ Veuillez sélectionner un couloir');
      return;
    }

    const status = getLaneStatus(targetLaneId);
    if (status !== 'connected') {
      alert('⚠️ Couloir non connecté. Veuillez d\'abord établir la connexion.');
      return;
    }

    if (activeGames.has(targetLaneId)) {
      alert(`⚠️ Une partie est déjà en cours sur le couloir ${targetLaneId + 1}. Attendez qu'elle se termine.`);
      return;
    }

    setSelectedGameMode(gameMode);
    setIsPseudoModalOpen(true);
  }, [selectedLaneId, getLaneStatus, activeGames]);

  // ✅ Fonction pour extraire la distance d'un mode
  const extractDistance = (mode: GameModeCode): string => {
    if (mode.startsWith('P-')) {
      // P-5m, P-10m, P-15m
      return mode.substring(2);
    }
    if (mode.startsWith('L')) {
      // L5m-1J, L10m-2J, etc.
      const match = mode.match(/^L(\d+m)/);
      return match ? match[1] : '5m';
    }
    return '';
  };

  // ✅ Fonction pour extraire le nombre de joueurs d'un mode
  const extractPlayerCount = (mode: GameModeCode): PlayerCount => {
    if (mode.startsWith('P-')) return 1;
    if (mode.startsWith('L')) {
      const match = mode.match(/-(\d)J$/);
      return match ? parseInt(match[1]) as PlayerCount : 1;
    }
    if (mode === 'C-2J') return 2;
    if (mode === 'N-4J') return 4;
    if (mode === 'U-1J') return 1;
    return 1;
  };

  // ✅ Mise à jour d'un pseudo avec token et playerId
  const updatePlayerPseudo = useCallback((playerIndex: number, pseudo: string, accessToken?: string, playerId?: string) => {
    setPlayerPseudos(prev => 
      prev.map(p => p.index === playerIndex ? { ...p, pseudo, accessToken, playerId, isAuthenticated: !!accessToken } : p)
    );
  }, []);

  // ✅ Fonction pour confirmer le lancement de la partie
  const confirmGameLaunch = useCallback(async () => {
    if (!selectedGameMode || selectedLaneId === null) return;

    const playerCount = extractPlayerCount(selectedGameMode);
    const distance = extractDistance(selectedGameMode);

    const validPseudos = playerPseudos.slice(0, playerCount).filter(p => p.pseudo.trim() !== '');
  
    if (validPseudos.length !== playerCount) {
      alert(`⚠️ Veuillez renseigner les ${playerCount} pseudos`);
      return;
    }

    // Envoyer les tokens d'authentification pour chaque joueur
    for (let i = 0; i < validPseudos.length; i++) {
      const player = validPseudos[i];
      if (player.accessToken) {
        const authMessage = JSON.stringify({
          type: "auth",
          pseudo: player.pseudo,
          access_token: player.accessToken
        });
        const authSuccess = sendCommand(selectedLaneId, authMessage, '');
        if (!authSuccess) {
          console.warn(`⚠️ Échec envoi auth pour ${player.pseudo}`);
        } else {
          console.log(`🔐 Auth envoyé pour ${player.pseudo}`);
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      } else {
        console.warn(`⚠️ Aucun token pour ${player.pseudo} - partie non authentifiée`);
      }
    }

    const pseudosForServer = validPseudos.map(p => p.pseudo).join(',');
    let modeForServer = '';
    
    if (selectedGameMode.startsWith('L')) {
      const nbJoueurs = extractPlayerCount(selectedGameMode);
      modeForServer = `LOISIR_${distance}_${nbJoueurs}`;
    } 
    else if (selectedGameMode.startsWith('P-')) {
      modeForServer = `PERSO_${distance}`;
    }
    else if (selectedGameMode === 'C-2J') {
      modeForServer = 'COMPETITION';
    }
    else if (selectedGameMode === 'N-4J') {
      modeForServer = 'NOTORIETE';
    }
    else {
      alert('Mode non disponible');
      return;
    }
    
    const pseudoCommand = `PSEUDOS_${modeForServer}_${pseudosForServer}`;
    const pseudoSuccess = sendCommand(selectedLaneId, pseudoCommand, '');
    if (!pseudoSuccess) {
      alert('❌ Erreur lors de l\'envoi des pseudos');
      return;
    }
    
    const modeSuccess = sendCommand(selectedLaneId, modeForServer, '');
    if (!modeSuccess) {
      alert('❌ Erreur lors de l\'envoi du mode de jeu');
      return;
    }
    
    const armSuccess = sendCommand(selectedLaneId, 'ARM', '');
    if (!armSuccess) {
      alert('❌ Erreur lors de l\'armement du couloir');
      return;
    }

    const newGame: ActiveGame = {
      laneId: selectedLaneId,
      mode: selectedGameMode,
      playerCount,
      pseudos: validPseudos,
      startTime: new Date(),
      scores: new Map(),
      status: 'waiting'
    };
  
    setActiveGames(prev => {
      const newMap = new Map(prev);
      newMap.set(selectedLaneId, newGame);
      return newMap;
    });

    if (agentEmail && agentCity) {
      logGameLaunch(selectedGameMode, validPseudos, selectedLaneId).catch(console.error);
    }

    setServerResponse(`🔴 Couloir ${selectedLaneId + 1} ARMÉ - En attente du clic joueur sur le bouton physique (LED VERTE)`);
    setIsPseudoModalOpen(false);
  
    alert(`✅ Couloir ${selectedLaneId + 1} armé ! Le joueur doit maintenant cliquer sur le bouton physique pour commencer la partie.`);
    
  }, [selectedGameMode, selectedLaneId, playerPseudos, sendCommand, agentEmail, agentCity, logGameLaunch]);

  // Réinitialisation des pseudos
  const resetAllPseudos = useCallback(() => {
    setPlayerPseudos([
      { index: 0, pseudo: '', isAuthenticated: false },
      { index: 1, pseudo: '', isAuthenticated: false },
      { index: 2, pseudo: '', isAuthenticated: false },
      { index: 3, pseudo: '', isAuthenticated: false },
    ]);
  }, []);

  // ✅ Obtenir le nombre de joueurs pour un mode
  const getPlayerCountFromMode = useCallback((mode: GameModeCode): PlayerCount => {
    return extractPlayerCount(mode);
  }, []);

  // Fonction de connexion avec persistance d'état
  const connectLaneWithPersistence = useCallback(async (laneId: number, ip: string) => {
    const success = await connectLane(laneId, ip);
    if (success) {
      updateLaneConnectedState(laneId, true, ip);
      const currentIp = getLaneIp(laneId);
      if (currentIp !== ip) {
        updateLaneIp(laneId, ip);
      }
    } else {
      updateLaneConnectedState(laneId, false, ip);
    }
    return success;
  }, [connectLane, updateLaneIp, getLaneIp]);

  // Fonction de déconnexion avec persistance d'état
  const disconnectLaneWithPersistence = useCallback((laneId: number) => {
    disconnectLane(laneId);
    updateLaneConnectedState(laneId, false, '');
  }, [disconnectLane]);

  return {
    // États
    agentCity,
    agentCountry,
    agentEmail,
    
    // WebSockets (avec persistance)
    lanes,
    selectedLaneId,
    getLaneStatus,
    connectLane: connectLaneWithPersistence,
    disconnectLane: disconnectLaneWithPersistence,
    selectLane,
    connectAllLanes,
    disconnectAllLanes,
    sendCommand,
    addMessageHandler,
    
    // Gestion des IPs
    updateLaneIp,
    getLaneIp,
    
    // Jeu
    selectedGameMode,
    playerPseudos,
    isPseudoModalOpen,
    setIsPseudoModalOpen,
    activeGames,
    serverResponse,
    refreshTrigger,
    
    // Actions
    launchGameMode,
    confirmGameLaunch,
    updatePlayerPseudo,
    resetAllPseudos,
    getPlayerCountFromMode,
    
    // lookupPlayer pour la modale
    lookupPlayer,
  };
}
