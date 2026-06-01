
"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  MapPin,
  Globe,
  Users,
  Activity,
  Search,
  RefreshCcw,
  ChevronDown,
  ChevronUp,
  AlertTriangle
} from "lucide-react";

interface CityData {
  code: string;
  name: string;
  country: string;
  countryCode: string;
  athletes: number;
  activeAthletes: number;
  staffCount: number;
  pendingMessages: number;
  lastActivity: string;
  status: "active" | "inactive" | "maintenance";
}

interface GlobalCityStats {
  totalCities: number;
  totalAthletes: number;
  totalActiveAthletes: number;
  totalStaff: number;
  totalMessages: number;
}

// Données de démonstration (seront remplacées par l'API réelle)
const DEMO_CITIES: CityData[] = [
  {
    code: "NANTES",
    name: "Nantes",
    country: "France",
    countryCode: "FR",
    athletes: 245,
    activeAthletes: 189,
    staffCount: 8,
    pendingMessages: 3,
    lastActivity: new Date().toISOString(),
    status: "active"
  },
  {
    code: "LYON",
    name: "Lyon",
    country: "France",
    countryCode: "FR",
    athletes: 178,
    activeAthletes: 142,
    staffCount: 6,
    pendingMessages: 1,
    lastActivity: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    status: "active"
  },
  {
    code: "PARIS",
    name: "Paris",
    country: "France",
    countryCode: "FR",
    athletes: 312,
    activeAthletes: 267,
    staffCount: 12,
    pendingMessages: 5,
    lastActivity: new Date().toISOString(),
    status: "active"
  },
  {
    code: "MARSEILLE",
    name: "Marseille",
    country: "France",
    countryCode: "FR",
    athletes: 156,
    activeAthletes: 112,
    staffCount: 5,
    pendingMessages: 0,
    lastActivity: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    status: "active"
  },
  {
    code: "MADRID",
    name: "Madrid",
    country: "Espagne",
    countryCode: "ES",
    athletes: 98,
    activeAthletes: 67,
    staffCount: 4,
    pendingMessages: 2,
    lastActivity: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    status: "active"
  }
];

