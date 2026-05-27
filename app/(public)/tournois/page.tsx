
/**
 * ==========================================================
 * PAGE PUBLIQUE TOURNOIS
 * ==========================================================
 * Affiche les tournois passés et à venir
 * Accessible à tous (public)
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Trophy,
  Calendar,
  MapPin,
  Users,
  ChevronLeft,
  ChevronRight,
  Search,
  Filter,
  Clock,
  Medal,
  Star,
  Eye,
  Loader2
} from 'lucide-react';
import Link from 'next/link';

// Types pour les tournois
interface Tournament {
  id: string;
  name: string;
  date: string;
  location: string;
  city: string;
  country: string;
  category: string;
  players_count: number;
  max_players: number;
  status: 'UPCOMING' | 'ONGOING' | 'FINISHED';
  winner_id?: string;
  winner_name?: string;
  results_url?: string;
}

interface TournamentResult {
  id: string;
  tournament_name: string;
  tournament_date: string;
  player_name: string;
  position: number;
  points_gained: number;
  category: string;
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

const CATEGORY_BADGES: Record<string, string> = {
  'LOCAL': 'bg-green-500/20 text-green-400 border-green-500/30',
  'REGIONAL': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'NATIONAL': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  'INTERNATIONAL': 'bg-red-500/20 text-red-400 border-red-500/30',
  'MASTER': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  'CHALLENGER': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
};

const STATUS_LABELS: Record<string, string> = {
  'UPCOMING': 'À venir',
  'ONGOING': 'En cours',
  'FINISHED': 'Terminé',
};

const STATUS_COLORS: Record<string, string> = {
  'UPCOMING': 'text-blue-500 bg-blue-500/10 border-blue-500/20',
  'ONGOING': 'text-green-500 bg-green-500/10 border-green-500/20',
  'FINISHED': 'text-zinc-500 bg-zinc-500/10 border-zinc-500/20',
};

// Villes disponibles pour le filtre
const CITIES = [
  { code: 'NANTES', name: 'Nantes', country: 'FR' },
  { code: 'LYON', name: 'Lyon', country: 'FR' },
  { code: 'MADRID', name: 'Madrid', country: 'ES' },
  { code: 'BARCELONE', name: 'Barcelone', country: 'ES' },
];

/**
 * Données de démonstration (déplacées AVANT leur utilisation)
 */
const getDemoTournaments = (): Tournament[] => {
  return [
    {
      id: '1',
      name: 'Open de Nantes',
      date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      location: 'Salle omnisports, Nantes',
      city: 'NANTES',
      country: 'FR',
      category: 'REGIONAL',
      players_count: 24,
      max_players: 32,
      status: 'UPCOMING',
    },
    {
      id: '2',
      name: 'Championnat de France',
      date: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
      location: 'Palais des Sports, Paris',
      city: 'PARIS',
      country: 'FR',
      category: 'NATIONAL',
      players_count: 64,
      max_players: 64,
      status: 'FINISHED',
      winner_name: 'Jean Dupont',
    },
    {
      id: '3',
      name: 'Madrid Challenger',
      date: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString(),
      location: 'Polideportivo Municipal, Madrid',
      city: 'MADRID',
      country: 'ES',
      category: 'CHALLENGER',
      players_count: 16,
      max_players: 32,
      status: 'UPCOMING',
    },
  ];
};

