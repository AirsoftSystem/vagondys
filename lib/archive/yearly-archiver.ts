
/**
 * ==========================================================
 * YEARLY ARCHIVER - ARCHIVAGE ANNUEL DES DONNÉES
 * ==========================================================
 * Ce fichier gère l'archivage des données de l'année N-1
 * vers Cloudflare R2 pour libérer de l'espace sur Supabase
 * Version adaptée pour l'Option B (un seul projet Supabase)
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { R2Client } from '@/lib/storage/r2-client';

// ==========================================================
// TYPES
// ==========================================================

export interface ArchiveData {
  year: number;
  city: string;
  country: string;
  archived_at: string;
  data: {
    players: PlayerArchiveData[];
    matches: MatchArchiveData[];
    tournaments: TournamentArchiveData[];
    rankings: RankingArchiveData[];
    as_eg_sessions: ASEGSessionArchiveData[];
  };
}

export interface PlayerArchiveData {
  id: string;
  email: string;
  full_name: string;
  pseudo: string | null;
  phone: string | null;
  rank: string;
  status: string;
  city: string;
  country: string;
  created_at: string;
  total_score: number;
  total_matches: number;
  total_shots: number;
  total_kills: number;
  total_deaths: number;
  total_assists: number;
}

export interface MatchArchiveData {
  id: string;
  player_id: string;
  player_name: string;
  date: string;
  duration: number;
  score: number;
  kills: number;
  deaths: number;
  assists: number;
  shots: number;
  hits_head: number;
  hits_body: number;
  hits_legs: number;
  win: boolean;
  game_group: string;
  city: string;
  country: string;
}

export interface TournamentArchiveData {
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
}

export interface RankingArchiveData {
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

export interface ASEGSessionArchiveData {
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
}

export interface ArchiveResult {
  success: boolean;
  year: number;
  city: string;
  country: string;
  compressedSize?: number;
  originalSize?: number;
  key?: string;
  error?: string;
  recordsCount?: {
    players: number;
    matches: number;
    tournaments: number;
    rankings: number;
    as_eg_sessions: number;
  };
}

// ==========================================================
// CONFIGURATION
// ==========================================================

const BATCH_SIZE = 1000; // Nombre d'enregistrements par lot

/**
 * ✅ Option B : Crée un client Supabase UNIQUE (projet unique)
 */
async function createSupabaseClient(): Promise<SupabaseClient> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!url || !anonKey) {
    throw new Error('Variables Supabase manquantes');
  }
  
  return createClient(url, anonKey);
}

/**
 * ✅ Option B : Crée un client admin (service role) UNIQUE
 */
async function createSupabaseAdminClient(): Promise<SupabaseClient> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!url || !serviceKey) {
    throw new Error('Variables Supabase manquantes');
  }
  
  return createClient(url, serviceKey);
}

/**
 * Obtient l'année précédente
 */
function getPreviousYear(): number {
  const now = new Date();
  return now.getFullYear() - 1;
}

/**
 * Obtient la plage de dates pour une année donnée
 */
