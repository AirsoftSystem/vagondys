
// app/api/cron/recalculate-rankings/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PlayerDB, type PlayerProfile } from "@/lib/github-db/player";
import { RankingDB, type GlobalRanking } from "@/lib/github-db/ranking";
import { createClient } from "@supabase/supabase-js";

// ==========================================================
// CONFIGURATION
// ==========================================================
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CRON_SECRET = process.env.CRON_SECRET;

// ==========================================================
// TYPES
// ==========================================================
interface RecalculateOptions {
  season: string;
  force?: boolean;
  dryRun?: boolean;
}

interface RecalculateResult {
  success: boolean;
  message: string;
  stats?: {
    total_players: number;
    rankings_count: number;
    snapshot_date: string;
    season: string;
    duration_ms: number;
    supabase_sync?: boolean;
  };
  errors?: string[];
}

// ==========================================================
// UTILITAIRES
// ==========================================================

/**
 * Vérifier l'authentification du cron (token secret)
 */
function validateCronAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");
  
  if (!CRON_SECRET) {
    console.warn("⚠️ CRON_SECRET non défini, le cron ne pourra pas s'authentifier");
    return false;
  }
  
  return token === CRON_SECRET;
}

/**
 * Récupérer tous les joueurs depuis GitHub
 * ✅ CORRIGÉ : Suppression de l'appel à getAllPlayerIds inexistant
 */
async function fetchAllPlayers(): Promise<PlayerProfile[]> {
  const playerIds = await getPlayerIdsFromGitHub();
  
  const players: PlayerProfile[] = [];
  let errors = 0;
  
  for (const playerId of playerIds) {
    try {
      const profile = await PlayerDB.getProfile(playerId);
      if (profile) {
        players.push(profile);
      } else {
        errors++;
      }
    } catch (error) {
      console.error(`Erreur chargement joueur ${playerId}:`, error);
      errors++;
    }
  }
  
  console.log(`📊 fetchAllPlayers: ${players.length} joueurs chargés, ${errors} erreurs`);
  return players;
}

/**
 * Récupérer les IDs des joueurs depuis GitHub
 */
async function getPlayerIdsFromGitHub(): Promise<string[]> {
  const { GitHubDB } = await import("@/lib/github-db/client");
  const playersPath = "players/";
  const folders = await GitHubDB.list(playersPath);
  return folders;
}

/**
 * Synchroniser les classements avec Supabase (pour les requêtes rapides)
 */
async function syncToSupabase(ranking: GlobalRanking): Promise<boolean> {
  if (!supabaseUrl || !supabaseServiceKey) {
    console.warn("⚠️ Supabase non configuré, synchronisation ignorée");
    return false;
  }
  
  try {
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    
    // 1. Supprimer l'ancien classement global
    await supabaseAdmin.from("global_rankings").delete().neq("id", 0);
    
    // 2. Insérer le nouveau classement
    const rankingsToInsert = ranking.rankings.map(r => ({
      player_id: r.player_id,
      rank: r.rank,
      score: r.score,
      pch: r.pch,
      snapshot_date: ranking.snapshot_date,
      season: ranking.season,
      pseudo: r.pseudo,
      city: r.city,
      country: r.country,
      total_matches: r.total_matches,
      win_rate: r.win_rate,
      current_grade_id: r.current_grade_id,
    }));
    
    // Insertion par lots (100 par 100 pour éviter les timeouts)
    const batchSize = 100;
    for (let i = 0; i < rankingsToInsert.length; i += batchSize) {
      const batch = rankingsToInsert.slice(i, i + batchSize);
      const { error } = await supabaseAdmin.from("global_rankings").insert(batch);
      if (error) {
        console.error("Erreur insertion batch Supabase:", error);
        return false;
      }
    }
    
    console.log(`✅ Sync Supabase: ${rankingsToInsert.length} entrées insérées`);
    return true;
    
  } catch (error) {
    console.error("Erreur synchronisation Supabase:", error);
    return false;
  }
}

/**
 * Mettre à jour l'historique des joueurs
 */
async function updatePlayersHistory(ranking: GlobalRanking): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;
  
  for (const entry of ranking.rankings) {
    try {
      await RankingDB.updatePlayerHistory(entry.player_id, ranking);
      success++;
    } catch (error) {
      console.error(`Erreur historique pour ${entry.player_id}:`, error);
      failed++;
    }
  }
  
  console.log(`📜 Historique: ${success} joueurs mis à jour, ${failed} échecs`);
  return { success, failed };
}

