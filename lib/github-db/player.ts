
// lib/github-db/player.ts
import { GitHubDB } from './client';

// ==========================================================
// TYPES
// ==========================================================

export interface Shot {
  tir_number: number;
  target_id: number;
  points: number;
  bonus: number;
  x: number;      // Coordonnée relative X (-1 à 1)
  y: number;      // Coordonnée relative Y (-1 à 1)
  zone: number;   // Sous-zone (0-5 pour centrale, 0-6 pour périph)
  timestamp: number; // Temps dans la partie (ms)
}

export interface Match {
  id: string;
  date: string;
  duration: number;     // en secondes
  score: number;
  kills: number;
  deaths: number;
  assists: number;
  shots: Shot[];        // Tableau des 20 tirs avec coordonnées
  win: boolean;
  game_group: string;   // CPT1, COMPETITION, LOISIR, etc.
  shot_distribution?: Record<string, number>; // Pré-calculé optionnel
}

export interface PlayerProfile {
  id: string;
  email: string;
  full_name: string;
  pseudo: string;
  city: string;
  country: string;
  dossier_ref: string;
  created_at: string;
  updated_at: string;
  total_matches: number;
  total_score: number;
  total_shots: number;
  total_kills: number;
  total_deaths: number;
  total_assists: number;
  total_hits_head: number;
  total_hits_body: number;
  total_hits_legs: number;
  current_rank: string;
  current_grade_id: number;
  precision_progress: number;
  current_cycle_shot_count: number;
  current_cycle_precision: number;
}

export interface PlayerMessage {
  id: string;
  sender: string;
  content: string;
  created_at: string;
  read: boolean;
  type: 'user' | 'staff' | 'system';
}

// ==========================================================
// CLASSE PLAYERDB
// ==========================================================
export class PlayerDB {
  
  /**
   * Construire le chemin du dossier d'un joueur
   */
  private static getPlayerPath(playerId: string): string {
    return `players/${playerId}`;
  }
  
  /**
   * Construire le chemin du fichier de profil
   */
  private static getProfilePath(playerId: string): string {
    return `${this.getPlayerPath(playerId)}/profile.json.gz`;
  }
  
  /**
   * Construire le chemin du fichier de messages
   */
  private static getMessagesPath(playerId: string): string {
    return `${this.getPlayerPath(playerId)}/messages.json.gz`;
  }
  
  /**
   * Construire le chemin du fichier des parties pour un mois donné
   */
  private static getMatchesPath(playerId: string, year: number, month: number): string {
    const monthStr = String(month).padStart(2, '0');
    return `${this.getPlayerPath(playerId)}/matches/${year}/${monthStr}.json.gz`;
  }
  
  /**
   * Récupérer le profil d'un joueur
   */
  static async getProfile(playerId: string): Promise<PlayerProfile | null> {
    return GitHubDB.read<PlayerProfile>(this.getProfilePath(playerId));
  }
  
  /**
   * Mettre à jour le profil d'un joueur (fusion partielle)
   */
  static async updateProfile(
    playerId: string,
    updates: Partial<Omit<PlayerProfile, 'id' | 'created_at'>>
  ): Promise<boolean> {
    const existing = await this.getProfile(playerId);
    if (!existing) {
      console.error(`PlayerDB.updateProfile: Joueur ${playerId} introuvable`);
      return false;
    }
    
    const updated: PlayerProfile = {
      ...existing,
      ...updates,
      updated_at: new Date().toISOString(),
    };
    
    return GitHubDB.write(this.getProfilePath(playerId), updated, { compress: true });
  }
  
  /**
   * Créer un nouveau profil joueur (première connexion)
   */
  static async createProfile(profile: PlayerProfile): Promise<boolean> {
    const exists = await GitHubDB.exists(this.getProfilePath(profile.id));
    if (exists) {
      console.warn(`PlayerDB.createProfile: Le profil ${profile.id} existe déjà`);
      return false;
    }
    
    return GitHubDB.write(this.getProfilePath(profile.id), profile, { compress: true });
  }
  
  /**
   * Récupérer les messages d'un joueur
   * ✅ CORRIGÉ : Garantit un tableau (jamais null)
   */
  static async getMessages(playerId: string): Promise<PlayerMessage[]> {
    const messages = await GitHubDB.read<PlayerMessage[]>(this.getMessagesPath(playerId));
    return messages || [];
  }
  
