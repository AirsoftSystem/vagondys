
/**
 * ==========================================================
 * API AS-EG SESSION - GESTION DES SESSIONS DE NOTORIÉTÉ
 * ==========================================================
 * Endpoint pour gérer les sessions de notoriété (PCH, TS, Challengers)
 * POST /api/as-eg/session
 * GET /api/as-eg/session?playerId=xxx&city=xxx
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { SupabaseClient } from '@supabase/supabase-js';

// Types pour les sessions AS-EG
interface AS_EG_SessionInput {
  player_id: string;
  player_name: string;
  session_type: 'PCH' | 'TS' | 'CHALLENGER';
  score: number;
  max_score: number;
  duration_seconds: number;
  city: string;
  country?: string;
}

interface AS_EG_SessionResponse {
  id: string;
  player_id: string;
  player_name: string;
  session_type: string;
  score: number;
  max_score: number;
  duration_seconds: number;
  created_at: string;
  city: string;
  country: string;
  archived: boolean;
  archived_at?: string;
}

// Configuration des seuils de notoriété
const NOTORIETY_THRESHOLDS = {
  PCH: {
    BRONZE: 10,
    SILVER: 25,
    GOLD: 50,
    PLATINUM: 100,
    DIAMOND: 200,
  },
  TS: {
    BRONZE: 5,
    SILVER: 15,
    GOLD: 30,
    PLATINUM: 60,
    DIAMOND: 120,
  },
  CHALLENGER: {
    BRONZE: 3,
    SILVER: 10,
    GOLD: 20,
    PLATINUM: 40,
    DIAMOND: 80,
  },
};

// Durée de conservation avant archivage (1 an en millisecondes)
const ARCHIVE_AFTER_MS = 365 * 24 * 60 * 60 * 1000;

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
 * Valide les données d'entrée
 */
function validateInput(data: AS_EG_SessionInput): { valid: boolean; error?: string } {
  if (!data.player_id || data.player_id.trim().length === 0) {
    return { valid: false, error: "ID joueur manquant" };
  }
  
  if (!data.player_name || data.player_name.trim().length === 0) {
    return { valid: false, error: "Nom du joueur manquant" };
  }
  
  const validTypes = ['PCH', 'TS', 'CHALLENGER'];
  if (!validTypes.includes(data.session_type)) {
    return { valid: false, error: `Type de session invalide. Valeurs acceptées: ${validTypes.join(', ')}` };
  }
  
  if (data.score < 0) {
    return { valid: false, error: "Le score ne peut pas être négatif" };
  }
  
  if (data.max_score <= 0) {
    return { valid: false, error: "Le score maximum doit être supérieur à 0" };
  }
  
  if (data.score > data.max_score) {
    return { valid: false, error: "Le score ne peut pas dépasser le score maximum" };
  }
  
  if (data.duration_seconds < 0) {
    return { valid: false, error: "La durée ne peut pas être négative" };
  }
  
  if (!data.city || data.city.trim().length === 0) {
    return { valid: false, error: "Ville manquante" };
  }
  
  return { valid: true };
}

/**
 * Calcule le pourcentage de réussite
 */
function calculateSuccessRate(score: number, maxScore: number): number {
  if (maxScore === 0) return 0;
  return Math.round((score / maxScore) * 100);
}

/**
 * Détermine le grade de notoriété
 */
