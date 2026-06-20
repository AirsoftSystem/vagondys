
// lib/workers/batch-saver.ts
import { redis } from "@/lib/redis/client";
import { masterAdmin } from "@/lib/supabase/master";
import { GitHubDB } from "@/lib/github-db/client";

// ==========================================================
// TYPES
// ==========================================================

interface RankingEntry {
  player_id: string;
  rank: number;
  score: number;
  pseudo?: string;
  city?: string;
  country?: string;
}

interface GlobalRankingSnapshot {
  snapshot_date: string;
  total_players: number;
  rankings: RankingEntry[];
  calculated_at: string;
}

interface HistoryEntry {
  player_id: string;
  rank: number;
  score: number;
  week_start: string;
  week_end: string;
}

interface PlayerDetails {
  id: string;
  pseudo: string;
  city: string;
  country: string;
  total_matches: number;
  current_grade_id: number;
}

// ==========================================================
// CONFIGURATION
// ==========================================================

const BATCH_INTERVAL = 5 * 60 * 1000; // 5 minutes
const TOP_LIMIT_GLOBAL = 1000;
const TOP_LIMIT_COUNTRY = 100;
const TOP_LIMIT_CITY = 50;

// ==========================================================
// BATCH SAVER
// ==========================================================

export class BatchSaver {
  private isRunning = true;
  private intervalId: NodeJS.Timeout | null = null;
  private lastSaveTime: Date | null = null;
  private saveCount = 0;

  constructor() {
    console.log('📦 BatchSaver initialisé');
  }

  /**
   * Démarre le batch saver
   */
  start(): void {
    if (this.intervalId) {
      console.warn('⚠️ BatchSaver déjà en cours');
      return;
    }

    console.log(`✅ BatchSaver démarré (intervalle: ${BATCH_INTERVAL / 1000}s)`);
    
    // Exécuter immédiatement un premier save
    this.runBatchSave();

    // Puis périodiquement
    this.intervalId = setInterval(() => {
      this.runBatchSave();
    }, BATCH_INTERVAL);
  }

  /**
   * Arrête le batch saver
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('🛑 BatchSaver arrêté');
    }
    this.isRunning = false;
  }

  /**
   * Récupère les statistiques du batch saver
   */
  getStats(): { lastSave: Date | null; saveCount: number; isRunning: boolean } {
    return {
      lastSave: this.lastSaveTime,
      saveCount: this.saveCount,
      isRunning: this.isRunning
    };
  }

  // ==========================================================
  // MÉTHODES PRIVÉES
  // ==========================================================

  /**
   * Exécute le batch save
   */
  private async runBatchSave(): Promise<void> {
    if (!this.isRunning) return;

    const startTime = Date.now();
    console.log('📦 [BatchSaver] Début de la sauvegarde');

    try {
      // 1. Sauvegarder les classements
      await this.saveRankings();

      // 2. Sauvegarder l'historique
      await this.saveHistory();

      // 3. Sauvegarder en GitHub
      await this.saveToGitHub();

      this.lastSaveTime = new Date();
      this.saveCount++;
      
      const duration = Date.now() - startTime;
      console.log(`✅ [BatchSaver] Sauvegarde terminée en ${duration}ms (${this.saveCount} saves)`);

    } catch (err) {
      console.error('❌ [BatchSaver] Erreur lors de la sauvegarde:', err);
    }
  }

  /**
   * Sauvegarde les classements en base
   */
  private async saveRankings(): Promise<void> {
    try {
      // 1. Sauvegarder le classement mondial
      await this.saveGlobalRanking();

      // 2. Sauvegarder les classements par pays
      await this.saveCountryRankings();

      // 3. Sauvegarder les classements par ville
      await this.saveCityRankings();

    } catch (err) {
      console.error('❌ [BatchSaver] Erreur sauvegarde classements:', err);
      throw err;
    }
  }

