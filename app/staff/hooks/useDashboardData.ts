
// app/staff/hooks/useDashboardData.ts
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';
import { 
  CityInfo, 
  DashboardStats, 
  RecentActivity, 
  TopPlayer,
  DashboardData 
} from '../types/dashboard';
import { getStationConfig } from '@/lib/supabase/master';

// Type pour les données brutes du joueur provenant de l'API
interface ApiPlayerData {
  id: string;
  pseudo: string;
  full_name: string;
  points?: number;
  rank?: string;
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
  
  // Ref pour éviter les appels multiples au montage
  const isInitialMount = useRef(true);

  const fetchDashboardData = useCallback(async () => {
    if (!userCity || !userEmail) {
      console.log('[useDashboardData] Manque infos:', { userCity, userEmail });
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // ✅ 1. Récupérer la configuration de la station (info seulement)
      const stationConfig = await getStationConfig(userCity, 'FR');
      console.log('[useDashboardData] stationConfig:', stationConfig?.name || 'non trouvée');

      // ✅ 2. CORRECTION : Appel à l'API Route pour les statistiques
      const statsResponse = await fetch(`/api/staff/dashboard-stats?city=${userCity}&country=FR`);
      
      if (!statsResponse.ok) {
        throw new Error(`Erreur API: ${statsResponse.status}`);
      }
      
      const statsData = await statsResponse.json();

      // ✅ 3. Données des activités récentes (via client STAFF pour les messages et lancements)
      let pendingMessages = 0;
      let totalGameLaunches = 0;
      const activities: RecentActivity[] = [];

      if (supabaseClient) {
        // Messages non lus
        const { count: msgCount, error: msgError } = await supabaseClient
          .from('pending_signals')
          .select('*', { count: 'exact', head: true })
          .eq('is_read', false);

        if (!msgError) {
          pendingMessages = msgCount || 0;
        }

        // Lancements de jeux
        const { count: launchesCount, error: launchesError } = await supabaseClient
          .from('game_launches')
          .select('*', { count: 'exact', head: true });

        if (!launchesError) {
          totalGameLaunches = launchesCount || 0;
        }

        // Derniers messages
        const { data: recentMessages } = await supabaseClient
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

        // Derniers lancements de jeux
        const { data: recentLaunches } = await supabaseClient
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

      // ✅ 4. CITY INFO
      const cityInfoData: CityInfo = {
        name: stationConfig?.name || userCity,
        country: stationConfig?.country_code || 'FR',
        totalAthletes: statsData.totalAthletes || 0,
        activeAthletes: statsData.activeAthletes || 0
      };

      setCityInfo(cityInfoData);

      setStats({
        totalAthletes: statsData.totalAthletes || 0,
        activeAthletes: statsData.activeAthletes || 0,
        pendingMessages: pendingMessages,
        todayMatches: 0,
        totalGameLaunches: totalGameLaunches,
        newAthletesThisMonth: statsData.newAthletesThisMonth || 0,
        unreadCount: pendingMessages
      });

      // ✅ 5. Top joueurs depuis l'API - CORRECTION : type spécifique au lieu de any
      if (statsData.topPlayers && statsData.topPlayers.length > 0) {
        const topPlayersData: TopPlayer[] = statsData.topPlayers.map((player: ApiPlayerData) => ({
          id: player.id,
          pseudo: player.pseudo,
          full_name: player.full_name,
          points: player.points || 0,
          rank: player.rank || 'RECRUE',
          matchesPlayed: 0,
          winRate: 0
        }));
        setTopPlayers(topPlayersData);
      }

      // Trier les activités par date
      activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setRecentActivities(activities);

    } catch (err) {
      console.error('[useDashboardData] Erreur chargement dashboard:', err);
      setError('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  }, [supabaseClient, userCity, userEmail]);

  // CORRECTION: Utilisation d'un effet qui s'exécute uniquement au montage
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      fetchDashboardData();
    }
  }, [fetchDashboardData]);

  // Realtime subscriptions
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
