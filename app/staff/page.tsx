
"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  CalendarCheck,
  Trophy,
  Users,
  Settings,
  MessageSquare,
  LogOut,
  Target,
  RefreshCcw
} from "lucide-react";
import { getStaffCity } from "@/actions/staff-actions";
import { getStaffConfig } from "@/actions/get-staff-config";
import { SupabaseClient } from "@supabase/supabase-js";

// NOUVEAUX COMPOSANTS
import CityInfoCard from "./components/dashboard/CityInfoCard";
import StatsGrid from "./components/dashboard/StatsGrid";
import RecentActivityComponent from "./components/dashboard/RecentActivity";
import TopPlayers from "./components/dashboard/TopPlayers";
import NavigationGrid from "./components/dashboard/NavigationGrid";
import LoadingSpinner from "./components/ui/LoadingSpinner";
import { useDashboardData } from "./hooks/useDashboardData";

// ✅ Clés pour le localStorage
const STORAGE_KEYS = {
  CITY_CACHE: 'vgd_dashboard_city_cache',
  COUNTERS_CACHE: 'vgd_dashboard_counters_cache',
  CACHE_TIMESTAMP: 'vgd_dashboard_timestamp'
};

// ✅ Durée du cache en millisecondes (5 minutes)
const CACHE_DURATION = 5 * 60 * 1000;

