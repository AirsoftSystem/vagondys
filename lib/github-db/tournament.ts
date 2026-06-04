
// lib/github-db/tournament.ts
import { GitHubDB } from './client';
import type { Match } from './player';

// ==========================================================
// TYPES
// ==========================================================

export interface TournamentRegistration {
  id: string;
  tournament_id: string;
  player_id: string;
  player_pseudo: string;
  player_city: string;
  player_country: string;
  registered_at: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'waiting';
  payment_status: 'pending' | 'paid' | 'refunded';
  payment_method?: string;
  notes?: string;
}

export interface TournamentMatch {
  id: string;
  tournament_id: string;
  round: number;
  match_number: number;
  player1_id: string;
  player2_id: string;
  player1_pseudo: string;
  player2_pseudo: string;
  player1_score: number;
  player2_score: number;
  winner_id: string | null;
  status: 'scheduled' | 'in_progress' | 'completed' | 'walkover';
  scheduled_time: string;
  completed_time?: string;
  referee?: string;
  match_details?: Match; // Détails complets de la partie (tirs, etc.)
}

export interface Tournament {
  id: string;
  name: string;
  description: string;
  city: string;
  country: string;
  start_date: string;
  end_date: string;
  registration_deadline: string;
  max_players: number;
  registered_count: number;
  entry_fee: number;
  prize_pool: number;
  format: 'single_elimination' | 'double_elimination' | 'round_robin' | 'swiss';
  status: 'draft' | 'registration_open' | 'registration_closed' | 'in_progress' | 'completed' | 'cancelled';
  rules: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  rankings_points: number; // Points pour le classement mondial
}

export interface TournamentResult {
  player_id: string;
  player_pseudo: string;
  rank: number;
  points_earned: number;
  prize_earned: number;
  matches_played: number;
  matches_won: number;
  win_rate: number;
}

export interface TournamentStanding {
  tournament_id: string;
  results: TournamentResult[];
  calculated_at: string;
}

// ==========================================================
// CLASSE TOURNAMENTDB
// ==========================================================
export class TournamentDB {
  
  /**
   * Construire le chemin d'un tournoi
   */
  private static getTournamentPath(tournamentId: string): string {
    return `tournaments/${tournamentId}`;
  }
  
  /**
   * Construire le chemin du fichier d'un tournoi
   */
  private static getTournamentInfoPath(tournamentId: string): string {
    return `${this.getTournamentPath(tournamentId)}/info.json.gz`;
  }
  
  /**
   * Construire le chemin des inscriptions d'un tournoi
   */
  private static getRegistrationsPath(tournamentId: string): string {
    return `${this.getTournamentPath(tournamentId)}/registrations.json.gz`;
  }
  
  /**
   * Construire le chemin des matchs d'un tournoi
   */
  private static getMatchesPath(tournamentId: string): string {
    return `${this.getTournamentPath(tournamentId)}/matches.json.gz`;
  }
  
  /**
   * Construire le chemin des résultats d'un tournoi
   */
  private static getStandingsPath(tournamentId: string): string {
    return `${this.getTournamentPath(tournamentId)}/standings.json.gz`;
  }
  
  // ==========================================================
  // CRUD TOURNOIS
  // ==========================================================
  
  /**
   * Créer un nouveau tournoi
   */
  static async createTournament(tournament: Omit<Tournament, 'created_at' | 'updated_at' | 'registered_count'>): Promise<Tournament | null> {
    const now = new Date().toISOString();
    const newTournament: Tournament = {
      ...tournament,
      registered_count: 0,
      created_at: now,
      updated_at: now,
    };
    
    const success = await GitHubDB.write(
      this.getTournamentInfoPath(tournament.id),
      newTournament,
      { compress: true }
    );
    
    if (!success) return null;
    
    // Créer les fichiers vides pour inscriptions, matchs et résultats
    await GitHubDB.write(this.getRegistrationsPath(tournament.id), [], { compress: true });
    await GitHubDB.write(this.getMatchesPath(tournament.id), [], { compress: true });
    await GitHubDB.write(this.getStandingsPath(tournament.id), { results: [], calculated_at: now }, { compress: true });
    
    return newTournament;
  }
  
  /**
   * Récupérer un tournoi par son ID
   */
  static async getTournament(tournamentId: string): Promise<Tournament | null> {
    return GitHubDB.read<Tournament>(this.getTournamentInfoPath(tournamentId));
  }
  
  /**
   * Mettre à jour un tournoi
   */
  static async updateTournament(tournamentId: string, updates: Partial<Omit<Tournament, 'id' | 'created_at'>>): Promise<boolean> {
    const existing = await this.getTournament(tournamentId);
    if (!existing) return false;
    
    const updated: Tournament = {
      ...existing,
      ...updates,
      updated_at: new Date().toISOString(),
    };
    
    return GitHubDB.write(this.getTournamentInfoPath(tournamentId), updated, { compress: true });
  }
  
