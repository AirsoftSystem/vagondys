
/**
 * ==========================================================
 * TYPES OFFICIELS CENTRALISÉS POUR VAGONDYS
 * ==========================================================
 * Ce fichier contient tous les types partagés entre l'application
 * Il évite la duplication et assure la cohérence des données
 */

// ==========================================================
// TYPES UTILITAIRES DE BASE
// ==========================================================

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = Record<string, JsonValue>;

// ==========================================================
// TYPES DES VILLES ET LOCALISATION
// ==========================================================

export interface CityConfig {
  code: string;        // NANTES, LYON, MADRID
  country: string;     // FR, ES, etc.
  name: string;        // VAGONDYS Nantes
  timezone: string;    // Europe/Paris, Europe/Madrid
}

export type SupportedCity = 'NANTES' | 'LYON' | 'MADRID';
export type SupportedCountry = 'FR' | 'ES';

// ==========================================================
// TYPES JOUEURS (ATHLÈTES)
// ==========================================================

export interface AthleteProfile {
  id: string;
  email: string;
  full_name: string;
  pseudo: string | null;
  phone: string | null;
  rank: string;
  status: 'ACTIF' | 'INACTIF' | 'SUSPENDU';
  city: string;
  country: string;
  created_at: string;
  dossier_ref: string | null;
  avatar_url?: string | null;
}

export interface AthleteStats {
  total_matches: number;
  wins: number;
  losses: number;
  win_rate: number;
  current_rank: number;
  best_rank: number;
  total_points: number;
}

// ==========================================================
// TYPES MATCHS (HISTORIQUE)
// ==========================================================

export interface MatchRecord {
  id: string;
  player1_id: string;
  player1_name: string;
  player1_score: number;
  player2_id: string;
  player2_name: string;
  player2_score: number;
  winner_id: string;
  winner_name: string;
  match_date: string;
  created_at: string;
  city: string;
  country: string;
  verified_by?: string;
}

export interface MatchStats {
  match_id: string;
  player_id: string;
  precision?: number;
  power?: number;
  technique?: number;
  mental?: number;
  experience_gained: number;
}

// ==========================================================
// TYPES TOURNOIS
// ==========================================================

export interface TournamentResult {
  id: string;
  tournament_name: string;
  tournament_date: string;
  player_id: string;
  player_name: string;
  position: number;
  points_gained: number;
  category: string;
  city: string;
  country: string;
  verified: boolean;
}

export interface TournamentRanking {
  player_id: string;
  player_name: string;
  total_points: number;
  tournaments_played: number;
  best_position: number;
  city: string;
  country: string;
  week: string;
}

// ==========================================================
// TYPES CLASSEMENTS HEBDOMADAIRES
// ==========================================================

export interface WeeklyRanking {
  id: string;
  player_id: string;
  player_name: string;
  rank: number;
  previous_rank: number;
  points: number;
  week_start: string;
  week_end: string;
  city: string;
  country: string;
}

// ==========================================================
// TYPES NOTORIÉTÉ (AS-EG)
// ==========================================================

export interface AS_EG_Session {
  id: string;
  player_id: string;
  player_name: string;
  session_type: 'PCH' | 'TS' | 'CHALLENGER';
  score: number;
  max_score: number;
  duration_seconds: number;
  created_at: string;
  city: string;
  country: string;
  archived: boolean;
  archived_at?: string;
}

// ==========================================================
// TYPES DOSSIERS DE CONTACT
// ==========================================================

export interface PendingSignal {
  id: string;
  dossier_ref: string;
  payload: {
    name: string;
    email: string;
    phone?: string;
    subject: string;
    message: string;
    city?: string;
    country?: string;
  };
  confirmed: boolean;
  is_read: boolean;
  is_new_athlete: boolean;
  created_at: string;
}

export interface CommunicationReply {
  id: string;
  dossier_ref: string;
  agent_email: string;
  content: string;
  document_url: string | null;
  created_at: string;
}

// ==========================================================
// TYPES ARCHIVES
// ==========================================================

export interface ArchiveMetadata {
  dossier_ref: string;
  year: number;
  month: number;
  file_size: number;
  compressed_size: number;
  url: string;
  created_at: string;
}

export interface PlayerArchive {
  id: string;
  player_id: string;
  player_email: string;
  year: number;
  archive_url: string;
  archive_size: number;
  city: string;
  country: string;
  created_at: string;
  last_accessed_at: string | null;
  access_count: number;
}

// ==========================================================
// TYPES API & REQUÊTES
// ==========================================================

export interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface ArchiveYearRequest {
  year: number;
  city_code: string;
  country_code?: string;
  force?: boolean;
}

// ==========================================================
// TYPES STAFF & PERMISSIONS
// ==========================================================

export interface StaffMember {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'MANAGER' | 'OFFICIAL';
  city: string;
  country: string;
  permissions: StaffPermission[];
}

export type StaffPermission = 
  | 'VIEW_PLAYERS'
  | 'EDIT_PLAYERS'
  | 'VIEW_MATCHES'
  | 'EDIT_MATCHES'
  | 'VIEW_TOURNAMENTS'
  | 'EDIT_TOURNAMENTS'
  | 'VIEW_ARCHIVES'
  | 'RESTORE_ARCHIVES'
  | 'MANAGE_STAFF'
  | 'MANAGE_SETTINGS';

// ==========================================================
// TYPES CONFIGURATION
// ==========================================================

export interface AppConfig {
  purge_retention_days: {
    matches: number;      // 730 jours = 2 ans
    tournaments: number;  // 730 jours = 2 ans
    rankings: number;     // 730 jours = 2 ans
    as_eg: number;        // 365 jours = 1 an
  };
  archive_enabled: boolean;
  archive_frequency: 'daily' | 'weekly' | 'monthly';
  max_free_storage_mb: number;
}

// ==========================================================
// TYPES POUR LE TABLEAU DE SUIVI (INTERNE)
// ==========================================================

export type FileStatus = '✅ FAIT' | '❌ À FAIRE' | '🆕 À CRÉER' | '⏳ EN COURS';
export type PriorityLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface FileTracking {
  id: number;
  path: string;
  action: string;
  status: FileStatus;
  priority: PriorityLevel;
}
