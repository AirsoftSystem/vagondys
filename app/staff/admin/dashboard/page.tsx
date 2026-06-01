
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  Building2,
  MessageSquare,
  Database,
  Activity,
  AlertTriangle,
  RefreshCcw
} from "lucide-react";

interface GlobalStats {
  totalAthletes: number;
  totalCities: number;
  totalStaff: number;
  totalMessages: number;
  pendingMessagerieRequests: number;
  activeAthletes: number;
  newAthletesThisMonth: number;
}

interface CityStats {
  name: string;
  country: string;
  athletes: number;
  active: number;
  messages: number;
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [globalStats, setGlobalStats] = useState<GlobalStats>({
    totalAthletes: 0,
    totalCities: 0,
    totalStaff: 0,
    totalMessages: 0,
    pendingMessagerieRequests: 0,
    activeAthletes: 0,
    newAthletesThisMonth: 0
  });
  const [cityStats, setCityStats] = useState<CityStats[]>([]);

  // Fonction de chargement des stats (temps réel)
  const loadStats = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/stats");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erreur chargement stats");
      }

      setGlobalStats(data.global);
      setCityStats(data.cities || []);
    } catch (err) {
      console.error("Erreur loadStats:", err);
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  };

  // Vérifier l'authentification admin (via sessionStorage) et charger les stats
  useEffect(() => {
    const init = async () => {
      const isAuthenticated = sessionStorage.getItem("admin_authenticated") === "true";
      if (!isAuthenticated) {
        router.push("/staff/admin/verification");
        return;
      }
      await loadStats();
    };
    init();
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCcw className="w-8 h-8 text-red-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tighter">
            Tableau de bord <span className="text-red-600">Global</span>
          </h1>
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1">
            Vue d&apos;ensemble de l&apos;ensemble du réseau VAGONDYS
          </p>
        </div>
        <button
          onClick={loadStats}
          className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors text-[10px] font-black uppercase tracking-widest"
        >
          <RefreshCcw className="w-4 h-4" />
          Actualiser
        </button>
      </div>

      {/* Erreur */}
      {error && (
        <div className="bg-red-600/10 border border-red-600/30 rounded-xl p-4 flex items-center gap-3 text-red-500">
          <AlertTriangle className="w-5 h-5" />
          <p className="text-[10px] font-black uppercase tracking-widest">{error}</p>
        </div>
      )}

      {/* Cartes statistiques globales */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-blue-500/10 rounded-xl">
              <Users className="w-5 h-5 text-blue-500" />
            </div>
            <span className="text-[8px] text-zinc-600 uppercase tracking-widest">Athlètes</span>
          </div>
          <p className="text-2xl font-black text-white">{globalStats.totalAthletes}</p>
          <p className="text-[8px] text-green-500 mt-1">+{globalStats.newAthletesThisMonth} ce mois</p>
        </div>

        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-green-500/10 rounded-xl">
              <Activity className="w-5 h-5 text-green-500" />
            </div>
            <span className="text-[8px] text-zinc-600 uppercase tracking-widest">Actifs</span>
          </div>
          <p className="text-2xl font-black text-white">{globalStats.activeAthletes}</p>
          <p className="text-[8px] text-zinc-600 mt-1">
            {globalStats.totalAthletes > 0 
              ? Math.round((globalStats.activeAthletes / globalStats.totalAthletes) * 100) 
              : 0}% du total
          </p>
        </div>

        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-purple-500/10 rounded-xl">
              <Building2 className="w-5 h-5 text-purple-500" />
            </div>
            <span className="text-[8px] text-zinc-600 uppercase tracking-widest">Villes</span>
          </div>
          <p className="text-2xl font-black text-white">{globalStats.totalCities}</p>
        </div>

        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-yellow-500/10 rounded-xl">
              <MessageSquare className="w-5 h-5 text-yellow-500" />
            </div>
            <span className="text-[8px] text-zinc-600 uppercase tracking-widest">Messages</span>
          </div>
          <p className="text-2xl font-black text-white">{globalStats.totalMessages}</p>
        </div>

        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-red-500/10 rounded-xl">
              <Users className="w-5 h-5 text-red-500" />
            </div>
            <span className="text-[8px] text-zinc-600 uppercase tracking-widest">Staff</span>
          </div>
          <p className="text-2xl font-black text-white">{globalStats.totalStaff}</p>
        </div>

        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-orange-500/10 rounded-xl">
              <Database className="w-5 h-5 text-orange-500" />
            </div>
            <span className="text-[8px] text-zinc-600 uppercase tracking-widest">Demandes</span>
          </div>
          <p className="text-2xl font-black text-white">{globalStats.pendingMessagerieRequests}</p>
          <p className="text-[8px] text-zinc-600 mt-1">Messagerie en attente</p>
        </div>
      </div>

      {/* Tableau des villes */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-zinc-800">
          <h2 className="text-sm font-black uppercase tracking-tighter">
            Statistiques <span className="text-red-600">par ville</span>
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800 bg-black/30">
                <th className="text-left p-4 text-[9px] font-black uppercase tracking-widest text-zinc-500">Ville</th>
                <th className="text-left p-4 text-[9px] font-black uppercase tracking-widest text-zinc-500">Athlètes</th>
                <th className="text-left p-4 text-[9px] font-black uppercase tracking-widest text-zinc-500">Actifs</th>
                <th className="text-left p-4 text-[9px] font-black uppercase tracking-widest text-zinc-500">Messages</th>
                <th className="text-left p-4 text-[9px] font-black uppercase tracking-widest text-zinc-500">Taux</th>
              </tr>
            </thead>
            <tbody>
              {cityStats.map((city, idx) => {
                const rate = city.athletes > 0 
                  ? Math.round((city.active / city.athletes) * 100) 
                  : 0;
                return (
                  <tr key={idx} className="border-b border-zinc-800/50 hover:bg-white/5 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-white">{city.name}</span>
                        <span className="text-[8px] text-zinc-600">{city.country}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="text-sm font-black text-white">{city.athletes}</span>
                    </td>
                    <td className="p-4">
                      <span className="text-sm font-black text-green-500">{city.active}</span>
                    </td>
                    <td className="p-4">
                      <span className="text-sm font-black text-yellow-500">{city.messages}</span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-green-500 rounded-full w-(--rate-width)"
                            data-percentage={`${rate}%`}
                          />
                        </div>
                        <span className="text-[8px] text-zinc-500">{rate}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
