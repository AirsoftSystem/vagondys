
// app/api/cron/sync-rankings/route.ts
import { NextResponse } from "next/server";
import { redis } from "@/lib/redis/client";
import { masterAdmin } from "@/lib/supabase/master";
import { GitHubDB } from "@/lib/github-db/client";

// ==========================================================
// TYPES
// ==========================================================

interface SyncResult {
  success: boolean;
  timestamp: string;
  duration_ms: number;
  global: {
    count: number;
    synced: boolean;
  };
  countries: {
    count: number;
    synced: number;
  };
  cities: {
    count: number;
    synced: number;
  };
  history: {
    count: number;
    synced: boolean;
  };
  github: {
    path: string;
    synced: boolean;
  };
  errors: string[];
}

interface RankingEntry {
  player_id: string;
  rank: number;
  score: number;
  pseudo?: string;
  city?: string;
  country?: string;
}

interface GlobalRankingSnapshot {
  snapshot_date: string;
  total_players: number;
  rankings: RankingEntry[];
  calculated_at: string;
}

interface PlayerDetails {
  id: string;
  pseudo: string;
  city: string;
  country: string;
  total_matches: number;
  current_grade_id: number;
}

interface HistoryEntry {
  player_id: string;
  rank: number;
  previous_rank?: number;
  score: number;
  week_start: string;
  week_end: string;
  city?: string;
  country?: string;
}

// ==========================================================
// CONFIGURATION
// ==========================================================

const TOP_LIMIT_GLOBAL = 1000;
const TOP_LIMIT_COUNTRY = 100;
const TOP_LIMIT_CITY = 50;

// ==========================================================
// FONCTIONS PRINCIPALES
// ==========================================================

/**
 * ✅ CORRIGÉ : Synchronise le classement mondial
 */
async function syncGlobalRanking(): Promise<{ count: number; synced: boolean }> {
  try {
    // 1. Récupérer depuis Redis
    const globalRanking = await redis.zrange('ranking:global', 0, TOP_LIMIT_GLOBAL - 1, true);
    
    if (globalRanking.length === 0) {
      console.warn('⚠️ [sync-rankings] Aucun classement mondial à synchroniser');
      return { count: 0, synced: false };
    }

    // 2. Récupérer les détails des joueurs
    const playerIds = globalRanking.map((entry) => entry.member);
    const playerDetails = await getPlayerDetails(playerIds);

    // 3. Construire les entrées
    const snapshotDate = new Date().toISOString();
    const entries = globalRanking.map((entry, index) => ({
      player_id: entry.member,
      rank: index + 1,
      score: entry.score,
      pseudo: playerDetails[entry.member]?.pseudo || 'Unknown',
      city: playerDetails[entry.member]?.city || '',
      country: playerDetails[entry.member]?.country || '',
      snapshot_date: snapshotDate,
      season: new Date().getFullYear().toString(),
      total_matches: playerDetails[entry.member]?.total_matches || 0,
      // ✅ CORRECTION : win_rate retiré car non disponible
      current_grade_id: playerDetails[entry.member]?.current_grade_id || 1,
      pch: 0,
      created_at: new Date().toISOString()
    }));

    // ✅ Vérification masterAdmin
    if (!masterAdmin) {
      console.error('❌ [sync-rankings] masterAdmin non disponible');
      return { count: 0, synced: false };
    }

    // 4. Supprimer l'ancien classement
    await masterAdmin.from('global_rankings').delete().neq('id', 0);

    // 5. Insérer le nouveau classement (par lots de 100)
    const batchSize = 100;
    for (let i = 0; i < entries.length; i += batchSize) {
      const batch = entries.slice(i, i + batchSize);
      const { error } = await masterAdmin.from('global_rankings').insert(batch);
      if (error) {
        console.error(`❌ [sync-rankings] Erreur insertion batch ${i}:`, error);
        return { count: entries.length, synced: false };
      }
    }

    console.log(`✅ [sync-rankings] Classement mondial synchronisé: ${entries.length} joueurs`);
    return { count: entries.length, synced: true };

  } catch (err) {
    console.error('❌ [sync-rankings] Erreur syncGlobalRanking:', err);
    return { count: 0, synced: false };
  }
}