  /**
   * Sauvegarde le classement mondial
   */
  private async saveGlobalRanking(): Promise<void> {
    try {
      // ✅ Vérification masterAdmin
      if (!masterAdmin) {
        console.error('❌ [BatchSaver] masterAdmin non disponible');
        return;
      }

      // Récupérer le top 1000 depuis Redis
      const globalRanking = await redis.zrange('ranking:global', 0, TOP_LIMIT_GLOBAL - 1, true);
      
      if (globalRanking.length === 0) {
        console.warn('⚠️ [BatchSaver] Aucun classement mondial à sauvegarder');
        return;
      }

      // Récupérer les détails des joueurs
      const playerIds = globalRanking.map((entry) => entry.member);
      const playerDetails = await this.getPlayerDetails(playerIds);

      // Construire les entrées
      const rankings: RankingEntry[] = globalRanking.map((entry, index) => ({
        player_id: entry.member,
        rank: index + 1,
        score: entry.score,
        pseudo: playerDetails[entry.member]?.pseudo || 'Unknown',
        city: playerDetails[entry.member]?.city || '',
        country: playerDetails[entry.member]?.country || ''
      }));

      // Supprimer l'ancien classement
      await masterAdmin.from('global_rankings').delete().neq('id', 0);

      // Insérer le nouveau classement
      const snapshotDate = new Date().toISOString();
      const entries = rankings.map((r) => ({
        player_id: r.player_id,
        rank: r.rank,
        score: r.score,
        pseudo: r.pseudo,
        city: r.city,
        country: r.country,
        snapshot_date: snapshotDate,
        season: new Date().getFullYear().toString(),
        total_matches: playerDetails[r.player_id]?.total_matches || 0,
        current_grade_id: playerDetails[r.player_id]?.current_grade_id || 1,
        pch: 0
      }));

      // Insertion par lots de 100
      const batchSize = 100;
      for (let i = 0; i < entries.length; i += batchSize) {
        const batch = entries.slice(i, i + batchSize);
        const { error } = await masterAdmin.from('global_rankings').insert(batch);
        if (error) {
          console.error(`❌ [BatchSaver] Erreur insertion global_rankings batch ${i}:`, error);
        }
      }

      console.log(`✅ [BatchSaver] Classement mondial sauvegardé: ${entries.length} joueurs`);

    } catch (err) {
      console.error('❌ [BatchSaver] Erreur saveGlobalRanking:', err);
      throw err;
    }
  }

  /**
   * Sauvegarde les classements par pays
   */
  private async saveCountryRankings(): Promise<void> {
    try {
      // ✅ Vérification masterAdmin
      if (!masterAdmin) {
        console.error('❌ [BatchSaver] masterAdmin non disponible');
        return;
      }

      // Récupérer la liste des pays depuis Redis
      const countryKeys = await redis.get('ranking:countries');
      const countries = countryKeys ? JSON.parse(countryKeys) : ['FR', 'ES'];

      for (const country of countries) {
        const key = `ranking:country:${country}`;
        const ranking = await redis.zrange(key, 0, TOP_LIMIT_COUNTRY - 1, true);
        
        if (ranking.length === 0) continue;

        // Récupérer les détails des joueurs
        const playerIds = ranking.map((entry) => entry.member);
        const playerDetails = await this.getPlayerDetails(playerIds);

        // Construire les entrées
        const entries = ranking.map((entry, index) => ({
          player_id: entry.member,
          country: country,
          rank: index + 1,
          score: entry.score,
          pseudo: playerDetails[entry.member]?.pseudo || 'Unknown',
          city: playerDetails[entry.member]?.city || '',
          snapshot_date: new Date().toISOString()
        }));

        // Supprimer l'ancien classement pour ce pays
        await masterAdmin
          .from('country_rankings')
          .delete()
          .eq('country', country);

        // Insérer le nouveau classement
        const { error } = await masterAdmin.from('country_rankings').insert(entries);
        if (error) {
          console.error(`❌ [BatchSaver] Erreur insertion country_rankings ${country}:`, error);
        }

        console.log(`✅ [BatchSaver] Classement ${country} sauvegardé: ${entries.length} joueurs`);
      }

    } catch (err) {
      console.error('❌ [BatchSaver] Erreur saveCountryRankings:', err);
    }
  }