export default function StaffDashboard() {
  // --- ÉTATS ---
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userCity, setUserCity] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [userCountry, setUserCountry] = useState<string | null>('FR');
  const [unreadCount, setUnreadCount] = useState(0);
  const [newAthletesCount, setNewAthletesCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [supabaseClient, setSupabaseClient] = useState<SupabaseClient | null>(null);
  
  // Refs
  const isMounted = useRef(true);
  const loadingCountersRef = useRef(false);

  // ✅ Charger les compteurs depuis le cache
  const loadCountersFromCache = useCallback(() => {
    try {
      const cachedData = localStorage.getItem(STORAGE_KEYS.COUNTERS_CACHE);
      const timestamp = localStorage.getItem(STORAGE_KEYS.CACHE_TIMESTAMP);
      
      if (cachedData && timestamp) {
        const age = Date.now() - parseInt(timestamp);
        if (age < CACHE_DURATION) {
          const { unread, newAthletes } = JSON.parse(cachedData);
          setUnreadCount(unread || 0);
          setNewAthletesCount(newAthletes || 0);
          console.log(`📦 Compteurs depuis cache (${Math.round(age / 1000)}s): unread=${unread}, new=${newAthletes}`);
          return true;
        }
      }
    } catch (err) {
      console.warn("Erreur lecture cache compteurs:", err);
    }
    return false;
  }, []);

  // ✅ Sauvegarder les compteurs dans le cache
  const saveCountersToCache = useCallback((unread: number, newAthletes: number) => {
    try {
      const cacheData = {
        unread,
        newAthletes,
        timestamp: Date.now()
      };
      localStorage.setItem(STORAGE_KEYS.COUNTERS_CACHE, JSON.stringify(cacheData));
      localStorage.setItem(STORAGE_KEYS.CACHE_TIMESTAMP, Date.now().toString());
    } catch (err) {
      console.warn("Erreur sauvegarde cache compteurs:", err);
    }
  }, []);

  // --- LOGIQUE DE FILTRAGE PAR SECTEUR (optimisée avec cache)---
  const fetchFilteredCount = useCallback(async (email: string, city: string | null, supabase: SupabaseClient, forceRefresh: boolean = false) => {
    if (!supabase || loadingCountersRef.current) return;
    
    // Essayer le cache d'abord
    if (!forceRefresh && loadCountersFromCache()) {
      return;
    }
    
    loadingCountersRef.current = true;
    setIsRefreshing(true);

    let cityKeyword = city?.toLowerCase() || "";
    
    if (!cityKeyword) {
      if (email.includes("nantes")) cityKeyword = "nantes";
      else if (email.includes("lyon")) cityKeyword = "lyon";
      else if (email.includes("madrid")) cityKeyword = "madrid";
    }

    const isMainAdmin = email === "vagondys@gmail.com" || email === "admin@vagondys.com";

    let messageQuery = supabase
      .from('pending_signals')
      .select('*', { count: 'exact', head: true })
      .eq('confirmed', true)
      .eq('is_read', false)
      .not('payload->>subject', 'ilike', '%INSCRIPTION%');

    if (!isMainAdmin && email !== "") {
      let keyword = "";
      if (email.includes("communication")) keyword = "communication";
      else if (email.includes("sponsors")) keyword = "sponsor";
      else if (email.includes("ligue")) keyword = "ligue";
      else if (email.includes("competition")) keyword = "competition";
      else if (email.includes("tournois")) keyword = "tournois";
      else if (email.includes("player")) keyword = "player";
      else if (email.includes("licence")) keyword = "licence";      
      else if (email.includes("reservations")) keyword = "reservation";
      else if (email.includes(cityKeyword)) keyword = cityKeyword;      
      
      if (keyword !== "") {
        messageQuery = messageQuery.filter('payload->>subject', 'ilike', `%${keyword}%`);
      }
    }

    const { count: mCount, error: mErr } = await messageQuery;
    let mCountValue = 0;
    if (!mErr) {
      mCountValue = mCount || 0;
      setUnreadCount(mCountValue);
    }

    let athleteQuery = supabase
      .from('pending_signals')
      .select('*', { count: 'exact', head: true })
      .eq('confirmed', true)
      .eq('is_read', false)
      .filter('payload->>subject', 'ilike', '%INSCRIPTION%');

    if (!isMainAdmin && cityKeyword !== "") {
      athleteQuery = athleteQuery.filter('payload->>email', 'ilike', `%${cityKeyword}%`);
    }

    const { count: aCount, error: aErr } = await athleteQuery;
    let aCountValue = 0;
    if (!aErr) {
      aCountValue = aCount || 0;
      setNewAthletesCount(aCountValue);
    }
    
    // Sauvegarder dans le cache
    saveCountersToCache(mCountValue, aCountValue);
    
    loadingCountersRef.current = false;
    setIsRefreshing(false);
  }, [loadCountersFromCache, saveCountersToCache]);

  // --- ÉTAPE 1: Récupérer les infos de l'agent (avec cache localStorage)---
  useEffect(() => {
    const loadStaffInfo = async () => {
      setIsLoading(true);
      
      try {
        // ✅ Essayer de charger depuis le cache localStorage
        const cachedCity = localStorage.getItem(STORAGE_KEYS.CITY_CACHE);
        if (cachedCity) {
          const { city, country, email, timestamp } = JSON.parse(cachedCity);
          const age = Date.now() - timestamp;
          if (age < CACHE_DURATION && city && email) {
            console.log(`📍 Ville depuis cache: ${city} (${Math.round(age / 1000)}s)`);
            setUserEmail(email);
            setUserCity(city);
            setUserCountry(country || "FR");
            
            // Charger les compteurs depuis le cache aussi
            loadCountersFromCache();
            
            // Créer le client Supabase
            const config = await getStaffConfig(city, country || 'FR');
            if (config && config.staff_url && config.staff_anon_key && isMounted.current) {
              const { createClient } = await import('@supabase/supabase-js');
              const client = createClient(config.staff_url, config.staff_anon_key);
              setSupabaseClient(client);
            }
            
            setIsLoading(false);
            return;
          }
        }
        
        // ✅ Pas de cache valide, appeler l'API
        const { city, country, email } = await getStaffCity();
        
        if (isMounted.current) {
          setUserEmail(email);
          if (city) {
            setUserCity(city);
            setUserCountry(country || "FR");
            
            // Sauvegarder la ville dans localStorage
            localStorage.setItem(STORAGE_KEYS.CITY_CACHE, JSON.stringify({
              city, country, email, timestamp: Date.now()
            }));
          }
          
          // Créer le client Supabase
          if (city) {
            const config = await getStaffConfig(city, country || 'FR');
            if (config && config.staff_url && config.staff_anon_key && isMounted.current) {
              const { createClient } = await import('@supabase/supabase-js');
              const client = createClient(config.staff_url, config.staff_anon_key);
              setSupabaseClient(client);
            }
          }
        }
        
      } catch (err) {
        console.error('❌ Erreur chargement staff info:', err);
      } finally {
        if (isMounted.current) setIsLoading(false);
      }
    };
    
    loadStaffInfo();
    
    return () => { isMounted.current = false; };
  }, [loadCountersFromCache]);

  // --- Données du dashboard via hook personnalisé ---
  const {
    cityInfo,
    stats,
    recentActivities,
    topPlayers,
    loading: dashboardLoading,
    error: dashboardError,
  } = useDashboardData(supabaseClient, userCity, userEmail);

  // ✅ AJOUT : Écouteur pour l'événement staff-message-updated
  useEffect(() => {
    const handleMessageUpdate = () => {
      if (supabaseClient && userEmail) {
        // Forcer le rafraîchissement des compteurs
        fetchFilteredCount(userEmail, userCity, supabaseClient, true);
      }
    };

    window.addEventListener('staff-message-updated', handleMessageUpdate);
    return () => window.removeEventListener('staff-message-updated', handleMessageUpdate);
  }, [supabaseClient, userEmail, userCity, fetchFilteredCount]);

  // --- ÉTAPE 2: Charger les compteurs (une fois le client prêt)---
  useEffect(() => {
    if (supabaseClient && userEmail && !loadingCountersRef.current) {
      fetchFilteredCount(userEmail, userCity, supabaseClient, false);
    }
  }, [supabaseClient, userEmail, userCity, fetchFilteredCount]);

  // ✅ CORRECTION : Déconnexion via le client MASTER (pas le client STAFF)
  const handleLogout = async () => {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const masterClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL_MASTER!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_MASTER!
      );
      await masterClient.auth.signOut();
      // Nettoyer le cache localStorage
      localStorage.removeItem(STORAGE_KEYS.CITY_CACHE);
      localStorage.removeItem(STORAGE_KEYS.COUNTERS_CACHE);
      localStorage.removeItem(STORAGE_KEYS.CACHE_TIMESTAMP);
    } catch (err) {
      console.error('Erreur déconnexion:', err);
    }
    window.location.href = "/staff/login";
  };

  if (isLoading || dashboardLoading) {
    return <LoadingSpinner text="Chargement du tableau de bord..." fullScreen />;
  }

  const menuItems = [
    { title: "RÉSERVATIONS", description: "Gestion des créneaux et membres", href: "/staff/reservations", icon: CalendarCheck },
    { title: "COMPÉTITIONS", description: "Organisation des tournois officiels", href: "/staff/competitions", icon: Trophy },
    { title: "MODES DE JEU", description: "Contrôle des cibles connectées", href: "/staff/mode_jeux", icon: Target },
    { title: "LICENCIÉS", description: "Base de données de la Maison", href: "/staff/licencies", icon: Users, badge: newAthletesCount },
    { title: "MESSAGES", description: "Signaux et transmissions reçus", href: "/staff/interface", icon: MessageSquare, badge: unreadCount },
    { title: "PARAMÈTRES", description: "Configuration du système", href: "/staff/settings", icon: Settings },
  ];

  return (
    <main className="min-h-screen bg-black text-white p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl md:text-3xl font-black uppercase tracking-[0.2em] text-red-600">
              ADMINISTRATION
            </h1>
            <div className="h-6 w-px bg-white/10" />
            <p className="text-[9px] md:text-[10px] uppercase tracking-[0.3em] text-zinc-600">
              Saison 2026
            </p>
          </div>
          <div className="flex items-center gap-3">
            {isRefreshing && (
              <div className="flex items-center gap-2 bg-black/50 px-3 py-1 rounded-full">
                <RefreshCcw className="w-3 h-3 text-red-600 animate-spin" />
                <span className="text-[8px] text-zinc-500">Mise à jour...</span>
              </div>
            )}
            <button 
              onClick={handleLogout}
              className="p-2 text-zinc-600 hover:text-red-500 transition-colors bg-neutral-900/50 rounded-full"
              title="Déconnexion"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        {dashboardError && (
          <div className="bg-red-950/30 border border-red-900 rounded-xl p-4">
            <p className="text-[10px] text-red-500 font-black uppercase tracking-widest">
              ⚠️ {dashboardError}
            </p>
          </div>
        )}

        <CityInfoCard cityInfo={cityInfo} userEmail={userEmail} userCity={userCity} />
        <StatsGrid stats={stats} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RecentActivityComponent activities={recentActivities} loading={dashboardLoading} />
          <TopPlayers players={topPlayers} loading={dashboardLoading} />
        </div>

        <NavigationGrid 
          menuItems={menuItems}
          city={userCity}
          unreadCount={unreadCount}
          newAthletesCount={newAthletesCount}
        />

        <footer className="pt-8 border-t border-neutral-900 text-center">
          <p className="text-[8px] uppercase tracking-[0.4em] text-neutral-800">
            VAGONDYS OFFICIAL SYSTEM — 2026
          </p>
        </footer>
      </div>
    </main>
  );
}
