
// lib/github-db/ranking.ts
import { GitHubDB } from './client';
import type { PlayerProfile } from './player';

// ==========================================================
// TYPES
// ==========================================================

export interface RankingEntry {
  player_id: string;
  pseudo: string;
  city: string;
  country: string;
  rank: number;
  previous_rank: number | null;
  score: number;
  pch: number;        // Points de changement (évolution)
  total_matches: number;
  win_rate: number;
  average_score: number;
  best_score: number;
  current_grade_id: number;
  grade_name: string;
}

export interface GlobalRanking {
  id: string;
  season: string;
  snapshot_date: string;
  rankings: RankingEntry[];
  total_players: number;
  calculated_at: string;
  calculated_by: string;
}

export interface SeasonRanking {
  season: string;
  start_date: string;
  end_date: string;
  rankings: RankingEntry[];
  is_active: boolean;
}

export interface RankingHistory {
  player_id: string;
  history: Array<{
    snapshot_date: string;
    rank: number;
    score: number;
    season: string;
  }>;
}

export interface GradeThreshold {
  grade_id: number;
  grade_name: string;
  min_score: number;
  max_score: number | null;
  icon: string;
}

// ==========================================================
// CONSTANTES
// ==========================================================

const DEFAULT_GRADES: GradeThreshold[] = [
  { grade_id: 1, grade_name: "Guerrier I", min_score: 0, max_score: 99, icon: "/grades/guerrier_1.png" },
  { grade_id: 2, grade_name: "Guerrier II", min_score: 100, max_score: 199, icon: "/grades/guerrier_2.png" },
  { grade_id: 3, grade_name: "Guerrier III", min_score: 200, max_score: 299, icon: "/grades/guerrier_3.png" },
  { grade_id: 4, grade_name: "Élite I", min_score: 300, max_score: 399, icon: "/grades/elite_1.png" },
  { grade_id: 5, grade_name: "Élite II", min_score: 400, max_score: 499, icon: "/grades/elite_2.png" },
  { grade_id: 6, grade_name: "Élite III", min_score: 500, max_score: 599, icon: "/grades/elite_3.png" },
  { grade_id: 7, grade_name: "Maître I", min_score: 600, max_score: 699, icon: "/grades/maitre_1.png" },
  { grade_id: 8, grade_name: "Maître II", min_score: 700, max_score: 799, icon: "/grades/maitre_2.png" },
  { grade_id: 9, grade_name: "Maître III", min_score: 800, max_score: 899, icon: "/grades/maitre_3.png" },
  { grade_id: 10, grade_name: "Grand Maître I", min_score: 900, max_score: 999, icon: "/grades/grand_maitre_1.png" },
  { grade_id: 11, grade_name: "Grand Maître II", min_score: 1000, max_score: 1099, icon: "/grades/grand_maitre_2.png" },
  { grade_id: 12, grade_name: "Grand Maître III", min_score: 1100, max_score: 1199, icon: "/grades/grand_maitre_3.png" },
  { grade_id: 13, grade_name: "Épique I", min_score: 1200, max_score: 1299, icon: "/grades/epique_1.png" },
  { grade_id: 14, grade_name: "Épique II", min_score: 1300, max_score: 1399, icon: "/grades/epique_2.png" },
  { grade_id: 15, grade_name: "Épique III", min_score: 1400, max_score: 1499, icon: "/grades/epique_3.png" },
  { grade_id: 16, grade_name: "Épique IV", min_score: 1500, max_score: 1599, icon: "/grades/epique_4.png" },
  { grade_id: 17, grade_name: "Épique V", min_score: 1600, max_score: 1699, icon: "/grades/epique_5.png" },
  { grade_id: 18, grade_name: "Légende I", min_score: 1700, max_score: 1799, icon: "/grades/legende_1.png" },
  { grade_id: 19, grade_name: "Légende II", min_score: 1800, max_score: 1899, icon: "/grades/legende_2.png" },
  { grade_id: 20, grade_name: "Légende III", min_score: 1900, max_score: 1999, icon: "/grades/legende_3.png" },
  { grade_id: 21, grade_name: "Immortel Mythique1000", min_score: 2000, max_score: 2999, icon: "/grades/immortel_1000.png" },
  { grade_id: 22, grade_name: "Immortel Mythique100", min_score: 3000, max_score: 3999, icon: "/grades/immortel_100.png" },
  { grade_id: 23, grade_name: "Immortel Mythique10", min_score: 4000, max_score: 4999, icon: "/grades/immortel_10.png" },
  { grade_id: 24, grade_name: "Immortel Mythique1", min_score: 5000, max_score: null, icon: "/grades/immortel_1.png" },
];

