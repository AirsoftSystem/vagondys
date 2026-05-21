
// app/staff/mode_jeux/types/game.types.ts

/**
 * Types de modes de jeu
 */
export type GameCategory = 'PERSO' | 'LOISIRS' | 'COMPETITION' | 'NOTORIETE' | 'ULTIMATE';

/**
 * Distance pour la catégorie PERSO
 */
export type PersoDistance = '5m' | '10m' | '15m';

/**
 * Distance pour la catégorie LOISIRS
 */
export type LoisirsDistance = '5m' | '10m' | '15m';

/**
 * Nombre de joueurs
 */
export type PlayerCount = 1 | 2 | 3 | 4;

/**
 * Format d'un mode de jeu
 * 
 * PERSO:    P-5m, P-10m, P-15m (1 joueur)
 * LOISIRS:  L5m-1J, L5m-2J, L5m-3J, L5m-4J, L10m-1J, etc. (1 à 4 joueurs)
 * COMPETITION: C-2J (2 joueurs)
 * NOTORIETE: N-4J (4 joueurs)
 * ULTIMATE: U-1J (1 joueur - en développement)
 */
export type GameModeCode = 
  // PERSO (1 joueur, 3 distances)
  | `P-${PersoDistance}`
  // LOISIRS (1 à 4 joueurs, 3 distances)
  | `L${LoisirsDistance}-${PlayerCount}J`
  // COMPETITION (2 joueurs)
  | `C-2J`
  // NOTORIETE (4 joueurs)
  | `N-4J`
  // ULTIMATE (1 joueur - en développement)
  | `U-1J`;

/**
 * Interface pour un niveau de jeu (PERSO ou LOISIRS)
 */
export interface GameLevel {
  distance: PersoDistance | LoisirsDistance;
  modes: GameModeCode[];
}

/**
 * Interface pour une section de jeu
 */
export interface GameSection {
  label: GameCategory;
  levels?: GameLevel[];         // Pour PERSO et LOISIRS
  modes?: GameModeCode[];       // Pour COMPETITION, NOTORIETE, ULTIMATE
  disabled?: boolean;           // Pour ULTIMATE (en développement)
  alertMessage?: string;        // Message pour mode désactivé
}

/**
 * Interface pour un couloir de tir
 */
export interface ShootingLane {
  id: number;                   // 0 à 7
  name: string;                 // "Couloir 1", "Couloir 2", etc.
  ip: string;                   // Adresse IP du serveur ESP32
  status: 'connected' | 'disconnected' | 'connecting' | 'error';
  lastPing?: number;
  currentMode?: GameModeCode | null;
}

/**
 * Interface pour les pseudos des joueurs
 */
export interface PlayerPseudo {
  index: number;                // 0 à 3
  pseudo: string;
  isAuthenticated?: boolean;
  playerId?: string;            // ID unique du joueur
  accessToken?: string;
}

/**
 * Interface pour une partie en cours
 */
export interface ActiveGame {
  laneId: number;
  mode: GameModeCode;
  playerCount: PlayerCount;
  pseudos: PlayerPseudo[];
  startTime: Date;
  scores: Map<number, number>;  // Index joueur -> score
  status: 'waiting' | 'in_progress' | 'finished';
}
