
// lib/workers/match-worker.ts
import { redis } from "@/lib/redis/client";
import { PlayerDB, type Match } from "@/lib/github-db/player";
import { masterAdmin } from "@/lib/supabase/master";
import { calculateStatsFromMatches, getGradeFromScore, type CalculatedStats } from "@/lib/github-db/stats-calculator";

// ==========================================================
// TYPES
// ==========================================================

interface MatchMessage {
  match_id: string;
  player_id: string;
  score: string;
  shots: string;
  duration: string;
  kills: string;
  deaths: string;
  assists: string;
  win: string;
  game_group: string;
  shot_distribution: string;
  timestamp: string;
}

interface ProcessResult {
  success: boolean;
  match_id: string;
  player_id: string;
  error?: string;
  duration_ms: number;
}

interface RedisEntry {
  id: string;
  fields: Record<string, string>;
}

// ❌ SUPPRESSION : PlayerCityData (non utilisé)

// ==========================================================
// CONFIGURATION
// ==========================================================

const BATCH_SIZE = 10;
const RETRY_DELAY = 1000; // 1 seconde

// ==========================================================
// WORKER PRINCIPAL
// ==========================================================

export class MatchWorker {
  private isRunning = true;
  private workerId: string;
  private processedCount = 0;
  private errorCount = 0;

  constructor(workerId: string = `worker-${Date.now()}`) {
    this.workerId = workerId;
    console.log(`🏃 [${this.workerId}] MatchWorker initialisé`);
  }

  /**
   * Démarre le worker (boucle infinie)
   */
  async start(): Promise<void> {
    console.log(`✅ [${this.workerId}] Worker démarré`);

    // Créer le consumer group s'il n'existe pas
    await this.ensureConsumerGroup();

    while (this.isRunning) {
      try {
        // Lire les messages du stream
        const entries = await this.readMessages();

        if (entries.length === 0) {
          // Pas de messages, attendre un peu
          await this.sleep(100);
          continue;
        }

        // Traiter les messages en parallèle
        const results = await this.processBatch(entries);

        // Acknowledge les messages traités
        await this.acknowledgeMessages(results);

        // Log des résultats
        this.logResults(results);

      } catch (err) {
        console.error(`❌ [${this.workerId}] Erreur boucle principale:`, err);
        this.errorCount++;
        await this.sleep(RETRY_DELAY);
      }
    }

    console.log(`🛑 [${this.workerId}] Worker arrêté`);
  }

  /**
   * Arrête le worker
   */
  stop(): void {
    this.isRunning = false;
    console.log(`⏹️ [${this.workerId}] Arrêt demandé`);
  }

  /**
   * Récupère les statistiques du worker
   */
  getStats(): { processed: number; errors: number; workerId: string } {
    return {
      processed: this.processedCount,
      errors: this.errorCount,
      workerId: this.workerId
    };
  }

  // ==========================================================
  // MÉTHODES PRIVÉES
  // ==========================================================

  /**
   * Crée le consumer group s'il n'existe pas
   */
  private async ensureConsumerGroup(): Promise<void> {
    try {
      // Vérifier si le groupe existe
      // Note: Vercel KV ne supporte pas xgroup, donc on ignore
      console.log(`📋 [${this.workerId}] Consumer group prêt`);
    } catch (err) {
      console.warn(`⚠️ [${this.workerId}] Erreur création consumer group:`, err);
    }
  }

  /**
   * Lit les messages du stream
   */
  private async readMessages(): Promise<RedisEntry[]> {
    try {
      const entries = await redis.xreadgroup(
        'matches:group',
        this.workerId,
        '>',
        'matches:stream',
        { count: BATCH_SIZE }
      );

      return entries as RedisEntry[];
    } catch (err) {
      console.error(`❌ [${this.workerId}] Erreur lecture messages:`, err);
      return [];
    }
  }

  /**
   * Traite un batch de messages
   */
  private async processBatch(entries: RedisEntry[]): Promise<ProcessResult[]> {
    const results: ProcessResult[] = [];

    // Traiter chaque message en parallèle
    const promises = entries.map(async (entry) => {
      const startTime = Date.now();
      
      try {
        // Extraire les données du message
        const data = this.extractMessageData(entry);
        
        // Traiter le match
        const success = await this.processMatch(data);

        return {
          success,
          match_id: data.match_id,
          player_id: data.player_id,
          duration_ms: Date.now() - startTime
        };

      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        return {
          success: false,
          match_id: entry.id || 'unknown',
          player_id: 'unknown',
          error,
          duration_ms: Date.now() - startTime
        };
      }
    });

    // Attendre tous les traitements
    const processedResults = await Promise.all(promises);
    results.push(...processedResults);

    return results;
  }

