
// app/api/record-match/route.ts
import { NextRequest, NextResponse } from "next/server";
import { masterAdmin } from "@/lib/supabase/master";
import { PlayerDB, type Match, type Shot } from "@/lib/github-db/player";
import { calculateStatsFromMatches, getGradeFromScore, type CalculatedStats } from "@/lib/github-db/stats-calculator";
import { redis } from "@/lib/redis/client";

// ==========================================================
// TYPES
// ==========================================================

interface RecordMatchRequest {
  access_token?: string;
  player_id?: string;
  pseudo?: string;
  email?: string;
  city?: string;
  country?: string;
  score: number;
  shots: Shot[];
  duration: number;
  shot_distribution?: Record<string, number>;
  game_mode?: string;
  game_group?: string;
  kills?: number;
  deaths?: number;
  assists?: number;
  win?: boolean;
}

interface RecordMatchResponse {
  success: boolean;
  match_id?: string;
  player_id?: string;
  player_stats?: {
    total_matches: number;
    total_score: number;
    total_shots: number;
    total_kills: number;
    total_deaths: number;
    total_assists: number;
    current_grade_id: number;
    precision_progress: number;
  };
  estimated_rank?: number;
  message?: string;
  error?: string;
}

interface PlayerDetails {
  id: string;
  email: string;
  pseudo: string;
  full_name: string;
  city: string;
  country: string;
  dossier_ref: string;
  status: string;
}

// ❌ SUPPRESSION : PlayerCacheData (non utilisé)

// ==========================================================
// FONCTIONS UTILITAIRES
// ==========================================================

/**
 * Valide et nettoie un token d'authentification
 */
function validateAccessToken(token: string): { player_id: string; email?: string; city?: string; country?: string } | null {
  try {
    const decoded = Buffer.from(token, "base64").toString("utf-8");
    const payload = JSON.parse(decoded);
    
    if (!payload.player_id) {
      return null;
    }
    
    if (payload.exp && payload.exp < Date.now()) {
      console.warn(`[record-match] Token expiré pour ${payload.player_id}`);
      return null;
    }
    
    return {
      player_id: payload.player_id,
      email: payload.email,
      city: payload.city,
      country: payload.country,
    };
  } catch {
    return null;
  }
}

/**
 * Recherche un joueur par pseudo ou email
 */
async function findPlayerByIdentifier(
  identifier: string,
  city?: string,
  country?: string
): Promise<PlayerDetails | null> {
  if (!masterAdmin) return null;
  
  try {
    let query = masterAdmin
      .from("athletes")
      .select("id, email, pseudo, full_name, city, country, dossier_ref, status")
      .or(`pseudo.ilike.%${identifier}%,email.ilike.%${identifier}%`);
    
    if (city) {
      query = query.eq("city", city.toUpperCase());
    }
    if (country) {
      query = query.eq("country", country.toUpperCase());
    }
    
    const { data, error } = await query.maybeSingle();
    
    if (error || !data) {
      return null;
    }
    
    return data as PlayerDetails;
  } catch (err) {
    console.error("[record-match] Erreur recherche joueur:", err);
    return null;
  }
}

/**
 * Vérifie si un joueur existe, sinon le crée
 */