  /**
   * Lister tous les tournois (avec filtres optionnels)
   */
  static async listTournaments(filters?: {
    city?: string;
    country?: string;
    status?: Tournament['status'];
    year?: number;
  }): Promise<Tournament[]> {
    const tournamentsPath = 'tournaments/';
    const tournamentIds = await GitHubDB.list(tournamentsPath);
    
    const tournaments: Tournament[] = [];
    
    for (const id of tournamentIds) {
      const tournament = await this.getTournament(id);
      if (tournament) {
        // Appliquer les filtres
        if (filters?.city && tournament.city !== filters.city) continue;
        if (filters?.country && tournament.country !== filters.country) continue;
        if (filters?.status && tournament.status !== filters.status) continue;
        if (filters?.year) {
          const tournamentYear = new Date(tournament.start_date).getFullYear();
          if (tournamentYear !== filters.year) continue;
        }
        tournaments.push(tournament);
      }
    }
    
    // Trier par date de début décroissante
    tournaments.sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime());
    
    return tournaments;
  }
  
  // ==========================================================
  // GESTION DES INSCRIPTIONS
  // ==========================================================
  
  /**
   * Récupérer toutes les inscriptions d'un tournoi
   * ✅ CORRIGÉ : Garantit un tableau (jamais null)
   */
  static async getRegistrations(tournamentId: string): Promise<TournamentRegistration[]> {
    const registrations = await GitHubDB.read<TournamentRegistration[]>(this.getRegistrationsPath(tournamentId));
    return registrations || [];
  }
  
  /**
   * Inscrire un joueur à un tournoi
   */
  static async registerPlayer(
    tournamentId: string,
    registration: Omit<TournamentRegistration, 'id' | 'registered_at' | 'status' | 'payment_status'>
  ): Promise<boolean> {
    const tournament = await this.getTournament(tournamentId);
    if (!tournament) return false;
    
    if (tournament.status !== 'registration_open') {
      console.error(`TournamentDB.registerPlayer: Tournoi ${tournamentId} n'accepte plus d'inscriptions`);
      return false;
    }
    
    const registrations = await this.getRegistrations(tournamentId);
    
    // Vérifier si déjà inscrit
    const alreadyRegistered = registrations.some(r => r.player_id === registration.player_id);
    if (alreadyRegistered) {
      console.warn(`TournamentDB.registerPlayer: Joueur ${registration.player_id} déjà inscrit`);
      return false;
    }
    
    // Vérifier la limite de joueurs
    if (tournament.registered_count >= tournament.max_players) {
      console.error(`TournamentDB.registerPlayer: Tournoi ${tournamentId} complet`);
      return false;
    }
    
    const newRegistration: TournamentRegistration = {
      ...registration,
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
      registered_at: new Date().toISOString(),
      status: tournament.max_players - tournament.registered_count <= 5 ? 'waiting' : 'pending',
      payment_status: 'pending',
    };
    
    registrations.push(newRegistration);
    
    // Mettre à jour le compteur
    const success = await GitHubDB.write(this.getRegistrationsPath(tournamentId), registrations, { compress: true });
    
    if (success) {
      await this.updateTournament(tournamentId, {
        registered_count: tournament.registered_count + 1,
      });
    }
    
    return success;
  }
  
  /**
   * Confirmer l'inscription d'un joueur (après paiement)
   */
  static async confirmRegistration(tournamentId: string, playerId: string): Promise<boolean> {
    const registrations = await this.getRegistrations(tournamentId);
    const registration = registrations.find(r => r.player_id === playerId);
    
    if (!registration) return false;
    
    registration.status = 'confirmed';
    registration.payment_status = 'paid';
    
    return GitHubDB.write(this.getRegistrationsPath(tournamentId), registrations, { compress: true });
  }
  
  /**
   * Annuler l'inscription d'un joueur
   * ✅ CORRIGÉ : Logique corrigée (comparaison avec confirmed avant annulation)
   */
  static async cancelRegistration(tournamentId: string, playerId: string): Promise<boolean> {
    const registrations = await this.getRegistrations(tournamentId);
    const index = registrations.findIndex(r => r.player_id === playerId);
    
    if (index === -1) return false;
    
    // Vérifier si le joueur était confirmé avant annulation
    const wasConfirmed = registrations[index].status === 'confirmed';
    
    registrations[index].status = 'cancelled';
    
    const tournament = await this.getTournament(tournamentId);
    if (tournament && wasConfirmed) {
      await this.updateTournament(tournamentId, {
        registered_count: Math.max(0, tournament.registered_count - 1),
      });
    }
    
    return GitHubDB.write(this.getRegistrationsPath(tournamentId), registrations, { compress: true });
  }
  
  // ==========================================================
  // GESTION DES MATCHS DE TOURNOI
  // ==========================================================
  
  /**
   * Récupérer tous les matchs d'un tournoi
   * ✅ CORRIGÉ : Garantit un tableau (jamais null)
   */
  static async getTournamentMatches(tournamentId: string): Promise<TournamentMatch[]> {
    const matches = await GitHubDB.read<TournamentMatch[]>(this.getMatchesPath(tournamentId));
    return matches || [];
  }
  
  /**
   * Ajouter un match à un tournoi
   */
  static async addMatch(tournamentId: string, match: Omit<TournamentMatch, 'id'>): Promise<boolean> {
    const matches = await this.getTournamentMatches(tournamentId);
    
    const newMatch: TournamentMatch = {
      ...match,
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    };
    
    matches.push(newMatch);
    
    return GitHubDB.write(this.getMatchesPath(tournamentId), matches, { compress: true });
  }
  
  /**
   * Mettre à jour le résultat d'un match
   */
  static async updateMatchResult(
    tournamentId: string,
    matchId: string,
    result: {
      player1_score: number;
      player2_score: number;
      winner_id: string | null;
      match_details?: Match;
    }
  ): Promise<boolean> {
    const matches = await this.getTournamentMatches(tournamentId);
    const match = matches.find(m => m.id === matchId);
    
    if (!match) return false;
    
    match.player1_score = result.player1_score;
    match.player2_score = result.player2_score;
    match.winner_id = result.winner_id;
    match.status = 'completed';
    match.completed_time = new Date().toISOString();
    
    if (result.match_details) {
      match.match_details = result.match_details;
    }
    
    const success = await GitHubDB.write(this.getMatchesPath(tournamentId), matches, { compress: true });
    
    // Recalculer les classements si le match est terminé
    if (success) {
      await this.recalculateStandings(tournamentId);
    }
    
    return success;
  }
  
  // ==========================================================
  // CLASSEMENTS DU TOURNOI
  // ==========================================================
  
  /**
   * Récupérer les résultats/classements d'un tournoi
   */
  static async getStandings(tournamentId: string): Promise<TournamentStanding | null> {
    return GitHubDB.read<TournamentStanding>(this.getStandingsPath(tournamentId));
  }
  
  /**
   * Recalculer les classements d'un tournoi
   */
  static async recalculateStandings(tournamentId: string): Promise<TournamentStanding | null> {
    const matches = await this.getTournamentMatches(tournamentId);
    const registrations = await this.getRegistrations(tournamentId);
    const tournament = await this.getTournament(tournamentId);
    
    if (!tournament) return null;
    
    // Compter les victoires par joueur
    const playerStats = new Map<string, { wins: number; losses: number; totalScore: number }>();
    
    for (const registration of registrations) {
      playerStats.set(registration.player_id, { wins: 0, losses: 0, totalScore: 0 });
    }
    
    for (const match of matches) {
      if (match.status === 'completed' && match.winner_id) {
        const winnerStats = playerStats.get(match.winner_id);
        const loserId = match.winner_id === match.player1_id ? match.player2_id : match.player1_id;
        const loserStats = playerStats.get(loserId);
        
        if (winnerStats) {
          winnerStats.wins += 1;
          winnerStats.totalScore += match.winner_id === match.player1_id ? match.player1_score : match.player2_score;
        }
        if (loserStats) {
          loserStats.losses += 1;
        }
      }
    }
    
    // Convertir en tableau et trier
    const results: TournamentResult[] = Array.from(playerStats.entries()).map(([playerId, stats]) => {
      const registration = registrations.find(r => r.player_id === playerId);
      return {
        player_id: playerId,
        player_pseudo: registration?.player_pseudo || 'Unknown',
        rank: 0, // Sera calculé après tri
        points_earned: stats.wins * tournament.rankings_points,
        prize_earned: 0, // À calculer selon la répartition des prix
        matches_played: stats.wins + stats.losses,
        matches_won: stats.wins,
        win_rate: stats.wins + stats.losses > 0 ? (stats.wins / (stats.wins + stats.losses)) * 100 : 0,
      };
    });
    
    // Trier par nombre de victoires, puis par score total
    results.sort((a, b) => {
      if (a.matches_won !== b.matches_won) return b.matches_won - a.matches_won;
      return b.points_earned - a.points_earned;
    });
    
    // Assigner les rangs
    results.forEach((result, index) => {
      result.rank = index + 1;
    });
    
    const standing: TournamentStanding = {
      tournament_id: tournamentId,
      results,
      calculated_at: new Date().toISOString(),
    };
    
    await GitHubDB.write(this.getStandingsPath(tournamentId), standing, { compress: true });
    
    return standing;
  }
  
  /**
   * Récupérer l'historique des tournois d'un joueur
   */
  static async getPlayerTournamentHistory(playerId: string): Promise<TournamentResult[]> {
    const tournaments = await this.listTournaments();
    const playerHistory: TournamentResult[] = [];
    
    for (const tournament of tournaments) {
      if (tournament.status === 'completed') {
        const standings = await this.getStandings(tournament.id);
        if (standings) {
          const playerResult = standings.results.find(r => r.player_id === playerId);
          if (playerResult) {
            playerHistory.push(playerResult);
          }
        }
      }
    }
    
    return playerHistory;
  }
}

// ==========================================================
// EXPORT D'UN CLIENT PRÊT À L'EMPLOI
// ==========================================================
export const tournamentDB = TournamentDB;
