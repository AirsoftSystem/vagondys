
/**
 * ==========================================================
 * API TOURNAMENTS RANKINGS - GESTION DES CLASSEMENTS
 * ==========================================================
 * Endpoint pour gérer les classements des tournois
 * GET /api/tournaments/rankings?city=xxx&week=xxx
 * POST /api/tournaments/rankings (recalcul)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { SupabaseClient } from '@supabase/supabase-js';

// Types pour les classements
interface RankingEntry {
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

// Configuration des classements
const RANKING_WEEKS_TO_KEEP = 52; // 1 an d'historique
const POINTS_PER_WIN = 10;
const POINTS_PER_MATCH = 5;
const BONUS_TOP_3 = 20;
const BONUS_TOP_10 = 10;

/**
 * Vérifie l'authentification de l'utilisateur
 */
async function getAuthenticatedUser() {
  const cookieStore = await cookies();
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL_MASTER!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_MASTER!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set() {},
        remove() {},
      },
    }
  );
  
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    return null;
  }
  
  return user;
}

/**
 * Crée un client Supabase pour une ville spécifique
 */
async function createCityClient(city: string) {
  const cookieStore = await cookies();
  
  let url = process.env.NEXT_PUBLIC_SUPABASE_URL_MASTER!;
  let anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_MASTER!;
  
  const cityUpper = city.toUpperCase().trim();
  const cityUrl = process.env[`NEXT_PUBLIC_SUPABASE_URL_${cityUpper}`];
  const cityKey = process.env[`NEXT_PUBLIC_SUPABASE_ANON_KEY_${cityUpper}`];
  
  if (cityUrl && cityKey) {
    url = cityUrl;
    anonKey = cityKey;
  }
  
  return createServerClient(url, anonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set() {},
      remove() {},
    },
  });
}

/**
 * Calcule la semaine en cours (lundi - dimanche)
 */