function getNotorietyGrade(
  sessionType: string,
  totalScore: number
): { grade: string; color: string; nextThreshold: number } {
  const thresholds = NOTORIETY_THRESHOLDS[sessionType as keyof typeof NOTORIETY_THRESHOLDS];
  
  if (!thresholds) {
    return { grade: 'NON_CLASSÉ', color: '#6B7280', nextThreshold: 0 };
  }
  
  if (totalScore >= thresholds.DIAMOND) {
    return { grade: 'DIAMANT', color: '#00BFFF', nextThreshold: 0 };
  }
  if (totalScore >= thresholds.PLATINUM) {
    return { grade: 'PLATINE', color: '#E5E4E2', nextThreshold: thresholds.DIAMOND };
  }
  if (totalScore >= thresholds.GOLD) {
    return { grade: 'OR', color: '#FFD700', nextThreshold: thresholds.PLATINUM };
  }
  if (totalScore >= thresholds.SILVER) {
    return { grade: 'ARGENT', color: '#C0C0C0', nextThreshold: thresholds.GOLD };
  }
  if (totalScore >= thresholds.BRONZE) {
    return { grade: 'BRONZE', color: '#CD7F32', nextThreshold: thresholds.SILVER };
  }
  
  return { grade: 'DÉBUTANT', color: '#6B7280', nextThreshold: thresholds.BRONZE };
}

/**
 * Met à jour le score total d'un joueur
 */
