
/**
 * ==========================================================
 * API TOURNAMENTS RECORD RESULT - ENREGISTREMENT DES RÉSULTATS
 * ==========================================================
 * Endpoint pour enregistrer les résultats de tournois
 * POST /api/tournaments/record-result
 * Body: { tournament_name, player_id, player_name, position, points_gained, category, city, country }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Types pour les résultats de tournoi
interface TournamentResultInput {
  tournament_name: string;
  tournament_date?: string;
  player_id: string;
  player_name: string;
  position: number;
  points_gained: number;
  category: string;
  city: string;
  country?: string;
  verified?: boolean;
}

interface TournamentResultResponse {
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
  created_at: string;
}

// Catégories de tournois valides
const VALID_CATEGORIES = [
  'LOCAL',
  'REGIONAL',
  'NATIONAL',
  'INTERNATIONAL',
  'MASTER',
  'CHALLENGER'
] as const;

type TournamentCategory = typeof VALID_CATEGORIES[number];

// Positions valides (1 = 1ère place, 2 = 2ème place, etc.)
const MIN_POSITION = 1;
const MAX_POSITION = 32;

// Points par position (exemple, à adapter selon vos règles)
const DEFAULT_POINTS_BY_POSITION: Record<number, number> = {
  1: 100,
  2: 80,
  3: 65,
  4: 55,
  5: 50,
  6: 45,
  7: 40,
  8: 35,
  9: 30,
  10: 28,
  11: 26,
  12: 24,
  13: 22,
  14: 20,
  15: 18,
  16: 16,
  17: 14,
  18: 12,
  19: 10,
  20: 8,
  21: 6,
  22: 5,
  23: 4,
  24: 3,
  25: 2,
  26: 1,
  27: 1,
  28: 1,
  29: 1,
  30: 1,
  31: 1,
  32: 1,
};

// Coefficient multiplicateur par catégorie
const CATEGORY_MULTIPLIER: Record<TournamentCategory, number> = {
  'LOCAL': 1,
  'REGIONAL': 1.5,
  'NATIONAL': 2,
  'INTERNATIONAL': 3,
  'MASTER': 4,
  'CHALLENGER': 2.5,
};

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
  
  // Récupérer la configuration de la ville
  let url = process.env.NEXT_PUBLIC_SUPABASE_URL_MASTER!;
  let anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_MASTER!;
  
  // Tentative de récupération de l'URL spécifique à la ville
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
 * Vérifie si l'utilisateur est autorisé à enregistrer des résultats
 */
