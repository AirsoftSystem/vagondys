
"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  Building2,
  MessageSquare,
  Database,
  Activity,
  AlertTriangle,
  RefreshCcw,
  Clock
} from "lucide-react";

import styles from "./page.module.css";

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

/**
 * Arrondit un nombre au multiple de 5 le plus proche (0-100)
 */
function roundToMultipleOf5(value: number): number {
  const clamped = Math.max(0, Math.min(100, value));
  return Math.round(clamped / 5) * 5;
}

/**
 * Retourne le nom de la classe CSS correspondant au pourcentage
 */
function getProgressClassName(rate: number): string {
  const rounded = roundToMultipleOf5(rate);
  const classMap: Record<number, string> = {
    0: styles["w-0"],
    5: styles["w-5"],
    10: styles["w-10"],
    15: styles["w-15"],
    20: styles["w-20"],
    25: styles["w-25"],
    30: styles["w-30"],
    35: styles["w-35"],
    40: styles["w-40"],
    45: styles["w-45"],
    50: styles["w-50"],
    55: styles["w-55"],
    60: styles["w-60"],
    65: styles["w-65"],
    70: styles["w-70"],
    75: styles["w-75"],
    80: styles["w-80"],
    85: styles["w-85"],
    90: styles["w-90"],
    95: styles["w-95"],
    100: styles["w-100"],
  };
  return classMap[rounded] || styles["w-0"];
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
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  
  // État pour la carte "Demandes" (simple bordure rouge)
  const [hasPendingRequests, setHasPendingRequests] = useState(false);
  
  // Refs
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  // Fonction pour détecter les changements et mettre à jour la carte
  const detectChangesAndNotify = useCallback((newGlobal: GlobalStats) => {
    // Mettre à jour la carte "Demandes" si la valeur change
    if (newGlobal.pendingMessagerieRequests > 0) {
      setHasPendingRequests(true);
    } else {
      setHasPendingRequests(false);
    }
  }, []);

  // Fonction de chargement des stats
  const loadStats = useCallback(async (silent: boolean = false) => {
    if (!silent) {
      setLoading(true);
    }
    setError(null);

    try {
      const response = await fetch("/api/staff/dashboard?city=MASTER&country=FR");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erreur chargement stats");
      }

      // Mettre à jour les stats
      setGlobalStats(data.global);
      setCityStats(data.cities || []);
      setLastUpdate(new Date());
      
      // Détecter les changements
      detectChangesAndNotify(data.global);
      
    } catch (err) {
      console.error("Erreur loadStats:", err);
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [detectChangesAndNotify]);

  // Démarrer le polling automatique
  useEffect(() => {
    isMountedRef.current = true;
    
    // Chargement initial
    const init = async () => {
      const isAuthenticated = sessionStorage.getItem("admin_authenticated") === "true";
      if (!isAuthenticated) {
        router.push("/staff/admin/verification");
        return;
      }
      await loadStats(false);
    };
    init();

    // Polling toutes les 5 secondes
    pollingIntervalRef.current = setInterval(() => {
      if (isMountedRef.current) {
        loadStats(true);
      }
    }, 5000);

    return () => {
      isMountedRef.current = false;
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [router, loadStats]);

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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tighter">
            Tableau de bord <span className="text-red-600">Global</span>
          </h1>
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1">
            Vue d&apos;ensemble de l&apos;ensemble du réseau VAGONDYS
          </p>
          {lastUpdate && (
            <div className="flex items-center gap-1 mt-1 text-[8px] text-zinc-600">
              <Clock className="w-3 h-3" />
              Dernière mise à jour : {lastUpdate.toLocaleTimeString()}
            </div>
          )}
        </div>
        <button
          onClick={() => loadStats(false)}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white hover:bg-red-700 transition-colors text-[10px] font-black uppercase tracking-widest rounded-lg"
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
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 transition-all duration-300 hover:border-zinc-700">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-blue-500/10 rounded-xl">
              <Users className="w-5 h-5 text-blue-500" />
            </div>
            <span className="text-[8px] text-zinc-600 uppercase tracking-widest">Athlètes</span>
          </div>
          <p className="text-2xl font-black text-white" id="stat-totalAthletes">{globalStats.totalAthletes}</p>
          <p className="text-[8px] text-green-500 mt-1">+{globalStats.newAthletesThisMonth} ce mois</p>
        </div>

        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 transition-all duration-300 hover:border-zinc-700">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-green-500/10 rounded-xl">
              <Activity className="w-5 h-5 text-green-500" />
            </div>
            <span className="text-[8px] text-zinc-600 uppercase tracking-widest">Actifs</span>
          </div>
          <p className="text-2xl font-black text-white" id="stat-activeAthletes">{globalStats.activeAthletes}</p>
          <p className="text-[8px] text-zinc-600 mt-1">
            {globalStats.totalAthletes > 0 
              ? Math.round((globalStats.activeAthletes / globalStats.totalAthletes) * 100) 
              : 0}% du total
          </p>
        </div>

        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 transition-all duration-300 hover:border-zinc-700">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-purple-500/10 rounded-xl">
              <Building2 className="w-5 h-5 text-purple-500" />
            </div>
            <span className="text-[8px] text-zinc-600 uppercase tracking-widest">Villes</span>
          </div>
          <p className="text-2xl font-black text-white" id="stat-totalCities">{globalStats.totalCities}</p>
        </div>

        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 transition-all duration-300 hover:border-zinc-700">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-yellow-500/10 rounded-xl">
              <MessageSquare className="w-5 h-5 text-yellow-500" />
            </div>
            <span className="text-[8px] text-zinc-600 uppercase tracking-widest">Messages</span>
          </div>
          <p className="text-2xl font-black text-white" id="stat-totalMessages">{globalStats.totalMessages}</p>
        </div>

        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 transition-all duration-300 hover:border-zinc-700">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-red-500/10 rounded-xl">
              <Users className="w-5 h-5 text-red-500" />
            </div>
            <span className="text-[8px] text-zinc-600 uppercase tracking-widest">Staff</span>
          </div>
          <p className="text-2xl font-black text-white" id="stat-totalStaff">{globalStats.totalStaff}</p>
        </div>

        {/* Carte "Demandes" - Bordure rouge si demande en attente */}
        <div 
          className={`bg-zinc-950 border rounded-2xl p-5 transition-all duration-300 ${
            hasPendingRequests 
              ? 'border-red-600 border-2' 
              : 'border-zinc-800 hover:border-zinc-700'
          }`}
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-orange-500/10 rounded-xl">
              <Database className="w-5 h-5 text-orange-500" />
            </div>
            <span className="text-[8px] text-zinc-600 uppercase tracking-widest">Demandes</span>
          </div>
          <p className="text-2xl font-black text-white" id="stat-pendingMessagerieRequests">{globalStats.pendingMessagerieRequests}</p>
          <p className="text-[8px] text-zinc-600 mt-1">Messagerie en attente</p>
        </div>
      </div>

      {/* Tableau des villes */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
          <h2 className="text-sm font-black uppercase tracking-tighter">
            Statistiques <span className="text-red-600">par ville</span>
          </h2>
          <span className="text-[8px] text-zinc-600">
            {cityStats.length} ville{cityStats.length > 1 ? "s" : ""}
          </span>
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
              {cityStats.map((city: CityStats, idx: number) => {
                const rate = city.athletes > 0 
                  ? Math.round((city.active / city.athletes) * 100) 
                  : 0;
                // ID unique pour la ville
                const cityId = `city-${city.name.toLowerCase().replace(/\s/g, "-")}`;
                const progressClass = getProgressClassName(rate);
                return (
                  <tr key={idx} className="border-b border-zinc-800/50 hover:bg-white/5 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-white">{city.name}</span>
                        <span className="text-[8px] text-zinc-600">{city.country}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="text-sm font-black text-white" id={`${cityId}-athletes`}>{city.athletes}</span>
                    </td>
                    <td className="p-4">
                      <span className="text-sm font-black text-green-500" id={`${cityId}-active`}>{city.active}</span>
                    </td>
                    <td className="p-4">
                      <span className="text-sm font-black text-yellow-500" id={`${cityId}-messages`}>{city.messages}</span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div className={styles.progressContainer}>
                          <div className={`${styles.progressFill} ${progressClass}`} />
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
