
"use client";

import { useEffect, useState, useCallback } from "react";
// import Link from "next/link"; // 👈 Supprimé (non utilisé)
import {
  CalendarCheck,
  Trophy,
  Users,
  Settings,
  MessageSquare,
  LogOut,
  // Bell, // 👈 Supprimé (non utilisé)
  Target
} from "lucide-react";
// ✅ CORRECTION : Revenir à createStaffClient (client-side avec SERVICE_ROLE)
import { createStaffClient } from "@/lib/supabase/client";
import { getStaffCity } from "@/actions/staff-actions";
import { SupabaseClient } from "@supabase/supabase-js";

// NOUVEAUX COMPOSANTS (ajoutés sans rien supprimer)
import CityInfoCard from "./components/dashboard/CityInfoCard";
import StatsGrid from "./components/dashboard/StatsGrid";
import RecentActivityComponent from "./components/dashboard/RecentActivity";
import TopPlayers from "./components/dashboard/TopPlayers";
import NavigationGrid from "./components/dashboard/NavigationGrid";
import LoadingSpinner from "./components/ui/LoadingSpinner";
import { useDashboardData } from "./hooks/useDashboardData";

export default function StaffDashboard() {
  // --- ÉTATS EXISTANTS (inchangés) ---
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userCity, setUserCity] = useState<string | null>(null);
  // userCountry est conservé car il pourrait être utile pour le filtrage international
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [userCountry, setUserCountry] = useState<string | null>('FR');
  const [unreadCount, setUnreadCount] = useState(0);
  const [newAthletesCount, setNewAthletesCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [supabaseClient, setSupabaseClient] = useState<SupabaseClient | null>(null);

  // --- NOUVELLE ÉTAPE 1: Récupérer les infos de l'agent via Server Action (inchangé) ---
  useEffect(() => {
    const loadStaffInfo = async () => {
      setIsLoading(true);
      const { city, country, email } = await getStaffCity();
      setUserEmail(email);
      
      if (city) {
        setUserCity(city);
        setUserCountry(country);
      }
      
      // ✅ CORRECTION : Revenir à createStaffClient (maintenant avec SERVICE_ROLE)
      // pour garder la session et bypasser les RLS
      const client = createStaffClient(city || undefined, country || undefined);
      setSupabaseClient(client);
      console.log(`✅ Dashboard: Client STAFF créé pour ${city} via createStaffClient`);
      setIsLoading(false);
    };
    loadStaffInfo();
  }, []);

  // --- Données du dashboard via hook personnalisé (NOUVEAU) ---
  const {
    cityInfo,
    stats,
    recentActivities,
    topPlayers,
    loading: dashboardLoading,
    error: dashboardError,
  } = useDashboardData(supabaseClient, userCity, userEmail);

  // --- LOGIQUE DE FILTRAGE PAR SECTEUR EXISTANTE (inchangée) ---
  const fetchFilteredCount = useCallback(async (email: string, city: string | null, supabase: SupabaseClient) => {
    if (!supabase) return;

    // Détermination de la ville pour le filtrage des licenciés (améliorée avec la ville réelle)
    let cityKeyword = city?.toLowerCase() || "";
    
    // Garder l'ancienne logique de fallback basée sur l'email pour compatibilité
    if (!cityKeyword) {
      if (email.includes("nantes")) cityKeyword = "nantes";
      else if (email.includes("lyon")) cityKeyword = "lyon";
      else if (email.includes("madrid")) cityKeyword = "madrid";
    }

    const isMainAdmin = email === "vagondys@gmail.com" || email === "admin@vagondys.com";

    // 1. COMPTE DES MESSAGES (Interface classique / Signaux standards)
    let messageQuery = supabase
      .from('pending_signals')
      .select('*', { count: 'exact', head: true })
      .eq('confirmed', true)
      .eq('is_read', false)
      .not('payload->>subject', 'ilike', '%INSCRIPTION%'); // On exclut les inscriptions ici

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

    // 2. COMPTE DES NOUVEAUX LICENCIÉS (Alertes de dossiers non lus)
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

  // --- ÉTAPE 2: Charger les compteurs une fois le client disponible (inchangé) ---
  useEffect(() => {
    const loadCounts = async () => {
      if (supabaseClient && userEmail) {
        await fetchFilteredCount(userEmail, userCity, supabaseClient);
      }
    };
    loadCounts();
  }, [supabaseClient, userEmail, userCity, fetchFilteredCount]);

  // --- REALTIME : Mise à jour automatique lors d'un nouveau signal (inchangé) ---
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

  const handleLogout = async () => {
    if (!supabaseClient) return;
    await supabaseClient.auth.signOut();
    window.location.href = "/staff/login";
  };

  // --- MODIFICATION : On combine les deux états de chargement ---
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
        
        {/* En-tête avec logout (style adapté) */}
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

        {/* Message d'erreur éventuel (NOUVEAU) */}
        {dashboardError && (
          <div className="bg-red-950/30 border border-red-900 rounded-xl p-4">
            <p className="text-[10px] text-red-500 font-black uppercase tracking-widest">
              ⚠️ {dashboardError}
            </p>
          </div>
        )}

        {/* Infos de la ville (NOUVEAU) */}
        <CityInfoCard 
          cityInfo={cityInfo} 
          userEmail={userEmail} 
          userCity={userCity} 
        />

        {/* Grille de statistiques (NOUVEAU) */}
        <StatsGrid stats={stats} />

        {/* Grille principale : Activités + Top Joueurs (NOUVEAU) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RecentActivityComponent 
            activities={recentActivities} 
            loading={dashboardLoading} 
          />
          <TopPlayers 
            players={topPlayers} 
            loading={dashboardLoading} 
          />
        </div>

        {/* ✅ NOUVEAU : NavigationGrid fusionne QuickActions et le menu */}
        <NavigationGrid 
          menuItems={menuItems}
          city={userCity}
          unreadCount={unreadCount}
          newAthletesCount={newAthletesCount}
        />

        {/* Footer (adapté) */}
        <footer className="pt-8 border-t border-neutral-900 text-center">
          <p className="text-[8px] uppercase tracking-[0.4em] text-neutral-800">
            VAGONDYS OFFICIAL SYSTEM — 2026
          </p>
        </footer>
      </div>
    </main>
  );
}