  /**
   * Extrait les données d'un message
   */
  private extractMessageData(entry: RedisEntry): MatchMessage {
    const fields = entry.fields || {};
    
    return {
      match_id: fields.match_id || entry.id || '',
      player_id: fields.player_id || '',
      score: fields.score || '0',
      shots: fields.shots || '[]',
      duration: fields.duration || '0',
      kills: fields.kills || '0',
      deaths: fields.deaths || '0',
      assists: fields.assists || '0',
      win: fields.win || '1',
      game_group: fields.game_group || 'CPT1',
      shot_distribution: fields.shot_distribution || '{}',
      timestamp: fields.timestamp || Date.now().toString()
    };
  }

  /**
   * Traite un match
   */
  private async processMatch(data: MatchMessage): Promise<boolean> {
    const { match_id, player_id, score, shots, duration, kills, deaths, assists, win, game_group, shot_distribution } = data;

    try {
      // 1. Construire l'objet Match
      const match: Match = {
        id: match_id,
        date: new Date(parseInt(data.timestamp)).toISOString(),
        score: parseInt(score),
        shots: JSON.parse(shots),
        duration: parseFloat(duration),
        kills: parseInt(kills) || 0,
        deaths: parseInt(deaths) || 0,
        assists: parseInt(assists) || 0,
        win: win === '1',
        game_group: game_group || 'CPT1',
        shot_distribution: JSON.parse(shot_distribution) || {}
      };

      console.log(`📊 [${this.workerId}] Traitement match ${match_id} pour ${player_id}`);

      // 2. Sauvegarder dans GitHub
      const savedInGitHub = await PlayerDB.addMatch(player_id, match);
      
      if (!savedInGitHub) {
        console.error(`❌ [${this.workerId}] Échec sauvegarde GitHub pour ${match_id}`);
        return false;
      }

      console.log(`✅ [${this.workerId}] Match ${match_id} sauvegardé dans GitHub`);

      // 3. Recalculer les stats depuis GitHub
      const stats = await calculateStatsFromMatches(player_id);
      
      if (!stats) {
        console.error(`❌ [${this.workerId}] Aucune stat calculée pour ${player_id}`);
        return false;
      }

      // 4. Mettre à jour Supabase (athletes)
      const grade = getGradeFromScore(stats.total_score);
      
      // Vérification masterAdmin
      if (!masterAdmin) {
        console.error(`❌ [${this.workerId}] masterAdmin non disponible`);
        return false;
      }
      
      const { error: updateError } = await masterAdmin
        .from("athletes")
        .update({
          total_matches: stats.total_matches,
          total_score: stats.total_score,
          total_shots: stats.total_shots,
          total_kills: stats.total_kills,
          total_deaths: stats.total_deaths,
          total_assists: stats.total_assists,
          total_hits_head: stats.total_hits_head,
          total_hits_body: stats.total_hits_body,
          total_hits_legs: stats.total_hits_legs,
          current_grade_id: stats.current_grade_id,
          precision_progress: stats.precision_progress,
          current_cycle_shot_count: stats.current_cycle_shot_count,
          current_cycle_precision: stats.current_cycle_precision,
          rank: grade.id >= 18 ? "LÉGENDE" : grade.id >= 13 ? "ÉPIQUE" : grade.id >= 7 ? "MAÎTRE" : grade.id >= 4 ? "ÉLITE" : "GUERRIER",
          points: stats.total_score,
          updated_at: new Date().toISOString(),
        })
        .eq("id", player_id);

      if (updateError) {
        console.error(`❌ [${this.workerId}] Erreur mise à jour stats ${player_id}:`, updateError);
        return false;
      }

      console.log(`✅ [${this.workerId}] Stats mises à jour pour ${player_id}: ${stats.total_matches} matchs, ${stats.total_score} pts`);

      // 5. Mettre à jour le cache Redis
      await this.updateCache(player_id, stats);

      // 6. Mettre à jour les classements
      await this.updateRankings(player_id, stats.total_score);

      this.processedCount++;
      return true;

    } catch (err) {
      console.error(`❌ [${this.workerId}] Erreur traitement match ${match_id}:`, err);
      return false;
    }
  }

