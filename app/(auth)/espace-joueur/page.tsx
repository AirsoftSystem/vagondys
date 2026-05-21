
"use client";

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { 
  LogOut,
  RefreshCcw,
  ShieldCheck,
  MapPin,
  Archive,
  Activity,
  Target,
  Clock,
  Crosshair
} from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createVagondysClient, type Athlete, type GitHubArchiveData, fetchGitHubArchive } from "@/lib/supabase/client";
import { RealtimeChannel } from '@supabase/supabase-js';

// ==========================================
// Imports des composants
// ==========================================
import { PrecisionBar } from './components/PrecisionBar';
import { GlobalProgressBar } from './components/GlobalProgressBar';
import { ScoreChart } from './components/ScoreChart';
import { HistoryTable } from './components/HistoryTable';
import { FlowerCibleCamembertWidget } from './components/cibles/FlowerCibleCamembertWidget';
import { FleurDeCiblesWidget } from './components/cibles/FleurDeCiblesWidget';
import { FullscreenCibles } from './components/cibles/FullscreenCibles';
import { formatSeconds } from './utils/formatters';

// ==========================================
// Types
// ==========================================
interface MatchRecord {
  id?: string;
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

// Interface pour les données brutes de Supabase (AVEC game_group)
interface RawMatchHistory {
  id: string;
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
  shot_distribution: Record<string, number>;
}

interface ExtendedAthlete extends Omit<Athlete, 'rank' | 'status'> {
  country?: string;
  city?: string;
  dossier_ref?: string;
  status?: string; 
  rank?: string | null; 
  current_grade_id?: number;
  precision_progress?: number;
  current_cycle_shot_count?: number;
  current_cycle_precision?: number;
  total_matches?: number;
  total_score?: number;
  total_shots?: number;
  total_kills?: number;
  total_deaths?: number;
  total_assists?: number;
  total_hits_head?: number;
  total_hits_body?: number;
  total_hits_legs?: number;
  total_connected_microseconds?: number;
}

interface GameStats {
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

// ==========================================
// Grades complets basés sur grades.json
// ==========================================
const GRADES = [
  { id: 1, name: "Guerrier I", icon: "/grades/guerrier_1.png", stars: 1, maxStars: 5, demotionRule: "Aucune" },
  { id: 2, name: "Guerrier II", icon: "/grades/guerrier_2.png", stars: 2, maxStars: 5, demotionRule: "Aucune" },
  { id: 3, name: "Guerrier III", icon: "/grades/guerrier_3.png", stars: 3, maxStars: 5, demotionRule: "Aucune" },
  { id: 4, name: "Élite I", icon: "/grades/elite_1.png", stars: 4, maxStars: 5, demotionRule: "Aucune" },
  { id: 5, name: "Élite II", icon: "/grades/elite_2.png", stars: 5, maxStars: 5, demotionRule: "Aucune" },
  { id: 6, name: "Élite III", icon: "/grades/elite_3.png", stars: 6, maxStars: 5, demotionRule: "Aucune" },
  { id: 7, name: "Maître I", icon: "/grades/maitre_1.png", stars: 7, maxStars: 5, demotionRule: "Rétrogradation division inférieure" },
  { id: 8, name: "Maître II", icon: "/grades/maitre_2.png", stars: 8, maxStars: 5, demotionRule: "Rétrogradation division inférieure" },
  { id: 9, name: "Maître III", icon: "/grades/maitre_3.png", stars: 9, maxStars: 5, demotionRule: "Rétrogradation division inférieure" },
  { id: 10, name: "Grand Maître I", icon: "/grades/grand_maitre_1.png", stars: 10, maxStars: 5, demotionRule: "Rétrogradation division inférieure" },
  { id: 11, name: "Grand Maître II", icon: "/grades/grand_maitre_2.png", stars: 11, maxStars: 5, demotionRule: "Rétrogradation division inférieure" },
  { id: 12, name: "Grand Maître III", icon: "/grades/grand_maitre_3.png", stars: 12, maxStars: 5, demotionRule: "Rétrogradation division inférieure" },
  { id: 13, name: "Épique I", icon: "/grades/epique_1.png", stars: 13, maxStars: 5, demotionRule: "Rétrogradation division inférieure" },
  { id: 14, name: "Épique II", icon: "/grades/epique_2.png", stars: 14, maxStars: 5, demotionRule: "Rétrogradation division inférieure" },
  { id: 15, name: "Épique III", icon: "/grades/epique_3.png", stars: 15, maxStars: 5, demotionRule: "Rétrogradation division inférieure" },
  { id: 16, name: "Épique IV", icon: "/grades/epique_4.png", stars: 16, maxStars: 5, demotionRule: "Rétrogradation division inférieure" },
  { id: 17, name: "Épique V", icon: "/grades/epique_5.png", stars: 17, maxStars: 5, demotionRule: "Rétrogradation division inférieure" },
  { id: 18, name: "Légende I", icon: "/grades/legende_1.png", stars: 18, maxStars: 5, demotionRule: "Rétro à Épique 3" },
  { id: 19, name: "Légende II", icon: "/grades/legende_2.png", stars: 19, maxStars: 5, demotionRule: "Rétro à Épique 3" },
  { id: 20, name: "Légende III", icon: "/grades/legende_3.png", stars: 20, maxStars: 5, demotionRule: "Rétro à Épique 4" },
  { id: 21, name: "Immortel Mythique1000", icon: "/grades/immortel_1000.png", stars: 21, maxStars: 3, demotionRule: "Rétro à Légende 5" },
  { id: 22, name: "Immortel Mythique100", icon: "/grades/immortel_100.png", stars: 22, maxStars: 6, demotionRule: "Rétro à Légende 5" },
  { id: 23, name: "Immortel Mythique10", icon: "/grades/immortel_10.png", stars: 23, maxStars: 9, demotionRule: "Rétro à Légende 5" },
  { id: 24, name: "Immortel Mythique1", icon: "/grades/immortel_1.png", stars: 24, maxStars: 12, demotionRule: "Rétro à Légende 5" },
];

export default function EspaceJoueur() {
  const router = useRouter();
  
  // ✅ CORRECTION : Stocker le client de données séparément
  const [supabaseData, setSupabaseData] = useState<ReturnType<typeof createVagondysClient> | null>(null);
  
  // Client par défaut pour l'AUTH (Master)
  const supabaseAuth = createVagondysClient();
  
  const [loading, setLoading] = useState(true);
  const [player, setPlayer] = useState<ExtendedAthlete | null>(null);
  const [archive, setArchive] = useState<GitHubArchiveData | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // ==========================================
  // État pour l'historique des matchs
  // ==========================================
  const [matchHistory, setMatchHistory] = useState<MatchRecord[]>([]);
  
  // ==========================================
  // États pour l'affichage
  // ==========================================
  const [showFullscreenCibles, setShowFullscreenCibles] = useState(false);
  
  const [gameStats, setGameStats] = useState<GameStats>({
    totalMatches: 0,
    totalScore: 0,
    totalShots: 0,
    totalKills: 0,
    totalDeaths: 0,
    totalAssists: 0,
    totalHitsHead: 0,
    totalHitsLegs: 0,
    totalHitsBody: 0
  });

  // ==========================================
  // États pour le grade et la progression
  // ==========================================
  const [currentGradeId, setCurrentGradeId] = useState(1);
  const [precisionProgress, setPrecisionProgress] = useState(0);
  
  // ==========================================
  // États pour le cycle de précision (depuis Supabase)
  // ==========================================
  const [cycleShotCount, setCycleShotCount] = useState(0);
  const [cyclePrecision, setCyclePrecision] = useState(0);
  
  // ==========================================
  // États pour les seuils (cosmétique ou depuis Supabase)
  // ==========================================
  const [seuilBas, setSeuilBas] = useState(50);
  const [seuilHaut, setSeuilHaut] = useState(75);
  
  // ==========================================
  // Temps connecté
  // ==========================================
  const [totalConnectedSeconds, setTotalConnectedSeconds] = useState(0);
  const [liveSeconds, setLiveSeconds] = useState(0);

  // ==========================================
  // Refs pour les abonnements Realtime
  // ==========================================
  const matchHistoryChannelRef = useRef<RealtimeChannel | null>(null);
  const athletesChannelRef = useRef<RealtimeChannel | null>(null);
  const userIdRef = useRef<string | null>(null);

  // ==========================================
  // Fonction : Charger l'historique des matchs
  // ==========================================
  const loadMatchHistory = useCallback(async (userId: string) => {
    if (!supabaseData) {
      console.log("⏳ Client données pas encore initialisé");
      return;
    }
    
    try {
      const { data, error } = await supabaseData
        .from('match_history')
        .select('*')
        .eq('player_id', userId)
        .order('date', { ascending: false });

      if (error) throw error;

      if (data) {
        const history: MatchRecord[] = (data as RawMatchHistory[]).map((item) => ({
          id: item.id,
          date: new Date(item.date),
          duration: item.duration,
          score: item.score,
          kills: item.kills,
          deaths: item.deaths,
          assists: item.assists,
          shots: item.shots,
          hitsHead: item.hits_head,
          hitsBody: item.hits_body,
          hitsLegs: item.hits_legs,
          win: item.win,
          group: item.game_group,
          shotDistribution: item.shot_distribution || {}
        }));
        setMatchHistory(history);
      }
    } catch (err) {
      console.error("Erreur chargement historique:", err);
    }
  }, [supabaseData]);

  // ==========================================
  // Fonction : Rafraîchir toutes les données
  // ==========================================
  const refreshAllData = useCallback(async () => {
    if (!userIdRef.current || !supabaseData) return;
    
    setIsRefreshing(true);
    try {
      // Recharger le profil
      const { data: athleteData, error: athleteError } = await supabaseData
        .from('athletes')
        .select('*')
        .eq('id', userIdRef.current)
        .maybeSingle();

      if (!athleteError && athleteData) {
        const playerData = athleteData as unknown as ExtendedAthlete;
        setPlayer(playerData);

        setGameStats({
          totalMatches: athleteData.total_matches || 0,
          totalScore: athleteData.total_score || 0,
          totalShots: athleteData.total_shots || 0,
          totalKills: athleteData.total_kills || 0,
          totalDeaths: athleteData.total_deaths || 0,
          totalAssists: athleteData.total_assists || 0,
          totalHitsHead: athleteData.total_hits_head || 0,
          totalHitsBody: athleteData.total_hits_body || 0,
          totalHitsLegs: athleteData.total_hits_legs || 0
        });

        setCurrentGradeId(athleteData.current_grade_id || 1);
        setPrecisionProgress(athleteData.precision_progress || 0);
        setCycleShotCount(athleteData.current_cycle_shot_count || 0);
        setCyclePrecision(athleteData.current_cycle_precision || 0);
        setTotalConnectedSeconds((athleteData.total_connected_microseconds || 0) / 1000000);
      }

      // Recharger l'historique
      await loadMatchHistory(userIdRef.current);
      
    } catch (err) {
      console.error("Erreur refresh données:", err);
    } finally {
      setIsRefreshing(false);
    }
  }, [supabaseData, loadMatchHistory]);

  // ==========================================
  // Configuration des abonnements Realtime
  // ==========================================
  const setupRealtimeSubscriptions = useCallback((userId: string) => {
    if (!supabaseData) return;
    
    // Nettoyer les anciens abonnements
    if (matchHistoryChannelRef.current) {
      supabaseData.removeChannel(matchHistoryChannelRef.current);
    }
    if (athletesChannelRef.current) {
      supabaseData.removeChannel(athletesChannelRef.current);
    }

    // Abonnement à match_history (nouvelles parties)
    matchHistoryChannelRef.current = supabaseData
      .channel(`match_history_${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'match_history',
          filter: `player_id=eq.${userId}`
        },
        () => {
          console.log('🔄 Nouvelle partie détectée, refresh...');
          refreshAllData();
        }
      )
      .subscribe();

    // Abonnement à athletes (mise à jour des stats)
    athletesChannelRef.current = supabaseData
      .channel(`athletes_${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'athletes',
          filter: `id=eq.${userId}`
        },
        () => {
          console.log('🔄 Mise à jour des stats détectée, refresh...');
          refreshAllData();
        }
      )
      .subscribe();
  }, [supabaseData, refreshAllData]);

  // ==========================================
  // Chargement des données joueur + abonnements
  // ==========================================
  const fetchPlayerData = useCallback(async () => {
    try {
      // 1. On récupère la session sur le Master
      const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
      
      if (authError || !user) {
        router.push("/connexion");
        return;
      }

      // 2. Identification de la ville cible
      const userCity = user.user_metadata?.city || "NANTES";
      
      // 3. ✅ CORRECTION : Créer le client de données AVEC la ville
      const dataClient = createVagondysClient(userCity);
      setSupabaseData(dataClient);
      userIdRef.current = user.id;

      // 4. Lecture des données dans la base de la VILLE
      const { data, error: profileError } = await dataClient
        .from('athletes')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError) {
        console.error("Erreur de lecture profil:", profileError.message);
      }

      if (data) {
        const playerData = data as unknown as ExtendedAthlete;
        setPlayer(playerData);

        setGameStats({
          totalMatches: data.total_matches || 0,
          totalScore: data.total_score || 0,
          totalShots: data.total_shots || 0,
          totalKills: data.total_kills || 0,
          totalDeaths: data.total_deaths || 0,
          totalAssists: data.total_assists || 0,
          totalHitsHead: data.total_hits_head || 0,
          totalHitsBody: data.total_hits_body || 0,
          totalHitsLegs: data.total_hits_legs || 0
        });

        const gradeId = data.current_grade_id || 1;
        const progress = data.precision_progress || 0;
        setCurrentGradeId(gradeId);
        setPrecisionProgress(progress);
        
        setCycleShotCount(data.current_cycle_shot_count || 0);
        setCyclePrecision(data.current_cycle_precision || 0);

        setTotalConnectedSeconds((data.total_connected_microseconds || 0) / 1000000);

        await loadMatchHistory(user.id);

        if (playerData.dossier_ref) {
          const archiveData = await fetchGitHubArchive(playerData.dossier_ref);
          setArchive(archiveData);
        }

        // ✅ Configurer les abonnements Realtime après avoir chargé les données
        setupRealtimeSubscriptions(user.id);
      } else {
        setPlayer({
          full_name: user.user_metadata?.full_name || "Athlète",
          pseudo: user.user_metadata?.pseudo || "",
          city: user.user_metadata?.city || "En cours...",
          status: "SYNCHRONISATION..."
        } as ExtendedAthlete);
      }

    } catch (err) {
      console.error("CRASH ESPACE JOUEUR:", err);
    } finally {
      setLoading(false);
    }
  }, [supabaseAuth, router, loadMatchHistory, setupRealtimeSubscriptions]);