  /**
   * Ajouter un message à la messagerie d'un joueur
   */
  static async addMessage(playerId: string, message: Omit<PlayerMessage, 'id' | 'created_at'>): Promise<boolean> {
    const existing = await this.getMessages(playerId);
    const newMessage: PlayerMessage = {
      ...message,
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
      created_at: new Date().toISOString(),
    };
    
    existing.push(newMessage);
    return GitHubDB.write(this.getMessagesPath(playerId), existing, { compress: true });
  }
  
  /**
   * Récupérer les parties d'un joueur pour un mois spécifique
   */
  static async getMatchesByMonth(
    playerId: string,
    year: number,
    month: number
  ): Promise<Match[]> {
    const path = this.getMatchesPath(playerId, year, month);
    const matches = await GitHubDB.read<Match[]>(path);
    return matches || [];
  }
  
  /**
   * Récupérer TOUTES les parties d'un joueur (tous mois/années)
   * ⚠️ Peut être lent pour les joueurs avec beaucoup d'historique
   * ✅ CORRIGÉ : 'const' au lieu de 'let'
   */
  static async getAllMatches(playerId: string): Promise<Match[]> {
    const matchesPath = `${this.getPlayerPath(playerId)}/matches/`;
    const years = await GitHubDB.list(matchesPath);
    
    const allMatches: Match[] = [];
    
    for (const year of years) {
      const yearPath = `${matchesPath}${year}`;
      const months = await GitHubDB.list(yearPath);
      
      for (const monthFile of months) {
        const month = parseInt(monthFile.replace('.json.gz', ''), 10);
        const matches = await this.getMatchesByMonth(playerId, parseInt(year, 10), month);
        allMatches.push(...matches);
      }
    }
    
    // Trier par date décroissante (plus récent en premier)
    allMatches.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    return allMatches;
  }
  
  /**
   * Récupérer les parties avec pagination (pour performance)
   * ✅ CORRIGÉ : 'const' pour allYearMatches
   */
  static async getMatchesPaginated(
    playerId: string,
    options?: { limit?: number; offset?: number; year?: number; month?: number }
  ): Promise<{ matches: Match[]; total: number }> {
    const { limit = 50, offset = 0, year, month } = options || {};
    
    let matches: Match[];
    
    if (year && month) {
      matches = await this.getMatchesByMonth(playerId, year, month);
    } else if (year) {
      // Toute l'année
      const allYearMatches: Match[] = [];
      for (let m = 1; m <= 12; m++) {
        const monthMatches = await this.getMatchesByMonth(playerId, year, m);
        allYearMatches.push(...monthMatches);
      }
      matches = allYearMatches;
    } else {
      matches = await this.getAllMatches(playerId);
    }
    
    // Trier par date décroissante
    matches.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    const total = matches.length;
    const paginated = matches.slice(offset, offset + limit);
    
    return { matches: paginated, total };
  }
  
  /**
   * Ajouter une partie à l'historique d'un joueur
   */
  static async addMatch(playerId: string, match: Match): Promise<boolean> {
    const date = new Date(match.date);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    
    // 1. Lire les parties existantes du mois
    const existingMatches = await this.getMatchesByMonth(playerId, year, month);
    
    // 2. Ajouter la nouvelle partie
    existingMatches.push(match);
    
    // 3. Écrire dans GitHub
    const success = await GitHubDB.write(
      this.getMatchesPath(playerId, year, month),
      existingMatches,
      { compress: true, message: `Add match ${match.id} for player ${playerId}` }
    );
    
    // 4. Mettre à jour les stats cumulées dans le profil
    if (success) {
      await this.updatePlayerStats(playerId, match);
    }
    
    return success;
  }
  