// ==========================================================
// POST - Recalculer les classements mondiaux
// ==========================================================
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const errors: string[] = [];
  
  try {
    // 1. Vérification de l'authentification
    if (!validateCronAuth(request)) {
      console.error("❌ Cron: Authentification échouée");
      return NextResponse.json(
        { error: "Non autorisé", message: "Token CRON_SECRET invalide ou manquant" },
        { status: 401 }
      );
    }
    
    // 2. Récupérer les options
    const body = await request.json().catch(() => ({}));
    const currentYear = new Date().getFullYear().toString();
    
    const options: RecalculateOptions = {
      season: body.season || currentYear,
      force: body.force || false,
      dryRun: body.dryRun || false,
    };
    
    console.log(`🔄 Cron: Début du recalcul des classements (season: ${options.season}, dryRun: ${options.dryRun})`);
    
    // 3. Récupérer tous les joueurs
    const players = await fetchAllPlayers();
    if (players.length === 0) {
      errors.push("Aucun joueur trouvé");
      return NextResponse.json(
        { success: false, message: "Aucun joueur trouvé", errors },
        { status: 404 }
      );
    }
    
    console.log(`📊 Cron: ${players.length} joueurs chargés`);
    
    // 4. Récupérer le précédent classement pour calculer le PCH
    let previousRanking: GlobalRanking | null = null;
    if (!options.force) {
      previousRanking = await RankingDB.getLatestGlobalRanking();
      if (previousRanking) {
        console.log(`📊 Cron: Classement précédent trouvé (${previousRanking.snapshot_date})`);
      }
    }
    
    // 5. Calculer le nouveau classement
    const newRanking = await RankingDB.calculateGlobalRankings(
      players,
      previousRanking,
      options.season
    );
    
    console.log(`📊 Cron: Nouveau classement calculé (${newRanking.rankings.length} entrées)`);
    
    // 6. Mode dry-run : ne pas sauvegarder
    if (options.dryRun) {
      return NextResponse.json({
        success: true,
        message: "Dry run mode - classement calculé mais non sauvegardé",
        stats: {
          total_players: newRanking.total_players,
          rankings_count: newRanking.rankings.length,
          snapshot_date: newRanking.snapshot_date,
          season: newRanking.season,
          top_10: newRanking.rankings.slice(0, 10).map(r => ({
            rank: r.rank,
            pseudo: r.pseudo,
            score: r.score,
            pch: r.pch,
          })),
        },
      });
    }
    
    // 7. Sauvegarder le classement dans GitHub
    const saved = await RankingDB.saveGlobalRanking(newRanking);
    if (!saved) {
      errors.push("Échec de la sauvegarde GitHub");
      return NextResponse.json(
        { success: false, message: "Échec de la sauvegarde", errors },
        { status: 500 }
      );
    }
    
    console.log(`✅ Cron: Classement sauvegardé dans GitHub (${newRanking.snapshot_date})`);
    
    // 8. Sauvegarder le classement saisonnier
    // ✅ CORRIGÉ : options.season est garanti d'être une string
    const existingSeason = await RankingDB.getSeasonRanking(options.season);
    
    if (!existingSeason || options.force) {
      const seasonRanking = {
        season: options.season,
        start_date: existingSeason?.start_date || newRanking.snapshot_date,
        end_date: newRanking.snapshot_date,
        rankings: newRanking.rankings,
        is_active: newRanking.season === currentYear,
      };
      const seasonSaved = await RankingDB.saveSeasonRanking(options.season, seasonRanking);
      if (seasonSaved) {
        console.log(`✅ Cron: Classement saisonnier sauvegardé (${options.season})`);
      }
    }
    
    // 9. Mettre à jour l'historique des joueurs
    // ✅ CORRIGÉ : Ajout de 'void' pour indiquer que le résultat est volontairement ignoré
    void updatePlayersHistory(newRanking);
    
    // 10. Synchroniser avec Supabase (optionnel, pour les requêtes rapides)
    let supabaseSynced = false;
    if (supabaseUrl && supabaseServiceKey) {
      supabaseSynced = await syncToSupabase(newRanking);
    }
    
    const duration = Date.now() - startTime;
    
    // 11. Retourner le résultat
    const result: RecalculateResult = {
      success: true,
      message: "Classement recalculé avec succès",
      stats: {
        total_players: newRanking.total_players,
        rankings_count: newRanking.rankings.length,
        snapshot_date: newRanking.snapshot_date,
        season: newRanking.season,
        duration_ms: duration,
        supabase_sync: supabaseSynced,
      },
    };
    
    if (errors.length > 0) {
      result.errors = errors;
    }
    
    console.log(`✅ Cron: Terminé en ${duration}ms (${newRanking.rankings.length} joueurs)`);
    
    return NextResponse.json(result);
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("❌ Cron: Erreur lors du recalcul:", error);
    
    return NextResponse.json(
      {
        success: false,
        message: "Erreur lors du recalcul des classements",
        error: error instanceof Error ? error.message : "Erreur inconnue",
        duration_ms: duration,
      },
      { status: 500 }
    );
  }
}

// ==========================================================
// GET - Obtenir le statut du dernier calcul (optionnel)
// ==========================================================
export async function GET(request: NextRequest) {
  try {
    // Vérification de l'authentification
    if (!validateCronAuth(request)) {
      return NextResponse.json(
        { error: "Non autorisé" },
        { status: 401 }
      );
    }
    
    const latestRanking = await RankingDB.getLatestGlobalRanking();
    const allRankings = await RankingDB.getAllGlobalRankings(10);
    const grades = await RankingDB.getGradesConfig();
    const globalStats = await RankingDB.getGlobalStats();
    
    return NextResponse.json({
      success: true,
      latest_ranking: latestRanking ? {
        snapshot_date: latestRanking.snapshot_date,
        season: latestRanking.season,
        total_players: latestRanking.total_players,
        calculated_at: latestRanking.calculated_at,
      } : null,
      recent_rankings: allRankings.map(r => ({
        snapshot_date: r.snapshot_date,
        season: r.season,
        total_players: r.total_players,
      })),
      grades_count: grades.length,
      global_stats: globalStats,
    });
    
  } catch (error) {
    console.error("GET /api/cron/recalculate-rankings error:", error);
    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500 }
    );
  }
}