export default function AdminVillesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cities, setCities] = useState<CityData[]>([]);
  const [globalStats, setGlobalStats] = useState<GlobalCityStats>({
    totalCities: 0,
    totalAthletes: 0,
    totalActiveAthletes: 0,
    totalStaff: 0,
    totalMessages: 0
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedCity, setExpandedCity] = useState<string | null>(null);
  const [filterCountry, setFilterCountry] = useState<string>("all");

  // ✅ CORRECTION : Envelopper loadCities dans useCallback
  const loadCities = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // TODO: Remplacer par l'API réelle
      // const response = await fetch("/api/admin/cities");
      // const data = await response.json();
      
      // Simulation API
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setCities(DEMO_CITIES);
      
      // Calculer les stats globales
      const stats: GlobalCityStats = {
        totalCities: DEMO_CITIES.length,
        totalAthletes: DEMO_CITIES.reduce((sum, c) => sum + c.athletes, 0),
        totalActiveAthletes: DEMO_CITIES.reduce((sum, c) => sum + c.activeAthletes, 0),
        totalStaff: DEMO_CITIES.reduce((sum, c) => sum + c.staffCount, 0),
        totalMessages: DEMO_CITIES.reduce((sum, c) => sum + c.pendingMessages, 0)
      };
      setGlobalStats(stats);
      
    } catch (err) {
      console.error("Erreur chargement villes:", err);
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }, []); // Pas de dépendances car tout est local ou constant

  // Vérifier l'authentification admin
  useEffect(() => {
    const checkAuth = () => {
      const isAuthenticated = sessionStorage.getItem("admin_authenticated") === "true";
      if (!isAuthenticated) {
        router.push("/staff/admin/verification");
        return;
      }
      loadCities();
    };
    checkAuth();
  }, [router, loadCities]);

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "À l'instant";
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    if (diffDays === 1) return "Hier";
    return date.toLocaleDateString('fr-FR');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <span className="text-[8px] text-green-500 bg-green-500/10 px-2 py-0.5 rounded-full">ACTIVE</span>;
      case "inactive":
        return <span className="text-[8px] text-zinc-500 bg-zinc-500/10 px-2 py-0.5 rounded-full">INACTIVE</span>;
      case "maintenance":
        return <span className="text-[8px] text-orange-500 bg-orange-500/10 px-2 py-0.5 rounded-full">MAINTENANCE</span>;
      default:
        return null;
    }
  };

  const filteredCities = cities.filter(city => {
    if (searchTerm && !city.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !city.code.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    if (filterCountry !== "all" && city.countryCode !== filterCountry) {
      return false;
    }
    return true;
  });

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
            Gestion des <span className="text-red-600">Villes</span>
          </h1>
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1">
            Supervision de l&apos;ensemble du réseau VAGONDYS
          </p>
        </div>
        <button
          onClick={loadCities}
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
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
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
            <div className="p-2 bg-blue-500/10 rounded-xl">
              <Users className="w-5 h-5 text-blue-500" />
            </div>
            <span className="text-[8px] text-zinc-600 uppercase tracking-widest">Athlètes</span>
          </div>
          <p className="text-2xl font-black text-white">{globalStats.totalAthletes}</p>
        </div>

        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-green-500/10 rounded-xl">
              <Activity className="w-5 h-5 text-green-500" />
            </div>
            <span className="text-[8px] text-zinc-600 uppercase tracking-widest">Actifs</span>
          </div>
          <p className="text-2xl font-black text-white">{globalStats.totalActiveAthletes}</p>
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
            <div className="p-2 bg-yellow-500/10 rounded-xl">
              <Activity className="w-5 h-5 text-yellow-500" />
            </div>
            <span className="text-[8px] text-zinc-600 uppercase tracking-widest">Messages</span>
          </div>
          <p className="text-2xl font-black text-white">{globalStats.totalMessages}</p>
        </div>
      </div>

      {/* Filtres et recherche */}
      <div className="flex flex-wrap gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
          <input
            type="text"
            placeholder="Rechercher une ville..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-red-600 outline-none transition-colors"
            title="Rechercher une ville"
            aria-label="Rechercher une ville"
          />
        </div>
        <select
          value={filterCountry}
          onChange={(e) => setFilterCountry(e.target.value)}
          className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white focus:border-red-600 outline-none cursor-pointer"
          title="Filtrer par pays"
          aria-label="Filtrer par pays"
        >
          <option value="all">Tous les pays</option>
          <option value="FR">France</option>
          <option value="ES">Espagne</option>
        </select>
      </div>

      {/* Tableau des villes */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-zinc-800">
          <h2 className="text-sm font-black uppercase tracking-tighter">
            Liste des <span className="text-red-600">villes</span>
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800 bg-black/30">
                <th className="text-left p-4 text-[9px] font-black uppercase tracking-widest text-zinc-500">Ville</th>
                <th className="text-left p-4 text-[9px] font-black uppercase tracking-widest text-zinc-500">Pays</th>
                <th className="text-left p-4 text-[9px] font-black uppercase tracking-widest text-zinc-500">Athlètes</th>
                <th className="text-left p-4 text-[9px] font-black uppercase tracking-widest text-zinc-500">Actifs</th>
                <th className="text-left p-4 text-[9px] font-black uppercase tracking-widest text-zinc-500">Staff</th>
                <th className="text-left p-4 text-[9px] font-black uppercase tracking-widest text-zinc-500">Messages</th>
                <th className="text-left p-4 text-[9px] font-black uppercase tracking-widest text-zinc-500">Dernière activité</th>
                <th className="text-left p-4 text-[9px] font-black uppercase tracking-widest text-zinc-500">Statut</th>
                <th className="text-left p-4 text-[9px] font-black uppercase tracking-widest text-zinc-500"></th>
              </tr>
            </thead>
            <tbody>
              {filteredCities.map((city) => {
                // Résolution sémantique et typage fort en dehors du JSX pour éviter les erreurs d'analyse statique "axe/aria"
                const currentPercent = city.athletes > 0 ? Math.round((city.activeAthletes / city.athletes) * 100) : 0;
                
                return (
                  <React.Fragment key={city.code}>
                    <tr className="border-b border-zinc-800/50 hover:bg-white/5 transition-colors cursor-pointer"
                        onClick={() => setExpandedCity(expandedCity === city.code ? null : city.code)}>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-red-600" />
                          <span className="text-sm font-black text-white">{city.name}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <Globe className="w-3 h-3 text-zinc-500" />
                          <span className="text-xs text-zinc-400">{city.country}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="text-sm font-black text-white">{city.athletes}</span>
                      </td>
                      <td className="p-4">
                        <span className="text-sm font-black text-green-500">{city.activeAthletes}</span>
                        <span className="text-[8px] text-zinc-600 ml-1">
                          ({currentPercent}%)
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="text-sm font-black text-white">{city.staffCount}</span>
                      </td>
                      <td className="p-4">
                        {city.pendingMessages > 0 ? (
                          <span className="text-sm font-black text-yellow-500">{city.pendingMessages}</span>
                        ) : (
                          <span className="text-sm text-zinc-600">0</span>
                        )}
                      </td>
                      <td className="p-4">
                        <span className="text-[10px] text-zinc-500">{formatDate(city.lastActivity)}</span>
                      </td>
                      <td className="p-4">
                        {getStatusBadge(city.status)}
                      </td>
                      <td className="p-4">
                        {expandedCity === city.code ? (
                          <ChevronUp className="w-4 h-4 text-zinc-500" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-zinc-500" />
                        )}
                      </td>
                    </tr>
                    {expandedCity === city.code && (
                      <tr className="bg-black/50">
                        <td colSpan={9} className="p-5">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-2">
                              <h4 className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Informations</h4>
                              <p className="text-[10px] text-zinc-400">
                                <strong className="text-white">Code:</strong> {city.code}
                              </p>
                              <p className="text-[10px] text-zinc-400">
                                <strong className="text-white">Pays:</strong> {city.country} ({city.countryCode})
                              </p>
                            </div>
                            <div className="space-y-2">
                              <h4 className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Actions rapides</h4>
                              <div className="flex gap-3">
                                <button className="text-[8px] font-black uppercase bg-zinc-800 hover:bg-red-600 px-3 py-1.5 rounded-lg transition-colors">
                                  Voir les athlètes
                                </button>
                                <button className="text-[8px] font-black uppercase bg-zinc-800 hover:bg-red-600 px-3 py-1.5 rounded-lg transition-colors">
                                  Voir le staff
                                </button>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <h4 className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Performance</h4>
                              <div className="flex items-center gap-3">
                                <span className="text-[8px] text-zinc-500">Taux d&apos;activité:</span>
                                <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden relative">
                                  <style>{`
                                    .progress-bar-val-${city.code} {
                                      width: ${currentPercent}%;
                                    }
                                  `}</style>
                                  <div className={`h-full bg-green-500 rounded-full transition-all duration-300 progress-bar-val-${city.code}`} />
                                  <span className="sr-only">Taux d&apos;activité : {currentPercent}%</span>
                                </div>
                                <span className="text-[8px] text-green-500">
                                  {currentPercent}%
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
