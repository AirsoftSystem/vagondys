
// app/staff/hooks/useDashboardData.ts
"use client";

import { useState, useEffect, useCallback } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';
import { 
  CityInfo, 
  DashboardStats, 
  RecentActivity, 
  TopPlayer,
  DashboardData 
} from '../types/dashboard';
import { getStationConfig } from '@/lib/supabase/master';

// ✅ Interface pour typer les matchs provenant de l'API PUBLIC
interface PublicMatchData {
  id: string;
  date: string;
  score: number;
  win: boolean;
  playerName: string;
}

export function useDashboardData(
  supabaseClient: SupabaseClient | null,
  userCity: string | null,
  userEmail: string | null
): DashboardData {

  const [cityInfo, setCityInfo] = useState<CityInfo | null>(null);
  const [stats, setStats] = useState<DashboardStats>({
    totalAthletes: 0,
    activeAthletes: 0,
    pendingMessages: 0,
    todayMatches: 0,
    totalGameLaunches: 0,
    newAthletesThisMonth: 0
  });
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [topPlayers, setTopPlayers] = useState<TopPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => {
    if (!supabaseClient || !userCity || !userEmail) {
      console.log('[useDashboardData] Manque infos:', { supabaseClient: !!supabaseClient, userCity, userEmail });
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // ✅ 1. Récupérer la configuration de la station (info seulement)
      const stationConfig = await getStationConfig(userCity, 'FR');
      console.log('[useDashboardData] stationConfig:', stationConfig?.name || 'non trouvée');

      // ✅ 2. Récupérer les données PUBLIC via l'API Route
      const publicDataResponse = await fetch(`/api/staff/public-data?city=${userCity}&country=FR`);
      const publicData = await publicDataResponse.json();

      if (!publicDataResponse.ok) {
        throw new Error(publicData.error || "Erreur récupération données PUBLIC");
      }

      // ✅ 3. Client STAFF pour pending_signals et game_launches
      const client = supabaseClient;
      console.log('[useDashboardData] Client STAFF disponible:', !!client);

      // ✅ 4. CITY INFO
      const cityInfoData: CityInfo = {
        name: stationConfig?.name || userCity,
        country: stationConfig?.country_code || 'FR',
        totalAthletes: publicData.totalAthletes || 0,
        activeAthletes: publicData.activeAthletes || 0
      };

      // ==========================================
      // STATISTIQUES (PUBLIC via API + STAFF)
      // ==========================================
      let pendingMessages = 0;
      let totalGameLaunches = 0;

      if (client) {
        // Messages non lus
        const { count: msgCount, error: msgError } = await client
          .from('pending_signals')
          .select('*', { count: 'exact', head: true })
          .eq('is_read', false);

        if (!msgError) {
          pendingMessages = msgCount || 0;
          console.log('[useDashboardData] Messages en attente:', pendingMessages);
        }

        // Lancements de jeux
        const { count: launchesCount, error: launchesError } = await client
          .from('game_launches')
          .select('*', { count: 'exact', head: true });

        if (!launchesError) {
          totalGameLaunches = launchesCount || 0;
        }
      } else {
        console.warn('[useDashboardData] Pas de client STAFF, stats staff = 0');
      }

      setCityInfo(cityInfoData);

      setStats({
        totalAthletes: publicData.totalAthletes || 0,
        activeAthletes: publicData.activeAthletes || 0,
        pendingMessages: pendingMessages,
        todayMatches: 0,
        totalGameLaunches: totalGameLaunches,
        newAthletesThisMonth: publicData.newAthletesThisMonth || 0,
        unreadCount: pendingMessages
      });

      // ✅ 5. Top joueurs depuis l'API
      if (publicData.topPlayers && publicData.topPlayers.length > 0) {
        setTopPlayers(publicData.topPlayers);
      }

      // ==========================================
      // ACTIVITÉS RÉCENTES
      // ==========================================
      const activities: RecentActivity[] = [];

      // Derniers messages (STAFF)
      if (client) {
        const { data: recentMessages } = await client
          .from('pending_signals')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(3);

        if (recentMessages) {
          recentMessages.forEach(msg => {
            activities.push({
              id: msg.id,
              type: 'message',
              title: msg.payload?.subject || 'Nouveau message',
              description: `De: ${msg.payload?.email || 'inconnu'}`,
              timestamp: msg.created_at,
              link: '/staff/interface'
            });
          });
        }

        // Derniers lancements de jeux (STAFF)
        const { data: recentLaunches } = await client
          .from('game_launches')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(3);

        if (recentLaunches) {
          recentLaunches.forEach(launch => {
            activities.push({
              id: launch.id,
              type: 'game_launch',
              title: `Partie ${launch.game_mode} lancée`,
              description: `Par: ${launch.agent_email}`,
              timestamp: launch.created_at,
              link: '/staff/mode_jeux'
            });
          });
        }
      }

      // Derniers matchs (PUBLIC via API)
      if (publicData.recentMatches && publicData.recentMatches.length > 0) {
        // ✅ CORRECTION: Typage explicite pour éviter 'any'
        publicData.recentMatches.forEach((match: PublicMatchData) => {
          activities.push({
            id: match.id,
            type: 'match',
            title: `Match terminé - ${match.win ? 'Victoire' : 'Défaite'}`,
            description: `${match.playerName} - ${match.score} pts`,
            timestamp: match.date,
            link: '/staff/licencies'
          });
        });
      }

      // Trier par date (plus récent en premier)
      activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setRecentActivities(activities);

    } catch (err) {
      console.error('[useDashboardData] Erreur chargement dashboard:', err);
      setError('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  }, [supabaseClient, userCity, userEmail]);

  useEffect(() => {
    const loadData = async () => {
      await fetchDashboardData();
    };
    loadData();
  }, [fetchDashboardData]);

  // Realtime subscriptions (uniquement sur STAFF)
  useEffect(() => {
    if (!supabaseClient) return;

    const channel = supabaseClient
      .channel('dashboard-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pending_signals' },
        () => {
          fetchDashboardData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'game_launches' },
        () => {
          fetchDashboardData();
        }
      )
      .subscribe();

    return () => {
      supabaseClient.removeChannel(channel);
    };
  }, [supabaseClient, fetchDashboardData]);

  return {
    cityInfo,
    stats,
    recentActivities,
    topPlayers,
    loading,
    error,
    refresh: fetchDashboardData
  };
}