async function updatePlayerTotalScore(
  cityClient: SupabaseClient,
  playerId: string,
  sessionType: string,
  score: number,
  city: string
): Promise<number> {
  try {
    // Récupérer le score actuel
    const { data: existing, error: fetchError } = await cityClient
      .from('as_eg_totals')
      .select('total_score, total_sessions')
      .eq('player_id', playerId)
      .eq('session_type', sessionType)
      .maybeSingle();
    
    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('❌ Erreur récupération score total:', fetchError);
    }
    
    const newTotalScore = (existing?.total_score || 0) + score;
    const newTotalSessions = (existing?.total_sessions || 0) + 1;
    
    if (existing) {
      // Mise à jour
      const { error: updateError } = await cityClient
        .from('as_eg_totals')
        .update({
          total_score: newTotalScore,
          total_sessions: newTotalSessions,
          last_session_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('player_id', playerId)
        .eq('session_type', sessionType);
      
      if (updateError) {
        console.error('❌ Erreur mise à jour score total:', updateError);
      }
    } else {
      // Insertion
      const { error: insertError } = await cityClient
        .from('as_eg_totals')
        .insert({
          player_id: playerId,
          session_type: sessionType,
          total_score: newTotalScore,
          total_sessions: 1,
          city: city,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      
      if (insertError) {
        console.error('❌ Erreur insertion score total:', insertError);
      }
    }
    
    return newTotalScore;
  } catch (error) {
    console.error('❌ Erreur updatePlayerTotalScore:', error);
    return 0;
  }
}

/**
 * Archive les sessions de plus d'un an
 */
async function archiveOldSessions(cityClient: SupabaseClient): Promise<number> {
  try {
    const cutoffDate = new Date(Date.now() - ARCHIVE_AFTER_MS).toISOString();
    
    const { data: oldSessions, error: fetchError } = await cityClient
      .from('as_eg_sessions')
      .select('id')
      .lt('created_at', cutoffDate)
      .eq('archived', false);
    
    if (fetchError) {
      console.error('❌ Erreur récupération sessions à archiver:', fetchError);
      return 0;
    }
    
    if (!oldSessions || oldSessions.length === 0) {
      return 0;
    }
    
    const { error: updateError } = await cityClient
      .from('as_eg_sessions')
      .update({
        archived: true,
        archived_at: new Date().toISOString(),
      })
      .in('id', oldSessions.map(s => s.id));
    
    if (updateError) {
      console.error('❌ Erreur archivage sessions:', updateError);
      return 0;
    }
    
    return oldSessions.length;
  } catch (error) {
    console.error('❌ Erreur archiveOldSessions:', error);
    return 0;
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
 * POST /api/as-eg/session
 * Enregistre une nouvelle session de notoriété
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
    const input: AS_EG_SessionInput = {
      player_id: body.player_id,
      player_name: body.player_name,
      session_type: body.session_type,
      score: body.score,
      max_score: body.max_score,
      duration_seconds: body.duration_seconds,
      city: body.city,
      country: body.country || 'FR',
    };
    
    const validation = validateInput(input);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error, success: false },
        { status: 400 }
      );
    }
    
    const authorized = await isAuthorized(user.id, input.city);
    if (!authorized && user.id !== input.player_id) {
      return NextResponse.json(
        { error: "Non autorisé à enregistrer cette session", success: false },
        { status: 403 }
      );
    }
    
    const cityClient = await createCityClient(input.city);
    const successRate = calculateSuccessRate(input.score, input.max_score);
    
    const { data: session, error: insertError } = await cityClient
      .from('as_eg_sessions')
      .insert({
        player_id: input.player_id,
        player_name: input.player_name,
        session_type: input.session_type,
        score: input.score,
        max_score: input.max_score,
        success_rate: successRate,
        duration_seconds: input.duration_seconds,
        city: input.city,
        country: input.country,
        created_at: new Date().toISOString(),
        archived: false,
      })
      .select()
      .single();
    
    if (insertError) {
      console.error('❌ Erreur insertion session:', insertError);
      return NextResponse.json(
        { error: "Erreur lors de l'enregistrement de la session", details: insertError.message, success: false },
        { status: 500 }
      );
    }
    
    const totalScore = await updatePlayerTotalScore(
      cityClient,
      input.player_id,
      input.session_type,
      input.score,
      input.city
    );
    
    const grade = getNotorietyGrade(input.session_type, totalScore);
    
    // Archivage asynchrone des anciennes sessions
    archiveOldSessions(cityClient).catch(console.error);
    
    const response: AS_EG_SessionResponse = {
      id: session.id,
      player_id: session.player_id,
      player_name: session.player_name,
      session_type: session.session_type,
      score: session.score,
      max_score: session.max_score,
      duration_seconds: session.duration_seconds,
      created_at: session.created_at,
      city: session.city,
      country: session.country,
      archived: session.archived,
      archived_at: session.archived_at,
    };
    
    return NextResponse.json({
      success: true,
      data: response,
      metadata: {
        success_rate: successRate,
        total_score: totalScore,
        grade: grade.grade,
        grade_color: grade.color,
        next_threshold: grade.nextThreshold,
      },
      message: `Session ${input.session_type} enregistrée - ${successRate}% de réussite - Grade: ${grade.grade}`,
    });
    
  } catch (error) {
    console.error('❌ Erreur POST as-eg session:', error);
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
 * GET /api/as-eg/session?playerId=xxx&city=xxx
 * Récupère les sessions d'un joueur
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json(
        { error: "Non authentifié", success: false },
        { status: 401 }
      );
    }
    
    const searchParams = request.nextUrl.searchParams;
    const playerId = searchParams.get('playerId');
    const city = searchParams.get('city');
    const sessionType = searchParams.get('sessionType');
    const includeArchived = searchParams.get('includeArchived') === 'true';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    
    if (!playerId || !city) {
      return NextResponse.json(
        { error: "Paramètres manquants: playerId et city sont requis", success: false },
        { status: 400 }
      );
    }
    
    const authorized = await isAuthorized(user.id, city);
    if (!authorized && user.id !== playerId) {
      return NextResponse.json(
        { error: "Non autorisé à consulter ces sessions", success: false },
        { status: 403 }
      );
    }
    
    const cityClient = await createCityClient(city);
    
    let query = cityClient
      .from('as_eg_sessions')
      .select('*', { count: 'exact' })
      .eq('player_id', playerId);
    
    if (sessionType) {
      query = query.eq('session_type', sessionType);
    }
    
    if (!includeArchived) {
      query = query.eq('archived', false);
    }
    
    const { data: sessions, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (error) {
      console.error('❌ Erreur récupération sessions:', error);
      return NextResponse.json(
        { error: "Erreur lors de la récupération des sessions", success: false },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: sessions as AS_EG_SessionResponse[],
      pagination: {
        total: count || 0,
        limit,
        offset,
      },
    });
    
  } catch (error) {
    console.error('❌ Erreur GET as-eg session:', error);
    return NextResponse.json(
      { error: "Erreur interne du serveur", success: false },
      { status: 500 }
    );
  }
}