  // ==========================================
  // Calcul du grade actuel
  // ==========================================
  const currentGrade = GRADES.find(g => g.id === currentGradeId) || GRADES[0];

  // ==========================================
  // Mise à jour des seuils
  // ==========================================
  useEffect(() => {
    setSeuilBas(50 + (currentGradeId - 1) * 2);
    setSeuilHaut(seuilBas + 25);
  }, [currentGradeId, seuilBas]);

  // ==========================================
  // Timer pour le temps connecté
  // ==========================================
  useEffect(() => {
    const timer = setInterval(() => {
      setLiveSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // ==========================================
  // Chargement initial
  // ==========================================
  useEffect(() => {
    fetchPlayerData();
    
    // Nettoyage des abonnements au démontage
    return () => {
      if (matchHistoryChannelRef.current && supabaseData) {
        supabaseData.removeChannel(matchHistoryChannelRef.current);
      }
      if (athletesChannelRef.current && supabaseData) {
        supabaseData.removeChannel(athletesChannelRef.current);
      }
    };
  }, [fetchPlayerData, supabaseData]);

  const handleLogout = async () => {
    await supabaseAuth.auth.signOut();
    router.push("/connexion");
    router.refresh();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <RefreshCcw className="w-8 h-8 text-red-600 animate-spin" />
      </div>
    );
  }

  if (!player) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center space-y-4">
        <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">
          Échec de synchronisation du profil
        </p>
        <button 
          onClick={() => window.location.reload()} 
          className="text-white text-[10px] border border-zinc-800 px-4 py-2 uppercase font-black"
        >
          Réinitialiser le protocole
        </button>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white px-4 py-6 md:px-6 md:py-12 font-sans relative overflow-hidden">
      
      {/* Indicateur de refresh (optionnel) */}
      {isRefreshing && (
        <div className="fixed top-4 right-4 z-50 bg-green-600/20 border border-green-600/30 rounded-lg px-3 py-1.5">
          <div className="flex items-center gap-2">
            <RefreshCcw className="w-3 h-3 text-green-500 animate-spin" />
            <span className="text-[8px] font-black uppercase text-green-500">Mise à jour...</span>
          </div>
        </div>
      )}

      {/* Modal plein écran des cibles */}
      {showFullscreenCibles && (
        <FullscreenCibles
          stats={{}} // TODO: Remplacer par les données de Supabase quand disponibles
          onClose={() => setShowFullscreenCibles(false)}
        />
      )}

      {/* Effet de fond */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-red-600/5 blur-[150px] pointer-events-none" />

      <div className="max-w-7xl mx-auto relative z-10">

        {/* HEADER avec navigation et connexion */}
        <header className="flex flex-wrap items-center justify-between gap-4 mb-8 pb-4 border-b border-zinc-900">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors text-[10px] font-black uppercase tracking-widest"
            >
              <ShieldCheck className="w-4 h-4 text-red-600" /> VAGONDYS
            </Link>
            <div className="w-px h-4 bg-zinc-900" />
            <div className="flex items-center gap-2">
              <MapPin className="w-3 h-3 text-red-600" />
              <span className="text-[9px] font-black uppercase text-zinc-400">{player.city || "NANTES"}</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-zinc-500 hover:text-red-600 transition-colors text-[10px] font-black uppercase tracking-widest"
            >
              <LogOut className="w-4 h-4" /> Déconnexion
            </button>

            <Link
              href="/carte-id"
              className="flex items-center gap-2 bg-zinc-900/50 hover:bg-red-600/10 border border-zinc-800 hover:border-red-600/50 px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-[0.2em] text-zinc-400 hover:text-white transition-all group"
            >
              <ShieldCheck className="w-3 h-3 text-red-600 group-hover:scale-110 transition-transform" />
              Carte ID
            </Link>
          </div>
        </header>

        {/* LIGNE 1 : Grade + Score total */}
        <div className="flex gap-6 mb-8">
          
          {/* Grade avec image */}
          <div className="flex gap-4 items-start">
            <div className="w-20 h-20 md:w-24 md:h-24 bg-zinc-950 border border-zinc-900 rounded-2xl flex items-center justify-center overflow-hidden relative">
              <Image
                src={currentGrade.icon}
                alt={currentGrade.name}
                fill
                className="object-contain"
              />
            </div>
            <div>
              <p className="text-zinc-500 text-[8px] font-black uppercase tracking-widest mb-1">
                Score total
              </p>
              <p className="text-2xl md:text-3xl font-black text-white">
                {gameStats.totalScore}
              </p>
              <p className="text-xl md:text-2xl font-black text-red-600 uppercase tracking-tighter mt-2">
                {currentGrade.name}
              </p>
              <div className="flex gap-1 mt-2">
                {Array.from({ length: currentGrade.maxStars }).map((_, i) => (
                  <span key={i} className={i < currentGrade.stars ? 'text-yellow-500 text-sm' : 'text-zinc-700 text-sm'}>★</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* LIGNE 2 : 4 KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          
          {/* Temps connecté */}
          <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-4">
            <Clock className="w-4 h-4 text-red-600 mb-2" />
            <p className="text-zinc-500 text-[8px] font-black uppercase tracking-widest mb-1">Temps connecté</p>
            <p className="text-white text-xs font-black">
              Cumul : {formatSeconds(totalConnectedSeconds + liveSeconds)}
            </p>
            <p className="text-zinc-600 text-[8px] font-mono mt-1">
              En cours : {formatSeconds(liveSeconds)}
            </p>
          </div>

          {/* Parties jouées */}
          <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-4">
            <Activity className="w-4 h-4 text-red-600 mb-2" />
            <p className="text-zinc-500 text-[8px] font-black uppercase tracking-widest mb-1">Parties jouées</p>
            <p className="text-white text-xs font-black">
              Cumul : {gameStats.totalMatches}
            </p>
            <p className="text-zinc-600 text-[8px] font-mono mt-1">
              En cours : 0
            </p>
          </div>

          {/* Temps de jeu */}
          <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-4">
            <Target className="w-4 h-4 text-red-600 mb-2" />
            <p className="text-zinc-500 text-[8px] font-black uppercase tracking-widest mb-1">Temps de jeu</p>
            <p className="text-white text-xs font-black">
              {matchHistory.reduce((acc, m) => acc + m.duration, 0).toFixed(3)} s
            </p>
            <p className="text-zinc-600 text-[8px] font-mono mt-1">
              Historique
            </p>
          </div>

          {/* Précision */}
          <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-4">
            <Crosshair className="w-4 h-4 text-red-600 mb-2" />
            <p className="text-zinc-500 text-[8px] font-black uppercase tracking-widest mb-1">Précision</p>
            <p className="text-white text-xs font-black">
              Tirs du cycle : {cycleShotCount}/100
            </p>
            <p className="text-white text-xs font-black">
              Dernière partie : {matchHistory.length > 0 ? matchHistory[0].shots : 0}/20
            </p>
            <p className="text-zinc-600 text-[8px] font-mono mt-1">
              Parties cycle : {Math.ceil(cycleShotCount / 20)}
            </p>
          </div>
        </div>

        {/* LIGNE 3 : Barre de précision (pleine largeur) */}
        <div className="w-full mb-6">
          <PrecisionBar
            value={cyclePrecision}
            seuilBas={seuilBas}
            seuilHaut={seuilHaut}
            nbTirs={cycleShotCount}
          />
        </div>

        {/* LIGNE 4 : Barre de progression globale (pleine largeur) */}
        <div className="w-full mb-8">
          <GlobalProgressBar
            grades={GRADES}
            currentGradeId={currentGrade.id}
            precisionProgress={precisionProgress}
            currentGradeMaxStars={currentGrade.maxStars}
          />
        </div>

        {/* LIGNE 5 : Deux colonnes de visualisation des cibles */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          
          {/* Colonne 1 : Pourcentage de cibles (camembert) */}
          <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">
                Pourcentage de cibles
              </p>
              <button
                onClick={() => setShowFullscreenCibles(true)}
                className="text-[7px] font-black uppercase tracking-widest text-red-600 hover:text-white transition-colors border border-red-600/30 hover:border-red-600 px-2 py-1 rounded"
              >
                Voir les cibles
              </button>
            </div>
            <div className="aspect-square max-w-md mx-auto">
              <FlowerCibleCamembertWidget
                stats={{}} // TODO: Remplacer par les données de Supabase
                onCibleClick={(num) => console.log('Cible cliquée:', num)}
                showWordCible={false}
              />
            </div>
          </div>

          {/* Colonne 2 : Zones des cibles tirés */}
          <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">
                Zones des cibles tirés
              </p>
              <button
                onClick={() => setShowFullscreenCibles(true)}
                className="text-[7px] font-black uppercase tracking-widest text-red-600 hover:text-white transition-colors border border-red-600/30 hover:border-red-600 px-2 py-1 rounded"
              >
                Voir les cibles
              </button>
            </div>
            <div className="aspect-square max-w-md mx-auto">
              <FleurDeCiblesWidget
                stats={{}} // TODO: Remplacer par les données de Supabase
                onCibleClick={(num) => console.log('Cible cliquée:', num)}
              />
            </div>
          </div>
        </div>

        {/* LIGNE 6 : Dernière partie (si disponible) */}
        {matchHistory.length > 0 && (
          <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-4 mb-8">
            <h3 className="text-[9px] font-black uppercase tracking-widest text-red-600 mb-3 flex items-center gap-2">
              <Activity size={12} /> DERNIÈRE PARTIE
            </h3>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div>
                <p className="text-[6px] font-black uppercase text-zinc-500">SCORE</p>
                <p className="text-base font-black text-white">{matchHistory[0].score}</p>
              </div>
              <div>
                <p className="text-[6px] font-black uppercase text-zinc-500">KILLS</p>
                <p className="text-base font-black text-green-500">{matchHistory[0].kills}</p>
              </div>
              <div>
                <p className="text-[6px] font-black uppercase text-zinc-500">DEATHS</p>
                <p className="text-base font-black text-red-500">{matchHistory[0].deaths}</p>
              </div>
              <div>
                <p className="text-[6px] font-black uppercase text-zinc-500">TIRS</p>
                <p className="text-base font-black text-blue-500">{matchHistory[0].shots}/20</p>
              </div>
            </div>
          </div>
        )}

        {/* LIGNE 7 : Graphique d'évolution (pleine largeur) */}
        <div className="w-full mb-6">
          <ScoreChart history={matchHistory} />
        </div>

        {/* LIGNE 8 : Tableau d'historique (pleine largeur) */}
        <div className="w-full mb-6">
          <HistoryTable history={matchHistory} />
        </div>

        {/* Archive GitHub (si disponible) */}
        {archive && (
          <div className="mt-6 bg-zinc-900/30 border border-zinc-800 p-4 rounded-xl">
            <div className="flex items-center gap-2 mb-3">
              <Archive className="w-4 h-4 text-red-600" />
              <h3 className="text-[9px] font-black uppercase tracking-widest text-white">Coffre-fort Numérique</h3>
            </div>
            <div className="flex flex-wrap gap-4 text-[8px] font-mono">
              <div>
                <span className="text-zinc-600 block text-[7px] uppercase">Référence</span>
                <span className="text-white">{archive.dossier.dossier_ref}</span>
              </div>
              <div>
                <span className="text-zinc-600 block text-[7px] uppercase">Création</span>
                <span className="text-white">{new Date(archive.dossier.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