  /**
   * Mettre à jour les statistiques cumulées d'un joueur après une partie
   * ✅ CORRIGÉ : 'const' pour shotDistribution
   */
  private static async updatePlayerStats(playerId: string, match: Match): Promise<void> {
    const profile = await this.getProfile(playerId);
    if (!profile) return;
    
    // Calculer les hits par zone depuis les shots
    let hitsHead = 0;
    let hitsBody = 0;
    let hitsLegs = 0;
    const shotDistribution: Record<string, number> = {};
    
    for (const shot of match.shots) {
      if (shot.zone >= 8 && shot.zone <= 10) hitsHead++;
      else if (shot.zone >= 4 && shot.zone <= 7) hitsBody++;
      else if (shot.zone >= 1 && shot.zone <= 3) hitsLegs++;
      
      const zoneKey = `zone_${shot.zone}`;
      shotDistribution[zoneKey] = (shotDistribution[zoneKey] || 0) + 1;
    }
    
    const updatedStats = {
      total_matches: (profile.total_matches || 0) + 1,
      total_score: (profile.total_score || 0) + match.score,
      total_shots: (profile.total_shots || 0) + match.shots.length,
      total_kills: (profile.total_kills || 0) + (match.kills || 0),
      total_deaths: (profile.total_deaths || 0) + (match.deaths || 0),
      total_assists: (profile.total_assists || 0) + (match.assists || 0),
      total_hits_head: (profile.total_hits_head || 0) + hitsHead,
      total_hits_body: (profile.total_hits_body || 0) + hitsBody,
      total_hits_legs: (profile.total_hits_legs || 0) + hitsLegs,
      updated_at: new Date().toISOString(),
    };
    
    await this.updateProfile(playerId, updatedStats);
  }
  
  /**
   * Récupérer les années disponibles pour l'historique d'un joueur
   */
  static async getAvailableYears(playerId: string): Promise<number[]> {
    const matchesPath = `${this.getPlayerPath(playerId)}/matches/`;
    const years = await GitHubDB.list(matchesPath);
    return years.map(y => parseInt(y, 10)).filter(y => !isNaN(y));
  }
  
  /**
   * Récupérer les mois disponibles pour une année donnée
   */
  static async getAvailableMonths(playerId: string, year: number): Promise<number[]> {
    const yearPath = `${this.getPlayerPath(playerId)}/matches/${year}/`;
    const months = await GitHubDB.list(yearPath);
    return months
      .map(m => parseInt(m.replace('.json.gz', ''), 10))
      .filter(m => !isNaN(m));
  }
  
  /**
   * Supprimer une partie (utile pour corrections)
   */
  static async deleteMatch(playerId: string, matchId: string): Promise<boolean> {
    const allMatches = await this.getAllMatches(playerId);
    const matchToDelete = allMatches.find(m => m.id === matchId);
    
    if (!matchToDelete) {
      console.warn(`PlayerDB.deleteMatch: Partie ${matchId} non trouvée`);
      return false;
    }
    
    const date = new Date(matchToDelete.date);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    
    const monthMatches = await this.getMatchesByMonth(playerId, year, month);
    const filtered = monthMatches.filter(m => m.id !== matchId);
    
    if (filtered.length === 0) {
      // Si plus aucune partie ce mois-ci, on supprime le fichier
      const path = this.getMatchesPath(playerId, year, month);
      return GitHubDB.delete(path, `Delete empty match file for ${playerId} - ${year}/${month}`);
    }
    
    return GitHubDB.write(
      this.getMatchesPath(playerId, year, month),
      filtered,
      { compress: true, message: `Delete match ${matchId} for player ${playerId}` }
    );
  }
  
  /**
   * Calculer la précision d'un cycle (basée sur les N derniers tirs)
   */
  static async calculateCyclePrecision(
    playerId: string,
    cycleSize: number = 100
  ): Promise<{ precision: number; shotCount: number }> {
    const allMatches = await this.getAllMatches(playerId);
    
    // Extraire tous les tirs dans l'ordre chronologique
    const allShots: Shot[] = [];
    for (const match of allMatches) {
      for (const shot of match.shots) {
        allShots.push(shot);
      }
    }
    
    // Prendre les N derniers tirs
    const recentShots = allShots.slice(-cycleSize);
    const hitCount = recentShots.filter(s => s.points > 0).length;
    const precision = recentShots.length > 0 ? (hitCount / recentShots.length) * 100 : 0;
    
    return {
      precision: Math.round(precision * 100) / 100,
      shotCount: recentShots.length,
    };
  }
}

// ==========================================================
// EXPORT D'UN CLIENT PRÊT À L'EMPLOI
// ==========================================================
export const playerDB = PlayerDB;