  /**
   * Sauvegarde les classements par ville
   */
  private async saveCityRankings(): Promise<void> {
    try {
      // ✅ Vérification masterAdmin
      if (!masterAdmin) {
        console.error('❌ [BatchSaver] masterAdmin non disponible');
        return;
      }

      // Récupérer la liste des villes depuis Redis
      const cityKeys = await redis.get('ranking:cities');
      const cities = cityKeys ? JSON.parse(cityKeys) : ['NANTES', 'LYON', 'MADRID'];

      for (const city of cities) {
        const key = `ranking:city:FR:${city}`;
        const ranking = await redis.zrange(key, 0, TOP_LIMIT_CITY - 1, true);
        
        if (ranking.length === 0) continue;

        // Récupérer les détails des joueurs
        const playerIds = ranking.map((entry) => entry.member);
        const playerDetails = await this.getPlayerDetails(playerIds);

        // Construire les entrées
        const entries = ranking.map((entry, index) => ({
          player_id: entry.member,
          city: city,
          country: 'FR',
          rank: index + 1,
          score: entry.score,
          pseudo: playerDetails[entry.member]?.pseudo || 'Unknown',
          snapshot_date: new Date().toISOString()
        }));

        // Supprimer l'ancien classement pour cette ville
        await masterAdmin
          .from('city_rankings')
          .delete()
          .eq('city', city)
          .eq('country', 'FR');

        // Insérer le nouveau classement
        const { error } = await masterAdmin.from('city_rankings').insert(entries);
        if (error) {
          console.error(`❌ [BatchSaver] Erreur insertion city_rankings ${city}:`, error);
        }

        console.log(`✅ [BatchSaver] Classement ${city} sauvegardé: ${entries.length} joueurs`);
      }

    } catch (err) {
      console.error('❌ [BatchSaver] Erreur saveCityRankings:', err);
    }
  }

  /**
   * Sauvegarde l'historique des classements
   */
  private async saveHistory(): Promise<void> {
    try {
      // ✅ Vérification masterAdmin
      if (!masterAdmin) {
        console.error('❌ [BatchSaver] masterAdmin non disponible');
        return;
      }

      // Récupérer l'historique depuis Redis
      const historyKey = 'rankings:history';
      const historyData = await redis.get(historyKey);
      
      if (!historyData) {
        console.log('ℹ️ [BatchSaver] Aucun historique à sauvegarder');
        return;
      }

      const history: HistoryEntry[] = JSON.parse(historyData);
      
      if (history.length === 0) return;

      // Insérer l'historique
      const { error } = await masterAdmin.from('rankings_history').insert(
        history.map((h) => ({
          player_id: h.player_id,
          rank: h.rank,
          previous_rank: h.rank,
          points: h.score,
          week_start: h.week_start,
          week_end: h.week_end,
          city: '',
          country: ''
        }))
      );

      if (error) {
        console.error('❌ [BatchSaver] Erreur insertion rankings_history:', error);
      } else {
        console.log(`✅ [BatchSaver] Historique sauvegardé: ${history.length} entrées`);
        
        // Vider l'historique temporaire
        await redis.del(historyKey);
      }

    } catch (err) {
      console.error('❌ [BatchSaver] Erreur saveHistory:', err);
    }
  }

  /**
   * Sauvegarde les classements dans GitHub
   */
  private async saveToGitHub(): Promise<void> {
    try {
      // Récupérer le top 1000 depuis Redis
      const globalRanking = await redis.zrange('ranking:global', 0, TOP_LIMIT_GLOBAL - 1, true);
      
      if (globalRanking.length === 0) {
        console.warn('⚠️ [BatchSaver] Aucun classement à sauvegarder dans GitHub');
        return;
      }

      // Récupérer les détails des joueurs
      const playerIds = globalRanking.map((entry) => entry.member);
      const playerDetails = await this.getPlayerDetails(playerIds);

      // Construire l'archive
      const snapshot: GlobalRankingSnapshot = {
        snapshot_date: new Date().toISOString(),
        total_players: await redis.zcard('ranking:global'),
        calculated_at: new Date().toISOString(),
        rankings: globalRanking.map((entry, index) => ({
          player_id: entry.member,
          rank: index + 1,
          score: entry.score,
          pseudo: playerDetails[entry.member]?.pseudo || 'Unknown',
          city: playerDetails[entry.member]?.city || '',
          country: playerDetails[entry.member]?.country || ''
        }))
      };

      // Sauvegarder dans GitHub
      const dateStr = new Date().toISOString().split('T')[0];
      const path = `rankings/global/${dateStr}.json.gz`;
      
      const success = await GitHubDB.write(path, snapshot, { compress: true });
      
      if (success) {
        console.log(`✅ [BatchSaver] Classement sauvegardé dans GitHub: ${path}`);
      } else {
        console.error('❌ [BatchSaver] Échec sauvegarde GitHub');
      }

    } catch (err) {
      console.error('❌ [BatchSaver] Erreur saveToGitHub:', err);
    }
  }

