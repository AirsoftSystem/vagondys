
"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { 
  LogOut,
  RefreshCcw,
  ShieldCheck,
  MapPin,
  Archive,
  Activity,
  Trophy
} from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createVagondysClient, type Athlete, type GitHubArchiveData, fetchGitHubArchive } from "@/lib/supabase/client";

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
import TournamentHistory from './components/TournamentHistory';

// ==========================================
// Types (adaptés pour l'API GitHub)
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

// Interface depuis l'API GitHub
interface ApiMatch {
  id: string;
  date: string;
  duration: number;
  score: number;
  kills: number;
  deaths: number;
  assists: number;
  shots: Shot[];
  win: boolean;
  game_group: string;
  shot_distribution?: Record<string, number>;
}

interface Shot {
  tir_number: number;
  target_id: number;
  points: number;
  bonus: number;
  x: number;
  y: number;
  zone: number;
  timestamp: number;
}

interface ApiProfileResponse {
  success: boolean;
  profile: ExtendedAthlete;
}

interface ApiMatchesResponse {
  success: boolean;
  player_id: string;
  matches: ApiMatch[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
    has_more: boolean;
  };
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

type TabType = 'stats' | 'tournaments';

// ==========================================
// Fonction utilitaire pour convertir les données de l'API vers MatchRecord
// ==========================================
function convertApiMatchToMatchRecord(apiMatch: ApiMatch): MatchRecord {
  // Calculer les hits par zone depuis les shots
  let hitsHead = 0;
  let hitsBody = 0;
  let hitsLegs = 0;
  
  for (const shot of apiMatch.shots) {
    if (shot.zone >= 8 && shot.zone <= 10) hitsHead++;
    else if (shot.zone >= 4 && shot.zone <= 7) hitsBody++;
    else if (shot.zone >= 1 && shot.zone <= 3) hitsLegs++;
  }
  
  return {
    id: apiMatch.id,
    date: new Date(apiMatch.date),
    duration: apiMatch.duration,
    score: apiMatch.score,
    kills: apiMatch.kills,
    deaths: apiMatch.deaths,
    assists: apiMatch.assists,
    shots: apiMatch.shots.length,
    hitsHead,
    hitsBody,
    hitsLegs,
    win: apiMatch.win,
    group: apiMatch.game_group,
    shotDistribution: apiMatch.shot_distribution || {}
  };
}

export default function EspaceJoueur() {
  const router = useRouter();
  
  // Client pour l'AUTH (projet unique - Option B)
  const supabaseAuth = createVagondysClient();
  
  const [loading, setLoading] = useState(true);
  const [player, setPlayer] = useState<ExtendedAthlete | null>(null);
  const [archive, setArchive] = useState<GitHubArchiveData | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // État pour l'onglet actif
  const [activeTab, setActiveTab] = useState<TabType>('stats');
  
  // État pour l'historique des matchs
  const [matchHistory, setMatchHistory] = useState<MatchRecord[]>([]);
  
  // États pour l'affichage
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

  // États pour le grade et la progression
  const [currentGradeId, setCurrentGradeId] = useState(1);
  const [precisionProgress, setPrecisionProgress] = useState(0);
  
  // États pour le cycle de précision
  const [cycleShotCount, setCycleShotCount] = useState(0);
  const [cyclePrecision, setCyclePrecision] = useState(0);
  
  // État pour le playerId
  const [playerId, setPlayerId] = useState<string>('');
  
  // Token d'authentification pour les appels API
  const [authToken, setAuthToken] = useState<string>('');

  // Valeurs dérivées (plus besoin de useEffect pour les seuils)
  const derivedSeuilBas = 50 + (currentGradeId - 1) * 2;
  const derivedSeuilHaut = derivedSeuilBas + 25;

  // ==========================================
  // Fonction : Obtenir le token d'authentification
  // ==========================================
  const getAuthToken = useCallback(async (): Promise<string | null> => {
    const { data: { session } } = await supabaseAuth.auth.getSession();
    if (session?.access_token) {
      return session.access_token;
    }
    return null;
  }, [supabaseAuth]);

  // ==========================================
  // Fonction : Charger l'historique des matchs depuis GitHub API
  // ==========================================
  const loadMatchHistory = useCallback(async (userId: string, token: string) => {
    try {
      const response = await fetch(`/api/player/matches?playerId=${userId}&limit=100`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data: ApiMatchesResponse = await response.json();
      
      if (data.success && data.matches) {
        const history = data.matches.map(convertApiMatchToMatchRecord);
        setMatchHistory(history);
      }
    } catch (err) {
      console.error("Erreur chargement historique:", err);
    }
  }, []);

  // ==========================================
  // Fonction : Charger le profil depuis GitHub API
  // ==========================================
  const loadProfile = useCallback(async (userId: string, token: string): Promise<ExtendedAthlete | null> => {
    try {
      const response = await fetch(`/api/player/profile?playerId=${userId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data: ApiProfileResponse = await response.json();
      
      if (data.success && data.profile) {
        return data.profile;
      }
      return null;
    } catch (err) {
      console.error("Erreur chargement profil:", err);
      return null;
    }
  }, []);

  // ==========================================
  // Fonction : Rafraîchir toutes les données (exposée pour le bouton de refresh)
  // ==========================================
  const refreshAllData = useCallback(async () => {
    if (!playerId || !authToken) return;
    
    setIsRefreshing(true);
    try {
      // Recharger le profil
      const profile = await loadProfile(playerId, authToken);
      if (profile) {
        setPlayer(profile);
        
        setGameStats({
          totalMatches: profile.total_matches || 0,
          totalScore: profile.total_score || 0,
          totalShots: profile.total_shots || 0,
          totalKills: profile.total_kills || 0,
          totalDeaths: profile.total_deaths || 0,
          totalAssists: profile.total_assists || 0,
          totalHitsHead: profile.total_hits_head || 0,
          totalHitsBody: profile.total_hits_body || 0,
          totalHitsLegs: profile.total_hits_legs || 0
        });
        
        setCurrentGradeId(profile.current_grade_id || 1);
        setPrecisionProgress(profile.precision_progress || 0);
        setCycleShotCount(profile.current_cycle_shot_count || 0);
        setCyclePrecision(profile.current_cycle_precision || 0);
      }
      
      // Recharger l'historique
      await loadMatchHistory(playerId, authToken);
      
    } catch (err) {
      console.error("Erreur refresh données:", err);
    } finally {
      setIsRefreshing(false);
    }
  }, [playerId, authToken, loadProfile, loadMatchHistory]);

  // ==========================================
  // Chargement des données joueur
  // ==========================================
  const fetchPlayerData = useCallback(async () => {
    try {
      // 1. Récupérer la session
      const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
      
      if (authError || !user) {
        router.push("/connexion");
        return;
      }
      
      // 2. Récupérer le token d'authentification
      const token = await getAuthToken();
      if (!token) {
        console.error("Impossible d'obtenir le token d'authentification");
        setLoading(false);
        return;
      }
      
      setAuthToken(token);
      setPlayerId(user.id);
      
      // 3. Charger le profil depuis GitHub API
      const profile = await loadProfile(user.id, token);
      
      if (profile) {
        setPlayer(profile);
        
        setGameStats({
          totalMatches: profile.total_matches || 0,
          totalScore: profile.total_score || 0,
          totalShots: profile.total_shots || 0,
          totalKills: profile.total_kills || 0,
          totalDeaths: profile.total_deaths || 0,
          totalAssists: profile.total_assists || 0,
          totalHitsHead: profile.total_hits_head || 0,
          totalHitsBody: profile.total_hits_body || 0,
          totalHitsLegs: profile.total_hits_legs || 0
        });
        
        setCurrentGradeId(profile.current_grade_id || 1);
        setPrecisionProgress(profile.precision_progress || 0);
        setCycleShotCount(profile.current_cycle_shot_count || 0);
        setCyclePrecision(profile.current_cycle_precision || 0);
        
        // 4. Charger l'historique
        await loadMatchHistory(user.id, token);
        
        // 5. Charger l'archive GitHub si disponible
        const userCity = user.user_metadata?.city || profile.city || "NANTES";
        const userCountry = user.user_metadata?.country || profile.country || "FR";
        
        if (profile.dossier_ref) {
          const archiveData = await fetchGitHubArchive(profile.dossier_ref, userCity, userCountry);
          setArchive(archiveData);
        }
      } else {
        // Profil non trouvé - utiliser les métadonnées utilisateur
        setPlayer({
          id: user.id,
          full_name: user.user_metadata?.full_name || "Athlète",
          pseudo: user.user_metadata?.pseudo || "",
          email: user.email || "",
          city: user.user_metadata?.city || "En cours...",
          country: user.user_metadata?.country || "FR",
          status: "SYNCHRONISATION...",
          created_at: new Date().toISOString(),
          dossier_ref: ""
        } as ExtendedAthlete);
      }
      
    } catch (err) {
      console.error("CRASH ESPACE JOUEUR:", err);
    } finally {
      setLoading(false);
    }
  }, [supabaseAuth, router, getAuthToken, loadProfile, loadMatchHistory]);

  // ==========================================
  // Calcul du grade actuel
  // ==========================================
  const currentGrade = GRADES.find(g => g.id === currentGradeId) || GRADES[0];

  // ==========================================
  // Chargement initial
  // Désactivation des règles ESLint pour ce cas légitime :
  // - set-state-in-effect : nous chargeons les données initiales, ce qui nécessite des setState
  // - exhaustive-deps : nous voulons que cet effet ne s'exécute qu'une seule fois au montage
  // ==========================================
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchPlayerData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      
      {/* Indicateur de refresh */}
      {isRefreshing && (
        <div className="fixed top-4 right-4 z-50 bg-green-600/20 border border-green-600/30 rounded-lg px-3 py-1.5">
          <div className="flex items-center gap-2">
            <RefreshCcw className="w-3 h-3 text-green-500 animate-spin" />
            <span className="text-[8px] font-black uppercase text-green-500">Mise à jour...</span>
          </div>
        </div>
      )}

      {/* Bouton de rafraîchissement manuel */}
      <button
        onClick={refreshAllData}
        className="fixed bottom-4 right-4 z-50 bg-red-600/20 border border-red-600/30 rounded-full p-3 hover:bg-red-600/30 transition-colors"
        title="Rafraîchir les données"
        aria-label="Rafraîchir les données"
      >
        <RefreshCcw className="w-4 h-4 text-red-500" />
      </button>

      {/* Modal plein écran des cibles */}
      {showFullscreenCibles && (
        <FullscreenCibles
          stats={{}} // TODO: Remplacer par les données de l'API quand disponibles
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

        {/* Onglets : Stats / Tournois */}
        <div className="flex gap-2 mb-6 border-b border-zinc-800">
          <button
            onClick={() => setActiveTab('stats')}
            className={`flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${
              activeTab === 'stats'
                ? 'text-red-600 border-b-2 border-red-600'
                : 'text-zinc-500 hover:text-white'
            }`}
            title="Statistiques de jeu"
            aria-label="Statistiques de jeu"
          >
            <Activity size={14} />
            Statistiques
          </button>
          <button
            onClick={() => setActiveTab('tournaments')}
            className={`flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${
              activeTab === 'tournaments'
                ? 'text-red-600 border-b-2 border-red-600'
                : 'text-zinc-500 hover:text-white'
            }`}
            title="Historique des tournois"
            aria-label="Historique des tournois"
          >
            <Trophy size={14} />
            Tournois
          </button>
        </div>

        {/* Contenu selon l'onglet actif */}
        {activeTab === 'stats' ? (
          <>
            {/* Barre de précision - utilisation des valeurs dérivées */}
            <div className="w-full mb-6">
              <PrecisionBar
                value={cyclePrecision}
                seuilBas={derivedSeuilBas}
                seuilHaut={derivedSeuilHaut}
                nbTirs={cycleShotCount}
              />
            </div>

            {/* Barre de progression globale */}
            <div className="w-full mb-8">
              <GlobalProgressBar
                grades={GRADES}
                currentGradeId={currentGrade.id}
                precisionProgress={precisionProgress}
                currentGradeMaxStars={currentGrade.maxStars}
              />
            </div>

            {/* Deux colonnes de visualisation des cibles */}
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
                    title="Voir les cibles en plein écran"
                    aria-label="Voir les cibles en plein écran"
                  >
                    Voir les cibles
                  </button>
                </div>
                <div className="aspect-square max-w-md mx-auto">
                  <FlowerCibleCamembertWidget
                    stats={{}} // TODO: Remplacer par les données de l'API
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
                    title="Voir les cibles en plein écran"
                    aria-label="Voir les cibles en plein écran"
                  >
                    Voir les cibles
                  </button>
                </div>
                <div className="aspect-square max-w-md mx-auto">
                  <FleurDeCiblesWidget
                    stats={{}} // TODO: Remplacer par les données de l'API
                    onCibleClick={(num) => console.log('Cible cliquée:', num)}
                  />
                </div>
              </div>
            </div>

            {/* Dernière partie */}
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

            {/* Graphique d'évolution */}
            <div className="w-full mb-6">
              <ScoreChart history={matchHistory} />
            </div>

            {/* Tableau d'historique */}
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
          </>
        ) : (
          /* Onglet Tournois - Historique des tournois du joueur */
          <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Trophy className="w-5 h-5 text-red-600" />
              <h2 className="text-sm font-black uppercase tracking-wider text-white">Historique des tournois</h2>
            </div>
            <TournamentHistory 
              playerId={playerId}
              city={player.city || 'NANTES'}
              country={player.country || 'FR'}
            />
          </div>
        )}
      </div>
    </main>
  );
}
