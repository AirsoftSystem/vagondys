
"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  MessageSquare,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  RefreshCcw,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Mail,
  Building2,
  Send
} from "lucide-react";

interface MessagerieRequest {
  id: string;
  full_name: string;
  email: string;
  company: string | null;
  phone: string | null;
  reason: string;
  status: "pending" | "approved" | "rejected";
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

interface GlobalRequestsStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
}

export default function AdminMessageriePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requests, setRequests] = useState<MessagerieRequest[]>([]);
  const [globalStats, setGlobalStats] = useState<GlobalRequestsStats>({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedRequest, setExpandedRequest] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<MessagerieRequest | null>(null);
  const [approveNotes, setApproveNotes] = useState("");

  // ✅ CORRECTION 1 : Charger les demandes depuis l'API réelle
  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/staff/messagerie-requests");
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Erreur chargement demandes");
      }
      
      const data = await response.json();
      const allRequests = data.requests || [];
      
      setRequests(allRequests);
      
      // Calculer les stats globales
      const stats: GlobalRequestsStats = {
        total: allRequests.length,
        pending: allRequests.filter((r: MessagerieRequest) => r.status === "pending").length,
        approved: allRequests.filter((r: MessagerieRequest) => r.status === "approved").length,
        rejected: allRequests.filter((r: MessagerieRequest) => r.status === "rejected").length
      };
      setGlobalStats(stats);
      
    } catch (err) {
      console.error("Erreur chargement demandes:", err);
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }, []);

  // Vérifier l'authentification admin
  useEffect(() => {
    const checkAuth = () => {
      const isAuthenticated = sessionStorage.getItem("admin_authenticated") === "true";
      if (!isAuthenticated) {
        router.push("/staff/admin/verification");
        return;
      }
      loadRequests();
    };
    checkAuth();
  }, [router, loadRequests]);

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
      case "pending":
        return <span className="text-[8px] text-yellow-500 bg-yellow-500/10 px-2 py-0.5 rounded-full border border-yellow-500/30 flex items-center gap-1">
          <Clock className="w-2.5 h-2.5" /> EN ATTENTE
        </span>;
      case "approved":
        return <span className="text-[8px] text-green-500 bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/30 flex items-center gap-1">
          <CheckCircle className="w-2.5 h-2.5" /> APPROUVÉE
        </span>;
      case "rejected":
        return <span className="text-[8px] text-red-500 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/30 flex items-center gap-1">
          <XCircle className="w-2.5 h-2.5" /> REJETÉE
        </span>;
      default:
        return null;
    }
  };

  // ✅ CORRECTION 2 : Approuver une demande avec appel API réel
  const handleApprove = async (request: MessagerieRequest) => {
    setProcessingId(request.id);
    try {
      const response = await fetch("/api/messagerie/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          requestId: request.id, 
          action: "approve",
          notes: approveNotes 
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Erreur lors de l'approbation");
      }
      
      // Recharger les demandes après approbation
      await loadRequests();
      
      setShowApproveModal(false);
      setSelectedRequest(null);
      setApproveNotes("");
      
    } catch (err) {
      console.error("Erreur approbation:", err);
      alert(err instanceof Error ? err.message : "Erreur lors de l'approbation");
    } finally {
      setProcessingId(null);
    }
  };

  // ✅ CORRECTION 3 : Rejeter une demande avec appel API réel
  const handleReject = async (request: MessagerieRequest) => {
    if (!confirm(`Refuser la demande de ${request.full_name} ?`)) return;
    
    setProcessingId(request.id);
    try {
      const response = await fetch("/api/messagerie/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          requestId: request.id, 
          action: "reject",
          notes: `Demande refusée par l'administrateur.`
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Erreur lors du rejet");
      }
      
      // Recharger les demandes après rejet
      await loadRequests();
      
    } catch (err) {
      console.error("Erreur rejet:", err);
      alert(err instanceof Error ? err.message : "Erreur lors du rejet");
    } finally {
      setProcessingId(null);
    }
  };

  const filteredRequests = requests.filter(request => {
    if (searchTerm && !request.full_name.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !request.email.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !(request.company || "").toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    if (filterStatus !== "all" && request.status !== filterStatus) {
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
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tighter">
            Demandes <span className="text-red-600">Messagerie</span>
          </h1>
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1">
            Gestion des demandes d&apos;accès à la messagerie privée
          </p>
        </div>
        <button
          onClick={loadRequests}
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-blue-500/10 rounded-xl">
              <MessageSquare className="w-5 h-5 text-blue-500" />
            </div>
            <span className="text-[8px] text-zinc-600 uppercase tracking-widest">Total</span>
          </div>
          <p className="text-2xl font-black text-white">{globalStats.total}</p>
        </div>

        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-yellow-500/10 rounded-xl">
              <Clock className="w-5 h-5 text-yellow-500" />
            </div>
            <span className="text-[8px] text-zinc-600 uppercase tracking-widest">En attente</span>
          </div>
          <p className="text-2xl font-black text-white">{globalStats.pending}</p>
        </div>

        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-green-500/10 rounded-xl">
              <CheckCircle className="w-5 h-5 text-green-500" />
            </div>
            <span className="text-[8px] text-zinc-600 uppercase tracking-widest">Approuvées</span>
          </div>
          <p className="text-2xl font-black text-white">{globalStats.approved}</p>
        </div>

        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-red-500/10 rounded-xl">
              <XCircle className="w-5 h-5 text-red-500" />
            </div>
            <span className="text-[8px] text-zinc-600 uppercase tracking-widest">Rejetées</span>
          </div>
          <p className="text-2xl font-black text-white">{globalStats.rejected}</p>
        </div>
      </div>

      {/* Filtres et recherche */}
      <div className="flex flex-wrap gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
          <input
            type="text"
            placeholder="Rechercher par nom, email ou société..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-red-600 outline-none transition-colors"
            title="Rechercher une demande"
            aria-label="Rechercher une demande"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white focus:border-red-600 outline-none cursor-pointer"
          title="Filtrer par statut"
          aria-label="Filtrer par statut"
        >
          <option value="all">Tous les statuts</option>
          <option value="pending">En attente</option>
          <option value="approved">Approuvées</option>
          <option value="rejected">Rejetées</option>
        </select>
        <button
          onClick={loadRequests}
          className="flex items-center gap-2 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
          title="Actualiser"
          aria-label="Actualiser"
        >
          <RefreshCcw className="w-4 h-4" />
          Actualiser
        </button>
      </div>

      {/* Tableau des demandes */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-zinc-800">
          <h2 className="text-sm font-black uppercase tracking-tighter">
            Liste des <span className="text-red-600">demandes</span>
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800 bg-black/30">
                <th className="text-left p-4 text-[9px] font-black uppercase tracking-widest text-zinc-500">Demandeur</th>
                <th className="text-left p-4 text-[9px] font-black uppercase tracking-widest text-zinc-500">Email</th>
                <th className="text-left p-4 text-[9px] font-black uppercase tracking-widest text-zinc-500">Société</th>
                <th className="text-left p-4 text-[9px] font-black uppercase tracking-widest text-zinc-500">Date</th>
                <th className="text-left p-4 text-[9px] font-black uppercase tracking-widest text-zinc-500">Statut</th>
                <th className="text-left p-4 text-[9px] font-black uppercase tracking-widest text-zinc-500"></th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map((request) => (
                <React.Fragment key={request.id}>
                  <tr className="border-b border-zinc-800/50 hover:bg-white/5 transition-colors cursor-pointer"
                      onClick={() => setExpandedRequest(expandedRequest === request.id ? null : request.id)}>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center">
                          <span className="text-xs font-black text-white">
                            {request.full_name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <span className="text-sm font-black text-white">{request.full_name}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <Mail className="w-3 h-3 text-zinc-500" />
                        <span className="text-xs text-zinc-400">{request.email}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-3 h-3 text-zinc-500" />
                        <span className="text-xs text-zinc-400">{request.company || "Non renseigné"}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="text-[10px] text-zinc-500">{formatDate(request.created_at)}</span>
                    </td>
                    <td className="p-4">
                      {getStatusBadge(request.status)}
                    </td>
                    <td className="p-4">
                      {expandedRequest === request.id ? (
                        <ChevronUp className="w-4 h-4 text-zinc-500" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-zinc-500" />
                      )}
                    </td>
                  </tr>
                  {expandedRequest === request.id && (
                    <tr className="bg-black/50">
                      <td colSpan={6} className="p-5">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div className="space-y-2">
                            <h4 className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Coordonnées</h4>
                            <p className="text-[10px] text-zinc-400">
                              <strong className="text-white">Nom complet:</strong> {request.full_name}
                            </p>
                            <p className="text-[10px] text-zinc-400">
                              <strong className="text-white">Email:</strong> {request.email}
                            </p>
                            <p className="text-[10px] text-zinc-400">
                              <strong className="text-white">Téléphone:</strong> {request.phone || "Non renseigné"}
                            </p>
                            <p className="text-[10px] text-zinc-400">
                              <strong className="text-white">Société:</strong> {request.company || "Non renseigné"}
                            </p>
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <h4 className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Motif de la demande</h4>
                            <div className="bg-black/50 p-3 rounded-xl border border-zinc-800">
                              <p className="text-[11px] text-zinc-300 leading-relaxed">
                                {request.reason}
                              </p>
                            </div>
                            {request.reviewed_by && (
                              <p className="text-[8px] text-zinc-600 mt-2">
                                Traitée par {request.reviewed_by} le {new Date(request.reviewed_at!).toLocaleDateString('fr-FR')}
                              </p>
                            )}
                          </div>
                        </div>
                        {request.status === "pending" && (
                          <div className="flex gap-3 mt-6 pt-4 border-t border-zinc-800">
                            <button
                              onClick={() => {
                                setSelectedRequest(request);
                                setShowApproveModal(true);
                              }}
                              disabled={processingId === request.id}
                              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                              Approuver
                            </button>
                            <button
                              onClick={() => handleReject(request)}
                              disabled={processingId === request.id}
                              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              Refuser
                            </button>
                          </div>
                        )}
                        {request.status !== "pending" && (
                          <div className="mt-6 pt-4 border-t border-zinc-800">
                            <p className="text-[8px] text-zinc-600 italic">
                              Cette demande a déjà été traitée.
                            </p>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal d'approbation */}
      {showApproveModal && selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/95 backdrop-blur-xl" onClick={() => setShowApproveModal(false)} />
          <div className="relative w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
              <h2 className="text-sm font-black uppercase tracking-tighter text-white">
                Approuver la <span className="text-red-600">demande</span>
              </h2>
              <button onClick={() => setShowApproveModal(false)} className="p-2 hover:bg-zinc-800 rounded-lg transition-colors">
                ✕
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-[10px] text-zinc-400">
                Vous allez approuver la demande de <strong className="text-white">{selectedRequest.full_name}</strong> ({selectedRequest.email}).
              </p>
              <p className="text-[10px] text-zinc-400">
                Un email de confirmation sera envoyé à l&apos;utilisateur avec un lien pour créer son mot de passe.
              </p>
              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500">
                  Notes internes (optionnel)
                </label>
                <textarea
                  value={approveNotes}
                  onChange={(e) => setApproveNotes(e.target.value)}
                  placeholder="Ajoutez une note pour l'équipe..."
                  rows={3}
                  className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:border-red-600 outline-none resize-none"
                  title="Notes internes"
                  aria-label="Notes internes"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => handleApprove(selectedRequest)}
                  disabled={processingId === selectedRequest.id}
                  className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
                >
                  {processingId === selectedRequest.id ? (
                    <RefreshCcw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  Confirmer l&apos;approbation
                </button>
                <button
                  onClick={() => setShowApproveModal(false)}
                  className="flex-1 bg-zinc-800 hover:bg-zinc-700 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