function getCurrentWeekRange(): { start: string; end: string } {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  
  const start = new Date(now);
  start.setDate(now.getDate() - daysToMonday);
  start.setHours(0, 0, 0, 0);
  
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  
  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

/**
 * Calcule les points d'un joueur basés sur ses matchs et tournois
 */
async function calculatePlayerPoints(
  playerId: string,
  cityClient: SupabaseClient,
  weekStart: string,
  weekEnd: string
): Promise<number> {
  let totalPoints = 0;
  
  try {
    // 1. Points des matchs de la semaine
    const { data: matches, error: matchesError } = await cityClient
      .from('match_history')
      .select('winner_id, player1_score, player2_score')
      .gte('match_date', weekStart)
      .lte('match_date', weekEnd)
      .or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`);
    
    if (!matchesError && matches) {
      for (const match of matches) {
        // Victoire
        if (match.winner_id === playerId) {
          totalPoints += POINTS_PER_WIN;
        }
        // Participation
        totalPoints += POINTS_PER_MATCH;
      }
    }
    
    // 2. Points des tournois de la semaine
    const { data: tournaments, error: tournamentsError } = await cityClient
      .from('tournament_results')
      .select('points_gained, position')
      .eq('player_id', playerId)
      .gte('tournament_date', weekStart)
      .lte('tournament_date', weekEnd);
    
    if (!tournamentsError && tournaments) {
      for (const tournament of tournaments) {
        totalPoints += tournament.points_gained;
        
        // Bonus pour les tops positions
        if (tournament.position <= 3) {
          totalPoints += BONUS_TOP_3;
        } else if (tournament.position <= 10) {
          totalPoints += BONUS_TOP_10;
        }
      }
    }
    
    return totalPoints;
  } catch (error) {
    console.error(`❌ Erreur calcul points pour ${playerId}:`, error);
    return 0;
  }
}

/**
 * Génère le classement hebdomadaire
 */
async function generateWeeklyRanking(
  cityClient: SupabaseClient,
  city: string,
  country: string,
  weekStart: string,
  weekEnd: string
): Promise<RankingEntry[]> {
  try {
    // 1. Récupérer tous les joueurs actifs
    const { data: players, error: playersError } = await cityClient
      .from('athletes')
      .select('id, full_name, pseudo');
    
    if (playersError) {
      console.error('❌ Erreur récupération joueurs:', playersError);
      return [];
    }
    
    if (!players || players.length === 0) {
      return [];
    }
    
    // 2. Calculer les points pour chaque joueur
    const playerPoints: { id: string; name: string; points: number }[] = [];
    
    for (const player of players) {
      const points = await calculatePlayerPoints(player.id, cityClient, weekStart, weekEnd);
      playerPoints.push({
        id: player.id,
        name: player.pseudo || player.full_name || player.id,
        points,
      });
    }
    
    // 3. Trier par points décroissants
    playerPoints.sort((a, b) => b.points - a.points);
    
    // 4. Attribuer les rangs
    const rankings: RankingEntry[] = [];
    let currentRank = 1;
    let previousPoints: number | null = null;
    
    for (let i = 0; i < playerPoints.length; i++) {
      const player = playerPoints[i];
      
      // Gestion des ex-aequo
      if (previousPoints !== null && player.points < previousPoints) {
        currentRank = i + 1;
      }
      
      // Récupérer le rang précédent
      const { data: previousRanking } = await cityClient
        .from('rankings_history')
        .select('rank')
        .eq('player_id', player.id)
        .order('week_start', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      rankings.push({
        id: `${city}_${player.id}_${weekStart}`,
        player_id: player.id,
        player_name: player.name,
        rank: currentRank,
        previous_rank: previousRanking?.rank || currentRank,
        points: player.points,
        week_start: weekStart,
        week_end: weekEnd,
        city: city,
        country: country,
      });
      
      previousPoints = player.points;
    }
    
    return rankings;
  } catch (error) {
    console.error('❌ Erreur génération classement:', error);
    return [];
  }
}

/**
 * Sauvegarde le classement hebdomadaire
 */
async function saveWeeklyRanking(
  cityClient: SupabaseClient,
  rankings: RankingEntry[]
): Promise<boolean> {
  if (rankings.length === 0) {
    return false;
  }
  
  try {
    // Supprimer l'ancien classement pour la même semaine
    const weekStart = rankings[0].week_start;
    await cityClient
      .from('rankings_history')
      .delete()
      .eq('week_start', weekStart)
      .eq('city', rankings[0].city);
    
    // Insérer le nouveau classement
    const { error: insertError } = await cityClient
      .from('rankings_history')
      .insert(rankings);
    
    if (insertError) {
      console.error('❌ Erreur sauvegarde classement:', insertError);
      return false;
    }
    
    // Nettoyer les anciennes semaines
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - (RANKING_WEEKS_TO_KEEP * 7));
    const cutoffIso = cutoffDate.toISOString();
    
    await cityClient
      .from('rankings_history')
      .delete()
      .lt('week_start', cutoffIso)
      .eq('city', rankings[0].city);
    
    return true;
  } catch (error) {
    console.error('❌ Erreur sauvegarde classement:', error);
    return false;
  }
}

/**
 * Vérifie si l'utilisateur est autorisé
 */
async function isAuthorized(userId: string, city: string): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL_MASTER!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_MASTER!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set() {},
          remove() {},
        },
      }
    );
    
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (!userError && user?.user_metadata?.role === 'staff') {
      const userCity = user.user_metadata.city;
      if (userCity === city) {
        return true;
      }
    }
    
    const { data: registry, error: registryError } = await supabase
      .from('athletes_registry')
      .select('is_staff, city')
      .eq('user_id', userId)
      .single();
    
    if (!registryError && registry) {
      if (registry.is_staff === true && registry.city === city) {
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error('❌ Erreur autorisation:', error);
    return false;
  }
}

/**
 * GET /api/tournaments/rankings
 * Récupère le classement
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const city = searchParams.get('city');
    const week = searchParams.get('week');
    const playerId = searchParams.get('playerId');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');
    
    if (!city) {
      return NextResponse.json(
        { error: "Paramètre 'city' requis", success: false },
        { status: 400 }
      );
    }
    
    const cityClient = await createCityClient(city);
    
    let query = cityClient
      .from('rankings_history')
      .select('*', { count: 'exact' });
    
    if (week) {
      // Recherche par semaine spécifique
      const weekStart = new Date(week);
      weekStart.setHours(0, 0, 0, 0);
      query = query.eq('week_start', weekStart.toISOString());
    } else {
      // Dernier classement disponible
      const { data: latestWeek } = await cityClient
        .from('rankings_history')
        .select('week_start')
        .eq('city', city)
        .order('week_start', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (latestWeek) {
        query = query.eq('week_start', latestWeek.week_start);
      }
    }
    
    if (playerId) {
      query = query.eq('player_id', playerId);
    }
    
    const { data: rankings, error, count } = await query
      .eq('city', city)
      .order('rank', { ascending: true })
      .range(offset, offset + limit - 1);
    
    if (error) {
      console.error('❌ Erreur récupération classement:', error);
      return NextResponse.json(
        { error: "Erreur lors de la récupération du classement", success: false },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: rankings as RankingEntry[],
      pagination: {
        total: count || 0,
        limit,
        offset,
      },
    });
    
  } catch (error) {
    console.error('❌ Erreur GET rankings:', error);
    return NextResponse.json(
      { error: "Erreur interne du serveur", success: false },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tournaments/rankings
 * Déclenche le recalcul du classement
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json(
        { error: "Non authentifié", success: false },
        { status: 401 }
      );
    }
    
    const body = await request.json();
    const { city, country, action } = body;
    
    if (!city) {
      return NextResponse.json(
        { error: "Paramètre 'city' requis", success: false },
        { status: 400 }
      );
    }
    
    const authorized = await isAuthorized(user.id, city);
    if (!authorized) {
      return NextResponse.json(
        { error: "Non autorisé à modifier les classements", success: false },
        { status: 403 }
      );
    }
    
    const cityClient = await createCityClient(city);
    const weekRange = getCurrentWeekRange();
    
    const rankings = await generateWeeklyRanking(
      cityClient,
      city,
      country || 'FR',
      weekRange.start,
      weekRange.end
    );
    
    if (action === 'recalculate') {
      const saved = await saveWeeklyRanking(cityClient, rankings);
      if (!saved) {
        return NextResponse.json(
          { error: "Erreur lors de la sauvegarde du classement", success: false },
          { status: 500 }
        );
      }
    }
    
    return NextResponse.json({
      success: true,
      data: rankings,
      week_range: weekRange,
      message: `Classement généré pour la semaine du ${new Date(weekRange.start).toLocaleDateString('fr-FR')}`,
    });
    
  } catch (error) {
    console.error('❌ Erreur POST rankings:', error);
    return NextResponse.json(
      { error: "Erreur interne du serveur", success: false },
      { status: 500 }
    );
  }
}
