
// app/api/player/matches/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PlayerDB, type Match } from "@/lib/github-db/player";
import { createClient } from "@supabase/supabase-js";

// ==========================================================
// CONFIGURATION
// ==========================================================
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// ==========================================================
// UTILITAIRES
// ==========================================================

/**
 * Vérifier l'authentification d'un utilisateur (joueur ou staff)
 */
async function authenticateUser(request: NextRequest): Promise<{ userId: string; isStaff: boolean } | null> {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");
  
  if (!token) {
    return null;
  }
  
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Variables Supabase manquantes");
    return null;
  }
  
  const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
  const { data: { user }, error } = await supabaseClient.auth.getUser(token);
  
  if (error || !user) {
    // Vérifier si c'est un token STAFF temporaire (pour Python)
    try {
      const decoded = Buffer.from(token, "base64").toString("utf-8");
      const payload = JSON.parse(decoded);
      if (payload.player_id && payload.exp && payload.exp > Date.now()) {
        return { userId: payload.player_id, isStaff: false };
      }
    } catch {
      // Token invalide
    }
    return null;
  }
  
  const isStaff = user.user_metadata?.role === "staff" || 
                  user.email?.includes("staff") ||
                  user.email === "vagondys@gmail.com";
  
  return { userId: user.id, isStaff };
}

/**
 * Vérifier qu'un utilisateur a accès aux données d'un joueur
 */
async function canAccessPlayerData(requesterId: string, targetPlayerId: string, isStaff: boolean): Promise<boolean> {
  if (isStaff) return true;
  return requesterId === targetPlayerId;
}

// ==========================================================
// GET - Récupérer l'historique des parties
// ==========================================================
export async function GET(request: NextRequest) {
  try {
    // 1. Authentification
    const auth = await authenticateUser(request);
    if (!auth) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }
    
    // 2. Paramètres de requête
    const searchParams = request.nextUrl.searchParams;
    const playerId = searchParams.get("playerId");
    const year = searchParams.get("year") ? parseInt(searchParams.get("year")!) : undefined;
    const month = searchParams.get("month") ? parseInt(searchParams.get("month")!) : undefined;
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : 50;
    const offset = searchParams.get("offset") ? parseInt(searchParams.get("offset")!) : 0;
    
    // 3. Déterminer le joueur cible
    const targetPlayerId = playerId || auth.userId;
    
    // 4. Vérifier les droits d'accès
    if (!await canAccessPlayerData(auth.userId, targetPlayerId, auth.isStaff)) {
      return NextResponse.json(
        { error: "Accès non autorisé à ce joueur" },
        { status: 403 }
      );
    }
    
    // 5. Récupérer les parties
    let matches: Match[];
    let total = 0;
    
    if (year && month) {
      matches = await PlayerDB.getMatchesByMonth(targetPlayerId, year, month);
      total = matches.length;
    } else if (year) {
      // Récupérer toute l'année via pagination
      const result = await PlayerDB.getMatchesPaginated(targetPlayerId, { year, limit, offset });
      matches = result.matches;
      total = result.total;
    } else {
      const result = await PlayerDB.getMatchesPaginated(targetPlayerId, { limit, offset });
      matches = result.matches;
      total = result.total;
    }
    
    // 6. Retourner les résultats
    return NextResponse.json({
      success: true,
      player_id: targetPlayerId,
      matches,
      pagination: {
        limit,
        offset,
        total,
        has_more: offset + limit < total,
      },
    });
    
  } catch (error) {
    console.error("GET /api/player/matches error:", error);
    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500 }
    );
  }
}

