
// app/api/cron/recalculate-stats/route.ts
import { NextResponse } from "next/server";
import { masterAdmin } from "@/lib/supabase/master";
import { PlayerDB } from "@/lib/github-db/player";

// ==========================================================
// TYPES
// ==========================================================

interface RecalculateStatsResult {
  success: boolean;
  total_players: number;
  updated_players: number;
  errors: string[];
  duration_ms: number;
  timestamp: string;
}

interface PlayerStats {
  total_matches: number;
  total_score: number;
  total_shots: number;
  total_kills: number;
  total_deaths: number;
  total_assists: number;
  total_hits_head: number;
  total_hits_body: number;
  total_hits_legs: number;
  current_grade_id: number;
  precision_progress: number;
  current_cycle_shot_count: number;
  current_cycle_precision: number;
}

// ==========================================================
// CONFIGURATION
// ==========================================================

const CYCLE_SIZE = 100;

const GRADE_THRESHOLDS = [
  { id: 1, minScore: 0 },
  { id: 2, minScore: 100 },
  { id: 3, minScore: 200 },
  { id: 4, minScore: 300 },
  { id: 5, minScore: 400 },
  { id: 6, minScore: 500 },
  { id: 7, minScore: 600 },
  { id: 8, minScore: 700 },
  { id: 9, minScore: 800 },
  { id: 10, minScore: 900 },
  { id: 11, minScore: 1000 },
  { id: 12, minScore: 1100 },
  { id: 13, minScore: 1200 },
  { id: 14, minScore: 1300 },
  { id: 15, minScore: 1400 },
  { id: 16, minScore: 1500 },
  { id: 17, minScore: 1600 },
  { id: 18, minScore: 1700 },
  { id: 19, minScore: 1800 },
  { id: 20, minScore: 1900 },
  { id: 21, minScore: 2000 },
  { id: 22, minScore: 3000 },
  { id: 23, minScore: 4000 },
  { id: 24, minScore: 5000 },
];

// ==========================================================
// FONCTION DE CALCUL
// ==========================================================

async function calculateStatsFromGitHub(playerId: string): Promise<PlayerStats | null> {
  try {
    const allMatches = await PlayerDB.getAllMatches(playerId);

    if (!allMatches || allMatches.length === 0) {
      return null;
    }

    let total_matches = 0;
    let total_score = 0;
    let total_shots = 0;
    let total_kills = 0;
    let total_deaths = 0;
    let total_assists = 0;
    let total_hits_head = 0;
    let total_hits_body = 0;
    let total_hits_legs = 0;

    const allShots: Array<{ points: number }> = [];

    for (const match of allMatches) {
      total_matches++;
      total_score += match.score;
      total_kills += match.kills || 0;
      total_deaths += match.deaths || 0;
      total_assists += match.assists || 0;
      total_shots += match.shots.length;

      for (const shot of match.shots) {
        allShots.push({ points: shot.points });

        if (shot.zone >= 8 && shot.zone <= 10) total_hits_head++;
        else if (shot.zone >= 4 && shot.zone <= 7) total_hits_body++;
        else if (shot.zone >= 1 && shot.zone <= 3) total_hits_legs++;
      }
    }

    // Cycle de précision (100 derniers tirs)
    const recentShots = allShots.slice(-CYCLE_SIZE);
    const hitsInCycle = recentShots.filter((s) => s.points > 0).length;
    const current_cycle_precision = recentShots.length > 0 ? (hitsInCycle / recentShots.length) * 100 : 0;
    const current_cycle_shot_count = recentShots.length;

    // Progression de précision
    const precision_progress = total_shots > 0
      ? Math.min(((total_shots - allShots.filter((s) => s.points === 0).length) / total_shots) * 100, 100)
      : 0;

    // Grade actuel
    let current_grade_id = 1;
    for (const grade of GRADE_THRESHOLDS) {
      if (total_score >= grade.minScore) {
        current_grade_id = grade.id;
      }
    }

    return {
      total_matches,
      total_score,
      total_shots,
      total_kills,
      total_deaths,
      total_assists,
      total_hits_head,
      total_hits_body,
      total_hits_legs,
      current_grade_id,
      precision_progress,
      current_cycle_shot_count,
      current_cycle_precision,
    };
  } catch (err) {
    console.error(`[recalculate-stats] Erreur calcul stats pour ${playerId}:`, err);
    return null;
  }
}

// ==========================================================
// ROUTE PRINCIPALE
// ==========================================================

export async function GET() {
  const startTime = Date.now();
  const result: RecalculateStatsResult = {
    success: true,
    total_players: 0,
    updated_players: 0,
    errors: [],
    duration_ms: 0,
    timestamp: new Date().toISOString(),
  };

  console.log("🔄 [recalculate-stats] Début du recalcul");

  try {
    // Vérifier masterAdmin
    if (!masterAdmin) {
      console.error("❌ [recalculate-stats] masterAdmin non disponible");
      return NextResponse.json(
        { error: "masterAdmin non disponible" },
        { status: 500 }
      );
    }

    // Récupérer tous les joueurs
    const { data: athletes, error: athletesError } = await masterAdmin
      .from("athletes")
      .select("id, email, full_name, pseudo")
      .order("created_at", { ascending: true });

    if (athletesError) {
      console.error("❌ [recalculate-stats] Erreur récupération athletes:", athletesError);
      return NextResponse.json(
        { error: athletesError.message },
        { status: 500 }
      );
    }

    if (!athletes || athletes.length === 0) {
      result.duration_ms = Date.now() - startTime;
      return NextResponse.json(result);
    }

    result.total_players = athletes.length;
    let updatedCount = 0;

    for (const athlete of athletes) {
      try {
        console.log(`🔍 [recalculate-stats] Traitement de ${athlete.email}`);

        const stats = await calculateStatsFromGitHub(athlete.id);

        if (!stats) {
          console.log(`ℹ️ [recalculate-stats] Aucune partie pour ${athlete.email}`);
          continue;
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
            updated_at: new Date().toISOString(),
          })
          .eq("id", athlete.id);

        if (updateError) {
          console.error(`❌ [recalculate-stats] Erreur mise à jour ${athlete.email}:`, updateError);
          result.errors.push(`Erreur ${athlete.email}: ${updateError.message}`);
          continue;
        }

        updatedCount++;
        console.log(
          `✅ [recalculate-stats] ${athlete.email}: ${stats.total_matches} matchs, ${stats.total_score} pts, grade ${stats.current_grade_id}`
        );

      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error(`❌ [recalculate-stats] Erreur pour ${athlete.email}:`, errorMsg);
        result.errors.push(`Erreur ${athlete.email}: ${errorMsg}`);
      }
    }

    result.updated_players = updatedCount;
    result.duration_ms = Date.now() - startTime;

    console.log(`✅ [recalculate-stats] Terminé: ${updatedCount}/${athletes.length} en ${result.duration_ms}ms`);

    return NextResponse.json(result);

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("❌ [recalculate-stats] Erreur critique:", errorMsg);

    result.success = false;
    result.errors.push(`Erreur critique: ${errorMsg}`);
    result.duration_ms = Date.now() - startTime;

    return NextResponse.json(result, { status: 500 });
  }
}

export const runtime = "nodejs";
export const maxDuration = 300;
