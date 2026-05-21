// app/staff/types/dashboard.ts

/**
 * Informations de la station (ville)
 */
export interface CityInfo {
  name: string;           // NANTES, LYON, etc.
  country: string;        // FR, ES, etc.
  totalAthletes: number;  // Total des licenciés
  activeAthletes: number; // Status = 'ACTIF'
  staffCount?: number;    // Nombre d'agents (optionnel)
}

/**
 * Statistiques globales du dashboard
 */
export interface DashboardStats {
  totalAthletes: number;
  activeAthletes: number;
  pendingMessages: number;      // pending_signals non lus
  todayMatches: number;         // match_history du jour
  totalGameLaunches: number;    // game_launches total
  newAthletesThisMonth: number; // athletes créés ce mois
  newAthletesCount?: number;    // Pour compatibilité avec le code existant
  unreadCount?: number;         // Pour compatibilité avec le code existant
}

/**
 * Activité récente (messages, lancements, matchs)
 */
export interface RecentActivity {
  id: string;
  type: 'message' | 'game_launch' | 'match' | 'inscription';
  title: string;
  description: string;
  timestamp: string;
  user?: string;
  link?: string;
  // ✅ CORRECTION : Remplacé 'any' par un type plus précis
  metadata?: Record<string, unknown> | null;
}

/**
 * Top joueurs (classement)
 */
export interface TopPlayer {
  id: string;
  pseudo: string | null;
  full_name: string;
  points: number;
  rank: string;
  matchesPlayed: number;
  winRate: number;
  avatar_url?: string | null;
}

/**
 * Réponse du hook useDashboardData
 */
export interface DashboardData {
  cityInfo: CityInfo | null;
  stats: DashboardStats;
  recentActivities: RecentActivity[];
  topPlayers: TopPlayer[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}
