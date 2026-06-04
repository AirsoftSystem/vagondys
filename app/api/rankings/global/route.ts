
// app/api/rankings/global/route.ts
import { NextRequest, NextResponse } from "next/server";
import { RankingDB, type RankingEntry } from "@/lib/github-db/ranking";
import { createClient } from "@supabase/supabase-js";

// ==========================================================
// CONFIGURATION
// ==========================================================
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// ==========================================================
// TYPES
// ==========================================================

interface RankingResponseData {
  success: boolean;
  ranking: Partial<RankingEntry> | RankingEntry;
  history: Array<{ snapshot_date: string; rank: number; score: number; season: string }>;
  best_rank: { rank: number; date: string } | null;
  snapshot_date: string;
  season: string;
  grades?: Array<{ grade_id: number; grade_name: string; min_score: number; max_score: number | null; icon: string }>;
}

// ==========================================================
// UTILITAIRES
// ==========================================================

/**
 * Vérifier l'authentification d'un utilisateur (optionnel pour les classements publics)
 */
async function authenticateUser(request: NextRequest): Promise<{ userId: string; isStaff: boolean } | null> {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");
  
  if (!token) {
    return null;
  }
  
  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }
  
  const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
  const { data: { user }, error } = await supabaseClient.auth.getUser(token);
  
  if (error || !user) {
    return null;
  }
  
  const isStaff = user.user_metadata?.role === "staff" || 
                  user.email?.includes("staff") ||
                  user.email === "vagondys@gmail.com";
  
  return { userId: user.id, isStaff };
}

/**
 * Filtrer les données sensibles des classements pour les non-staff
 */
function filterRankingForPublic(ranking: RankingEntry): Partial<RankingEntry> {
  return {
    player_id: ranking.player_id,
    pseudo: ranking.pseudo,
    city: ranking.city,
    country: ranking.country,
    rank: ranking.rank,
    previous_rank: ranking.previous_rank,
    score: ranking.score,
    pch: ranking.pch,
    total_matches: ranking.total_matches,
    win_rate: ranking.win_rate,
    average_score: ranking.average_score,
    current_grade_id: ranking.current_grade_id,
    grade_name: ranking.grade_name,
  };
}