export default function TournoisPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCity, setSelectedCity] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [tournamentResults, setTournamentResults] = useState<TournamentResult[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [pagination, setPagination] = useState({
    limit: 12,
    offset: 0,
    total: 0,
    totalPages: 0,
  });

  /**
   * Récupère la liste des tournois
   */
  const fetchTournaments = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      let url = `/api/tournaments/list?limit=${pagination.limit}&offset=${pagination.offset}`;

      if (selectedCity !== 'all') {
        url += `&city=${selectedCity}`;
      }
      if (selectedCategory !== 'all') {
        url += `&category=${selectedCategory}`;
      }
      if (selectedStatus !== 'all') {
        url += `&status=${selectedStatus}`;
      }
      if (searchTerm) {
        url += `&search=${encodeURIComponent(searchTerm)}`;
      }

      const response = await fetch(url);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Erreur lors du chargement');
      }

      setTournaments(result.data || []);
      setPagination(prev => ({
        ...prev,
        total: result.pagination?.total || 0,
        totalPages: Math.ceil((result.pagination?.total || 0) / prev.limit),
      }));
    } catch (err) {
      console.error('Erreur chargement tournois:', err);
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
      // Données de démonstration en cas d'erreur API
      setTournaments(getDemoTournaments());
    } finally {
      setLoading(false);
    }
  }, [pagination.limit, pagination.offset, selectedCity, selectedCategory, selectedStatus, searchTerm]);

  /**
   * Récupère les résultats d'un tournoi
   */
  const fetchTournamentResults = async (tournamentId: string, tournamentName: string) => {
    try {
      const response = await fetch(`/api/tournaments/results?tournamentId=${tournamentId}`);
      const result = await response.json();

      if (result.success && result.data) {
        setTournamentResults(result.data);
      } else {
        // Données de démonstration
        setTournamentResults([
          { id: '1', tournament_name: tournamentName, tournament_date: new Date().toISOString(), player_name: 'Jean Dupont', position: 1, points_gained: 100, category: 'NATIONAL' },
          { id: '2', tournament_name: tournamentName, tournament_date: new Date().toISOString(), player_name: 'Marie Martin', position: 2, points_gained: 80, category: 'NATIONAL' },
          { id: '3', tournament_name: tournamentName, tournament_date: new Date().toISOString(), player_name: 'Pierre Durand', position: 3, points_gained: 65, category: 'NATIONAL' },
        ]);
      }
    } catch (err) {
      console.error('Erreur chargement résultats:', err);
      setTournamentResults([]);
    }
  };

  // Chargement initial
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchTournaments();
  }, [fetchTournaments]);

  /**
   * Ouvre le modal des résultats
   */
  const handleViewResults = async (tournament: Tournament) => {
    setSelectedTournament(tournament);
    await fetchTournamentResults(tournament.id, tournament.name);
    setShowModal(true);
  };

  /**
   * Change de page
   */
  const handlePageChange = (newOffset: number) => {
    setPagination(prev => ({ ...prev, offset: newOffset }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /**
   * Réinitialise les filtres
   */
  const resetFilters = () => {
    setSelectedCity('all');
    setSelectedCategory('all');
    setSelectedStatus('all');
    setSearchTerm('');
    setPagination(prev => ({ ...prev, offset: 0 }));
  };

  // Formatage de la date
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  // Formatage de la position
  const formatPosition = (position: number): string => {
    if (position === 1) return '1er';
    return `${position}ème`;
  };

  // Icône de médaillé par position
  const getMedalIcon = (position: number) => {
    if (position === 1) return <Medal className="w-4 h-4 text-yellow-500" />;
    if (position === 2) return <Medal className="w-4 h-4 text-gray-400" />;
    if (position === 3) return <Medal className="w-4 h-4 text-amber-600" />;
    return <Star className="w-4 h-4 text-zinc-500" />;
  };

  return (
    <main className="min-h-screen bg-black text-white pt-32 pb-20 px-4 md:px-6">
      <div className="max-w-6xl mx-auto">
        {/* En-tête */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter mb-4">
            Tournois <span className="text-red-600">Vagondys</span>
          </h1>
          <p className="text-zinc-400 text-sm max-w-2xl mx-auto">
            Consultez les tournois passés et à venir du réseau Vagondys
          </p>
        </div>

        {/* Barre de recherche et filtres */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 mb-8">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Recherche */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                placeholder="Rechercher un tournoi..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-black border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-red-600 outline-none transition-colors"
                title="Rechercher un tournoi"
                aria-label="Rechercher un tournoi"
              />
            </div>

            {/* Filtre ville */}
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="bg-black border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:border-red-600 outline-none"
              title="Filtrer par ville"
              aria-label="Filtrer par ville"
            >
              <option value="all">Toutes les villes</option>
              {CITIES.map(city => (
                <option key={city.code} value={city.code}>{city.name}</option>
              ))}
            </select>

            {/* Filtre catégorie */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-black border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:border-red-600 outline-none"
              title="Filtrer par catégorie"
              aria-label="Filtrer par catégorie"
            >
              <option value="all">Toutes les catégories</option>
              {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>

            {/* Filtre statut */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-black border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:border-red-600 outline-none"
              title="Filtrer par statut"
              aria-label="Filtrer par statut"
            >
              <option value="all">Tous les statuts</option>
              <option value="UPCOMING">À venir</option>
              <option value="ONGOING">En cours</option>
              <option value="FINISHED">Terminés</option>
            </select>

            {/* Reset */}
            <button
              onClick={resetFilters}
              className="px-4 py-2.5 rounded-xl bg-zinc-800 text-zinc-400 hover:text-white text-sm font-medium transition-colors"
              title="Réinitialiser les filtres"
              aria-label="Réinitialiser les filtres"
            >
              <Filter size={16} className="inline mr-1" />
              Reset
            </button>
          </div>
        </div>

        {/* Liste des tournois */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 text-red-600 animate-spin" />
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <p className="text-red-500">{error}</p>
            <button
              onClick={() => fetchTournaments()}
              className="mt-4 text-sm text-zinc-500 hover:text-white"
              title="Réessayer"
              aria-label="Réessayer"
            >
              Réessayer
            </button>
          </div>
        ) : tournaments.length === 0 ? (
          <div className="text-center py-20 border border-zinc-800 rounded-2xl bg-zinc-900/20">
            <Trophy className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
            <p className="text-zinc-500">Aucun tournoi trouvé</p>
            <p className="text-zinc-600 text-sm mt-1">Essayez d&apos;autres filtres</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {tournaments.map((tournament) => (
                <div
                  key={tournament.id}
                  className="bg-zinc-900/30 border border-zinc-800 rounded-2xl overflow-hidden hover:bg-zinc-900/50 transition-all hover:border-red-600/30"
                >
                  <div className="p-5">
                    {/* En-tête */}
                    <div className="flex items-start justify-between mb-3">
                      <span className={`text-[8px] font-black px-2 py-1 rounded-full border ${STATUS_COLORS[tournament.status]}`}>
                        {STATUS_LABELS[tournament.status]}
                      </span>
                      <span className={`text-[8px] font-black px-2 py-1 rounded-full border ${CATEGORY_BADGES[tournament.category]}`}>
                        {CATEGORY_LABELS[tournament.category]?.split(' ')[0] || tournament.category}
                      </span>
                    </div>

                    {/* Titre */}
                    <h3 className="text-lg font-black mb-2 line-clamp-1">{tournament.name}</h3>

                    {/* Infos */}
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center gap-2 text-zinc-400 text-xs">
                        <Calendar size={12} />
                        <span>{formatDate(tournament.date)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-zinc-400 text-xs">
                        <MapPin size={12} />
                        <span>{tournament.location}</span>
                      </div>
                      <div className="flex items-center gap-2 text-zinc-400 text-xs">
                        <Users size={12} />
                        <span>{tournament.players_count} / {tournament.max_players} inscrits</span>
                      </div>
                    </div>

                    {/* Vainqueur (si terminé) */}
                    {tournament.status === 'FINISHED' && tournament.winner_name && (
                      <div className="mb-4 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                        <p className="text-[9px] text-yellow-500 font-black uppercase tracking-wider">
                          Vainqueur
                        </p>
                        <p className="text-sm font-bold text-white">{tournament.winner_name}</p>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 pt-2 border-t border-zinc-800">
                      {tournament.status === 'FINISHED' && (
                        <button
                          onClick={() => handleViewResults(tournament)}
                          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-red-600/10 text-red-500 hover:bg-red-600 hover:text-white transition-colors text-[10px] font-black uppercase tracking-wider"
                          title="Voir les résultats"
                          aria-label="Voir les résultats"
                        >
                          <Eye size={12} />
                          Résultats
                        </button>
                      )}
                      {tournament.status !== 'FINISHED' && (
                        <Link
                          href={`/reservations?tournament=${tournament.id}`}
                          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors text-[10px] font-black uppercase tracking-wider text-center"
                        >
                          <Clock size={12} />
                          S&apos;inscrire
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-center gap-4 mt-8">
                <button
                  onClick={() => handlePageChange(Math.max(0, pagination.offset - pagination.limit))}
                  disabled={pagination.offset === 0}
                  className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-800 transition-colors"
                  title="Page précédente"
                  aria-label="Page précédente"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-sm text-zinc-500">
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
          </>
        )}
      </div>

      {/* Modal des résultats */}
      {showModal && selectedTournament && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black">{selectedTournament.name}</h2>
                <p className="text-xs text-zinc-500">{formatDate(selectedTournament.date)}</p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 rounded-lg hover:bg-zinc-800 transition-colors"
                title="Fermer"
                aria-label="Fermer"
              >
                ✕
              </button>
            </div>
            <div className="p-5 overflow-y-auto max-h-[60vh]">
              <h3 className="text-sm font-black uppercase tracking-wider text-zinc-500 mb-4">
                Classement final
              </h3>
              <div className="space-y-2">
                {tournamentResults.map((result) => (
                  <div
                    key={result.id}
                    className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-xl"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 text-center">
                        {getMedalIcon(result.position)}
                      </div>
                      <span className="font-medium">{result.player_name}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-xs text-zinc-400">{formatPosition(result.position)}</span>
                      <span className="text-sm font-bold text-red-500">{result.points_gained} pts</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