  /**
   * Met à jour le cache Redis
   */
  private async updateCache(playerId: string, stats: CalculatedStats): Promise<void> {
    try {
      // 1. Mettre à jour le profil du joueur
      await redis.hset(`player:${playerId}`, {
        total_matches: stats.total_matches,
        total_score: stats.total_score,
        total_shots: stats.total_shots,
        total_kills: stats.total_kills,
        total_deaths: stats.total_deaths,
        total_assists: stats.total_assists,
        current_grade_id: stats.current_grade_id,
        precision_progress: stats.precision_progress,
        updated_at: Date.now()
      });

      // 2. Mettre à jour le classement global
      await redis.zadd('ranking:global', stats.total_score, playerId);

      // 3. Mettre à jour le classement de la ville
      // Vérification masterAdmin
      if (!masterAdmin) return;
      
      const { data: player } = await masterAdmin
        .from("athletes")
        .select("city, country")
        .eq("id", playerId)
        .single();

      if (player) {
        const cityKey = `ranking:city:${player.country}:${player.city}`;
        await redis.zadd(cityKey, stats.total_score, playerId);
        await redis.zremrangebyrank(cityKey, 0, -51);
      }

      console.log(`✅ [${this.workerId}] Cache mis à jour pour ${playerId}`);

    } catch (err) {
      console.warn(`⚠️ [${this.workerId}] Erreur mise à jour cache:`, err);
    }
  }

  /**
   * Met à jour les classements
   */
  private async updateRankings(playerId: string, newScore: number): Promise<void> {
    try {
      // Vérification masterAdmin
      if (!masterAdmin) return;
      
      // Récupérer la ville du joueur
      const { data: player } = await masterAdmin
        .from("athletes")
        .select("city, country")
        .eq("id", playerId)
        .single();

      if (!player) return;

      // 1. Classement de la ville
      const cityKey = `ranking:city:${player.country}:${player.city}`;
      await redis.zadd(cityKey, newScore, playerId);
      await redis.zremrangebyrank(cityKey, 0, -51);

      // 2. Classement du pays (Top 100)
      const countryKey = `ranking:country:${player.country}`;
      await redis.zadd(countryKey, newScore, playerId);
      await redis.zremrangebyrank(countryKey, 0, -101);

      // 3. Classement mondial (Top 1000)
      await redis.zadd('ranking:global', newScore, playerId);
      await redis.zremrangebyrank('ranking:global', 0, -1001);

      console.log(`✅ [${this.workerId}] Classements mis à jour pour ${playerId}`);

    } catch (err) {
      console.warn(`⚠️ [${this.workerId}] Erreur mise à jour classements:`, err);
    }
  }

  /**
   * Acknowledge les messages traités
   */
  private async acknowledgeMessages(results: ProcessResult[]): Promise<void> {
    for (const result of results) {
      if (result.success) {
        try {
          await redis.xack('matches:stream', 'matches:group', result.match_id);
        } catch (err) {
          console.warn(`⚠️ [${this.workerId}] Erreur ACK pour ${result.match_id}:`, err);
        }
      }
    }
  }

  /**
   * Log des résultats du batch
   */
  private logResults(results: ProcessResult[]): void {
    const success = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const total = results.length;

    if (total > 0) {
      const avgDuration = results.reduce((sum, r) => sum + r.duration_ms, 0) / total;
      console.log(
        `📊 [${this.workerId}] Batch: ${success}/${total} réussis, ` +
        `${failed} échecs, moyenne ${avgDuration.toFixed(0)}ms`
      );
    }
  }

  /**
   * Fonction utilitaire pour sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ==========================================================
// FONCTION DE DÉMARRAGE (pour utilisation en API)
// ==========================================================

let workerInstance: MatchWorker | null = null;

/**
 * Démarre le worker (appelé une fois au démarrage de l'application)
 */
export function startMatchWorker(): MatchWorker {
  if (!workerInstance) {
    const workerId = process.env.VERCEL ? `worker-${process.env.VERCEL_REGION || 'global'}` : 'worker-local';
    workerInstance = new MatchWorker(workerId);
    
    // Démarrer le worker en arrière-plan
    workerInstance.start().catch((err) => {
      console.error('❌ Erreur fatale du worker:', err);
    });
    
    console.log(`🚀 MatchWorker démarré: ${workerId}`);
  }
  
  return workerInstance;
}

/**
 * Arrête le worker (pour nettoyage)
 */
export function stopMatchWorker(): void {
  if (workerInstance) {
    workerInstance.stop();
    workerInstance = null;
    console.log('🛑 MatchWorker arrêté');
  }
}

/**
 * Récupère les statistiques du worker
 */
export function getMatchWorkerStats(): { processed: number; errors: number; workerId: string } | null {
  if (!workerInstance) return null;
  return workerInstance.getStats();
}

// ==========================================================
// EXPORT PAR DÉFAUT
// ==========================================================

export default MatchWorker;