// ==========================================================
// CLASSE RANKINGDB
// ==========================================================
export class RankingDB {
  
  /**
   * Construire le chemin d'un classement global
   */
  private static getGlobalRankingPath(snapshotDate: string): string {
    return `rankings/global/${snapshotDate}.json.gz`;
  }
  
  /**
   * Construire le chemin d'un classement saisonnier
   */
  private static getSeasonRankingPath(season: string): string {
    return `rankings/seasons/${season}.json.gz`;
  }
  
  /**
   * Construire le chemin de l'historique d'un joueur
   */
  private static getPlayerHistoryPath(playerId: string): string {
    return `rankings/history/${playerId}.json.gz`;
  }
  
  /**
   * Construire le chemin de la configuration des grades
   */
  private static getGradesConfigPath(): string {
    return `global/grades.json`;
  }
  
  // ==========================================================
  // CALCUL DES CLASSEMENTS
  // ==========================================================
  
  /**
   * Calculer le grade d'un joueur en fonction de son score
   */
  static getGradeFromScore(score: number): { grade_id: number; grade_name: string; icon: string } {
    for (let i = DEFAULT_GRADES.length - 1; i >= 0; i--) {
      const grade = DEFAULT_GRADES[i];
      if (score >= grade.min_score) {
        if (grade.max_score === null || score <= grade.max_score) {
          return {
            grade_id: grade.grade_id,
            grade_name: grade.grade_name,
            icon: grade.icon,
          };
        }
      }
    }
    return {
      grade_id: 1,
      grade_name: "Guerrier I",
      icon: "/grades/guerrier_1.png",
    };
  }
  
  /**
   * Calculer les classements mondiaux à partir de la liste des joueurs
   */
  static async calculateGlobalRankings(
    players: PlayerProfile[],
    previousRanking: GlobalRanking | null = null,
    season: string = new Date().getFullYear().toString()
  ): Promise<GlobalRanking> {
    // Trier les joueurs par score décroissant
    const sortedPlayers = [...players].sort((a, b) => b.total_score - a.total_score);
    
    // Créer une map des précédents rangs pour calculer le PCH
    const previousRankMap = new Map<string, number>();
    if (previousRanking) {
      for (const entry of previousRanking.rankings) {
        previousRankMap.set(entry.player_id, entry.rank);
      }
    }
    
    // Construire les entrées de classement
    const rankings: RankingEntry[] = sortedPlayers.map((player, index) => {
      const rank = index + 1;
      const previousRank = previousRankMap.get(player.id) || null;
      const pch = previousRank ? previousRank - rank : 0;
      const winRate = player.total_matches > 0 
        ? (player.total_kills / player.total_matches) * 100 
        : 0;
      const averageScore = player.total_matches > 0 
        ? player.total_score / player.total_matches 
        : 0;
      
      const grade = this.getGradeFromScore(player.total_score);
      
      return {
        player_id: player.id,
        pseudo: player.pseudo,
        city: player.city,
        country: player.country,
        rank,
        previous_rank: previousRank,
        score: player.total_score,
        pch,
        total_matches: player.total_matches,
        win_rate: Math.round(winRate * 100) / 100,
        average_score: Math.round(averageScore * 100) / 100,
        best_score: player.total_score, // À améliorer avec historique
        current_grade_id: grade.grade_id,
        grade_name: grade.grade_name,
      };
    });
    
    const snapshotDate = new Date().toISOString().split('T')[0];
    
    return {
      id: `${season}_${snapshotDate}`,
      season,
      snapshot_date: snapshotDate,
      rankings,
      total_players: players.length,
      calculated_at: new Date().toISOString(),
      calculated_by: 'system',
    };
  }
  
