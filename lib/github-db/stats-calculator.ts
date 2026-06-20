
// lib/github-db/stats-calculator.ts
import { PlayerDB } from "./player";

// ==========================================================
// TYPES
// ==========================================================

export interface CalculatedStats {
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

export interface GradeThreshold {
  id: number;
  minScore: number;
  maxStars: number;
}

// ==========================================================
// CONFIGURATION
// ==========================================================

export const CYCLE_SIZE = 100;

export const GRADE_THRESHOLDS: GradeThreshold[] = [
  { id: 1, minScore: 0, maxStars: 5 },
  { id: 2, minScore: 100, maxStars: 5 },
  { id: 3, minScore: 200, maxStars: 5 },
  { id: 4, minScore: 300, maxStars: 5 },
  { id: 5, minScore: 400, maxStars: 5 },
  { id: 6, minScore: 500, maxStars: 5 },
  { id: 7, minScore: 600, maxStars: 5 },
  { id: 8, minScore: 700, maxStars: 5 },
  { id: 9, minScore: 800, maxStars: 5 },
  { id: 10, minScore: 900, maxStars: 5 },
  { id: 11, minScore: 1000, maxStars: 5 },
  { id: 12, minScore: 1100, maxStars: 5 },
  { id: 13, minScore: 1200, maxStars: 5 },
  { id: 14, minScore: 1300, maxStars: 5 },
  { id: 15, minScore: 1400, maxStars: 5 },
  { id: 16, minScore: 1500, maxStars: 5 },
  { id: 17, minScore: 1600, maxStars: 5 },
  { id: 18, minScore: 1700, maxStars: 5 },
  { id: 19, minScore: 1800, maxStars: 5 },
  { id: 20, minScore: 1900, maxStars: 5 },
  { id: 21, minScore: 2000, maxStars: 3 },
  { id: 22, minScore: 3000, maxStars: 6 },
  { id: 23, minScore: 4000, maxStars: 9 },
  { id: 24, minScore: 5000, maxStars: 12 },
];

// ==========================================================
// FONCTION PRINCIPALE
// ==========================================================

export async function calculateStatsFromMatches(
  playerId: string
): Promise<CalculatedStats | null> {
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

    // Cycle de précision
    const recentShots = allShots.slice(-CYCLE_SIZE);
    const hitsInCycle = recentShots.filter((s) => s.points > 0).length;
    const current_cycle_precision = recentShots.length > 0
      ? (hitsInCycle / recentShots.length) * 100
      : 0;
    const current_cycle_shot_count = recentShots.length;

    // Progression de précision
    const precision_progress = total_shots > 0
      ? Math.min(
          ((total_shots - allShots.filter((s) => s.points === 0).length) / total_shots) * 100,
          100
        )
      : 0;

    // Grade
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
    console.error(`[StatsCalculator] Erreur pour ${playerId}:`, err);
    return null;
  }
}

export function getGradeFromScore(score: number): GradeThreshold {
  let result = GRADE_THRESHOLDS[0];
  for (const grade of GRADE_THRESHOLDS) {
    if (score >= grade.minScore) {
      result = grade;
    }
  }
  return result;
}