/**
 * ✅ CORRIGÉ : Synchronise les classements par pays
 */
async function syncCountryRankings(): Promise<{ count: number; synced: number }> {
  try {
    // ✅ Vérification masterAdmin
    if (!masterAdmin) {
      console.error('❌ [sync-rankings] masterAdmin non disponible');
      return { count: 0, synced: 0 };
    }

    // Récupérer la liste des pays depuis Redis
    const countryKeys = await redis.get('ranking:countries');
    const countries = countryKeys ? JSON.parse(countryKeys) : ['FR', 'ES'];

    let totalSynced = 0;

    for (const country of countries) {
      const key = `ranking:country:${country}`;
      const ranking = await redis.zrange(key, 0, TOP_LIMIT_COUNTRY - 1, true);
      
      if (ranking.length === 0) continue;

      // Récupérer les détails des joueurs
      const playerIds = ranking.map((entry) => entry.member);
      const playerDetails = await getPlayerDetails(playerIds);

      // Construire les entrées
      const entries = ranking.map((entry, index) => ({
        player_id: entry.member,
        country: country,
        rank: index + 1,
        score: entry.score,
        pseudo: playerDetails[entry.member]?.pseudo || 'Unknown',
        city: playerDetails[entry.member]?.city || '',
        snapshot_date: new Date().toISOString()
      }));

      // Supprimer l'ancien classement pour ce pays
      await masterAdmin
        .from('country_rankings')
        .delete()
        .eq('country', country);

      // Insérer le nouveau classement
      const { error } = await masterAdmin.from('country_rankings').insert(entries);
      if (error) {
        console.error(`❌ [sync-rankings] Erreur insertion country_rankings ${country}:`, error);
        continue;
      }

      totalSynced += entries.length;
      console.log(`✅ [sync-rankings] Classement ${country} synchronisé: ${entries.length} joueurs`);
    }

    return { count: totalSynced, synced: totalSynced };

  } catch (err) {
    console.error('❌ [sync-rankings] Erreur syncCountryRankings:', err);
    return { count: 0, synced: 0 };
  }
}

/**
 * ✅ CORRIGÉ : Synchronise les classements par ville
 */
async function syncCityRankings(): Promise<{ count: number; synced: number }> {
  try {
    // ✅ Vérification masterAdmin
    if (!masterAdmin) {
      console.error('❌ [sync-rankings] masterAdmin non disponible');
      return { count: 0, synced: 0 };
    }

    // Récupérer la liste des villes depuis Redis
    const cityKeys = await redis.get('ranking:cities');
    const cities = cityKeys ? JSON.parse(cityKeys) : ['NANTES', 'LYON', 'MADRID'];

    let totalSynced = 0;

    for (const city of cities) {
      const key = `ranking:city:FR:${city}`;
      const ranking = await redis.zrange(key, 0, TOP_LIMIT_CITY - 1, true);
      
      if (ranking.length === 0) continue;

      // Récupérer les détails des joueurs
      const playerIds = ranking.map((entry) => entry.member);
      const playerDetails = await getPlayerDetails(playerIds);

      // Construire les entrées
      const entries = ranking.map((entry, index) => ({
        player_id: entry.member,
        city: city,
        country: 'FR',
        rank: index + 1,
        score: entry.score,
        pseudo: playerDetails[entry.member]?.pseudo || 'Unknown',
        snapshot_date: new Date().toISOString()
      }));

      // Supprimer l'ancien classement pour cette ville
      await masterAdmin
        .from('city_rankings')
        .delete()
        .eq('city', city)
        .eq('country', 'FR');

      // Insérer le nouveau classement
      const { error } = await masterAdmin.from('city_rankings').insert(entries);
      if (error) {
        console.error(`❌ [sync-rankings] Erreur insertion city_rankings ${city}:`, error);
        continue;
      }

      totalSynced += entries.length;
      console.log(`✅ [sync-rankings] Classement ${city} synchronisé: ${entries.length} joueurs`);
    }

    return { count: totalSynced, synced: totalSynced };

  } catch (err) {
    console.error('❌ [sync-rankings] Erreur syncCityRankings:', err);
    return { count: 0, synced: 0 };
  }
}