  // ==========================================================
  // SAUVEGARDE ET LECTURE DES CLASSEMENTS
  // ==========================================================
  
  /**
   * Sauvegarder un classement global
   */
  static async saveGlobalRanking(ranking: GlobalRanking): Promise<boolean> {
    const path = this.getGlobalRankingPath(ranking.snapshot_date);
    return GitHubDB.write(path, ranking, { compress: true });
  }
  
  /**
   * Récupérer le dernier classement global
   */
  static async getLatestGlobalRanking(): Promise<GlobalRanking | null> {
    const rankingsPath = 'rankings/global/';
    const files = await GitHubDB.list(rankingsPath);
    
    if (files.length === 0) return null;
    
    // Trier les fichiers par date décroissante (les plus récents d'abord)
    const sortedFiles = files.sort().reverse();
    const latestFile = sortedFiles[0];
    
    return GitHubDB.read<GlobalRanking>(`${rankingsPath}${latestFile}`);
  }
  
  /**
   * Récupérer un classement global par date
   */
  static async getGlobalRankingByDate(date: string): Promise<GlobalRanking | null> {
    return GitHubDB.read<GlobalRanking>(this.getGlobalRankingPath(date));
  }
  
  /**
   * Récupérer tous les classements globaux (pour graphiques)
   */
  static async getAllGlobalRankings(limit: number = 30): Promise<GlobalRanking[]> {
    const rankingsPath = 'rankings/global/';
    const files = await GitHubDB.list(rankingsPath);
    
    const sortedFiles = files.sort().reverse().slice(0, limit);
    const rankings: GlobalRanking[] = [];
    
    for (const file of sortedFiles) {
      const ranking = await GitHubDB.read<GlobalRanking>(`${rankingsPath}${file}`);
      if (ranking) rankings.push(ranking);
    }
    
    return rankings;
  }
  
  /**
   * Sauvegarder un classement saisonnier
   */
  static async saveSeasonRanking(season: string, ranking: SeasonRanking): Promise<boolean> {
    const path = this.getSeasonRankingPath(season);
    return GitHubDB.write(path, ranking, { compress: true });
  }
  
  /**
   * Récupérer un classement saisonnier
   */
  static async getSeasonRanking(season: string): Promise<SeasonRanking | null> {
    return GitHubDB.read<SeasonRanking>(this.getSeasonRankingPath(season));
  }
  
  /**
   * Récupérer tous les classements saisonniers
   */
  static async getAllSeasonRankings(): Promise<SeasonRanking[]> {
    const seasonsPath = 'rankings/seasons/';
    const files = await GitHubDB.list(seasonsPath);
    
    const seasons: SeasonRanking[] = [];
    for (const file of files) {
      const season = await GitHubDB.read<SeasonRanking>(`${seasonsPath}${file}`);
      if (season) seasons.push(season);
    }
    
    return seasons.sort((a, b) => b.season.localeCompare(a.season));
  }
  
  // ==========================================================
  // HISTORIQUE PAR JOUEUR
  // ==========================================================
  
  /**
   * Mettre à jour l'historique d'un joueur
   */
  static async updatePlayerHistory(playerId: string, currentRanking: GlobalRanking): Promise<boolean> {
    const history = await this.getPlayerHistory(playerId);
    const currentEntry = currentRanking.rankings.find(r => r.player_id === playerId);
    
    if (!currentEntry) return false;
    
    const newHistoryPoint = {
      snapshot_date: currentRanking.snapshot_date,
      rank: currentEntry.rank,
      score: currentEntry.score,
      season: currentRanking.season,
    };
    
    // Éviter les doublons (même date)
    const lastEntry = history.history[history.history.length - 1];
    if (lastEntry && lastEntry.snapshot_date === currentRanking.snapshot_date) {
      history.history[history.history.length - 1] = newHistoryPoint;
    } else {
      history.history.push(newHistoryPoint);
    }
    
    // Garder seulement les 100 derniers points d'historique
    if (history.history.length > 100) {
      history.history = history.history.slice(-100);
    }
    
    return GitHubDB.write(this.getPlayerHistoryPath(playerId), history, { compress: true });
  }
  
