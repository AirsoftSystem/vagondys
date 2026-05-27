
"use client";

import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  CreditCard,
  CheckCircle,
  XCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Search,
  Eye,
  Edit,
  Trash2,
  RefreshCcw
} from "lucide-react";
import Link from "next/link";

// ============================================================
// TYPES
// ============================================================
interface Reservation {
  id: string;
  reference: string;
  eventName: string;
  eventDate: string;
  timeSlot: string;
  location: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  participants: number;
  totalAmount: number;
  status: 'confirmed' | 'pending' | 'cancelled' | 'completed';
  createdAt: string;
  paid: boolean;
}

interface ReservationStats {
  total: number;
  confirmed: number;
  pending: number;
  completed: number;
  cancelled: number;
  revenue: number;
}

// ============================================================
// DONNÉES DE DÉMONSTRATION
// ============================================================
const DEMO_RESERVATIONS: Reservation[] = [
  {
    id: "1",
    reference: "VGD-8XK4M2P9",
    eventName: "AS-ELITE GRIND",
    eventDate: "2025-06-15",
    timeSlot: "14:30 - 16:00",
    location: "Complexe Sportif, Nantes",
    customerName: "Jean Dupont",
    customerEmail: "jean.dupont@email.com",
    customerPhone: "0612345678",
    participants: 1,
    totalAmount: 150,
    status: "confirmed",
    createdAt: "2025-05-20T10:30:00Z",
    paid: true
  },
  {
    id: "2",
    reference: "VGD-3H7J1N5M",
    eventName: "ULTIMATE MASTER SUPREME",
    eventDate: "2025-07-20",
    timeSlot: "10:00 - 11:30",
    location: "Palais des Sports, Paris",
    customerName: "Marie Martin",
    customerEmail: "marie.martin@email.com",
    customerPhone: "0698765432",
    participants: 2,
    totalAmount: 160,
    status: "pending",
    createdAt: "2025-05-21T14:15:00Z",
    paid: false
  },
  {
    id: "3",
    reference: "VGD-9L2K8R4T",
    eventName: "WORKSHOP PRÉCISION GBB",
    eventDate: "2025-05-10",
    timeSlot: "16:00 - 17:30",
    location: "Stand VAGONDYS, Nantes",
    customerName: "Pierre Durand",
    customerEmail: "pierre.durand@email.com",
    customerPhone: "0678901234",
    participants: 1,
    totalAmount: 45,
    status: "completed",
    createdAt: "2025-04-25T09:00:00Z",
    paid: true
  },
  {
    id: "4",
    reference: "VGD-5F6C9W1A",
    eventName: "AS-ELITE GRIND",
    eventDate: "2025-06-15",
    timeSlot: "19:00 - 20:30",
    location: "Complexe Sportif, Nantes",
    customerName: "Sophie Bernard",
    customerEmail: "sophie.bernard@email.com",
    customerPhone: "0645123789",
    participants: 3,
    totalAmount: 450,
    status: "confirmed",
    createdAt: "2025-05-22T16:45:00Z",
    paid: true
  },
  {
    id: "5",
    reference: "VGD-2E7B4Z8X",
    eventName: "WORKSHOP PRÉCISION GBB",
    eventDate: "2025-06-05",
    timeSlot: "13:00 - 14:30",
    location: "Stand VAGONDYS, Nantes",
    customerName: "Thomas Petit",
    customerEmail: "thomas.petit@email.com",
    customerPhone: "0789012345",
    participants: 2,
    totalAmount: 90,
    status: "cancelled",
    createdAt: "2025-05-10T11:20:00Z",
    paid: false
  }
];

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; borderColor: string }> = {
  confirmed: {
    label: "Confirmée",
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    borderColor: "border-green-500/30"
  },
  pending: {
    label: "En attente",
    color: "text-yellow-500",
    bgColor: "bg-yellow-500/10",
    borderColor: "border-yellow-500/30"
  },
  cancelled: {
    label: "Annulée",
    color: "text-red-500",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/30"
  },
  completed: {
    label: "Terminée",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/30"
  }
};