async function isAuthorized(
  userId: string,
  city: string
): Promise<boolean> {
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
    
    // Vérifier si l'utilisateur est staff
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (!userError && user?.user_metadata?.role === 'staff') {
      const userCity = user.user_metadata.city;
      if (userCity === city) {
        return true;
      }
    }
    
    // Vérifier dans athletes_registry
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
 * Calcule les points en fonction de la position et de la catégorie
 */
function calculatePoints(position: number, category: string): number {
  const basePoints = DEFAULT_POINTS_BY_POSITION[position] || 1;
  const multiplier = CATEGORY_MULTIPLIER[category as TournamentCategory] || 1;
  return Math.floor(basePoints * multiplier);
}

/**
 * Valide les données d'entrée
 */
function validateInput(data: TournamentResultInput): { valid: boolean; error?: string } {
  if (!data.tournament_name || data.tournament_name.trim().length === 0) {
    return { valid: false, error: "Nom du tournoi manquant" };
  }
  
  if (!data.player_id || data.player_id.trim().length === 0) {
    return { valid: false, error: "ID joueur manquant" };
  }
  
  if (!data.player_name || data.player_name.trim().length === 0) {
    return { valid: false, error: "Nom du joueur manquant" };
  }
  
  if (data.position < MIN_POSITION || data.position > MAX_POSITION) {
    return { valid: false, error: `Position invalide (${MIN_POSITION}-${MAX_POSITION})` };
  }
  
  if (!data.city || data.city.trim().length === 0) {
    return { valid: false, error: "Ville manquante" };
  }
  
  if (!VALID_CATEGORIES.includes(data.category as TournamentCategory)) {
    return { valid: false, error: `Catégorie invalide. Valeurs acceptées: ${VALID_CATEGORIES.join(', ')}` };
  }
  
  return { valid: true };
}

/**
 * POST /api/tournaments/record-result
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Vérifier l'authentification
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json(
        { error: "Non authentifié", success: false },
        { status: 401 }
      );
    }
    
    // 2. Récupérer les données
    const body = await request.json();
    const input: TournamentResultInput = {
      tournament_name: body.tournament_name,
      tournament_date: body.tournament_date || new Date().toISOString(),
      player_id: body.player_id,
      player_name: body.player_name,
      position: body.position,
      points_gained: body.points_gained,
      category: body.category,
      city: body.city,
      country: body.country || 'FR',
      verified: body.verified || false,
    };
    
    // 3. Valider les données
    const validation = validateInput(input);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error, success: false },
        { status: 400 }
      );
    }
    
    // 4. Vérifier les autorisations (seul le staff peut enregistrer)
    const authorized = await isAuthorized(user.id, input.city);
    if (!authorized) {
      return NextResponse.json(
        { error: "Non autorisé à enregistrer des résultats de tournoi", success: false },
        { status: 403 }
      );
    }
    
    // 5. Calculer les points si non fournis
    let pointsGained = input.points_gained;
    if (!pointsGained || pointsGained === 0) {
      pointsGained = calculatePoints(input.position, input.category);
    }
    
    // 6. Créer le client pour la ville
    const cityClient = await createCityClient(input.city);
    
    // 7. Enregistrer le résultat
    const tournamentDate = input.tournament_date || new Date().toISOString();
    
    const { data: result, error: insertError } = await cityClient
      .from('tournament_results')
      .insert({
        tournament_name: input.tournament_name,
        tournament_date: tournamentDate,
        player_id: input.player_id,
        player_name: input.player_name,
        position: input.position,
        points_gained: pointsGained,
        category: input.category,
        city: input.city,
        country: input.country,
        verified: input.verified || false,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();
    
    if (insertError) {
      console.error('❌ Erreur insertion résultat:', insertError);
      return NextResponse.json(
        { error: "Erreur lors de l'enregistrement du résultat", details: insertError.message, success: false },
        { status: 500 }
      );
    }
    
    // 8. Retourner la réponse
    const response: TournamentResultResponse = {
      id: result.id,
      tournament_name: result.tournament_name,
      tournament_date: result.tournament_date,
      player_id: result.player_id,
      player_name: result.player_name,
      position: result.position,
      points_gained: result.points_gained,
      category: result.category,
      city: result.city,
      country: result.country,
      verified: result.verified,
      created_at: result.created_at,
    };
    
    return NextResponse.json({
      success: true,
      data: response,
      message: `Résultat enregistré pour ${input.player_name} - ${input.position}ème place (${pointsGained} points)`,
    });
    
  } catch (error) {
    console.error('❌ Erreur record-result:', error);
    return NextResponse.json(
      {
        error: "Erreur interne du serveur",
        success: false,
        details: error instanceof Error ? error.message : "Erreur inconnue"
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/tournaments/record-result?playerId=xxx&city=xxx
 * Récupère les résultats d'un joueur
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Vérifier l'authentification
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json(
        { error: "Non authentifié", success: false },
        { status: 401 }
      );
    }
    
    // 2. Récupérer les paramètres
    const searchParams = request.nextUrl.searchParams;
    const playerId = searchParams.get('playerId');
    const city = searchParams.get('city');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    
    if (!playerId || !city) {
      return NextResponse.json(
        { error: "Paramètres manquants: playerId et city sont requis", success: false },
        { status: 400 }
      );
    }
    
    // 3. Vérifier les autorisations
    const authorized = await isAuthorized(user.id, city);
    if (!authorized && user.id !== playerId) {
      return NextResponse.json(
        { error: "Non autorisé à consulter ces résultats", success: false },
        { status: 403 }
      );
    }
    
    // 4. Créer le client pour la ville
    const cityClient = await createCityClient(city);
    
    // 5. Récupérer les résultats
    const { data: results, error: fetchError } = await cityClient
      .from('tournament_results')
      .select('*')
      .eq('player_id', playerId)
      .order('tournament_date', { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (fetchError) {
      console.error('❌ Erreur récupération résultats:', fetchError);
      return NextResponse.json(
        { error: "Erreur lors de la récupération des résultats", success: false },
        { status: 500 }
      );
    }
    
    // 6. Compter le total
    const { count } = await cityClient
      .from('tournament_results')
      .select('*', { count: 'exact', head: true })
      .eq('player_id', playerId);
    
    return NextResponse.json({
      success: true,
      data: results as TournamentResultResponse[],
      pagination: {
        total: count || 0,
        limit,
        offset,
      },
    });
    
  } catch (error) {
    console.error('❌ Erreur GET record-result:', error);
    return NextResponse.json(
      { error: "Erreur interne du serveur", success: false },
      { status: 500 }
    );
  }
}
