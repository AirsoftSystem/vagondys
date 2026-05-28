
/**
 * ==========================================================
 * PAGE PUBLIQUE TOURNOIS & CRÉNEAUX
 * ==========================================================
 * Affiche les tournois passés/à venir et les créneaux de réservation
 * Accessible à tous (public) - Staff peut modifier les créneaux
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Trophy,
  Calendar,
  MapPin,
  Users,
  Search,
  Filter,
  Clock,
  Medal,
  Star,
  Eye,
  Loader2,
  Plus,
  Edit,
  Trash2,
  X
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

// ============================================================
// TYPES
// ============================================================
type EventStatus = 'UPCOMING' | 'ONGOING' | 'FINISHED';
type TimeSlotStatus = 'available' | 'booked' | 'maintenance';

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
  status: EventStatus;
  winner_name?: string;
}

interface TournamentResult {
  id: string;
  tournament_name: string;
  player_name: string;
  position: number;
  points_gained: number;
}

interface TimeSlot {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  duration: number;
  status: TimeSlotStatus;
  booked_by?: string;
  booked_by_name?: string;
  price: number;
  max_participants: number;
  current_participants: number;
  is_recurring: boolean;
  city: string;
  country: string;
}

// ============================================================
// DONNÉES DE DÉMONSTRATION (TOURNOIS)
// ============================================================
const DEMO_TOURNAMENTS: Tournament[] = [
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

// ============================================================
// CONFIGURATION
// ============================================================
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

const TIME_SLOT_STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  'available': { label: 'Disponible', color: 'text-green-500', bgColor: 'bg-green-500/10' },
  'booked': { label: 'Réservé', color: 'text-red-500', bgColor: 'bg-red-500/10' },
  'maintenance': { label: 'Maintenance', color: 'text-yellow-500', bgColor: 'bg-yellow-500/10' },
};

const CITIES = [
  { code: 'NANTES', name: 'Nantes', country: 'FR' },
  { code: 'LYON', name: 'Lyon', country: 'FR' },
  { code: 'MADRID', name: 'Madrid', country: 'ES' },
  { code: 'BARCELONE', name: 'Barcelone', country: 'ES' },
];

const HOURS = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00'];

// ============================================================
// COMPOSANT PRINCIPAL
// ============================================================
export default function TournoisPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') as 'tournaments' | 'slots' | null;
  
  const [activeTab, setActiveTab] = useState<'tournaments' | 'slots'>(initialTab === 'slots' ? 'slots' : 'tournaments');
  
  // État pour les tournois
  const [tournaments] = useState<Tournament[]>(DEMO_TOURNAMENTS);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCity, setSelectedCity] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [tournamentResults, setTournamentResults] = useState<TournamentResult[]>([]);
  const [showModal, setShowModal] = useState(false);
  
  // État pour les créneaux (API réelle)
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [isStaff, setIsStaff] = useState(false);
  const [showSlotForm, setShowSlotForm] = useState(false);
  const [editingSlot, setEditingSlot] = useState<TimeSlot | null>(null);
  const [slotFormData, setSlotFormData] = useState({
    date: '',
    start_time: '10:00',
    end_time: '11:30',
    price: 25,
    max_participants: 4,
  });
  const [isSubmittingSlot, setIsSubmittingSlot] = useState(false);

  /**
   * Vérifier si l'utilisateur est staff
   */
  const checkStaffStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/check');
      if (response.ok) {
        const data = await response.json();
        setIsStaff(data.isStaff || false);
      }
    } catch {
      setIsStaff(false);
    }
  }, []);

  /**
   * Récupérer les créneaux depuis l'API
   */
  const fetchTimeSlots = useCallback(async () => {
    if (!selectedDate) return;
    
    setLoadingSlots(true);
    setSlotsError(null);
    
    try {
      const city = selectedCity !== 'all' ? selectedCity : 'NANTES';
      const response = await fetch(`/api/slots?date=${selectedDate}&city=${city}`);
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Erreur lors du chargement');
      }
      
      setTimeSlots(result.data || []);
    } catch (err) {
      console.error('Erreur chargement créneaux:', err);
      setSlotsError(err instanceof Error ? err.message : 'Erreur inconnue');
      setTimeSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }, [selectedDate, selectedCity]);

  /**
   * Créer un nouveau créneau
   */
  const createTimeSlot = async (data: typeof slotFormData) => {
    const city = selectedCity !== 'all' ? selectedCity : 'NANTES';
    
    const response = await fetch('/api/slots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: data.date,
        start_time: data.start_time,
        end_time: data.end_time,
        price: data.price,
        max_participants: data.max_participants,
        city: city,
      }),
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || 'Erreur lors de la création');
    }
    
    return result.data;
  };

  /**
   * Mettre à jour un créneau
   */
  const updateTimeSlot = async (id: string, data: Partial<typeof slotFormData>) => {
    const updateData: Record<string, unknown> = {};
    if (data.date !== undefined) updateData.date = data.date;
    if (data.start_time !== undefined) updateData.start_time = data.start_time;
    if (data.end_time !== undefined) updateData.end_time = data.end_time;
    if (data.price !== undefined) updateData.price = data.price;
    if (data.max_participants !== undefined) updateData.max_participants = data.max_participants;
    
    const response = await fetch(`/api/slots/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateData),
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || 'Erreur lors de la mise à jour');
    }
    
    return result.data;
  };

  /**
   * Supprimer un créneau
   */
  const deleteTimeSlot = async (id: string) => {
    const response = await fetch(`/api/slots/${id}`, {
      method: 'DELETE',
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || 'Erreur lors de la suppression');
    }
    
    return result;
  };

  // Effets
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    checkStaffStatus();
  }, [checkStaffStatus]);

  useEffect(() => {
    if (activeTab === 'slots') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchTimeSlots();
    }
  }, [activeTab, fetchTimeSlots]);

  // ============================================================
  // FONCTIONS TOURNOIS
  // ============================================================
  const filteredTournaments = tournaments.filter(t => {
    if (searchTerm && !t.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (selectedCity !== 'all' && t.city !== selectedCity) return false;
    if (selectedCategory !== 'all' && t.category !== selectedCategory) return false;
    if (selectedStatus !== 'all' && t.status !== selectedStatus) return false;
    return true;
  });

  const handleViewResults = (tournament: Tournament) => {
    setSelectedTournament(tournament);
    setTournamentResults([
      { id: '1', tournament_name: tournament.name, player_name: 'Jean Dupont', position: 1, points_gained: 100 },
      { id: '2', tournament_name: tournament.name, player_name: 'Marie Martin', position: 2, points_gained: 80 },
      { id: '3', tournament_name: tournament.name, player_name: 'Pierre Durand', position: 3, points_gained: 65 },
    ]);
    setShowModal(true);
  };

  const resetTournamentFilters = () => {
    setSelectedCity('all');
    setSelectedCategory('all');
    setSelectedStatus('all');
    setSearchTerm('');
  };

  // ============================================================
  // FONCTIONS CRÉNEAUX
  // ============================================================
  const getSlotsForHour = (hour: string): TimeSlot[] => {
    return timeSlots.filter(slot => slot.start_time === hour);
  };

  const handleAddSlot = () => {
    setEditingSlot(null);
    setSlotFormData({
      date: selectedDate,
      start_time: '10:00',
      end_time: '11:30',
      price: 25,
      max_participants: 4,
    });
    setShowSlotForm(true);
  };

  const handleEditSlot = (slot: TimeSlot) => {
    setEditingSlot(slot);
    setSlotFormData({
      date: slot.date,
      start_time: slot.start_time,
      end_time: slot.end_time,
      price: slot.price,
      max_participants: slot.max_participants,
    });
    setShowSlotForm(true);
  };

  const handleDeleteSlot = async (slotId: string) => {
    if (!confirm('Supprimer définitivement ce créneau ?')) return;
    
    try {
      await deleteTimeSlot(slotId);
      await fetchTimeSlots();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erreur lors de la suppression');
    }
  };

  const handleSubmitSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingSlot(true);
    
    try {
      if (editingSlot) {
        await updateTimeSlot(editingSlot.id, slotFormData);
      } else {
        await createTimeSlot(slotFormData);
      }
      setShowSlotForm(false);
      await fetchTimeSlots();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erreur lors de l\'enregistrement');
    } finally {
      setIsSubmittingSlot(false);
    }
  };

  const handleBookSlot = (slotId: string) => {
    const slot = timeSlots.find(s => s.id === slotId);
    if (!slot || slot.status !== 'available') return;
    
    router.push(`/reservations?slot=${slotId}&date=${selectedDate}`);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long' });
  };

  const getWeekDays = () => {
    const today = new Date();
    const days = [];
    for (let i = -3; i <= 3; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      days.push(date.toISOString().split('T')[0]);
    }
    return days;
  };

  const formatPosition = (position: number): string => position === 1 ? '1er' : `${position}ème`;
  
  const getMedalIcon = (position: number) => {
    if (position === 1) return <Medal className="w-4 h-4 text-yellow-500" />;
    if (position === 2) return <Medal className="w-4 h-4 text-gray-400" />;
    if (position === 3) return <Medal className="w-4 h-4 text-amber-600" />;
    return <Star className="w-4 h-4 text-zinc-500" />;
  };

  return (
    <main className="min-h-screen bg-black text-white pt-32 pb-20 px-4 md:px-6">
      <div className="max-w-7xl mx-auto">
        
        {/* ===== EN-TÊTE ===== */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter mb-4">
            Tournois & <span className="text-red-600">Créneaux</span>
          </h1>
          <p className="text-zinc-400 text-sm max-w-2xl mx-auto">
            Consultez les tournois officiels et réservez vos créneaux d&apos;entraînement
          </p>
        </div>

        {/* ===== ONGLETS ===== */}
        <div className="flex justify-center gap-4 mb-12 border-b border-zinc-800 pb-4">
          <button
            onClick={() => setActiveTab('tournaments')}
            className={`flex items-center gap-2 px-8 py-3 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
              activeTab === 'tournaments'
                ? 'bg-red-600 text-white shadow-lg shadow-red-900/20'
                : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
            }`}
            title="Afficher les tournois"
            aria-label="Afficher les tournois"
          >
            <Trophy size={14} />
            Tournois
          </button>
          <button
            onClick={() => setActiveTab('slots')}
            className={`flex items-center gap-2 px-8 py-3 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
              activeTab === 'slots'
                ? 'bg-red-600 text-white shadow-lg shadow-red-900/20'
                : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
            }`}
            title="Afficher les créneaux disponibles"
            aria-label="Afficher les créneaux disponibles"
          >
            <Calendar size={14} />
            Créneaux
          </button>
        </div>

        {/* ===== ONGLET TOURNOIS ===== */}
        {activeTab === 'tournaments' && (
          <>
            {/* Filtres */}
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
                    aria-label="Rechercher un tournoi"
                    title="Rechercher un tournoi"
                  />
                </div>
                <select
                  value={selectedCity}
                  onChange={(e) => setSelectedCity(e.target.value)}
                  className="bg-black border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:border-red-600 outline-none"
                  aria-label="Filtrer par ville"
                  title="Filtrer par ville"
                >
                  <option value="all">Toutes les villes</option>
                  {CITIES.map(city => <option key={city.code} value={city.code}>{city.name}</option>)}
                </select>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="bg-black border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:border-red-600 outline-none"
                  aria-label="Filtrer par catégorie"
                  title="Filtrer par catégorie"
                >
                  <option value="all">Toutes les catégories</option>
                  {Object.entries(CATEGORY_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </select>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="bg-black border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:border-red-600 outline-none"
                  aria-label="Filtrer par statut"
                  title="Filtrer par statut"
                >
                  <option value="all">Tous les statuts</option>
                  <option value="UPCOMING">À venir</option>
                  <option value="ONGOING">En cours</option>
                  <option value="FINISHED">Terminés</option>
                </select>
                <button onClick={resetTournamentFilters} className="px-4 py-2.5 rounded-xl bg-zinc-800 text-zinc-400 hover:text-white text-sm font-medium transition-colors" aria-label="Réinitialiser les filtres" title="Réinitialiser les filtres">
                  <Filter size={16} className="inline mr-1" /> Reset
                </button>
              </div>
            </div>

            {/* Liste des tournois */}
            {filteredTournaments.length === 0 ? (
              <div className="text-center py-20 border border-zinc-800 rounded-2xl bg-zinc-900/20">
                <Trophy className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
                <p className="text-zinc-500">Aucun tournoi trouvé</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredTournaments.map(t => (
                  <div key={t.id} className="bg-zinc-900/30 border border-zinc-800 rounded-2xl overflow-hidden hover:border-red-600/30 transition-all">
                    <div className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <span className={`text-[8px] font-black px-2 py-1 rounded-full border ${STATUS_COLORS[t.status]}`}>{STATUS_LABELS[t.status]}</span>
                        <span className={`text-[8px] font-black px-2 py-1 rounded-full border ${CATEGORY_BADGES[t.category]}`}>{CATEGORY_LABELS[t.category]?.split(' ')[0]}</span>
                      </div>
                      <h3 className="text-lg font-black mb-2">{t.name}</h3>
                      <div className="space-y-2 mb-4">
                        <div className="flex items-center gap-2 text-zinc-400 text-xs"><Calendar size={12} /><span>{new Date(t.date).toLocaleDateString('fr-FR')}</span></div>
                        <div className="flex items-center gap-2 text-zinc-400 text-xs"><MapPin size={12} /><span>{t.location}</span></div>
                        <div className="flex items-center gap-2 text-zinc-400 text-xs"><Users size={12} /><span>{t.players_count} / {t.max_players} inscrits</span></div>
                      </div>
                      {t.status === 'FINISHED' && t.winner_name && (
                        <div className="mb-4 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                          <p className="text-[9px] text-yellow-500 font-black">Vainqueur</p>
                          <p className="text-sm font-bold text-white">{t.winner_name}</p>
                        </div>
                      )}
                      <div className="flex gap-2 pt-2 border-t border-zinc-800">
                        {t.status === 'FINISHED' ? (
                          <button onClick={() => handleViewResults(t)} className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-red-600/10 text-red-500 hover:bg-red-600 hover:text-white transition-colors text-[10px] font-black" title="Voir les résultats" aria-label="Voir les résultats">
                            <Eye size={12} /> Résultats
                          </button>
                        ) : (
                          <Link href={`/reservations?tournament=${t.id}`} className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors text-[10px] font-black text-center" title="S'inscrire au tournoi" aria-label="S'inscrire au tournoi">
                            <Clock size={12} /> S&apos;inscrire
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ===== ONGLET CRÉNEAUX ===== */}
        {activeTab === 'slots' && (
          <>
            {/* Sélecteur de ville pour les créneaux */}
            <div className="mb-6 flex justify-end">
              <select
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-wider text-white focus:border-red-600 outline-none"
                aria-label="Filtrer par ville"
                title="Filtrer par ville"
              >
                <option value="all">Toutes les villes</option>
                {CITIES.map(city => <option key={city.code} value={city.code}>{city.name}</option>)}
              </select>
            </div>

            {/* Sélecteur de date */}
            <div className="flex flex-wrap gap-2 mb-8 justify-center">
              {getWeekDays().map(date => (
                <button
                  key={date}
                  onClick={() => setSelectedDate(date)}
                  className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
                    selectedDate === date ? 'bg-red-600 text-white' : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
                  }`}
                  title={`Sélectionner le ${formatDate(date)}`}
                  aria-label={`Sélectionner le ${formatDate(date)}`}
                >
                  {formatDate(date)}
                </button>
              ))}
            </div>

            {/* Bouton ajout créneau (staff uniquement) */}
            {isStaff && (
              <div className="flex justify-end mb-6">
                <button onClick={handleAddSlot} className="flex items-center gap-2 px-4 py-2 bg-green-600/20 border border-green-600/30 rounded-lg text-[10px] font-black text-green-500 hover:bg-green-600/30 transition-all" title="Ajouter un créneau" aria-label="Ajouter un créneau">
                  <Plus size={14} /> Ajouter un créneau
                </button>
              </div>
            )}

            {/* Grille des créneaux */}
            {loadingSlots ? (
              <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 text-red-600 animate-spin" /></div>
            ) : slotsError ? (
              <div className="text-center py-20 border border-red-600/30 rounded-2xl bg-red-600/5">
                <p className="text-red-500 text-sm">{slotsError}</p>
                <button onClick={fetchTimeSlots} className="mt-4 text-xs text-zinc-500 hover:text-white" title="Réessayer" aria-label="Réessayer">Réessayer</button>
              </div>
            ) : (
              <div className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-800 bg-zinc-900/50">
                        <th className="p-4 text-left text-[9px] font-black uppercase tracking-widest text-zinc-500 w-24">Horaire</th>
                        <th className="p-4 text-left text-[9px] font-black uppercase tracking-widest text-zinc-500">Créneau</th>
                        <th className="p-4 text-center text-[9px] font-black uppercase tracking-widest text-zinc-500 w-24">Prix</th>
                        <th className="p-4 text-center text-[9px] font-black uppercase tracking-widest text-zinc-500 w-28">Places</th>
                        <th className="p-4 text-center text-[9px] font-black uppercase tracking-widest text-zinc-500 w-24">Statut</th>
                        <th className="p-4 text-center text-[9px] font-black uppercase tracking-widest text-zinc-500 w-32">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {HOURS.map(hour => {
                        const slots = getSlotsForHour(hour);
                        return slots.length > 0 ? slots.map(slot => (
                          <tr key={slot.id} className="border-b border-zinc-800 hover:bg-zinc-900/20 transition-colors">
                            <td className="p-4 font-mono text-sm text-red-500 align-top">{slot.start_time}</td>
                            <td className="p-4">
                              <p className="text-sm font-medium text-white">{slot.start_time} - {slot.end_time}</p>
                              <p className="text-[8px] text-zinc-500 uppercase tracking-wider">Durée: {slot.duration} min</p>
                            </td>
                            <td className="p-4 text-center font-black text-red-500">{slot.price}€</td>
                            <td className="p-4 text-center">
                              <span className="text-sm font-black">{slot.current_participants}/{slot.max_participants}</span>
                            </td>
                            <td className="p-4 text-center">
                              <span className={`text-[8px] font-black px-2 py-1 rounded-full border ${TIME_SLOT_STATUS_CONFIG[slot.status].bgColor} ${TIME_SLOT_STATUS_CONFIG[slot.status].color}`}>
                                {TIME_SLOT_STATUS_CONFIG[slot.status].label}
                              </span>
                            </td>
                            <td className="p-4 text-center">
                              {isStaff ? (
                                <div className="flex gap-2 justify-center">
                                  <button onClick={() => handleEditSlot(slot)} className="p-1.5 rounded-lg hover:bg-zinc-800 transition-colors" title="Modifier le créneau" aria-label="Modifier le créneau"><Edit size={14} /></button>
                                  <button onClick={() => handleDeleteSlot(slot.id)} className="p-1.5 rounded-lg hover:bg-red-600/20 hover:text-red-500 transition-colors" title="Supprimer le créneau" aria-label="Supprimer le créneau"><Trash2 size={14} /></button>
                                </div>
                              ) : (
                                slot.status === 'available' && slot.current_participants < slot.max_participants ? (
                                  <button onClick={() => handleBookSlot(slot.id)} className="px-4 py-1.5 bg-red-600 text-white rounded-lg text-[9px] font-black uppercase tracking-wider hover:bg-white hover:text-black transition-all" title="Réserver ce créneau" aria-label="Réserver ce créneau">
                                    Réserver
                                  </button>
                                ) : (
                                  <span className="text-[8px] text-zinc-600 uppercase">Indisponible</span>
                                )
                              )}
                            </td>
                          </tr>
                        )) : null;
                      })}
                      {timeSlots.length === 0 && (
                        <tr><td colSpan={6} className="p-12 text-center text-zinc-500">Aucun créneau disponible pour cette date</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Modal ajout/modification créneau (staff) */}
            {showSlotForm && isStaff && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95 backdrop-blur-md" onClick={() => setShowSlotForm(false)}>
                <div className="relative w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                  <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
                    <h2 className="text-xl font-black uppercase tracking-tighter">{editingSlot ? 'Modifier le créneau' : 'Ajouter un créneau'}</h2>
                    <button onClick={() => setShowSlotForm(false)} className="p-2 rounded-lg hover:bg-zinc-800 transition-colors" title="Fermer" aria-label="Fermer"><X size={20} /></button>
                  </div>
                  <form onSubmit={handleSubmitSlot} className="p-6 space-y-4">
                    <div>
                      <label className="block text-[9px] font-black uppercase text-zinc-500 mb-1">Date</label>
                      <input type="date" value={slotFormData.date} onChange={e => setSlotFormData({ ...slotFormData, date: e.target.value })} className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-2 text-white focus:border-red-600 outline-none" required title="Date du créneau" aria-label="Date du créneau" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[9px] font-black uppercase text-zinc-500 mb-1">Début</label>
                        <input type="time" value={slotFormData.start_time} onChange={e => setSlotFormData({ ...slotFormData, start_time: e.target.value })} className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-2 text-white focus:border-red-600 outline-none" required title="Heure de début" aria-label="Heure de début" />
                      </div>
                      <div>
                        <label className="block text-[9px] font-black uppercase text-zinc-500 mb-1">Fin</label>
                        <input type="time" value={slotFormData.end_time} onChange={e => setSlotFormData({ ...slotFormData, end_time: e.target.value })} className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-2 text-white focus:border-red-600 outline-none" required title="Heure de fin" aria-label="Heure de fin" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[9px] font-black uppercase text-zinc-500 mb-1">Prix (€)</label>
                        <input type="number" min={0} max={200} value={slotFormData.price} onChange={e => setSlotFormData({ ...slotFormData, price: parseInt(e.target.value) })} className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-2 text-white focus:border-red-600 outline-none" required title="Prix du créneau" aria-label="Prix du créneau" />
                      </div>
                      <div>
                        <label className="block text-[9px] font-black uppercase text-zinc-500 mb-1">Places max</label>
                        <input type="number" min={1} max={20} value={slotFormData.max_participants} onChange={e => setSlotFormData({ ...slotFormData, max_participants: parseInt(e.target.value) })} className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-2 text-white focus:border-red-600 outline-none" required title="Nombre maximum de participants" aria-label="Nombre maximum de participants" />
                      </div>
                    </div>
                    <div className="flex gap-3 pt-4">
                      <button type="submit" disabled={isSubmittingSlot} className="flex-1 py-3 bg-red-600 text-white font-black rounded-xl hover:bg-white hover:text-black transition-all" title={editingSlot ? 'Enregistrer les modifications' : 'Créer le créneau'} aria-label={editingSlot ? 'Enregistrer les modifications' : 'Créer le créneau'}>
                        {isSubmittingSlot ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : (editingSlot ? 'Enregistrer' : 'Créer')}
                      </button>
                      <button type="button" onClick={() => setShowSlotForm(false)} className="flex-1 py-3 bg-zinc-800 text-white font-black rounded-xl hover:bg-zinc-700 transition-all" title="Annuler" aria-label="Annuler">Annuler</button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal résultats tournoi */}
      {showModal && selectedTournament && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95 backdrop-blur-md" onClick={() => setShowModal(false)}>
          <div className="relative w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
              <div><h2 className="text-xl font-black uppercase tracking-tighter">{selectedTournament.name}</h2><p className="text-xs text-zinc-500">{new Date(selectedTournament.date).toLocaleDateString('fr-FR')}</p></div>
              <button onClick={() => setShowModal(false)} className="p-2 rounded-lg hover:bg-zinc-800 transition-colors" title="Fermer" aria-label="Fermer"><X size={20} /></button>
            </div>
            <div className="p-6">
              <h3 className="text-sm font-black uppercase tracking-wider text-zinc-500 mb-4">Classement final</h3>
              <div className="space-y-2">
                {tournamentResults.map(result => (
                  <div key={result.id} className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-xl">
                    <div className="flex items-center gap-3"><div className="w-8 text-center">{getMedalIcon(result.position)}</div><span className="font-medium">{result.player_name}</span></div>
                    <div className="flex items-center gap-4"><span className="text-xs text-zinc-400">{formatPosition(result.position)}</span><span className="text-sm font-bold text-red-500">{result.points_gained} pts</span></div>
                  </div>
                ))}
              </div>
              <button onClick={() => setShowModal(false)} className="w-full mt-6 py-3 bg-red-600 text-white font-black rounded-xl hover:bg-white hover:text-black transition-all" title="Fermer" aria-label="Fermer">Fermer</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