// ==========================================================
// POST - Enregistrer une nouvelle partie
// ==========================================================
export async function POST(request: NextRequest) {
  try {
    // 1. Authentification
    const auth = await authenticateUser(request);
    if (!auth) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }
    
    // 2. Récupérer et valider le body
    const body = await request.json();
    const {
      id,
      date,
      duration,
      score,
      kills = 0,
      deaths = 0,
      assists = 0,
      shots = [],
      win = true,
      game_group = "CPT1",
      player_id: providedPlayerId,
    } = body;
    
    // 3. Déterminer le joueur (priorité au body, sinon l'utilisateur authentifié)
    const targetPlayerId = providedPlayerId || auth.userId;
    
    // 4. Vérifier les droits d'accès
    if (!await canAccessPlayerData(auth.userId, targetPlayerId, auth.isStaff)) {
      return NextResponse.json(
        { error: "Accès non autorisé pour ce joueur" },
        { status: 403 }
      );
    }
    
    // 5. Valider les champs obligatoires
    if (!score || typeof score !== "number") {
      return NextResponse.json(
        { error: "Le score est requis et doit être un nombre" },
        { status: 400 }
      );
    }
    
    if (shots.length > 20) {
      return NextResponse.json(
        { error: "Maximum 20 tirs par partie" },
        { status: 400 }
      );
    }
    
    // 6. Construire l'objet Match
    const matchId = id || crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`;
    const matchDate = date || new Date().toISOString();
    
    // Calculer la distribution des tirs si non fournie
    const shotDistribution: Record<string, number> = {};
    if (shots.length > 0) {
      for (const shot of shots) {
        const zoneKey = `zone_${shot.zone || 0}`;
        shotDistribution[zoneKey] = (shotDistribution[zoneKey] || 0) + 1;
      }
    }
    
    const match: Match = {
      id: matchId,
      date: matchDate,
      duration: duration || 0,
      score,
      kills,
      deaths,
      assists,
      shots,
      win,
      game_group,
      shot_distribution: shotDistribution,
    };
    
    // 7. Sauvegarder dans GitHub
    const success = await PlayerDB.addMatch(targetPlayerId, match);
    
    if (!success) {
      return NextResponse.json(
        { error: "Échec de l'enregistrement de la partie" },
        { status: 500 }
      );
    }
    
    // 8. Mettre à jour le profil (déjà fait dans addMatch)
    const updatedProfile = await PlayerDB.getProfile(targetPlayerId);
    
    // 9. Déclencher le recalcul des classements (async, non bloquant)
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      fetch(`${process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin}/api/cron/recalculate-rankings`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${cronSecret}` },
      }).catch(err => console.error("Erreur déclenchement cron:", err));
    }
    
    // 10. Retourner la confirmation
    return NextResponse.json({
      success: true,
      message: "Partie enregistrée avec succès",
      match_id: matchId,
      player_id: targetPlayerId,
      player_stats: updatedProfile ? {
        total_matches: updatedProfile.total_matches,
        total_score: updatedProfile.total_score,
        total_shots: updatedProfile.total_shots,
      } : null,
    });
    
  } catch (error) {
    console.error("POST /api/player/matches error:", error);
    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500 }
    );
  }
}

// ==========================================================
// DELETE - Supprimer une partie (admin/staff uniquement)
// ==========================================================
export async function DELETE(request: NextRequest) {
  try {
    // 1. Authentification
    const auth = await authenticateUser(request);
    if (!auth || !auth.isStaff) {
      return NextResponse.json(
        { error: "Accès réservé au staff" },
        { status: 401 }
      );
    }
    
    // 2. Récupérer les paramètres
    const searchParams = request.nextUrl.searchParams;
    const playerId = searchParams.get("playerId");
    const matchId = searchParams.get("matchId");
    
    if (!playerId || !matchId) {
      return NextResponse.json(
        { error: "playerId et matchId requis" },
        { status: 400 }
      );
    }
    
    // 3. Supprimer la partie
    const success = await PlayerDB.deleteMatch(playerId, matchId);
    
    if (!success) {
      return NextResponse.json(
        { error: "Partie non trouvée ou impossible à supprimer" },
        { status: 404 }
      );
    }
    
    // 4. Déclencher le recalcul des classements
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      fetch(`${process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin}/api/cron/recalculate-rankings`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${cronSecret}` },
      }).catch(err => console.error("Erreur déclenchement cron:", err));
    }
    
    return NextResponse.json({
      success: true,
      message: "Partie supprimée avec succès",
    });
    
  } catch (error) {
    console.error("DELETE /api/player/matches error:", error);
    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500 }
    );
  }
}