/**
 * ✅ CORRIGÉ : Synchronise l'historique des classements
 */
async function syncHistory(): Promise<{ count: number; synced: boolean }> {
  try {
    // ✅ Vérification masterAdmin
    if (!masterAdmin) {
      console.error('❌ [sync-rankings] masterAdmin non disponible');
      return { count: 0, synced: false };
    }

    // Récupérer l'historique depuis Redis
    const historyKey = 'rankings:history';
    const historyData = await redis.get(historyKey);
    
    if (!historyData) {
      console.log('ℹ️ [sync-rankings] Aucun historique à synchroniser');
      return { count: 0, synced: false };
    }

    const history: HistoryEntry[] = JSON.parse(historyData);
    
    if (history.length === 0) {
      return { count: 0, synced: false };
    }

    // ✅ CORRIGÉ : Typage correct des entrées
    const entries = history.map((h) => ({
      player_id: h.player_id,
      rank: h.rank,
      previous_rank: h.previous_rank || h.rank,
      points: h.score,
      week_start: h.week_start || new Date().toISOString(),
      week_end: h.week_end || new Date().toISOString(),
      city: h.city || '',
      country: h.country || '',
      created_at: new Date().toISOString()
    }));

    // Insérer l'historique
    const { error } = await masterAdmin.from('rankings_history').insert(entries);

    if (error) {
      console.error('❌ [sync-rankings] Erreur insertion rankings_history:', error);
      return { count: history.length, synced: false };
    }

    console.log(`✅ [sync-rankings] Historique synchronisé: ${history.length} entrées`);
    
    // Vider l'historique temporaire
    await redis.del(historyKey);

    return { count: history.length, synced: true };

  } catch (err) {
    console.error('❌ [sync-rankings] Erreur syncHistory:', err);
    return { count: 0, synced: false };
  }
}

/**
 * Synchronise les classements dans GitHub
 */
async function syncToGitHub(): Promise<{ path: string; synced: boolean }> {
  try {
    // Récupérer le top 1000 depuis Redis
    const globalRanking = await redis.zrange('ranking:global', 0, TOP_LIMIT_GLOBAL - 1, true);
    
    if (globalRanking.length === 0) {
      console.warn('⚠️ [sync-rankings] Aucun classement à sauvegarder dans GitHub');
      return { path: '', synced: false };
    }

    // Récupérer les détails des joueurs
    const playerIds = globalRanking.map((entry) => entry.member);
    const playerDetails = await getPlayerDetails(playerIds);

    // Construire l'archive
    const snapshot: GlobalRankingSnapshot = {
      snapshot_date: new Date().toISOString(),
      total_players: await redis.zcard('ranking:global'),
      calculated_at: new Date().toISOString(),
      rankings: globalRanking.map((entry, index) => ({
        player_id: entry.member,
        rank: index + 1,
        score: entry.score,
        pseudo: playerDetails[entry.member]?.pseudo || 'Unknown',
        city: playerDetails[entry.member]?.city || '',
        country: playerDetails[entry.member]?.country || ''
      }))
    };

    // Sauvegarder dans GitHub
    const dateStr = new Date().toISOString().split('T')[0];
    const path = `rankings/global/${dateStr}.json.gz`;
    
    const success = await GitHubDB.write(path, snapshot, { compress: true });
    
    if (success) {
      console.log(`✅ [sync-rankings] Classement sauvegardé dans GitHub: ${path}`);
    } else {
      console.error('❌ [sync-rankings] Échec sauvegarde GitHub');
    }

    return { path, synced: success };

  } catch (err) {
    console.error('❌ [sync-rankings] Erreur syncToGitHub:', err);
    return { path: '', synced: false };
  }
}

/**
 * ✅ CORRIGÉ : Récupère les détails des joueurs
 */