  /**
   * Récupérer l'historique d'un joueur
   */
  static async getPlayerHistory(playerId: string): Promise<RankingHistory> {
    const history = await GitHubDB.read<RankingHistory>(this.getPlayerHistoryPath(playerId));
    if (!history) {
      return {
        player_id: playerId,
        history: [],
      };
    }
    return history;
  }
  
  /**
   * Récupérer le meilleur rank d'un joueur
   */
  static async getPlayerBestRank(playerId: string): Promise<{ rank: number; date: string } | null> {
    const history = await this.getPlayerHistory(playerId);
    if (history.history.length === 0) return null;
    
    let bestRank = Infinity;
    let bestRankDate = '';
    
    for (const entry of history.history) {
      if (entry.rank < bestRank) {
        bestRank = entry.rank;
        bestRankDate = entry.snapshot_date;
      }
    }
    
    return { rank: bestRank, date: bestRankDate };
  }
  
  // ==========================================================
  // CLASSEMENT PAR VILLE/PAYS
  // ==========================================================
  
  /**
   * Calculer le classement d'une ville spécifique
   */
  static async getCityRanking(cityCode: string, countryCode: string = 'FR'): Promise<RankingEntry[]> {
    const latestRanking = await this.getLatestGlobalRanking();
    if (!latestRanking) return [];
    
    const cityRankings = latestRanking.rankings.filter(
      r => r.city.toUpperCase() === cityCode.toUpperCase() && 
           r.country.toUpperCase() === countryCode.toUpperCase()
    );
    
    // Re-rank les joueurs de la ville
    return cityRankings.map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));
  }
  
  /**
   * Récupérer le top N joueurs d'une ville
   */
  static async getCityTopPlayers(cityCode: string, countryCode: string = 'FR', limit: number = 10): Promise<RankingEntry[]> {
    const cityRanking = await this.getCityRanking(cityCode, countryCode);
    return cityRanking.slice(0, limit);
  }
  
  // ==========================================================
  // CONFIGURATION DES GRADES
  // ==========================================================
  
  /**
   * Récupérer la configuration des grades
   */
  static async getGradesConfig(): Promise<GradeThreshold[]> {
    const config = await GitHubDB.read<GradeThreshold[]>(this.getGradesConfigPath());
    return config || DEFAULT_GRADES;
  }
  
  /**
   * Sauvegarder la configuration des grades
   */
  static async saveGradesConfig(grades: GradeThreshold[]): Promise<boolean> {
    return GitHubDB.write(this.getGradesConfigPath(), grades);
  }
  
  // ==========================================================
  // STATISTIQUES GLOBALES
  // ==========================================================
  
  /**
   * Récupérer les statistiques globales (moyennes, top scores, etc.)
   */
  static async getGlobalStats(): Promise<{
    total_players: number;
    average_score: number;
    top_score: number;
    top_player: string | null;
    total_matches_all: number;
    active_players: number;
    last_updated: string;
  } | null> {
    const latestRanking = await this.getLatestGlobalRanking();
    if (!latestRanking) return null;
    
    let totalScore = 0;
    let topScore = 0;
    let topPlayer: string | null = null;
    let totalMatches = 0;
    
    for (const entry of latestRanking.rankings) {
      totalScore += entry.score;
      if (entry.score > topScore) {
        topScore = entry.score;
        topPlayer = entry.pseudo;
      }
      totalMatches += entry.total_matches;
    }
    
    // Joueurs actifs (au moins 10 matchs)
    const activePlayers = latestRanking.rankings.filter(r => r.total_matches >= 10).length;
    
    return {
      total_players: latestRanking.total_players,
      average_score: totalScore / latestRanking.total_players,
      top_score: topScore,
      top_player: topPlayer,
      total_matches_all: totalMatches,
      active_players: activePlayers,
      last_updated: latestRanking.calculated_at,
    };
  }
}

// ==========================================================
// EXPORT D'UN CLIENT PRÊT À L'EMPLOI
// ==========================================================
export const rankingDB = RankingDB;
