
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

// Interface pour typer la réponse de la relation athletes dans match_history
interface MatchWithAthlete {
  id: string;
  date: string;
  score: number;
  win: boolean;
  athletes: {
    pseudo: string | null;
    full_name: string;
  } | null;
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

  // ✅ CORRECTION: Initialiser la ref avec null
  const fetchDashboardDataRef = useRef<(() => Promise<void>) | null>(null);

  const fetchDashboardData = useCallback(async () => {
    if (!supabaseClient || !userCity || !userEmail) {
      console.log('[useDashboardData] Manque infos:', { supabaseClient: !!supabaseClient, userCity, userEmail });
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const stationConfig = await getStationConfig(userCity, 'FR');
      console.log('[useDashboardData] stationConfig:', stationConfig?.name || 'non trouvée');

      const client = supabaseClient;
      console.log('[useDashboardData] Client STAFF disponible:', !!client);

      const cityInfoData: CityInfo = {
        name: stationConfig?.name || userCity,
        country: stationConfig?.country_code || 'FR',
        totalAthletes: 0,
        activeAthletes: 0
      };

      let totalAthletes = 0;
      let activeAthletes = 0;
      let todayMatches = 0;
      let newAthletesThisMonth = 0;
      let pendingMessages = 0;
      let totalGameLaunches = 0;

      if (client) {
        const { count: totalCount, error: totalError } = await client
          .from('athletes')
          .select('*', { count: 'exact', head: true });

        if (totalError) {
          console.warn('[useDashboardData] Erreur total athletes:', totalError.message);
        } else {
          totalAthletes = totalCount || 0;
          console.log('[useDashboardData] Total athlètes:', totalAthletes);
        }

        const { count: activeCount, error: activeError } = await client
          .from('athletes')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'ACTIF');

        if (activeError) {
          console.warn('[useDashboardData] Erreur active athletes:', activeError.message);
        } else {
          activeAthletes = activeCount || 0;
          console.log('[useDashboardData] Athlètes actifs:', activeAthletes);
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const { count: matchesCount, error: matchesError } = await client
          .from('match_history')
          .select('*', { count: 'exact', head: true })
          .gte('date', today.toISOString())
          .lt('date', tomorrow.toISOString());

        if (matchesError) {
          console.warn('[useDashboardData] Erreur today matches:', matchesError.message);
        } else {
          todayMatches = matchesCount || 0;
        }

        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const { count: newCount, error: newError } = await client
          .from('athletes')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', firstDayOfMonth.toISOString());

        if (newError) {
          console.warn('[useDashboardData] Erreur new athletes:', newError.message);
        } else {
          newAthletesThisMonth = newCount || 0;
        }

        const { count: msgCount, error: msgError } = await client
          .from('pending_signals')
          .select('*', { count: 'exact', head: true })
          .eq('is_read', false);

        if (msgError) {
          console.warn('[useDashboardData] Erreur pending messages:', msgError.message);
        } else {
          pendingMessages = msgCount || 0;
          console.log('[useDashboardData] Messages en attente:', pendingMessages);
        }

        const { count: launchesCount, error: launchesError } = await client
          .from('game_launches')
          .select('*', { count: 'exact', head: true });

        if (launchesError) {
          console.warn('[useDashboardData] Erreur game launches:', launchesError.message);
        } else {
          totalGameLaunches = launchesCount || 0;
        }
      } else {
        console.warn('[useDashboardData] Pas de client STAFF, toutes les stats = 0');
      }

      setCityInfo({
        ...cityInfoData,
        totalAthletes,
        activeAthletes
      });

      setStats({
        totalAthletes,
        activeAthletes,
        pendingMessages,
        todayMatches,
        totalGameLaunches,
        newAthletesThisMonth,
        unreadCount: pendingMessages
      });

      const activities: RecentActivity[] = [];

      if (client) {
        const { data: recentMessages, error: recentMessagesError } = await client
          .from('pending_signals')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(3);

        if (!recentMessagesError && recentMessages) {
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

        const { data: recentLaunches, error: launchesError2 } = await client
          .from('game_launches')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(3);

        if (!launchesError2 && recentLaunches) {
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

        const { data: recentMatches, error: matchesError2 } = await client
          .from('match_history')
          .select('*, athletes(pseudo, full_name)')
          .order('date', { ascending: false })
          .limit(3);

        if (!matchesError2 && recentMatches) {
          (recentMatches as unknown as MatchWithAthlete[]).forEach(match => {
            const playerName = match.athletes?.pseudo || match.athletes?.full_name || 'Joueur';
            activities.push({
              id: match.id,
              type: 'match',
              title: `Match terminé - ${match.win ? 'Victoire' : 'Défaite'}`,
              description: `${playerName} - ${match.score} pts`,
              timestamp: match.date,
              link: '/staff/licencies'
            });
          });
        }
      }

      activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setRecentActivities(activities);

      if (client) {
        const { data: players, error: playersError } = await client
          .from('athletes')
          .select('id, pseudo, full_name, points, rank')
          .order('points', { ascending: false })
          .limit(5);

        if (!playersError && players) {
          const topPlayersData: TopPlayer[] = await Promise.all(
            players.map(async (player) => {
              const { count: matchesPlayed } = await client
                .from('match_history')
                .select('*', { count: 'exact', head: true })
                .eq('player_id', player.id);

              const { count: wins } = await client
                .from('match_history')
                .select('*', { count: 'exact', head: true })
                .eq('player_id', player.id)
                .eq('win', true);

              const totalMatches = matchesPlayed || 0;
              const winRate = totalMatches > 0 ? Math.round((wins || 0) / totalMatches * 100) : 0;

              return {
                id: player.id,
                pseudo: player.pseudo,
                full_name: player.full_name,
                points: player.points || 0,
                rank: player.rank || 'RECRUE',
                matchesPlayed: totalMatches,
                winRate
              };
            })
          );
          setTopPlayers(topPlayersData);
        }
      }

    } catch (err) {
      console.error('[useDashboardData] Erreur chargement dashboard:', err);
      setError('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  }, [supabaseClient, userCity, userEmail]);

  // ✅ METTRE À JOUR LA REF
  useEffect(() => {
    fetchDashboardDataRef.current = fetchDashboardData;
  }, [fetchDashboardData]);

  // ✅ CORRECTION: CHARGEMENT INITIAL avec fonction async wrapper
  useEffect(() => {
    const loadData = async () => {
      await fetchDashboardData();
    };
    loadData();
  }, [fetchDashboardData]);

  // ✅ REALTIME CORRIGÉ - utilise la REF pour éviter la dépendance
  useEffect(() => {
    if (!supabaseClient) return;

    const channel = supabaseClient
      .channel('dashboard-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pending_signals' },
        () => {
          // ✅ Appeler via la REF (stable)
          if (fetchDashboardDataRef.current) {
            fetchDashboardDataRef.current();
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'game_launches' },
        () => {
          if (fetchDashboardDataRef.current) {
            fetchDashboardDataRef.current();
          }
        }
      )
      .subscribe();

    return () => {
      supabaseClient.removeChannel(channel);
    };
  }, [supabaseClient]); // ✅ PLUS DE fetchDashboardData DANS LES DÉPENDANCES

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