async function getOrCreatePlayer(
  playerId: string,
  email: string,
  pseudo: string,
  fullName: string,
  city: string,
  country: string
): Promise<boolean> {
  if (!masterAdmin) return false;
  
  try {
    const { data: existing, error: checkError } = await masterAdmin
      .from("athletes")
      .select("id")
      .eq("id", playerId)
      .maybeSingle();
    
    if (checkError) {
      console.error("[record-match] Erreur vérification joueur:", checkError);
      return false;
    }
    
    if (existing) {
      const { error: updateError } = await masterAdmin
        .from("athletes")
        .update({
          email: email.toLowerCase(),
          pseudo: pseudo,
          full_name: fullName,
          city: city.toUpperCase(),
          country: country.toUpperCase(),
          status: "ACTIF",
          updated_at: new Date().toISOString(),
        })
        .eq("id", playerId);
      
      if (updateError) {
        console.error("[record-match] Erreur mise à jour joueur:", updateError);
        return false;
      }
      
      return true;
    }
    
    const { error: insertError } = await masterAdmin
      .from("athletes")
      .insert({
        id: playerId,
        email: email.toLowerCase(),
        pseudo: pseudo,
        full_name: fullName,
        city: city.toUpperCase(),
        country: country.toUpperCase(),
        status: "ACTIF",
        rank: "RECRUE",
        points: 0,
        total_matches: 0,
        total_score: 0,
        total_shots: 0,
        total_kills: 0,
        total_deaths: 0,
        total_assists: 0,
        total_hits_head: 0,
        total_hits_body: 0,
        total_hits_legs: 0,
        current_grade_id: 1,
        precision_progress: 0,
        current_cycle_shot_count: 0,
        current_cycle_precision: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    
    if (insertError) {
      console.error("[record-match] Erreur création joueur:", insertError);
      return false;
    }
    
    console.log(`✅ [record-match] Joueur créé: ${email} (${playerId})`);
    return true;
    
  } catch (err) {
    console.error("[record-match] Erreur getOrCreatePlayer:", err);
    return false;
  }
}

/**
 * Estimer le rang du joueur en temps réel depuis Redis
 */
async function getEstimatedRank(playerId: string, newScore: number): Promise<number> {
  try {
    const globalRanking = await redis.zrange('ranking:global', 0, 999, true);
    
    if (!globalRanking || globalRanking.length === 0) {
      return -1;
    }
    
    let rank = 1;
    for (const entry of globalRanking) {
      const score = typeof entry === 'object' && 'score' in entry ? entry.score : 0;
      if (score > newScore) {
        rank++;
      } else {
        break;
      }
    }
    
    return rank;
  } catch (err) {
    console.warn("[record-match] Erreur estimation rang:", err);
    return -1;
  }
}

/**
 * Envoyer le match dans Redis Stream (Queue)
 */
async function pushToQueue(matchId: string, playerId: string, match: Match): Promise<boolean> {
  try {
    await redis.xadd(
      'matches:stream',
      '*',
      'match_id', matchId,
      'player_id', playerId,
      'score', match.score.toString(),
      'shots', JSON.stringify(match.shots),
      'duration', match.duration.toString(),
      'kills', match.kills.toString(),
      'deaths', match.deaths.toString(),
      'assists', match.assists.toString(),
      'win', match.win ? '1' : '0',
      'game_group', match.game_group,
      'shot_distribution', JSON.stringify(match.shot_distribution || {}),
      'timestamp', Date.now().toString()
    );
    
    console.log(`📤 [record-match] Match ${matchId} envoyé dans la queue`);
    return true;
  } catch (err) {
    console.error(`❌ [record-match] Erreur envoi queue:`, err);
    return false;
  }
}

/**
 * Mettre à jour le cache Redis avec les nouvelles stats
 */
async function updateCache(playerId: string, stats: CalculatedStats): Promise<void> {
  try {
    // 1. Mettre à jour le profil du joueur en cache
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
    
    // 2. Mettre à jour le classement global (Sorted Set)
    await redis.zadd('ranking:global', stats.total_score, playerId);
    
    // 3. Mettre à jour le classement de la ville
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
    
    console.log(`✅ [record-match] Cache mis à jour pour ${playerId}`);
  } catch (err) {
    console.warn(`⚠️ [record-match] Erreur mise à jour cache:`, err);
  }
}

/**
 * Met à jour les statistiques cumulées d'un joueur dans Supabase
 */
async function updatePlayerStatsInSupabase(
  playerId: string
): Promise<boolean> {
  if (!masterAdmin) return false;
  
  try {
    const stats = await calculateStatsFromMatches(playerId);
    
    if (!stats) {
      console.warn(`[record-match] Aucune stat calculée pour ${playerId}`);
      return false;
    }
    
    const grade = getGradeFromScore(stats.total_score);
    
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
      .eq("id", playerId);
    
    if (updateError) {
      console.error(`[record-match] Erreur mise à jour stats ${playerId}:`, updateError);
      return false;
    }
    
    console.log(`✅ [record-match] Stats mises à jour pour ${playerId}: ${stats.total_matches} matchs, ${stats.total_score} pts`);
    return true;
    
  } catch (err) {
    console.error(`[record-match] Erreur updatePlayerStatsInSupabase ${playerId}:`, err);
    return false;
  }
}

// ==========================================================
// ROUTE PRINCIPALE - POST
// ==========================================================

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  console.log("🎯 [record-match] Réception d'une nouvelle partie");
  
  try {
    const body = await request.json() as RecordMatchRequest;
    
    // 2. Valider les données obligatoires
    if (body.score === undefined || body.score === null) {
      return NextResponse.json(
        { success: false, error: "Le score est obligatoire" },
        { status: 400 }
      );
    }
    
    if (!body.shots || !Array.isArray(body.shots) || body.shots.length === 0) {
      return NextResponse.json(
        { success: false, error: "Les tirs (shots) sont obligatoires" },
        { status: 400 }
      );
    }
    
    if (body.shots.length > 20) {
      return NextResponse.json(
        { success: false, error: "Maximum 20 tirs par partie" },
        { status: 400 }
      );
    }
    
    // 3. Identifier le joueur
    let playerId: string | null = null;
    let playerEmail: string = "";
    let playerPseudo: string = "";
    let playerFullName: string = "";
    let playerCity: string = body.city || "NANTES";
    let playerCountry: string = body.country || "FR";
    
    // 3a. Via token d'authentification
    if (body.access_token) {
      const tokenData = validateAccessToken(body.access_token);
      if (tokenData) {
        playerId = tokenData.player_id;
        playerEmail = tokenData.email || "";
        playerCity = tokenData.city || playerCity;
        playerCountry = tokenData.country || playerCountry;
        console.log(`🔐 [record-match] Authentification par token: ${playerId}`);
      } else {
        console.warn("⚠️ [record-match] Token invalide ou expiré");
      }
    }
    
    // 3b. Via player_id fourni
    if (!playerId && body.player_id) {
      playerId = body.player_id;
      console.log(`📝 [record-match] player_id fourni: ${playerId}`);
    }
    
    // 3c. Via pseudo/email (recherche)
    if (!playerId && (body.pseudo || body.email)) {
      const identifier = body.pseudo || body.email || "";
      const found = await findPlayerByIdentifier(identifier, playerCity, playerCountry);
      if (found) {
        playerId = found.id;
        playerEmail = found.email;
        playerPseudo = found.pseudo || identifier;
        playerFullName = found.full_name || identifier;
        playerCity = found.city || playerCity;
        playerCountry = found.country || playerCountry;
        console.log(`🔍 [record-match] Joueur trouvé: ${playerId} (${found.email})`);
      } else {
        playerId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        playerPseudo = body.pseudo || `Joueur_${playerId.slice(-6)}`;
        playerFullName = body.pseudo || playerPseudo;
        console.log(`🆕 [record-match] Nouveau joueur temporaire: ${playerId}`);
      }
    }
    
    // 3d. Fallback: ID généré
    if (!playerId) {
      playerId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      playerPseudo = `Joueur_${playerId.slice(-6)}`;
      playerFullName = playerPseudo;
      console.log(`🆕 [record-match] Joueur fallback: ${playerId}`);
    }
    
    // 4. Créer/mettre à jour le joueur dans Supabase
    const playerCreated = await getOrCreatePlayer(
      playerId,
      playerEmail || `${playerPseudo}@vagondys.local`,
      playerPseudo,
      playerFullName,
      playerCity,
      playerCountry
    );
    
    if (!playerCreated) {
      console.warn(`⚠️ [record-match] Impossible de créer/mettre à jour le joueur ${playerId}`);
    }
    
    // 5. Construire l'objet Match
    const matchId = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const matchDate = new Date().toISOString();
    
    const shotDistribution = body.shot_distribution || {};
    if (Object.keys(shotDistribution).length === 0 && body.shots.length > 0) {
      for (const shot of body.shots) {
        const zoneKey = `zone_${shot.zone || 0}`;
        shotDistribution[zoneKey] = (shotDistribution[zoneKey] || 0) + 1;
      }
    }
    
    const match: Match = {
      id: matchId,
      date: matchDate,
      duration: body.duration || 0,
      score: body.score,
      kills: body.kills || 0,
      deaths: body.deaths || 0,
      assists: body.assists || 0,
      shots: body.shots,
      win: body.win !== undefined ? body.win : true,
      game_group: body.game_group || body.game_mode || "CPT1",
      shot_distribution: shotDistribution,
    };
    
    console.log(`📊 [record-match] Match ${matchId}: ${match.score} pts, ${match.shots.length} tirs`);
    
    // ✅ 6. Envoyer dans Redis Stream (Queue)
    const queued = await pushToQueue(matchId, playerId, match);
    
    if (!queued) {
      console.warn(`⚠️ [record-match] Échec envoi queue, fallback synchrone`);
      
      const savedInGitHub = await PlayerDB.addMatch(playerId, match);
      if (!savedInGitHub) {
        console.error(`❌ [record-match] Échec sauvegarde GitHub pour ${playerId}`);
        return NextResponse.json(
          { success: false, error: "Échec de l'enregistrement dans GitHub" },
          { status: 500 }
        );
      }
      
      await updatePlayerStatsInSupabase(playerId);
    }
    
    // ✅ 7. Mettre à jour le cache Redis
    const stats = await calculateStatsFromMatches(playerId);
    if (stats) {
      await updateCache(playerId, stats);
    }
    
    // ✅ 8. Estimer le rang du joueur
    const estimatedRank = await getEstimatedRank(playerId, match.score);
    
    // 9. Construire la réponse
    const response: RecordMatchResponse = {
      success: true,
      match_id: matchId,
      player_id: playerId,
      message: queued ? "Partie enregistrée, traitement en cours" : "Partie enregistrée avec succès",
      estimated_rank: estimatedRank > 0 ? estimatedRank : undefined,
      player_stats: stats ? {
        total_matches: stats.total_matches,
        total_score: stats.total_score,
        total_shots: stats.total_shots,
        total_kills: stats.total_kills,
        total_deaths: stats.total_deaths,
        total_assists: stats.total_assists,
        current_grade_id: stats.current_grade_id,
        precision_progress: stats.precision_progress,
      } : undefined,
    };
    
    const duration = Date.now() - startTime;
    console.log(`✅ [record-match] Terminé en ${duration}ms pour ${playerId} (queue: ${queued})`);
    
    return NextResponse.json(response);
    
  } catch (err) {
    const duration = Date.now() - startTime;
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`❌ [record-match] Erreur après ${duration}ms:`, errorMsg);
    
    return NextResponse.json(
      { success: false, error: "Erreur interne du serveur", details: errorMsg },
      { status: 500 }
    );
  }
}

// ==========================================================
// OPTIONS - CORS
// ==========================================================

export async function OPTIONS() {
  return NextResponse.json(
    {},
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    }
  );
}

export const runtime = "nodejs";
export const maxDuration = 30;
