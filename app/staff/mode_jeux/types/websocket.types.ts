
// app/staff/mode_jeux/types/websocket.types.ts

/**
 * Statut de connexion WebSocket
 */
export type WebSocketStatus = 'connected' | 'disconnected' | 'connecting' | 'error';

/**
 * Message WebSocket générique
 */
export interface WebSocketMessage {
  type: string;
  message?: string;
  [key: string]: unknown;
}

/**
 * Message de score reçu du serveur
 */
export interface ScoreMessage {
  type: 'score';
  playerIndex: number;
  points: number;
  pointsbonus: number;
  score: number;
  servoIdx: number;
  timestamp: number;
}

/**
 * Message de statut de jeu
 * ⚠️ SUPPRIMÉ 'BOUTON_E_VIRTUEL' car non supporté par FrNantes1.py
 */
export interface GameStatusMessage {
  type: 'game_status';
  message: 'START' | 'NEXT_PLAYER' | 'NEXT_TURN' | 'FIN_GAME' | 'COUNTDOWN' | 'END_MANCHE';
  playerIndex?: number;
  value?: number;
}

/**
 * Message de timeout
 */
export interface TimeoutMessage {
  type: 'timeout';
  playerIndex: number;
  servoIdx: number;
  timestamp: number;
}

/**
 * Message de levée de servo
 */
export interface ServoUpMessage {
  type: 'servo_up';
  servoIndex: number;
  timestamp: number;
}

/**
 * Message de données de cible
 */
export interface TargetDataMessage {
  type: 'target_data';
  servo: number;
  points: number[];
  timestamp: number;
}

/**
 * Message de ping/pong
 */
export interface PingMessage {
  type: 'ping' | 'pong';
  time: number;
  player?: number;
}

/**
 * Union de tous les types de messages
 */
export type WebSocketIncomingMessage = 
  | ScoreMessage
  | GameStatusMessage
  | TimeoutMessage
  | ServoUpMessage
  | TargetDataMessage
  | PingMessage;

/**
 * Interface pour le gestionnaire de WebSocket par couloir
 */
export interface LaneWebSocket {
  laneId: number;
  socket: WebSocket | null;
  status: WebSocketStatus;
  ip: string;
  name: string;                 // 👈 AJOUTÉ (manquait)
  reconnectAttempts: number;
  lastPingTime: number;
  lastPongTime: number;
  messageHandlers: ((data: WebSocketIncomingMessage) => void)[];
}

/**
 * Interface pour les statistiques en temps réel
 */
export interface LiveStats {
  currentPlayerIndex: number;
  countdown: number;
  cumulativeTimes: Map<number, number>;  // Index joueur -> temps cumulé
  scores: Map<number, number>;            // Index joueur -> score
  pointBonuses: Map<number, number>;      // Index joueur -> bonus
  frequencies: Map<number, Map<number, number>>; // Index joueur -> points -> compteur
  gameState: 'waiting' | 'ready' | 'in_progress' | 'finished';
}

/**
 * Interface pour la configuration d'un couloir
 */
export interface LaneConfig {
  id: number;
  name: string;
  ip: string;
  enabled: boolean;
}