  /**
   * ✅ CORRIGÉ : Récupère les détails des joueurs
   */
  private async getPlayerDetails(playerIds: string[]): Promise<Record<string, PlayerDetails>> {
    const details: Record<string, PlayerDetails> = {};

    try {
      // 1. Essayer de lire depuis Redis cache
      const cachedDetails = await redis.hmget('players:details', ...playerIds);
      
      // 2. Pour ceux qui ne sont pas en cache, lire depuis Supabase
      const missingIds: string[] = [];

      for (let i = 0; i < playerIds.length; i++) {
        const cachedValue = cachedDetails[i];
        if (cachedValue !== null && cachedValue !== undefined) {
          try {
            details[playerIds[i]] = JSON.parse(cachedValue);
          } catch {
            // Si le JSON est invalide, on ignore et on va chercher dans Supabase
            missingIds.push(playerIds[i]);
          }
        } else {
          missingIds.push(playerIds[i]);
        }
      }

      if (missingIds.length > 0) {
        // ✅ Vérification masterAdmin
        if (!masterAdmin) {
          console.error('❌ [BatchSaver] masterAdmin non disponible');
          return details;
        }

        const { data: players, error } = await masterAdmin
          .from("athletes")
          .select("id, pseudo, city, country, total_matches, current_grade_id")
          .in("id", missingIds);

        if (!error && players) {
          for (const player of players) {
            details[player.id] = {
              id: player.id,
              pseudo: player.pseudo || '',
              city: player.city || '',
              country: player.country || '',
              total_matches: player.total_matches || 0,
              current_grade_id: player.current_grade_id || 1
            };
          }

          // Mettre en cache les nouveaux joueurs
          for (const player of players) {
            await redis.hset(`player:${player.id}`, {
              pseudo: player.pseudo || '',
              city: player.city || '',
              country: player.country || '',
              total_matches: player.total_matches || 0,
              current_grade_id: player.current_grade_id || 1
            });
          }
        }
      }

    } catch (err) {
      console.error('❌ [BatchSaver] Erreur getPlayerDetails:', err);
    }

    return details;
  }
}

// ==========================================================
// FONCTION DE DÉMARRAGE (pour utilisation en API/cron)
// ==========================================================

let batchSaverInstance: BatchSaver | null = null;

/**
 * Démarre le batch saver
 */
export function startBatchSaver(): BatchSaver {
  if (!batchSaverInstance) {
    batchSaverInstance = new BatchSaver();
    batchSaverInstance.start();
    console.log('🚀 BatchSaver démarré');
  }
  return batchSaverInstance;
}

/**
 * Arrête le batch saver
 */
export function stopBatchSaver(): void {
  if (batchSaverInstance) {
    batchSaverInstance.stop();
    batchSaverInstance = null;
    console.log('🛑 BatchSaver arrêté');
  }
}

/**
 * Récupère les statistiques du batch saver
 */
export function getBatchSaverStats(): { lastSave: Date | null; saveCount: number; isRunning: boolean } | null {
  if (!batchSaverInstance) return null;
  return batchSaverInstance.getStats();
}

/**
 * Exécute une sauvegarde manuelle
 */
export async function manualBatchSave(): Promise<void> {
  if (!batchSaverInstance) {
    batchSaverInstance = new BatchSaver();
    await batchSaverInstance['runBatchSave']();
    batchSaverInstance = null;
  } else {
    await batchSaverInstance['runBatchSave']();
  }
}

// ==========================================================
// EXPORT PAR DÉFAUT
// ==========================================================

export default BatchSaver;