function getYearDateRange(year: number): { start: string; end: string } {
  const start = new Date(year, 0, 1, 0, 0, 0, 0);
  const end = new Date(year, 11, 31, 23, 59, 59, 999);
  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

/**
 * Archive les joueurs d'une année (avec filtre city)
 */
async function archivePlayers(
  client: SupabaseClient,
  year: number,
  city: string,
  country: string
): Promise<PlayerArchiveData[]> {
  const { start, end } = getYearDateRange(year);
  
  let allPlayers: PlayerArchiveData[] = [];
  let offset = 0;
  let hasMore = true;
  
  while (hasMore) {
    const { data, error } = await client
      .from('athletes')
      .select('*')
      .eq('city', city.toUpperCase())
      .eq('country', country.toUpperCase())
      .gte('created_at', start)
      .lte('created_at', end)
      .range(offset, offset + BATCH_SIZE - 1);
    
    if (error) {
      console.error(`❌ Erreur archivage joueurs:`, error);
      break;
    }
    
    if (data && data.length > 0) {
      const mappedPlayers: PlayerArchiveData[] = data.map((p: Record<string, unknown>) => ({
        id: p.id as string,
        email: p.email as string,
        full_name: p.full_name as string,
        pseudo: (p.pseudo as string) || null,
        phone: (p.phone as string) || null,
        rank: p.rank as string,
        status: p.status as string,
        city: city,
        country: country,
        created_at: p.created_at as string,
        total_score: (p.total_score as number) || 0,
        total_matches: (p.total_matches as number) || 0,
        total_shots: (p.total_shots as number) || 0,
        total_kills: (p.total_kills as number) || 0,
        total_deaths: (p.total_deaths as number) || 0,
        total_assists: (p.total_assists as number) || 0,
      }));
      allPlayers = [...allPlayers, ...mappedPlayers];
      offset += BATCH_SIZE;
    } else {
      hasMore = false;
    }
  }
  
  return allPlayers;
}

/**
 * Archive les matchs d'une année (avec filtre city)
 */
async function archiveMatches(
  client: SupabaseClient,
  year: number,
  city: string,
  country: string
): Promise<MatchArchiveData[]> {
  const { start, end } = getYearDateRange(year);
  
  let allMatches: MatchArchiveData[] = [];
  let offset = 0;
  let hasMore = true;
  
  while (hasMore) {
    const { data, error } = await client
      .from('match_history')
      .select('*')
      .eq('city', city.toUpperCase())
      .eq('country', country.toUpperCase())
      .gte('date', start)
      .lte('date', end)
      .range(offset, offset + BATCH_SIZE - 1);
    
    if (error) {
      console.error(`❌ Erreur archivage matchs:`, error);
      break;
    }
    
    if (data && data.length > 0) {
      const mappedMatches: MatchArchiveData[] = data.map((m: Record<string, unknown>) => ({
        id: m.id as string,
        player_id: m.player_id as string,
        player_name: m.player_name as string,
        date: m.date as string,
        duration: m.duration as number,
        score: m.score as number,
        kills: m.kills as number,
        deaths: m.deaths as number,
        assists: m.assists as number,
        shots: m.shots as number,
        hits_head: m.hits_head as number,
        hits_body: m.hits_body as number,
        hits_legs: m.hits_legs as number,
        win: m.win as boolean,
        game_group: m.game_group as string,
        city: city,
        country: country,
      }));
      allMatches = [...allMatches, ...mappedMatches];
      offset += BATCH_SIZE;
    } else {
      hasMore = false;
    }
  }
  
  return allMatches;
}

/**
 * Archive les résultats de tournois d'une année (avec filtre city)
 */
async function archiveTournaments(
  client: SupabaseClient,
  year: number,
  city: string,
  country: string
): Promise<TournamentArchiveData[]> {
  const { start, end } = getYearDateRange(year);
  
  let allTournaments: TournamentArchiveData[] = [];
  let offset = 0;
  let hasMore = true;
  
  while (hasMore) {
    const { data, error } = await client
      .from('tournament_results')
      .select('*')
      .eq('city', city.toUpperCase())
      .eq('country', country.toUpperCase())
      .gte('tournament_date', start)
      .lte('tournament_date', end)
      .range(offset, offset + BATCH_SIZE - 1);
    
    if (error) {
      console.error(`❌ Erreur archivage tournois:`, error);
      break;
    }
    
    if (data && data.length > 0) {
      const mappedTournaments: TournamentArchiveData[] = data.map((t: Record<string, unknown>) => ({
        id: t.id as string,
        tournament_name: t.tournament_name as string,
        tournament_date: t.tournament_date as string,
        player_id: t.player_id as string,
        player_name: t.player_name as string,
        position: t.position as number,
        points_gained: t.points_gained as number,
        category: t.category as string,
        city: city,
        country: country,
      }));
      allTournaments = [...allTournaments, ...mappedTournaments];
      offset += BATCH_SIZE;
    } else {
      hasMore = false;
    }
  }
  
  return allTournaments;
}

/**
 * Archive les classements d'une année (avec filtre city)
 */
async function archiveRankings(
  client: SupabaseClient,
  year: number,
  city: string,
  country: string
): Promise<RankingArchiveData[]> {
  const { start, end } = getYearDateRange(year);
  
  let allRankings: RankingArchiveData[] = [];
  let offset = 0;
  let hasMore = true;
  
  while (hasMore) {
    const { data, error } = await client
      .from('rankings_history')
      .select('*')
      .eq('city', city.toUpperCase())
      .eq('country', country.toUpperCase())
      .gte('week_start', start)
      .lte('week_end', end)
      .range(offset, offset + BATCH_SIZE - 1);
    
    if (error) {
      console.error(`❌ Erreur archivage classements:`, error);
      break;
    }
    
    if (data && data.length > 0) {
      const mappedRankings: RankingArchiveData[] = data.map((r: Record<string, unknown>) => ({
        id: r.id as string,
        player_id: r.player_id as string,
        player_name: r.player_name as string,
        rank: r.rank as number,
        previous_rank: r.previous_rank as number,
        points: r.points as number,
        week_start: r.week_start as string,
        week_end: r.week_end as string,
        city: city,
        country: country,
      }));
      allRankings = [...allRankings, ...mappedRankings];
      offset += BATCH_SIZE;
    } else {
      hasMore = false;
    }
  }
  
  return allRankings;
}

/**
 * Archive les sessions AS-EG d'une année (avec filtre city)
 */
async function archiveASEGSessions(
  client: SupabaseClient,
  year: number,
  city: string,
  country: string
): Promise<ASEGSessionArchiveData[]> {
  const { start, end } = getYearDateRange(year);
  
  let allSessions: ASEGSessionArchiveData[] = [];
  let offset = 0;
  let hasMore = true;
  
  while (hasMore) {
    const { data, error } = await client
      .from('as_eg_sessions')
      .select('*')
      .eq('city', city.toUpperCase())
      .eq('country', country.toUpperCase())
      .gte('created_at', start)
      .lte('created_at', end)
      .range(offset, offset + BATCH_SIZE - 1);
    
    if (error) {
      console.error(`❌ Erreur archivage sessions AS-EG:`, error);
      break;
    }
    
    if (data && data.length > 0) {
      const mappedSessions: ASEGSessionArchiveData[] = data.map((s: Record<string, unknown>) => ({
        id: s.id as string,
        player_id: s.player_id as string,
        player_name: s.player_name as string,
        session_type: s.session_type as string,
        score: s.score as number,
        max_score: s.max_score as number,
        duration_seconds: s.duration_seconds as number,
        created_at: s.created_at as string,
        city: city,
        country: country,
      }));
      allSessions = [...allSessions, ...mappedSessions];
      offset += BATCH_SIZE;
    } else {
      hasMore = false;
    }
  }
  
  return allSessions;
}

/**
 * Compresse et upload l'archive vers R2
 */
async function compressAndUpload(
  archiveData: ArchiveData
): Promise<{ key: string; compressedSize: number; originalSize: number }> {
  const jsonData = JSON.stringify(archiveData);
  const originalSize = Buffer.byteLength(jsonData, 'utf8');
  
  // Compression GZIP
  const { gzipSync } = await import('zlib');
  const compressed = gzipSync(jsonData);
  const compressedSize = compressed.length;
  
  const filename = `archive_${archiveData.year}_${archiveData.city.toLowerCase()}_${Date.now()}.json.gz`;
  const key = R2Client.generateArchivePath(archiveData.year, archiveData.city, filename);
  
  await R2Client.uploadFile(key, compressed, 'application/gzip');
  
  return { key, compressedSize, originalSize };
}

/**
 * Enregistre la référence de l'archive dans la base
 */
async function saveArchiveReference(
  client: SupabaseClient,
  archiveData: ArchiveData,
  key: string,
  compressedSize: number
): Promise<void> {
  try {
    const { error } = await client
      .from('player_archives')
      .insert({
        year: archiveData.year,
        city: archiveData.city,
        country: archiveData.country,
        archive_key: key,
        archive_size: compressedSize,
        records_count: {
          players: archiveData.data.players.length,
          matches: archiveData.data.matches.length,
          tournaments: archiveData.data.tournaments.length,
          rankings: archiveData.data.rankings.length,
          as_eg_sessions: archiveData.data.as_eg_sessions.length,
        },
        archived_at: archiveData.archived_at,
      });
    
    if (error) {
      console.error('❌ Erreur sauvegarde référence:', error);
    }
  } catch (error) {
    console.error('❌ Exception sauvegarde référence:', error);
  }
}

/**
 * Archive toutes les données d'une année pour une ville
 */
export async function archiveYearForCity(
  city: string,
  country: string = 'FR',
  year?: number
): Promise<ArchiveResult> {
  const targetYear = year || getPreviousYear();
  const startTime = Date.now();
  
  console.log(`📦 Début archivage ${targetYear} pour ${city}/${country}`);
  
  try {
    // ✅ Option B : Client UNIQUE
    const client = await createSupabaseClient();
    const adminClient = await createSupabaseAdminClient();
    
    // 1. Récupérer toutes les données
    console.log(`📥 Récupération des données...`);
    const [players, matches, tournaments, rankings, as_eg_sessions] = await Promise.all([
      archivePlayers(client, targetYear, city, country),
      archiveMatches(client, targetYear, city, country),
      archiveTournaments(client, targetYear, city, country),
      archiveRankings(client, targetYear, city, country),
      archiveASEGSessions(client, targetYear, city, country),
    ]);
    
    const recordsCount = {
      players: players.length,
      matches: matches.length,
      tournaments: tournaments.length,
      rankings: rankings.length,
      as_eg_sessions: as_eg_sessions.length,
    };
    
    console.log(`📊 Données récupérées:`, recordsCount);
    
    // Vérifier s'il y a des données à archiver
    const totalRecords = Object.values(recordsCount).reduce((a, b) => a + b, 0);
    if (totalRecords === 0) {
      return {
        success: true,
        year: targetYear,
        city,
        country,
        recordsCount,
      };
    }
    
    // 2. Construire l'archive
    const archiveData: ArchiveData = {
      year: targetYear,
      city,
      country,
      archived_at: new Date().toISOString(),
      data: {
        players,
        matches,
        tournaments,
        rankings,
        as_eg_sessions,
      },
    };
    
    // 3. Compresser et uploader vers R2
    console.log(`☁️ Upload vers R2...`);
    const { key, compressedSize, originalSize } = await compressAndUpload(archiveData);
    
    // 4. Sauvegarder la référence
    await saveArchiveReference(adminClient, archiveData, key, compressedSize);
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ Archivage terminé en ${duration}s. Compression: ${((compressedSize / originalSize) * 100).toFixed(1)}%`);
    
    return {
      success: true,
      year: targetYear,
      city,
      country,
      compressedSize,
      originalSize,
      key,
      recordsCount,
    };
    
  } catch (error) {
    console.error(`❌ Erreur archivage pour ${city}/${country}:`, error);
    return {
      success: false,
      year: targetYear || getPreviousYear(),
      city,
      country,
      error: error instanceof Error ? error.message : 'Erreur inconnue',
    };
  }
}

/**
 * Archive toutes les données d'une année pour toutes les villes
 */
export async function archiveYearForAllCities(
  year?: number
): Promise<ArchiveResult[]> {
  const cities = [
    { code: 'NANTES', country: 'FR' },
    { code: 'LYON', country: 'FR' },
    { code: 'MADRID', country: 'ES' },
    { code: 'BARCELONE', country: 'ES' },
  ];
  
  const results: ArchiveResult[] = [];
  
  for (const city of cities) {
    console.log(`\n🔍 Traitement de ${city.code}/${city.country}...`);
    const result = await archiveYearForCity(city.code, city.country, year);
    results.push(result);
    
    // Attendre un peu entre chaque ville pour ne pas surcharger
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return results;
}

/**
 * Vérifie si une archive existe déjà pour une année et une ville
 */
export async function archiveExists(
  year: number,
  city: string,
  country: string = 'FR'
): Promise<boolean> {
  try {
    const client = await createSupabaseClient();
    const { data, error } = await client
      .from('player_archives')
      .select('id')
      .eq('year', year)
      .eq('city', city.toUpperCase())
      .eq('country', country.toUpperCase())
      .maybeSingle();
    
    if (error) {
      console.error('❌ Erreur vérification archive:', error);
      return false;
    }
    
    return !!data;
  } catch {
    return false;
  }
}

/**
 * Récupère les métadonnées d'une archive
 */
export async function getArchiveMetadata(
  year: number,
  city: string,
  country: string = 'FR'
): Promise<{ key: string; size: number; recordsCount: Record<string, number> } | null> {
  try {
    const client = await createSupabaseClient();
    const { data, error } = await client
      .from('player_archives')
      .select('archive_key, archive_size, records_count')
      .eq('year', year)
      .eq('city', city.toUpperCase())
      .eq('country', country.toUpperCase())
      .maybeSingle();
    
    if (error || !data) {
      return null;
    }
    
    return {
      key: data.archive_key,
      size: data.archive_size,
      recordsCount: data.records_count,
    };
  } catch {
    return null;
  }
}

/**
 * Récupère et décompresse une archive
 */
export async function loadArchive(
  year: number,
  city: string,
  country: string = 'FR'
): Promise<ArchiveData | null> {
  try {
    const metadata = await getArchiveMetadata(year, city, country);
    if (!metadata) {
      return null;
    }
    
    const compressedData = await R2Client.downloadFile(metadata.key);
    
    const { gunzipSync } = await import('zlib');
    const jsonData = gunzipSync(compressedData).toString('utf8');
    
    return JSON.parse(jsonData) as ArchiveData;
  } catch (error) {
    console.error('❌ Erreur chargement archive:', error);
    return null;
  }
}
