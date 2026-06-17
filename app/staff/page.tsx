
"use client";

import { useEffect, useState, useRef } from "react";
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

// COMPOSANTS
import CityInfoCard from "./components/dashboard/CityInfoCard";
import StatsGrid from "./components/dashboard/StatsGrid";
import RecentActivityComponent from "./components/dashboard/RecentActivity";
import TopPlayers from "./components/dashboard/TopPlayers";
import NavigationGrid from "./components/dashboard/NavigationGrid";
import LoadingSpinner from "./components/ui/LoadingSpinner";

// Types locaux
interface CityInfo {
  name: string;
  country: string;
  totalAthletes: number;
  activeAthletes: number;
}

interface DashboardStats {
  totalAthletes: number;
  activeAthletes: number;
  pendingMessages: number;
  todayMatches: number;
  totalGameLaunches: number;
  newAthletesThisMonth: number;
}

interface RecentActivity {
  id: string;
  type: 'message' | 'game_launch' | 'match';
  title: string;
  description: string;
  timestamp: string;
  link: string;
}

interface TopPlayer {
  id: string;
  pseudo: string | null;
  full_name: string;
  points: number;
  rank: string;
  matchesPlayed: number;
  winRate: number;
}

export default function StaffDashboard() {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userCity, setUserCity] = useState<string | null>(null);
  const [userCountry, setUserCountry] = useState<string>('FR');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Données du dashboard
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
  const [unreadCount, setUnreadCount] = useState(0);
  const [newAthletesCount, setNewAthletesCount] = useState(0);
  
  const isMounted = useRef(true);

  // Chargement unique au montage (comme dans mode_jeux)
  useEffect(() => {
    const loadDashboard = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // 1. Récupérer les infos de l'agent
        const { city, country, email } = await getStaffCity();
        
        if (!isMounted.current) return;
        
        setUserEmail(email);
        if (!city) {
          setError("Station non identifiée");
          setLoading(false);
          return;
        }
        
        setUserCity(city);
        setUserCountry(country || "FR");
        
        // 2. Appeler l'API dashboard
        const response = await fetch(`/api/staff/dashboard?city=${city}&country=${country || "FR"}`);
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || "Erreur chargement dashboard");
        }
        
        if (!isMounted.current) return;
        
        // ✅ CORRECTION : Pour MASTER (Staff Admin), on masque les messages privés
        // Le Staff Admin ne doit pas voir les messages de la messagerie privée (Système 2)
        const isMaster = city === "MASTER";
        const pendingMessages = isMaster ? 0 : (data.pendingMessages || 0);
        
        // ✅ CORRECTION : Filtrer les activités récentes pour MASTER
        // Supprimer les activités de type "message" pour MASTER
        let filteredActivities = data.recentActivities || [];
        if (isMaster) {
          filteredActivities = filteredActivities.filter((act: RecentActivity) => act.type !== "message");
        }
        
        // 3. Mettre à jour les états
        setCityInfo({
          name: city,
          country: country || "FR",
          totalAthletes: data.totalAthletes || 0,
          activeAthletes: data.activeAthletes || 0
        });
        
        setStats({
          totalAthletes: data.totalAthletes || 0,
          activeAthletes: data.activeAthletes || 0,
          pendingMessages: pendingMessages,
          todayMatches: data.todayMatches || 0,
          totalGameLaunches: data.totalGameLaunches || 0,
          newAthletesThisMonth: data.newAthletesThisMonth || 0
        });
        
        setUnreadCount(pendingMessages);
        setNewAthletesCount(data.newAthletesThisMonth || 0);
        
        // 4. Formater les activités récentes (filtrées pour MASTER)
        const activities: RecentActivity[] = filteredActivities.map((act: RecentActivity) => ({
          ...act,
          type: act.type || 'message'
        }));
        setRecentActivities(activities);
        
        // 5. Top joueurs
        setTopPlayers(data.topPlayers || []);
        
      } catch (err) {
        console.error("❌ Erreur dashboard:", err);
        if (isMounted.current) {
          setError(err instanceof Error ? err.message : "Erreur inconnue");
        }
      } finally {
        if (isMounted.current) setLoading(false);
      }
    };
    
    loadDashboard();
    
    return () => { isMounted.current = false; };
  }, []);

  // Écouteur pour l'événement staff-message-updated (met à jour le compteur)
  useEffect(() => {
    const handleMessageUpdate = async () => {
      if (!userCity) return;
      
      try {
        const response = await fetch(`/api/staff/dashboard?city=${userCity}&country=${userCountry}`);
        const data = await response.json();
        
        if (response.ok && isMounted.current) {
          // ✅ CORRECTION : Pour MASTER, on force 0
          const isMaster = userCity === "MASTER";
          const pendingMessages = isMaster ? 0 : (data.pendingMessages || 0);
          
          setUnreadCount(pendingMessages);
          setNewAthletesCount(data.newAthletesThisMonth || 0);
          setStats(prev => ({
            ...prev,
            pendingMessages: pendingMessages,
            newAthletesThisMonth: data.newAthletesThisMonth || 0
          }));
        }
      } catch (err) {
        console.error("Erreur mise à jour compteurs:", err);
      }
    };

    window.addEventListener('staff-message-updated', handleMessageUpdate);
    return () => window.removeEventListener('staff-message-updated', handleMessageUpdate);
  }, [userCity, userCountry]);

  const handleLogout = async () => {
    try {
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

  if (loading) {
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

        {error && (
          <div className="bg-red-950/30 border border-red-900 rounded-xl p-4">
            <p className="text-[10px] text-red-500 font-black uppercase tracking-widest">
              ⚠️ {error}
            </p>
          </div>
        )}

        <CityInfoCard 
          cityInfo={cityInfo} 
          userEmail={userEmail} 
          userCity={userCity} 
        />
        <StatsGrid stats={stats} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RecentActivityComponent activities={recentActivities} loading={loading} />
          <TopPlayers players={topPlayers} loading={loading} />
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
