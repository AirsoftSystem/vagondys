export interface MatchRecord {
  date: Date;
  duration: number;
  score: number;
  kills: number;
  deaths: number;
  assists: number;
  shots: number;
  hitsHead: number;
  hitsBody: number;
  hitsLegs: number;
  win: boolean;
  group: string;
  shotDistribution: Record<string, number>;
}

export interface GameStats {
  totalMatches: number;
  totalScore: number;
  totalShots: number;
  totalKills: number;
  totalDeaths: number;
  totalAssists: number;
  totalHitsHead: number;
  totalHitsBody: number;
  totalHitsLegs: number;
}

export interface GameResult {
  score: number;
  shots: number;
  kills: number;
  deaths: number;
  assists: number;
  hitsHead?: number;
  hitsBody?: number;
  hitsLegs?: number;
  date?: Date;
  duration?: number;
  group?: string;
  shotDistribution?: Record<string, number>;
}
