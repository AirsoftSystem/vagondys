
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

// ✅ Interface pour typer les matchs provenant de l'API PUBLIC
interface PublicMatchData {
  id: string;
  date: string;
  score: number;
  win: boolean;
  playerName: string;
}

// ✅ Interface pour typer les données de l'API public-data
interface PublicDataResponse {
  totalAthletes: number;
  activeAthletes: number;
  newAthletesThisMonth: number;
  topPlayers: TopPlayer[];
  recentMatches: PublicMatchData[];
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
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // ✅ Option B : Plus de getStationConfig
      // Les données de la ville sont directement utilisées
      const cityName = userCity.toUpperCase().trim();
      
      // ✅ Détection des admins (MASTER) pour qu'ils voient TOUS les messages
      const isAdmin = cityName === 'MASTER';

      // ✅ Récupérer les données PUBLIC via l'API Route
      const publicDataResponse = await fetch(`/api/staff/public-data?city=${userCity}&country=FR`);
      
      if (!publicDataResponse.ok) {
        throw new Error(`Erreur récupération données PUBLIC: ${publicDataResponse.status}`);
      }
      
      const publicData = await publicDataResponse.json() as PublicDataResponse;

      const client = supabaseClient;

      const cityInfoData: CityInfo = {
        name: cityName,
        country: 'FR',
        totalAthletes: publicData.totalAthletes || 0,
        activeAthletes: publicData.activeAthletes || 0
      };

      let pendingMessages = 0;
      let totalGameLaunches = 0;

      if (client) {
        // ✅ CORRECTION : Pour les admins (MASTER), NE PAS filtrer par ville
        // Pour les agents normaux, filtrer par leur ville
        let pendingQuery = client
          .from('pending_signals')
          .select('*', { count: 'exact', head: true })
          .eq('is_read', false);
        
        if (!isAdmin) {
          pendingQuery = pendingQuery.eq('city', cityName);
        }
        
        const { count: msgCount } = await pendingQuery;
        pendingMessages = msgCount || 0;

        // ✅ Ajout du filtre city pour les game_launches
        const { count: launchesCount } = await client
          .from('game_launches')
          .select('*', { count: 'exact', head: true })
          .eq('city', cityName);
        totalGameLaunches = launchesCount || 0;
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

      if (publicData.topPlayers && publicData.topPlayers.length > 0) {
        setTopPlayers(publicData.topPlayers);
      }

      const activities: RecentActivity[] = [];

      if (client) {
        // ✅ CORRECTION : Pour les admins (MASTER), NE PAS filtrer par ville pour les messages récents
        let messagesQuery = client
          .from('pending_signals')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(3);
        
        if (!isAdmin) {
          messagesQuery = messagesQuery.eq('city', cityName);
        }
        
        const { data: recentMessages } = await messagesQuery;

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

        // ✅ Ajout du filtre city pour les lancements de jeux récents
        const { data: recentLaunches } = await client
          .from('game_launches')
          .select('*')
          .eq('city', cityName)
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

      // Ajout des matchs récents depuis l'API public-data
      if (publicData.recentMatches && publicData.recentMatches.length > 0) {
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

      activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setRecentActivities(activities);

    } catch (err) {
      console.error('[useDashboardData] Erreur:', err);
      setError('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  }, [supabaseClient, userCity, userEmail]);

  // Chargement initial
  useEffect(() => {
    const loadData = async () => {
      await fetchDashboardData();
    };
    loadData();
  }, [fetchDashboardData]);

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