// ============================================================
// COMPOSANT PRINCIPAL
// ============================================================
export default function StaffReservationsPage() {
  const [reservations, setReservations] = useState<Reservation[]>(DEMO_RESERVATIONS);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [stats, setStats] = useState<ReservationStats>({
    total: 0,
    confirmed: 0,
    pending: 0,
    completed: 0,
    cancelled: 0,
    revenue: 0
  });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Calcul des statistiques
  useEffect(() => {
    const newStats: ReservationStats = {
      total: reservations.length,
      confirmed: reservations.filter(r => r.status === 'confirmed').length,
      pending: reservations.filter(r => r.status === 'pending').length,
      completed: reservations.filter(r => r.status === 'completed').length,
      cancelled: reservations.filter(r => r.status === 'cancelled').length,
      revenue: reservations.filter(r => r.status === 'confirmed' || r.status === 'completed')
        .reduce((sum, r) => sum + r.totalAmount, 0)
    };
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStats(newStats);
  }, [reservations]);

  // Filtrage
  const filteredReservations = reservations.filter(res => {
    if (searchTerm && !res.reference.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !res.customerName.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !res.customerEmail.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    if (selectedStatus !== "all" && res.status !== selectedStatus) {
      return false;
    }
    return true;
  });

  const totalPages = Math.ceil(filteredReservations.length / itemsPerPage);
  const paginatedReservations = filteredReservations.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Formatage de la date
  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatDateTime = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status: string) => {
    const config = STATUS_CONFIG[status];
    return (
      <span className={`text-[8px] font-black px-2 py-1 rounded-full border ${config.bgColor} ${config.color} ${config.borderColor}`}>
        {config.label}
      </span>
    );
  };

  const handleViewDetails = (reservation: Reservation) => {
    setSelectedReservation(reservation);
    setShowModal(true);
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    setReservations(prev => prev.map(r =>
      r.id === id ? { ...r, status: newStatus as Reservation['status'] } : r
    ));
  };

  const handleDelete = async (id: string) => {
    if (confirm("Supprimer définitivement cette réservation ?")) {
      setReservations(prev => prev.filter(r => r.id !== id));
    }
  };

  const handleRefresh = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
    }, 1000);
  };

  const statsCards = [
    { label: "Total", value: stats.total, icon: Calendar, color: "text-white", bgColor: "bg-zinc-800" },
    { label: "Confirmées", value: stats.confirmed, icon: CheckCircle, color: "text-green-500", bgColor: "bg-green-500/10" },
    { label: "En attente", value: stats.pending, icon: Clock, color: "text-yellow-500", bgColor: "bg-yellow-500/10" },
    { label: "Terminées", value: stats.completed, icon: CheckCircle, color: "text-blue-500", bgColor: "bg-blue-500/10" },
    { label: "Annulées", value: stats.cancelled, icon: XCircle, color: "text-red-500", bgColor: "bg-red-500/10" },
    { label: "CA (€)", value: `${stats.revenue.toLocaleString()}€`, icon: CreditCard, color: "text-red-600", bgColor: "bg-red-600/10" }
  ];

  return (
    <main className="min-h-screen bg-black text-white p-6 font-sans relative">

      {/* Navigation retour */}
      <div className="mb-8">
        <Link
          href="/staff"
          className="inline-flex items-center gap-2 text-zinc-500 hover:text-white transition-colors text-[10px] font-black uppercase tracking-widest"
        >
          <ChevronLeft size={14} /> Dashboard Staff
        </Link>
      </div>

      {/* En-tête */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tighter italic">
            Gestion des <span className="text-red-600">Réservations</span>
          </h1>
          <p className="text-zinc-500 text-[10px] uppercase tracking-widest mt-1">
            Consultez et gérez toutes les réservations
          </p>
        </div>
        <button
          onClick={handleRefresh}
          className="flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-[9px] font-black uppercase tracking-wider hover:bg-zinc-800 transition-all"
        >
          <RefreshCcw size={12} className={loading ? "animate-spin" : ""} />
          Actualiser
        </button>
      </div>

      {/* Cartes statistiques */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
        {statsCards.map((stat, idx) => (
          <div key={idx} className={`${stat.bgColor} border border-zinc-800 rounded-xl p-3 text-center`}>
            <stat.icon className={`w-4 h-4 ${stat.color} mx-auto mb-1`} />
            <p className="text-lg font-black text-white">{stat.value}</p>
            <p className="text-[7px] text-zinc-500 uppercase tracking-widest">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Filtres et recherche */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600" />
          <input
            type="text"
            placeholder="Rechercher par référence, nom ou email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:border-red-600 outline-none"
            aria-label="Rechercher une réservation"
          />
        </div>
        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-white focus:border-red-600 outline-none"
          aria-label="Filtrer par statut"
          title="Filtrer par statut"
        >
          <option value="all">Tous les statuts</option>
          <option value="confirmed">Confirmées</option>
          <option value="pending">En attente</option>
          <option value="completed">Terminées</option>
          <option value="cancelled">Annulées</option>
        </select>
      </div>

      {/* Tableau des réservations */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 text-red-600 animate-spin" />
        </div>
      ) : paginatedReservations.length === 0 ? (
        <div className="text-center py-20 border border-zinc-800 rounded-2xl bg-zinc-900/20">
          <Calendar className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
          <p className="text-zinc-500">Aucune réservation trouvée</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 text-left text-[9px] font-black uppercase tracking-widest text-zinc-500">
                  <th className="pb-3">Référence</th>
                  <th className="pb-3">Client</th>
                  <th className="pb-3">Événement</th>
                  <th className="pb-3">Date</th>
                  <th className="pb-3">Participants</th>
                  <th className="pb-3">Montant</th>
                  <th className="pb-3">Statut</th>
                  <th className="pb-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedReservations.map((res) => (
                  <tr key={res.id} className="border-b border-zinc-900 hover:bg-zinc-900/20 transition-colors">
                    <td className="py-3">
                      <p className="text-[10px] font-black font-mono text-red-500">{res.reference}</p>
                    </td>
                    <td className="py-3">
                      <p className="text-xs font-medium text-white">{res.customerName}</p>
                      <p className="text-[8px] text-zinc-500">{res.customerEmail}</p>
                    </td>
                    <td className="py-3">
                      <p className="text-[10px] font-bold uppercase">{res.eventName}</p>
                      <p className="text-[8px] text-zinc-500">{res.location}</p>
                    </td>
                    <td className="py-3">
                      <p className="text-[10px]">{formatDate(res.eventDate)}</p>
                      <p className="text-[8px] text-zinc-500">{res.timeSlot}</p>
                    </td>
                    <td className="py-3 text-center">
                      <span className="text-[10px]">{res.participants}</span>
                    </td>
                    <td className="py-3">
                      <p className="text-[10px] font-black text-red-500">{res.totalAmount}€</p>
                      {res.paid && <span className="text-[7px] text-green-500">Payé</span>}
                    </td>
                    <td className="py-3">
                      {getStatusBadge(res.status)}
                    </td>
                    <td className="py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleViewDetails(res)}
                          className="p-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
                          title="Voir les détails"
                          aria-label="Voir les détails"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(res.id, res.status === 'confirmed' ? 'completed' : 'confirmed')}
                          className="p-1.5 rounded-lg hover:bg-green-600/20 transition-colors"
                          title="Changer le statut"
                          aria-label="Changer le statut"
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(res.id)}
                          className="p-1.5 rounded-lg hover:bg-red-600/20 transition-colors"
                          title="Supprimer"
                          aria-label="Supprimer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 mt-8">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-800 transition-colors"
                aria-label="Page précédente"
                title="Page précédente"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-[10px] text-zinc-500">
                Page {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-800 transition-colors"
                aria-label="Page suivante"
                title="Page suivante"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      )}

      {/* Modal détails */}
      {showModal && selectedReservation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95 backdrop-blur-md" onClick={() => setShowModal(false)}>
          <div className="relative w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black uppercase tracking-tighter text-white">Détails de la réservation</h2>
                <p className="text-[10px] text-red-500 font-mono">{selectedReservation.reference}</p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 rounded-lg hover:bg-zinc-800 transition-colors" aria-label="Fermer">
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-[8px] text-zinc-500 uppercase tracking-widest">Client</p>
                  <p className="text-sm font-medium">{selectedReservation.customerName}</p>
                  <p className="text-xs text-zinc-400">{selectedReservation.customerEmail}</p>
                  <p className="text-xs text-zinc-400">{selectedReservation.customerPhone}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[8px] text-zinc-500 uppercase tracking-widest">Événement</p>
                  <p className="text-sm font-bold uppercase">{selectedReservation.eventName}</p>
                  <p className="text-xs text-zinc-400">{selectedReservation.location}</p>
                  <p className="text-xs text-zinc-400">{formatDate(selectedReservation.eventDate)} - {selectedReservation.timeSlot}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[8px] text-zinc-500 uppercase tracking-widest">Réservation</p>
                  <p className="text-xs">Participants: {selectedReservation.participants}</p>
                  <p className="text-xs">Montant: {selectedReservation.totalAmount}€</p>
                  <p className="text-xs">Créée le: {formatDateTime(selectedReservation.createdAt)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[8px] text-zinc-500 uppercase tracking-widest">Statut</p>
                  {getStatusBadge(selectedReservation.status)}
                  <p className="text-xs mt-1">Paiement: {selectedReservation.paid ? "✅ Effectué" : "⏳ En attente"}</p>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-zinc-800 flex gap-3 justify-end">
              <button
                onClick={() => handleUpdateStatus(selectedReservation.id, selectedReservation.status === 'confirmed' ? 'completed' : 'confirmed')}
                className="px-4 py-2 bg-green-600/20 border border-green-600/30 rounded-lg text-[10px] font-black uppercase text-green-500 hover:bg-green-600/30 transition-all"
                aria-label="Changer le statut"
              >
                Changer le statut
              </button>
              <button
                onClick={() => handleDelete(selectedReservation.id)}
                className="px-4 py-2 bg-red-600/20 border border-red-600/30 rounded-lg text-[10px] font-black uppercase text-red-500 hover:bg-red-600/30 transition-all"
                aria-label="Supprimer"
              >
                Supprimer
              </button>
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 bg-zinc-800 rounded-lg text-[10px] font-black uppercase hover:bg-zinc-700 transition-all"
                aria-label="Fermer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="mt-12 pt-6 border-t border-zinc-900 text-center">
        <p className="text-[8px] uppercase tracking-[0.4em] text-zinc-800">
          VAGONDYS OFFICIAL SYSTEM — GESTION DES RÉSERVATIONS
        </p>
      </footer>
    </main>
  );
}