async function getPlayerDetails(playerIds: string[]): Promise<Record<string, PlayerDetails>> {
  const details: Record<string, PlayerDetails> = {};

  try {
    // 1. Essayer de lire depuis Redis cache
    for (const id of playerIds) {
      const cached = await redis.hgetall(`player:${id}`);
      if (cached && Object.keys(cached).length > 0) {
        details[id] = {
          id: id,
          pseudo: cached.pseudo || '',
          city: cached.city || '',
          country: cached.country || '',
          total_matches: parseInt(cached.total_matches) || 0,
          current_grade_id: parseInt(cached.current_grade_id) || 1
        };
      }
    }

    // 2. Pour ceux qui ne sont pas en cache, lire depuis Supabase
    const missingIds = playerIds.filter(id => !details[id]);
    
    if (missingIds.length > 0) {
      // ✅ Vérification masterAdmin
      if (!masterAdmin) {
        console.error('❌ [sync-rankings] masterAdmin non disponible');
        return details;
      }

      const { data: players, error } = await masterAdmin
        .from("athletes")
        .select("id, pseudo, city, country, total_matches, current_grade_id")
        .in("id", missingIds);

      if (!error && players) {
        for (const player of players) {
          details[player.id] = {
            id: player.id,
            pseudo: player.pseudo || '',
            city: player.city || '',
            country: player.country || '',
            total_matches: player.total_matches || 0,
            current_grade_id: player.current_grade_id || 1
          };
          // Mettre en cache
          await redis.hset(`player:${player.id}`, {
            pseudo: player.pseudo || '',
            city: player.city || '',
            country: player.country || '',
            total_matches: player.total_matches || 0,
            current_grade_id: player.current_grade_id || 1
          });
        }
      }
    }

  } catch (err) {
    console.error('❌ [sync-rankings] Erreur getPlayerDetails:', err);
  }

  return details;
}

// ==========================================================
// ROUTE PRINCIPALE - GET (Cron)
// ==========================================================

export async function GET(request: Request) {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();

  // 🔐 Vérification du secret (sécurité)
  const url = new URL(request.url);
  const secret = url.searchParams.get("secret");
  const expectedSecret = process.env.CRON_SECRET;

  if (expectedSecret && secret !== expectedSecret) {
    console.warn("⛔ [sync-rankings] Tentative non autorisée");
    return NextResponse.json(
      { error: "Non autorisé" },
      { status: 401 }
    );
  }

  console.log("🔄 [sync-rankings] Début de la synchronisation");

  const result: SyncResult = {
    success: true,
    timestamp,
    duration_ms: 0,
    global: { count: 0, synced: false },
    countries: { count: 0, synced: 0 },
    cities: { count: 0, synced: 0 },
    history: { count: 0, synced: false },
    github: { path: '', synced: false },
    errors: []
  };

  try {
    // 1. Synchroniser le classement mondial
    const globalResult = await syncGlobalRanking();
    result.global = globalResult;

    // 2. Synchroniser les classements par pays
    const countryResult = await syncCountryRankings();
    result.countries = countryResult;

    // 3. Synchroniser les classements par ville
    const cityResult = await syncCityRankings();
    result.cities = cityResult;

    // 4. Synchroniser l'historique
    const historyResult = await syncHistory();
    result.history = historyResult;

    // 5. Synchroniser dans GitHub
    const githubResult = await syncToGitHub();
    result.github = githubResult;

    result.duration_ms = Date.now() - startTime;

    console.log(`✅ [sync-rankings] Terminé en ${result.duration_ms}ms`);
    console.log(`📊 Global: ${result.global.count}, Pays: ${result.countries.count}, Villes: ${result.cities.count}, Historique: ${result.history.count}`);

    return NextResponse.json(result);

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("❌ [sync-rankings] Erreur critique:", errorMsg);
    
    result.success = false;
    result.errors.push(errorMsg);
    result.duration_ms = Date.now() - startTime;

    return NextResponse.json(result, { status: 500 });
  }
}

// ==========================================================
// EXPORT POUR VERCEL CRON
// ==========================================================

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes
