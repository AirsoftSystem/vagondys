
/**
 * ==========================================================
 * PAGE STAFF COMPETITIONS
 * ==========================================================
 * Gestion des compétitions (tournois) pour le staff
 * Accessible uniquement aux membres du staff
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Trophy,
  Users,
  Plus,
  Edit,
  Trash2,
  Save,
  X,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Search,
  Filter
} from 'lucide-react';
import { useRouter } from 'next/navigation';

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
  registration_deadline: string;
  fee: number;
  description?: string;
  winner_id?: string;
  winner_name?: string;
  created_at: string;
}

interface TournamentFormData {
  name: string;
  date: string;
  location: string;
  city: string;
  country: string;
  category: string;
  max_players: number;
  registration_deadline: string;
  fee: number;
  description: string;
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

const CATEGORY_OPTIONS = [
  { value: 'LOCAL', label: 'Tournoi Local' },
  { value: 'REGIONAL', label: 'Tournoi Régional' },
  { value: 'NATIONAL', label: 'Tournoi National' },
  { value: 'INTERNATIONAL', label: 'Tournoi International' },
  { value: 'MASTER', label: 'Master Series' },
  { value: 'CHALLENGER', label: 'Challenger Series' },
];

const STATUS_COLORS: Record<string, string> = {
  'UPCOMING': 'text-blue-500 bg-blue-500/10 border-blue-500/20',
  'ONGOING': 'text-green-500 bg-green-500/10 border-green-500/20',
  'FINISHED': 'text-zinc-500 bg-zinc-500/10 border-zinc-500/20',
};

// Villes disponibles
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
      registration_deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      fee: 20,
      created_at: new Date().toISOString(),
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
      registration_deadline: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString(),
      fee: 50,
      winner_name: 'Jean Dupont',
      created_at: new Date().toISOString(),
    },
  ];
};

export default function StaffCompetitionsPage() {
  const router = useRouter();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCity, setSelectedCity] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [editingTournament, setEditingTournament] = useState<Tournament | null>(null);
  const [formData, setFormData] = useState<TournamentFormData>({
    name: '',
    date: '',
    location: '',
    city: 'NANTES',
    country: 'FR',
    category: 'LOCAL',
    max_players: 32,
    registration_deadline: '',
    fee: 0,
    description: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    limit: 10,
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
      let url = `/api/staff/tournaments/list?limit=${pagination.limit}&offset=${pagination.offset}`;

      if (selectedCity !== 'all') {
        url += `&city=${selectedCity}`;
      }
      if (selectedStatus !== 'all') {
        url += `&status=${selectedStatus}`;
      }
      if (searchTerm) {
        url += `&search=${encodeURIComponent(searchTerm)}`;
      }

      const response = await fetch(url);
      const result = await response.json();

      if (!response.ok) {
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
      // Données de démonstration
      setTournaments(getDemoTournaments());
    } finally {
      setLoading(false);
    }
  }, [pagination.limit, pagination.offset, selectedCity, selectedStatus, searchTerm]);

  /**
   * Crée ou met à jour un tournoi
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);

    try {
      const url = editingTournament
        ? `/api/staff/tournaments/${editingTournament.id}`
        : '/api/staff/tournaments/create';
      
      const method = editingTournament ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Erreur lors de la sauvegarde');
      }
      
      setShowForm(false);
      setEditingTournament(null);
      resetForm();
      fetchTournaments();
      
    } catch (err) {
      console.error('Erreur sauvegarde:', err);
      setFormError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * Supprime un tournoi
   */
  const handleDelete = async (tournament: Tournament) => {
    if (!confirm(`Supprimer définitivement le tournoi "${tournament.name}" ?`)) {
      return;
    }
    
    try {
      const response = await fetch(`/api/staff/tournaments/${tournament.id}`, {
        method: 'DELETE',
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Erreur lors de la suppression');
      }
      
      fetchTournaments();
      
    } catch (err) {
      console.error('Erreur suppression:', err);
      alert(err instanceof Error ? err.message : 'Erreur inconnue');
    }
  };

  /**
   * Ouvre le formulaire d'édition
   */
  const handleEdit = (tournament: Tournament) => {
    setEditingTournament(tournament);
    setFormData({
      name: tournament.name,
      date: tournament.date.split('T')[0],
      location: tournament.location,
      city: tournament.city,
      country: tournament.country,
      category: tournament.category,
      max_players: tournament.max_players,
      registration_deadline: tournament.registration_deadline.split('T')[0],
      fee: tournament.fee,
      description: tournament.description || '',
    });
    setShowForm(true);
  };

  /**
   * Réinitialise le formulaire
   */
  const resetForm = () => {
    setFormData({
      name: '',
      date: '',
      location: '',
      city: 'NANTES',
      country: 'FR',
      category: 'LOCAL',
      max_players: 32,
      registration_deadline: '',
      fee: 0,
      description: '',
    });
    setFormError(null);
  };

  /**
   * Change le statut d'un tournoi
   */
  const handleStatusChange = async (tournament: Tournament, newStatus: string) => {
    try {
      const response = await fetch(`/api/staff/tournaments/${tournament.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Erreur lors du changement de statut');
      }
      
      fetchTournaments();
      
    } catch (err) {
      console.error('Erreur changement statut:', err);
      alert(err instanceof Error ? err.message : 'Erreur inconnue');
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchTournaments();
  }, [fetchTournaments]);

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

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* En-tête */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tighter">
              Gestion des <span className="text-red-600">Compétitions</span>
            </h1>
            <p className="text-zinc-400 text-sm mt-1">
              Créez, modifiez et gérez les tournois de votre ligue
            </p>
          </div>
          <button
            onClick={() => {
              setEditingTournament(null);
              resetForm();
              setShowForm(true);
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 transition-colors text-sm font-bold"
            title="Créer un tournoi"
            aria-label="Créer un tournoi"
          >
            <Plus size={16} />
            Nouveau tournoi
          </button>
        </div>

        {/* Barre de recherche et filtres */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 mb-8">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                placeholder="Rechercher un tournoi..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-black border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-red-600 outline-none"
                title="Rechercher un tournoi"
                aria-label="Rechercher un tournoi"
              />
            </div>
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
            <button
              onClick={() => {
                setEditingTournament(null);
                resetForm();
                setShowForm(true);
              }}
              className="mt-4 text-sm text-red-500 hover:text-red-400"
              title="Créer un tournoi"
              aria-label="Créer un tournoi"
            >
              Créer votre premier tournoi
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-zinc-800">
                  <tr className="text-left text-xs text-zinc-500 uppercase tracking-wider">
                    <th className="pb-3">Nom</th>
                    <th className="pb-3">Date</th>
                    <th className="pb-3">Lieu</th>
                    <th className="pb-3">Catégorie</th>
                    <th className="pb-3">Inscrits</th>
                    <th className="pb-3">Statut</th>
                    <th className="pb-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tournaments.map((tournament) => (
                    <tr key={tournament.id} className="border-b border-zinc-800/50">
                      <td className="py-3">
                        <div>
                          <p className="font-medium">{tournament.name}</p>
                          <p className="text-xs text-zinc-500">{tournament.fee}€</p>
                        </div>
                      </td>
                      <td className="py-3 text-sm">{formatDate(tournament.date)}</td>
                      <td className="py-3 text-sm">{tournament.location}</td>
                      <td className="py-3">
                        <span className="text-xs px-2 py-1 rounded-full bg-zinc-800 text-zinc-300">
                          {CATEGORY_LABELS[tournament.category]?.split(' ')[0]}
                        </span>
                      </td>
                      <td className="py-3 text-sm">
                        {tournament.players_count} / {tournament.max_players}
                       </td>
                      <td className="py-3">
                        <select
                          value={tournament.status}
                          onChange={(e) => handleStatusChange(tournament, e.target.value)}
                          className={`text-xs px-2 py-1 rounded-full border ${STATUS_COLORS[tournament.status]} bg-transparent`}
                          title="Changer le statut"
                          aria-label="Changer le statut"
                        >
                          <option value="UPCOMING">À venir</option>
                          <option value="ONGOING">En cours</option>
                          <option value="FINISHED">Terminé</option>
                        </select>
                       </td>
                      <td className="py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEdit(tournament)}
                            className="p-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
                            title="Modifier"
                            aria-label="Modifier"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(tournament)}
                            className="p-1.5 rounded-lg hover:bg-red-600/20 hover:text-red-500 transition-colors"
                            title="Supprimer"
                            aria-label="Supprimer"
                          >
                            <Trash2 size={16} />
                          </button>
                          <button
                            onClick={() => router.push(`/staff/competitions/${tournament.id}/players`)}
                            className="p-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
                            title="Gérer les inscrits"
                            aria-label="Gérer les inscrits"
                          >
                            <Users size={16} />
                          </button>
                        </div>
                       </td>
                    </tr>
                  ))}
                </tbody>
               </table>
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

      {/* Modal Formulaire */}
      {showForm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-zinc-800 flex items-center justify-between sticky top-0 bg-zinc-900">
              <h2 className="text-xl font-black">
                {editingTournament ? 'Modifier le tournoi' : 'Nouveau tournoi'}
              </h2>
              <button
                onClick={() => {
                  setShowForm(false);
                  setEditingTournament(null);
                  resetForm();
                }}
                className="p-2 rounded-lg hover:bg-zinc-800 transition-colors"
                title="Fermer"
                aria-label="Fermer"
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-5 space-y-5">
              {formError && (
                <div className="p-3 bg-red-600/20 border border-red-600 rounded-xl text-red-500 text-sm">
                  {formError}
                </div>
              )}
              
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-zinc-400 mb-1">
                  Nom du tournoi *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-2 text-white focus:border-red-600 outline-none"
                  required
                  title="Nom du tournoi"
                  aria-label="Nom du tournoi"
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-zinc-400 mb-1">
                    Date *
                  </label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-2 text-white focus:border-red-600 outline-none"
                    required
                    title="Date du tournoi"
                    aria-label="Date du tournoi"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-zinc-400 mb-1">
                    Date limite d&apos;inscription *
                  </label>
                  <input
                    type="date"
                    value={formData.registration_deadline}
                    onChange={(e) => setFormData({ ...formData, registration_deadline: e.target.value })}
                    className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-2 text-white focus:border-red-600 outline-none"
                    required
                    title="Date limite d'inscription"
                    aria-label="Date limite d'inscription"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-zinc-400 mb-1">
                  Lieu *
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-2 text-white focus:border-red-600 outline-none"
                  required
                  title="Lieu du tournoi"
                  aria-label="Lieu du tournoi"
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-zinc-400 mb-1">
                    Ville *
                  </label>
                  <select
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-2 text-white focus:border-red-600 outline-none"
                    required
                    title="Ville"
                    aria-label="Ville"
                  >
                    {CITIES.map(city => (
                      <option key={city.code} value={city.code}>{city.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-zinc-400 mb-1">
                    Catégorie *
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-2 text-white focus:border-red-600 outline-none"
                    required
                    title="Catégorie"
                    aria-label="Catégorie"
                  >
                    {CATEGORY_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-zinc-400 mb-1">
                    Nombre max de joueurs *
                  </label>
                  <input
                    type="number"
                    min={2}
                    max={128}
                    value={formData.max_players}
                    onChange={(e) => setFormData({ ...formData, max_players: parseInt(e.target.value) })}
                    className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-2 text-white focus:border-red-600 outline-none"
                    required
                    title="Nombre maximum de joueurs"
                    aria-label="Nombre maximum de joueurs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-zinc-400 mb-1">
                    Frais d&apos;inscription (€)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={1000}
                    value={formData.fee}
                    onChange={(e) => setFormData({ ...formData, fee: parseInt(e.target.value) })}
                    className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-2 text-white focus:border-red-600 outline-none"
                    title="Frais d'inscription"
                    aria-label="Frais d'inscription"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-zinc-400 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={4}
                  className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-2 text-white focus:border-red-600 outline-none resize-none"
                  title="Description du tournoi"
                  aria-label="Description du tournoi"
                />
              </div>
              
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 transition-colors font-bold disabled:opacity-50"
                  title={editingTournament ? 'Enregistrer les modifications' : 'Créer le tournoi'}
                  aria-label={editingTournament ? 'Enregistrer les modifications' : 'Créer le tournoi'}
                >
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  {editingTournament ? 'Enregistrer' : 'Créer'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingTournament(null);
                    resetForm();
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 transition-colors font-bold"
                  title="Annuler"
                  aria-label="Annuler"
                >
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
