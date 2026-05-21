
"use client";

import { useEffect, useState, useCallback } from "react";
import {
  CalendarCheck,
  Trophy,
  Users,
  Settings,
  MessageSquare,
  LogOut,
  Target
} from "lucide-react";
import { getStaffCity } from "@/actions/staff-actions";
import { SupabaseClient } from "@supabase/supabase-js";

// NOUVEAUX COMPOSANTS
import CityInfoCard from "./components/dashboard/CityInfoCard";
import StatsGrid from "./components/dashboard/StatsGrid";
import RecentActivityComponent from "./components/dashboard/RecentActivity";
import TopPlayers from "./components/dashboard/TopPlayers";
import NavigationGrid from "./components/dashboard/NavigationGrid";
import LoadingSpinner from "./components/ui/LoadingSpinner";
import { useDashboardData } from "./hooks/useDashboardData";
import { getStationConfig } from "@/lib/supabase/master";

export default function StaffDashboard() {
  // --- ÉTATS ---
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userCity, setUserCity] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [userCountry, setUserCountry] = useState<string | null>('FR');
  const [unreadCount, setUnreadCount] = useState(0);
  const [newAthletesCount, setNewAthletesCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [supabaseClient, setSupabaseClient] = useState<SupabaseClient | null>(null);

  // --- ÉTAPE 1: Récupérer les infos de l'agent via Server Action ---
  useEffect(() => {
    const loadStaffInfo = async () => {
      setIsLoading(true);
      const { city, country, email } = await getStaffCity();
      setUserEmail(email);
      
      if (city) {
        setUserCity(city);
        setUserCountry(country);
      }
      
      if (city) {
        try {
          const { createClient } = await import('@supabase/supabase-js');
          
          // ✅ DYNAMIQUE : Récupérer la configuration de la ville via getStationConfig
          const config = await getStationConfig(city, country || 'FR');
          
          if (!config || !config.staff_url || !config.staff_anon_key) {
            console.error(`❌ Configuration STAFF introuvable pour ${city}`);
            setIsLoading(false);
            return;
          }
          
          console.log(`✅ Dashboard: Création client STAFF pour ${city} (${country})`);
          const client = createClient(config.staff_url, config.staff_anon_key);
          setSupabaseClient(client);
          
        } catch (err) {
          console.error('❌ Erreur création client STAFF:', err);
        }
      }
      
      setIsLoading(false);
    };
    loadStaffInfo();
  }, []);

  // --- Données du dashboard via hook personnalisé ---
  const {
    cityInfo,
    stats,
    recentActivities,
    topPlayers,
    loading: dashboardLoading,
    error: dashboardError,
  } = useDashboardData(supabaseClient, userCity, userEmail);

  // --- LOGIQUE DE FILTRAGE PAR SECTEUR ---
  const fetchFilteredCount = useCallback(async (email: string, city: string | null, supabase: SupabaseClient) => {
    if (!supabase) return;

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
    if (!mErr) setUnreadCount(mCount || 0);

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
    if (!aErr) setNewAthletesCount(aCount || 0);
  }, []);

  // --- ÉTAPE 2: Charger les compteurs ---
  useEffect(() => {
    const loadCounts = async () => {
      if (supabaseClient && userEmail) {
        await fetchFilteredCount(userEmail, userCity, supabaseClient);
      }
    };
    loadCounts();
  }, [supabaseClient, userEmail, userCity, fetchFilteredCount]);

  // --- REALTIME ---
  useEffect(() => {
    if (!supabaseClient || !userEmail) return;

    const channel = supabaseClient
      .channel('dashboard-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pending_signals' },
        () => {
          if (userEmail) fetchFilteredCount(userEmail, userCity, supabaseClient);
        }
      )
      .subscribe();

    return () => {
      supabaseClient.removeChannel(channel);
    };
  }, [supabaseClient, userEmail, userCity, fetchFilteredCount]);

  // ✅ CORRECTION : Déconnexion via le client MASTER (pas le client STAFF)
  const handleLogout = async () => {
    try {
      // Créer un client MASTER pour la déconnexion (auth centralisée)
      const { createClient } = await import('@supabase/supabase-js');
      const masterClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL_MASTER!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_MASTER!
      );
      await masterClient.auth.signOut();
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
          <button 
            onClick={handleLogout}
            className="p-2 text-zinc-600 hover:text-red-500 transition-colors bg-neutral-900/50 rounded-full"
            title="Déconnexion"
          >
            <LogOut className="w-5 h-5" />
          </button>
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
