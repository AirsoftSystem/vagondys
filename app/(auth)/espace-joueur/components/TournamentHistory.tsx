
/**
 * ==========================================================
 * TOURNAMENT HISTORY COMPONENT
 * ==========================================================
 * Affiche l'historique des tournois d'un joueur
 * Intégré dans l'espace joueur
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Trophy, 
  Medal, 
  Calendar, 
  MapPin, 
  TrendingUp, 
  ChevronLeft, 
  ChevronRight,
  Loader2,
  Award,
  Star,
  Target
} from 'lucide-react';

// Types pour les résultats de tournoi
interface TournamentResult {
  id: string;
  tournament_name: string;
  tournament_date: string;
  player_id: string;
  player_name: string;
  position: number;
  points_gained: number;
  category: string;
  city: string;
  country: string;
  verified: boolean;
  created_at: string;
}

interface TournamentHistoryProps {
  playerId: string;
  city: string;
  country?: string;
}

interface PaginationInfo {
  total: number;
  limit: number;
  offset: number;
  totalPages: number;
}

// Configuration des catégories
const CATEGORY_LABELS: Record<string, string> = {
  'LOCAL': 'Tournoi Local',
  'REGIONAL': 'Tournoi Régional',
  'NATIONAL': 'Tournoi National',
  'INTERNATIONAL': 'Tournoi International',
  'MASTER': 'Master Series',
  'CHALLENGER': 'Challenger Series',
};

const CATEGORY_COLORS: Record<string, string> = {
  'LOCAL': 'bg-green-500/10 text-green-500 border-green-500/20',
  'REGIONAL': 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  'NATIONAL': 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  'INTERNATIONAL': 'bg-red-500/10 text-red-500 border-red-500/20',
  'MASTER': 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  'CHALLENGER': 'bg-orange-500/10 text-orange-500 border-orange-500/20',
};

// Icône par position
const getPositionIcon = (position: number) => {
  if (position === 1) return <Trophy className="w-4 h-4 text-yellow-500" />;
  if (position === 2) return <Medal className="w-4 h-4 text-gray-400" />;
  if (position === 3) return <Medal className="w-4 h-4 text-amber-600" />;
  return <Target className="w-4 h-4 text-zinc-500" />;
};

// Formatage de la date
const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

// Formatage du rang
const formatPosition = (position: number): string => {
  if (position === 1) return '1er';
  return `${position}ème`;
};

export default function TournamentHistory({ 
  playerId, 
  city, 
  country = 'FR' 
}: TournamentHistoryProps) {
  const [results, setResults] = useState<TournamentResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationInfo>({
    total: 0,
    limit: 10,
    offset: 0,
    totalPages: 0,
  });
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [stats, setStats] = useState({
    totalPoints: 0,
    averagePosition: 0,
    bestPosition: 0,
    tournamentsCount: 0,
    winsCount: 0,
    podiumsCount: 0,
  });

  /**
   * Récupère l'historique des tournois
   */
  const fetchTournamentHistory = useCallback(async () => {
    if (!playerId || !city) return;
    
    setLoading(true);
    setError(null);
    
    try {
      let url = `/api/tournaments/record-result?playerId=${playerId}&city=${city}&country=${country}&limit=${pagination.limit}&offset=${pagination.offset}`;
      
      if (selectedCategory !== 'all') {
        url += `&category=${selectedCategory}`;
      }
      
      const response = await fetch(url);
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Erreur lors du chargement');
      }
      
      setResults(result.data || []);
      setPagination(prev => ({
        ...prev,
        total: result.pagination?.total || 0,
        totalPages: Math.ceil((result.pagination?.total || 0) / prev.limit),
      }));
      
      // Calculer les statistiques
      const data = result.data || [];
      const totalPoints = data.reduce((sum: number, r: TournamentResult) => sum + r.points_gained, 0);
      const averagePosition = data.length > 0 
        ? Math.round(data.reduce((sum: number, r: TournamentResult) => sum + r.position, 0) / data.length)
        : 0;
      const bestPosition = data.length > 0 
        ? Math.min(...data.map((r: TournamentResult) => r.position))
        : 0;
      const winsCount = data.filter((r: TournamentResult) => r.position === 1).length;
      const podiumsCount = data.filter((r: TournamentResult) => r.position <= 3).length;
      
      setStats({
        totalPoints,
        averagePosition,
        bestPosition,
        tournamentsCount: data.length,
        winsCount,
        podiumsCount,
      });
      
    } catch (err) {
      console.error('Erreur chargement tournois:', err);
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }, [playerId, city, country, pagination.limit, pagination.offset, selectedCategory]);

  // Chargement initial
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchTournamentHistory();
  }, [fetchTournamentHistory]);

  /**
   * Change de page
   */
  const handlePageChange = (newOffset: number) => {
    setPagination(prev => ({ ...prev, offset: newOffset }));
  };

  /**
   * Change la limite par page
   */
  const handleLimitChange = (newLimit: number) => {
    setPagination(prev => ({ ...prev, limit: newLimit, offset: 0 }));
  };

  /**
   * Filtre par catégorie
   */
  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
    setPagination(prev => ({ ...prev, offset: 0 }));
  };

  if (loading && results.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 text-red-600 animate-spin" />
        <span className="ml-2 text-zinc-500">Chargement de l&apos;historique...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-500 text-sm">Erreur: {error}</p>
        <button
          onClick={() => fetchTournamentHistory()}
          className="mt-2 text-xs text-zinc-500 hover:text-white"
          title="Réessayer le chargement"
          aria-label="Réessayer le chargement"
        >
          Réessayer
        </button>
      </div>
    );
  }

  if (results.length === 0 && !loading) {
    return (
      <div className="text-center py-12 border border-zinc-800 rounded-xl bg-zinc-900/20">
        <Award className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
        <p className="text-zinc-500 text-sm">Aucun tournoi disputé</p>
        <p className="text-zinc-600 text-xs mt-1">Participez à des tournois pour voir votre historique ici</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête avec statistiques */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-zinc-900/50 rounded-xl p-3 text-center border border-zinc-800">
          <p className="text-[9px] text-zinc-500 uppercase tracking-wider">Tournois</p>
          <p className="text-xl font-black text-white">{stats.tournamentsCount}</p>
        </div>
        <div className="bg-zinc-900/50 rounded-xl p-3 text-center border border-zinc-800">
          <p className="text-[9px] text-zinc-500 uppercase tracking-wider">Points</p>
          <p className="text-xl font-black text-red-500">{stats.totalPoints}</p>
        </div>
        <div className="bg-zinc-900/50 rounded-xl p-3 text-center border border-zinc-800">
          <p className="text-[9px] text-zinc-500 uppercase tracking-wider">Top 3</p>
          <p className="text-xl font-black text-yellow-500">{stats.podiumsCount}</p>
        </div>
        <div className="bg-zinc-900/50 rounded-xl p-3 text-center border border-zinc-800">
          <p className="text-[9px] text-zinc-500 uppercase tracking-wider">Victoires</p>
          <p className="text-xl font-black text-green-500">{stats.winsCount}</p>
        </div>
        <div className="bg-zinc-900/50 rounded-xl p-3 text-center border border-zinc-800">
          <p className="text-[9px] text-zinc-500 uppercase tracking-wider">Meilleur rang</p>
          <p className="text-xl font-black text-white">{formatPosition(stats.bestPosition)}</p>
        </div>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleCategoryChange('all')}
            className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
              selectedCategory === 'all'
                ? 'bg-red-600 text-white'
                : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
            }`}
            title="Afficher toutes les catégories"
            aria-label="Afficher toutes les catégories"
          >
            Tous
          </button>
          {Object.keys(CATEGORY_LABELS).map(cat => (
            <button
              key={cat}
              onClick={() => handleCategoryChange(cat)}
              className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
                selectedCategory === cat
                  ? 'bg-red-600 text-white'
                  : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
              }`}
              title={`Filtrer par ${CATEGORY_LABELS[cat]}`}
              aria-label={`Filtrer par ${CATEGORY_LABELS[cat]}`}
            >
              {CATEGORY_LABELS[cat].split(' ')[0]}
            </button>
          ))}
        </div>
        
        <select
          value={pagination.limit}
          onChange={(e) => handleLimitChange(Number(e.target.value))}
          className="bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1.5 text-[9px] font-black text-white"
          title="Nombre de résultats par page"
          aria-label="Nombre de résultats par page"
        >
          <option value={5}>5 par page</option>
          <option value={10}>10 par page</option>
          <option value={20}>20 par page</option>
          <option value={50}>50 par page</option>
        </select>
      </div>

      {/* Liste des résultats */}
      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
        {results.map((result) => (
          <div
            key={result.id}
            className="bg-zinc-900/30 border border-zinc-800 rounded-xl p-3 hover:bg-zinc-900/50 transition-colors"
          >
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3">
                {getPositionIcon(result.position)}
                <div>
                  <p className="font-bold text-white text-sm">{result.tournament_name}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[9px] text-zinc-500 flex items-center gap-1">
                      <Calendar size={10} />
                      {formatDate(result.tournament_date)}
                    </span>
                    <span className="text-[9px] text-zinc-500 flex items-center gap-1">
                      <MapPin size={10} />
                      {result.city}
                    </span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-black text-red-500">{result.points_gained} pts</p>
                <span className={`text-[8px] px-2 py-0.5 rounded-full border ${CATEGORY_COLORS[result.category] || 'bg-zinc-800 text-zinc-400'}`}>
                  {CATEGORY_LABELS[result.category] || result.category}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-800">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-zinc-400">
                  {formatPosition(result.position)} place
                </span>
                {result.verified && (
                  <span className="text-[8px] text-green-500 flex items-center gap-1">
                    <Star size={8} />
                    Vérifié
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <TrendingUp size={10} className="text-zinc-500" />
                <span className="text-[8px] text-zinc-500">
                  {result.position <= 3 ? 'Podium !' : result.position <= 10 ? 'Top 10' : 'Participant'}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={() => handlePageChange(Math.max(0, pagination.offset - pagination.limit))}
            disabled={pagination.offset === 0}
            className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-800 transition-colors"
            title="Page précédente"
            aria-label="Page précédente"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-[9px] text-zinc-500">
            Page {Math.floor(pagination.offset / pagination.limit) + 1} / {pagination.totalPages}
          </span>
          <button
            onClick={() => handlePageChange(Math.min(pagination.offset + pagination.limit, (pagination.totalPages - 1) * pagination.limit))}
            disabled={pagination.offset + pagination.limit >= pagination.total}
            className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-800 transition-colors"
            title="Page suivante"
            aria-label="Page suivante"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