// ==========================================================
// GET - Récupérer les classements mondiaux
// ==========================================================
export async function GET(request: NextRequest) {
  try {
    // 1. Paramètres de requête
    const searchParams = request.nextUrl.searchParams;
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : 100;
    const offset = searchParams.get("offset") ? parseInt(searchParams.get("offset")!) : 0;
    const city = searchParams.get("city");
    const country = searchParams.get("country") || "FR";
    const season = searchParams.get("season");
    const date = searchParams.get("date");
    const playerId = searchParams.get("playerId");
    const search = searchParams.get("search");
    
    // 2. Authentification optionnelle (pour les données sensibles)
    const auth = await authenticateUser(request);
    const isStaff = auth?.isStaff || false;
    
    // 3. Cas 1: Recherche d'un joueur spécifique
    if (playerId) {
      const latestRanking = await RankingDB.getLatestGlobalRanking();
      if (!latestRanking) {
        return NextResponse.json(
          { error: "Aucun classement disponible" },
          { status: 404 }
        );
      }
      
      const playerRanking = latestRanking.rankings.find(r => r.player_id === playerId);
      if (!playerRanking) {
        return NextResponse.json(
          { error: "Joueur non trouvé dans le classement" },
          { status: 404 }
        );
      }
      
      // Récupérer l'historique du joueur
      const history = await RankingDB.getPlayerHistory(playerId);
      const bestRank = await RankingDB.getPlayerBestRank(playerId);
      
      // ✅ CORRIGÉ : Type spécifique au lieu de 'any'
      const responseData: RankingResponseData = {
        success: true,
        ranking: isStaff ? playerRanking : filterRankingForPublic(playerRanking),
        history: history.history,
        best_rank: bestRank,
        snapshot_date: latestRanking.snapshot_date,
        season: latestRanking.season,
      };
      
      // Ajouter le grade complet si staff
      if (isStaff) {
        const grades = await RankingDB.getGradesConfig();
        responseData.grades = grades;
      }
      
      return NextResponse.json(responseData);
    }
    
    // 4. Cas 2: Classement par date spécifique
    if (date) {
      const ranking = await RankingDB.getGlobalRankingByDate(date);
      if (!ranking) {
        return NextResponse.json(
          { error: `Aucun classement trouvé pour la date ${date}` },
          { status: 404 }
        );
      }
      
      let rankings = ranking.rankings;
      
      // Filtrer par ville si demandé
      if (city) {
        rankings = rankings.filter(r => 
          r.city.toUpperCase() === city.toUpperCase() && 
          r.country.toUpperCase() === country.toUpperCase()
        );
      }
      
      // Recherche textuelle
      if (search) {
        const searchLower = search.toLowerCase();
        rankings = rankings.filter(r => 
          r.pseudo.toLowerCase().includes(searchLower) ||
          r.city.toLowerCase().includes(searchLower)
        );
      }
      
      // Pagination
      const paginatedRankings = rankings.slice(offset, offset + limit);
      
      return NextResponse.json({
        success: true,
        ranking: {
          id: ranking.id,
          season: ranking.season,
          snapshot_date: ranking.snapshot_date,
          total_players: rankings.length,
          calculated_at: ranking.calculated_at,
          rankings: isStaff ? paginatedRankings : paginatedRankings.map(filterRankingForPublic),
        },
        pagination: {
          limit,
          offset,
          total: rankings.length,
          has_more: offset + limit < rankings.length,
        },
      });
    }
    
    // 5. Cas 3: Classement saisonnier spécifique
    if (season) {
      const seasonRanking = await RankingDB.getSeasonRanking(season);
      if (!seasonRanking) {
        return NextResponse.json(
          { error: `Aucun classement trouvé pour la saison ${season}` },
          { status: 404 }
        );
      }
      
      let rankings = seasonRanking.rankings;
      
      // Filtrer par ville si demandé
      if (city) {
        rankings = rankings.filter(r => 
          r.city.toUpperCase() === city.toUpperCase() && 
          r.country.toUpperCase() === country.toUpperCase()
        );
      }
      
      const paginatedRankings = rankings.slice(offset, offset + limit);
      
      return NextResponse.json({
        success: true,
        season_ranking: {
          season: seasonRanking.season,
          start_date: seasonRanking.start_date,
          end_date: seasonRanking.end_date,
          is_active: seasonRanking.is_active,
          total_players: rankings.length,
          rankings: isStaff ? paginatedRankings : paginatedRankings.map(filterRankingForPublic),
        },
        pagination: {
          limit,
          offset,
          total: rankings.length,
          has_more: offset + limit < rankings.length,
        },
      });
    }
    
    // 6. Cas 4: Classement global le plus récent
    const latestRanking = await RankingDB.getLatestGlobalRanking();
    if (!latestRanking) {
      return NextResponse.json(
        { error: "Aucun classement disponible" },
        { status: 404 }
      );
    }
    
    let rankings = [...latestRanking.rankings];
    
    // Filtrer par ville si demandé
    if (city) {
      rankings = rankings.filter(r => 
        r.city.toUpperCase() === city.toUpperCase() && 
        r.country.toUpperCase() === country.toUpperCase()
      );
      
      // Re-rank les joueurs de la ville
      rankings = rankings.map((r, idx) => ({ ...r, rank: idx + 1 }));
    }
    
    // Recherche textuelle
    if (search) {
      const searchLower = search.toLowerCase();
      rankings = rankings.filter(r => 
        r.pseudo.toLowerCase().includes(searchLower) ||
        r.city.toLowerCase().includes(searchLower)
      );
    }
    
    // Pagination
    const paginatedRankings = rankings.slice(offset, offset + limit);
    
    // Récupérer les stats globales
    const globalStats = await RankingDB.getGlobalStats();
    
    // Récupérer toutes les saisons disponibles
    const availableSeasons = await RankingDB.getAllSeasonRankings();
    
    return NextResponse.json({
      success: true,
      ranking: {
        id: latestRanking.id,
        season: latestRanking.season,
        snapshot_date: latestRanking.snapshot_date,
        total_players: latestRanking.total_players,
        calculated_at: latestRanking.calculated_at,
        rankings: isStaff ? paginatedRankings : paginatedRankings.map(filterRankingForPublic),
      },
      pagination: {
        limit,
        offset,
        total: rankings.length,
        has_more: offset + limit < rankings.length,
      },
      global_stats: globalStats,
      available_seasons: availableSeasons.map(s => ({
        season: s.season,
        is_active: s.is_active,
        start_date: s.start_date,
        end_date: s.end_date,
      })),
      filters_applied: {
        city: city || null,
        country,
        search: search || null,
      },
    });
    
  } catch (error) {
    console.error("GET /api/rankings/global error:", error);
    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500 }
    );
  }
}

// ==========================================================
// OPTIONS - Gérer les requêtes CORS
// ==========================================================
export async function OPTIONS() {
  return NextResponse.json(
    {},
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    }
  );
}
