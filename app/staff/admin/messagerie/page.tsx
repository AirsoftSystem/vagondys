
"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
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
  Send,
  FileText,
  Trash2,
  RotateCcw,
  Eye,
  Maximize2,
  Minimize2,
  DatabaseBackup,
  UserCircle,
  Users
} from "lucide-react";

// ✅ INTERFACE ÉTENDUE avec les champs KBis et messages
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
  dossier_ref?: string | null;
  city?: string | null;
  // ✅ AJOUT : Champs KBis
  kbis_url?: string | null;
  kbis_key?: string | null;
  kbis_validated?: boolean;
  kbis_scan_result?: {
    safe: boolean;
    virusDetected?: boolean;
    isAuthentic?: boolean;
    confidence?: number;
  } | null;
  // ✅ NOUVEAUX CHAMPS
  account_status?: "active" | "inactive" | "suspended" | "not_created";
  is_online?: boolean;
  // ✅ AJOUT : Type de messagerie (partenaire ou joueur)
  type?: "partner" | "player";
  // ✅ AJOUT : Dernier message
  last_message?: string;
  last_message_date?: string;
}

interface GlobalRequestsStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
}

// ✅ Interface pour un message dans le fil de discussion
interface ConversationMessage {
  id: string;
  content: string;
  created_at: string;
  sender_email: string;
  sender_name: string;
  is_staff: boolean;
  file_url?: string | null;
}

// ✅ Interface pour les réponses staff
interface StaffReply {
  id: string;
  created_at: string;
  agent_email: string;
  content: string;
  dossier_ref: string;
  document_url?: string | null;
}

// Interface pour les données brutes de l'API (remplacement de any)
interface StaffReplyRaw {
  id: string;
  created_at: string;
  agent_email: string;
  content: string;
  dossier_ref: string;
  document_url?: string | null;
}

// ✅ FONCTION DE FORMATAGE DE DATE
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

// ✅ FONCTION POUR LE BADGE DE STATUT DE LA DEMANDE
function getStatusBadge(status: "pending" | "approved" | "rejected") {
  switch (status) {
    case "approved":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-green-600/20 border border-green-600/30">
          <CheckCircle className="w-3 h-3 text-green-500" />
          <span className="text-[8px] font-black uppercase tracking-widest text-green-500">Approuvée</span>
        </span>
      );
    case "rejected":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-red-600/20 border border-red-600/30">
          <XCircle className="w-3 h-3 text-red-500" />
          <span className="text-[8px] font-black uppercase tracking-widest text-red-500">Rejetée</span>
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-yellow-600/20 border border-yellow-600/30">
          <Clock className="w-3 h-3 text-yellow-500" />
          <span className="text-[8px] font-black uppercase tracking-widest text-yellow-500">En attente</span>
        </span>
      );
  }
}

// ❌ SUPPRESSION : getAccountStatusBadge n'est plus utilisée
// La colonne "Compte" a été remplacée par "Dernier message"

// ✅ FONCTION POUR LE BADGE DE TYPE
function getTypeBadge(type?: string) {
  if (type === "player") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-600/20 border border-blue-600/30">
        <UserCircle className="w-3 h-3 text-blue-500" />
        <span className="text-[8px] font-black uppercase tracking-widest text-blue-500">Joueur</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-purple-600/20 border border-purple-600/30">
      <Building2 className="w-3 h-3 text-purple-500" />
      <span className="text-[8px] font-black uppercase tracking-widest text-purple-500">Partenaire</span>
    </span>
  );
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
  const [filterType, setFilterType] = useState<string>("all");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<MessagerieRequest | null>(null);
  const [approveNotes, setApproveNotes] = useState("");
  
  // ✅ ÉTATS POUR LE FIL DE DISCUSSION
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [replyContent, setReplyContent] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  
  // ✅ ÉTAT POUR LE MODAL D'EXPANSION
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalDossierRef, setModalDossierRef] = useState<string | null>(null);
  const [modalMessages, setModalMessages] = useState<ConversationMessage[]>([]);
  const [modalReplyContent, setModalReplyContent] = useState("");
  const [modalSendingReply, setModalSendingReply] = useState(false);

  // ✅ ÉTATS POUR L'ARCHIVAGE GITHUB
  const [searchGitHubRef, setSearchGitHubRef] = useState("");
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoringRef, setRestoringRef] = useState<string | null>(null);

  // ✅ Ref pour éviter les appels multiples
  const hasLoadedRef = useRef(false);

  // ✅ Charger les conversations depuis messagerie_accounts + messagerie_messages
  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/staff/messagerie-requests");
      
      if (!response.ok) {
        if (response.status === 401) {
          router.push("/staff/admin/verification");
          return;
        }
        const errorData = await response.json();
        throw new Error(errorData.error || "Erreur chargement conversations");
      }
      
      const data = await response.json();
      const allRequests = data.requests || [];
      
      setRequests(allRequests);
      
      const stats: GlobalRequestsStats = {
        total: allRequests.length,
        pending: allRequests.filter((r: MessagerieRequest) => r.status === "pending").length,
        approved: allRequests.filter((r: MessagerieRequest) => r.status === "approved").length,
        rejected: allRequests.filter((r: MessagerieRequest) => r.status === "rejected").length
      };
      setGlobalStats(stats);
      
    } catch (err) {
      console.error("Erreur chargement conversations:", err);
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }, [router]);

  // ✅ AJOUT : Vérification de l'authentification admin
  useEffect(() => {
    const isAuthenticated = sessionStorage.getItem("admin_authenticated") === "true";
    if (!isAuthenticated) {
      router.push("/staff/admin/verification");
    }
  }, [router]);

  // ✅ AJOUT : Chargement des données
  useEffect(() => {
    if (hasLoadedRef.current) return;
    const isAuthenticated = sessionStorage.getItem("admin_authenticated") === "true";
    if (isAuthenticated) {
      hasLoadedRef.current = true;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadRequests();
    }
  }, [loadRequests]);

  // ✅ AJOUT : Rechargement automatique quand la page devient visible (retour de set-password)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        // Recharger les données quand l'utilisateur revient sur l'onglet
        loadRequests();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [loadRequests]);

  // ✅ RÉCUPÉRER LES RÉPONSES STAFF (communication_replies)
  const getStaffReplies = async (dossierRef: string): Promise<StaffReply[]> => {
    try {
      const response = await fetch(`/api/staff/history?ref=${encodeURIComponent(dossierRef)}`);
      if (response.ok) {
        const data = await response.json();
        return (data.history || []).map((h: StaffReplyRaw) => ({
          id: h.id,
          created_at: h.created_at,
          agent_email: h.agent_email,
          content: h.content,
          dossier_ref: dossierRef,
          document_url: h.document_url || null
        }));
      }
    } catch (err) {
      console.warn("Erreur récupération réponses staff:", err);
    }
    return [];
  };

  // ✅ CHARGER LES MESSAGES D'UNE CONVERSATION (via dossierRef)
  const loadConversationMessages = useCallback(async (dossierRef: string) => {
    if (!dossierRef) return;
    
    setLoadingMessages(true);
    try {
      const messagesResponse = await fetch(`/api/messagerie/messages?dossierRef=${encodeURIComponent(dossierRef)}`);
      if (messagesResponse.ok) {
        const messagesData = await messagesResponse.json();
        const formattedMessages = (messagesData.messages || []).map((msg: ConversationMessage) => ({
          ...msg,
          is_staff: msg.sender_email?.endsWith("@vagondys.com") || false
        }));
        setMessages(formattedMessages);
      } else {
        setMessages([]);
      }
    } catch (err) {
      console.error("Erreur chargement messages:", err);
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  // ✅ ENVOYER UNE RÉPONSE (staff → partenaire ou joueur) via dossierRef
  const handleSendReply = async () => {
    if (!selectedRequest || !replyContent.trim() || !selectedRequest.dossier_ref) return;
    
    setSendingReply(true);
    try {
      const sendResponse = await fetch("/api/messagerie/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dossierRef: selectedRequest.dossier_ref,
          content: replyContent.trim(),
          senderType: selectedRequest.type === "player" ? "staff-to-player" : "staff-to-partner",
        }),
      });
      
      if (!sendResponse.ok) throw new Error("Erreur envoi message");
      
      await loadConversationMessages(selectedRequest.dossier_ref);
      setReplyContent("");
      
    } catch (err) {
      console.error("Erreur envoi réponse:", err);
      alert("Erreur lors de l'envoi de la réponse");
    } finally {
      setSendingReply(false);
    }
  };

  // ✅ ENVOYER UNE RÉPONSE DEPUIS LE MODAL (via dossierRef)
  const handleModalSendReply = async () => {
    if (!selectedRequest || !modalReplyContent.trim() || !modalDossierRef) return;
    
    setModalSendingReply(true);
    try {
      const sendResponse = await fetch("/api/messagerie/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dossierRef: modalDossierRef,
          content: modalReplyContent.trim(),
          senderType: selectedRequest.type === "player" ? "staff-to-player" : "staff-to-partner",
        }),
      });
      
      if (!sendResponse.ok) throw new Error("Erreur envoi message");
      
      const messagesResponse = await fetch(`/api/messagerie/messages?dossierRef=${encodeURIComponent(modalDossierRef)}`);
      if (messagesResponse.ok) {
        const messagesData = await messagesResponse.json();
        const formattedMessages = (messagesData.messages || []).map((msg: ConversationMessage) => ({
          ...msg,
          is_staff: msg.sender_email?.endsWith("@vagondys.com") || false
        }));
        setModalMessages(formattedMessages);
      }
      
      await loadConversationMessages(modalDossierRef);
      setModalReplyContent("");
      
    } catch (err) {
      console.error("Erreur envoi réponse modal:", err);
      alert("Erreur lors de l'envoi de la réponse");
    } finally {
      setModalSendingReply(false);
    }
  };

  // ✅ OUVRIR LE MODAL D'EXPANSION (via dossierRef)
  const openExpandedModal = async (request: MessagerieRequest) => {
    if (!request.dossier_ref) {
      alert("Ce dossier n'a pas encore de référence.");
      return;
    }
    
    setSelectedRequest(request);
    setIsModalOpen(true);
    setModalReplyContent("");
    setModalDossierRef(request.dossier_ref);
    
    try {
      const messagesResponse = await fetch(`/api/messagerie/messages?dossierRef=${encodeURIComponent(request.dossier_ref)}`);
      if (messagesResponse.ok) {
        const messagesData = await messagesResponse.json();
        const formattedMessages = (messagesData.messages || []).map((msg: ConversationMessage) => ({
          ...msg,
          is_staff: msg.sender_email?.endsWith("@vagondys.com") || false
        }));
        setModalMessages(formattedMessages);
      } else {
        setModalMessages([]);
      }
    } catch (err) {
      console.error("Erreur chargement messages modal:", err);
      setModalMessages([]);
    }
  };

  // ✅ FERMER LE MODAL
  const closeExpandedModal = () => {
    setIsModalOpen(false);
    setModalDossierRef(null);
    setModalMessages([]);
    setModalReplyContent("");
  };

  // ✅ SUPPRIMER UNE DEMANDE
  const handleDelete = async (request: MessagerieRequest) => {
    if (!confirm(`Supprimer définitivement la demande de ${request.full_name} ? Cette action est irréversible.`)) return;
    
    setProcessingId(request.id);
    try {
      const response = await fetch(`/api/messagerie/request?id=${request.id}`, {
        method: "DELETE",
      });
      
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Erreur lors de la suppression");
      }
      
      await loadRequests();
      
    } catch (err) {
      console.error("Erreur suppression:", err);
      alert(err instanceof Error ? err.message : "Erreur lors de la suppression");
    } finally {
      setProcessingId(null);
    }
  };

  // ✅ RÉOUVRIR UNE DEMANDE (remettre en attente)
  const handleReopen = async (request: MessagerieRequest) => {
    if (!confirm(`Remettre la demande de ${request.full_name} en attente ?`)) return;
    
    setProcessingId(request.id);
    try {
      const response = await fetch("/api/messagerie/request/reopen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: request.id }),
      });
      
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Erreur lors de la réouverture");
      }
      
      await loadRequests();
      
    } catch (err) {
      console.error("Erreur réouverture:", err);
      alert(err instanceof Error ? err.message : "Erreur lors de la réouverture");
    } finally {
      setProcessingId(null);
    }
  };

  // Approuver une demande
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

  // Rejeter une demande
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
      
      await loadRequests();
      
    } catch (err) {
      console.error("Erreur rejet:", err);
      alert(err instanceof Error ? err.message : "Erreur lors du rejet");
    } finally {
      setProcessingId(null);
    }
  };

  // ✅ ARCHIVAGE VERS GITHUB (Coffre-Fort) - VERSION CORRIGÉE avec dossierRef
  const handleArchiveToGitHub = async (request: MessagerieRequest) => {
    if (!request.dossier_ref) {
      alert("Ce dossier n'a pas encore de référence. Approuvez-le d'abord.");
      return;
    }
    
    if (!confirm(`Archiver ${request.dossier_ref} vers le Coffre-Fort GitHub et purger les données locales ? Cette action est irréversible.`)) return;
    
    setProcessingId(request.id);
    try {
      // 1. Récupérer les messages de la conversation via dossierRef
      let conversationMessages: ConversationMessage[] = [];
      
      const messagesResponse = await fetch(`/api/messagerie/messages?dossierRef=${encodeURIComponent(request.dossier_ref)}`);
      if (messagesResponse.ok) {
        const messagesData = await messagesResponse.json();
        conversationMessages = (messagesData.messages || []).map((msg: ConversationMessage) => ({
          ...msg,
          is_staff: msg.sender_email?.endsWith("@vagondys.com") || false
        }));
      }
      
      // 2. Récupérer les réponses staff
      const staffReplies = await getStaffReplies(request.dossier_ref);
      
      // 3. Construire le payload pour l'archivage (format compatible avec l'API)
      const archivePayload = {
        message: {
          dossier_ref: request.dossier_ref,
          created_at: request.created_at,
          payload: {
            name: request.full_name,
            email: request.email,
            phone: request.phone || null,
            subject: "MESSAGERIE_REQUEST",
            message: request.reason,
            company: request.company,
            kbis_url: request.kbis_url,
            kbis_key: request.kbis_key,
            kbis_validated: request.kbis_validated,
            kbis_scan_result: request.kbis_scan_result,
            status: request.status,
            reviewed_by: request.reviewed_by,
            reviewed_at: request.reviewed_at,
            messages_history: conversationMessages.filter(m => !m.is_staff).map(m => ({
              content: m.content,
              created_at: m.created_at
            }))
          }
        },
        history: staffReplies,
        purgeActive: true,
        city_code: request.city || "MASTER",
        country_code: "FR",
        fullThread: conversationMessages.map(m => ({
          role: m.is_staff ? "staff" : "public",
          sender: m.sender_email,
          content: m.content,
          created_at: m.created_at,
          document_url: m.file_url || null
        }))
      };
      
      console.log(`📦 Archivage GitHub pour ${request.dossier_ref} avec purgeActive=true`);
      
      const response = await fetch("/api/archive-external", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(archivePayload),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || "Erreur lors de l'archivage");
      }
      
      // ✅ Vérifier que la purge a bien été effectuée
      if (result.purged === true) {
        console.log(`✅ Purge effectuée pour ${request.dossier_ref}`);
      } else {
        console.warn(`⚠️ Purge non confirmée pour ${request.dossier_ref}, résultat:`, result);
      }
      
      // Rafraîchir la liste (la demande devrait disparaître)
      await loadRequests();
      alert(`Dossier ${request.dossier_ref} archivé avec succès dans le Coffre-Fort GitHub et purgé des données locales.`);
      
    } catch (err) {
      console.error("Erreur archivage GitHub:", err);
      alert(err instanceof Error ? err.message : "Erreur lors de l'archivage");
    } finally {
      setProcessingId(null);
    }
  };

  // ✅ RESTAURATION DEPUIS GITHUB
  const handleRestoreFromGitHub = async () => {
    if (!searchGitHubRef.trim()) {
      alert("Veuillez saisir une référence de dossier (ex: VGD-XXXXXX)");
      return;
    }
    
    setIsRestoring(true);
    setRestoringRef(searchGitHubRef.trim().toUpperCase());
    
    try {
      const response = await fetch("/api/archive-external/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dossier_ref: searchGitHubRef.trim().toUpperCase(),
          city_code: "MASTER",
          country_code: "FR"
        }),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || "Erreur lors de la restauration");
      }
      
      await loadRequests();
      alert(`Dossier ${searchGitHubRef.trim().toUpperCase()} restauré avec succès depuis le Coffre-Fort GitHub.`);
      setSearchGitHubRef("");
      
    } catch (err) {
      console.error("Erreur restauration:", err);
      alert(err instanceof Error ? err.message : "Erreur lors de la restauration");
    } finally {
      setIsRestoring(false);
      setRestoringRef(null);
    }
  };

  // ✅ EXPANSION AVEC CHARGEMENT DES MESSAGES (via dossierRef)
  const handleExpand = async (request: MessagerieRequest) => {
    if (expandedRequest === request.id) {
      setExpandedRequest(null);
      setMessages([]);
    } else {
      setExpandedRequest(request.id);
      setSelectedRequest(request);
      setMessages([]);
      if (request.dossier_ref) {
        await loadConversationMessages(request.dossier_ref);
      }
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
    if (filterType !== "all" && request.type !== filterType) {
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
            Conversations <span className="text-red-600">Messagerie</span>
          </h1>
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1">
            Gestion des conversations (Partenaires & Joueurs)
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

      {/* Barre de recherche GitHub (Coffre-Fort) */}
      <div className="flex items-center gap-4 bg-black/50 border border-zinc-800 rounded-xl p-3">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
          <input
            type="text"
            placeholder="RECHERCHE COFFRE-FORT GITHUB (VGD-XXXXXX)..."
            value={searchGitHubRef}
            onChange={(e) => setSearchGitHubRef(e.target.value.toUpperCase())}
            className="w-full bg-black border border-zinc-800 rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-red-600 outline-none transition-colors uppercase font-mono"
            title="Rechercher un dossier dans le Coffre-Fort GitHub"
            aria-label="Rechercher un dossier dans le Coffre-Fort GitHub"
          />
        </div>
        <button
          onClick={handleRestoreFromGitHub}
          disabled={isRestoring || !searchGitHubRef.trim()}
          className="flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
        >
          {isRestoring ? (
            <RefreshCcw className="w-4 h-4 animate-spin" />
          ) : (
            <DatabaseBackup className="w-4 h-4" />
          )}
          {isRestoring ? `RESTAURATION ${restoringRef}...` : "RESTAURER DEPUIS COFFRE-FORT"}
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
              <Users className="w-5 h-5 text-blue-500" />
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
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white focus:border-red-600 outline-none cursor-pointer"
          title="Filtrer par type"
          aria-label="Filtrer par type"
        >
          <option value="all">Tous les types</option>
          <option value="partner">Partenaires</option>
          <option value="player">Joueurs</option>
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

      {/* Tableau des conversations */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-zinc-800">
          <h2 className="text-sm font-black uppercase tracking-tighter">
            Liste des <span className="text-red-600">conversations</span>
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800 bg-black/30">
                <th className="text-left p-4 text-[9px] font-black uppercase tracking-widest text-zinc-500">Correspondant</th>
                <th className="text-left p-4 text-[9px] font-black uppercase tracking-widest text-zinc-500">Email</th>
                <th className="text-left p-4 text-[9px] font-black uppercase tracking-widest text-zinc-500">Type</th>
                <th className="text-left p-4 text-[9px] font-black uppercase tracking-widest text-zinc-500">Date</th>
                <th className="text-left p-4 text-[9px] font-black uppercase tracking-widest text-zinc-500">Statut</th>
                <th className="text-left p-4 text-[9px] font-black uppercase tracking-widest text-zinc-500">Dernier message</th>
                <th className="text-left p-4 text-[9px] font-black uppercase tracking-widest text-zinc-500"></th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map((request) => (
                <React.Fragment key={request.id}>
                  <tr className="border-b border-zinc-800/50 hover:bg-white/5 transition-colors cursor-pointer"
                      onClick={() => handleExpand(request)}>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center">
                          <span className="text-xs font-black text-white">
                            {request.full_name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <span className={`text-sm font-black ${request.is_online ? "text-green-500" : "text-white"}`}>
                          {request.full_name}
                        </span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <Mail className="w-3 h-3 text-zinc-500" />
                        <span className="text-xs text-zinc-400">{request.email}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      {getTypeBadge(request.type)}
                    </td>
                    <td className="p-4">
                      <span className="text-[10px] text-zinc-500">{formatDate(request.created_at)}</span>
                    </td>
                    <td className="p-4">
                      {getStatusBadge(request.status)}
                    </td>
                    <td className="p-4">
                      <span className="text-[9px] text-zinc-400 truncate max-w-[150px] block">
                        {request.last_message || "Aucun message"}
                      </span>
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
                      <td colSpan={7} className="p-5">
                        {/* Contenu de l'expansion inchangé - utilise dossier_ref pour les messages */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {/* Colonne gauche : Coordonnées + motif + KBis */}
                          <div className="space-y-4">
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
                              <p className="text-[10px] text-zinc-400 mt-2 pt-2 border-t border-zinc-800/50">
                                <strong className="text-red-600">N° Dossier / Référence:</strong>{' '}
                                <span className="font-mono text-white">{request.dossier_ref || "Non défini"}</span>
                              </p>
                              <p className="text-[10px] text-zinc-400">
                                <strong className="text-blue-500">Type:</strong>{' '}
                                <span className="text-zinc-400">{request.type === "player" ? "Joueur" : "Partenaire"}</span>
                              </p>
                            </div>
                            
                            <div className="space-y-2">
                              <h4 className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Motif de la demande</h4>
                              <div className="bg-black/50 p-3 rounded-xl border border-zinc-800">
                                <p className="text-[11px] text-zinc-300 leading-relaxed">
                                  {request.reason}
                                </p>
                              </div>
                            </div>
                            
                            {request.kbis_url && (
                              <div className="space-y-2">
                                <h4 className="text-[9px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                                  <FileText className="w-3 h-3 text-red-600" />
                                  Justificatif KBis
                                </h4>
                                <div className="bg-black/50 p-3 rounded-xl border border-zinc-800">
                                  <a
                                    href={request.kbis_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 text-red-600 hover:text-red-500 text-[10px] font-black uppercase tracking-wider transition-colors"
                                  >
                                    <Eye className="w-3 h-3" />
                                    Consulter le document
                                  </a>
                                  {request.kbis_validated !== undefined && (
                                    <div className="mt-2 text-[8px]">
                                      {request.kbis_validated ? (
                                        <span className="text-green-500">✓ Document validé par IA</span>
                                      ) : (
                                        <span className="text-yellow-500">⚠️ Document à vérifier manuellement</span>
                                      )}
                                      {request.kbis_scan_result?.confidence && (
                                        <span className="ml-2 text-zinc-500">
                                          (confiance: {Math.round(request.kbis_scan_result.confidence * 100)}%)
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                            
                            <div className="flex flex-wrap gap-2">
                              {request.status !== "pending" && (
                                <button
                                  onClick={() => handleReopen(request)}
                                  disabled={processingId === request.id}
                                  className="flex items-center gap-2 px-3 py-1.5 bg-blue-600/20 border border-blue-600/30 rounded-lg text-[8px] font-black uppercase tracking-widest text-blue-500 hover:bg-blue-600/30 transition-all"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                  Remettre en attente
                                </button>
                              )}
                              
                              <button
                                onClick={() => handleDelete(request)}
                                disabled={processingId === request.id}
                                className="flex items-center gap-2 px-3 py-1.5 bg-red-600/20 border border-red-600/30 rounded-lg text-[8px] font-black uppercase tracking-widest text-red-500 hover:bg-red-600/30 transition-all"
                              >
                                <Trash2 className="w-3 h-3" />
                                Supprimer définitivement
                              </button>
                              
                              <button
                                onClick={() => handleArchiveToGitHub(request)}
                                disabled={processingId === request.id || !request.dossier_ref}
                                className="flex items-center gap-2 px-3 py-1.5 bg-purple-600/20 border border-purple-600/30 rounded-lg text-[8px] font-black uppercase tracking-widest text-purple-500 hover:bg-purple-600/30 transition-all disabled:opacity-50"
                                title={!request.dossier_ref ? "Approuvez d'abord la demande pour obtenir une référence" : "Archiver vers le Coffre-Fort GitHub"}
                              >
                                <DatabaseBackup className="w-3 h-3" />
                                Coffre-Fort GitHub
                              </button>
                            </div>
                          </div>
                          
                          {/* Colonne droite : Fil de discussion */}
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <h4 className="text-[9px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                                <MessageSquare className="w-3 h-3 text-red-600" />
                                Échanges avec le correspondant
                              </h4>
                              <div className="flex items-center gap-2">
                                {request.dossier_ref && (
                                  <button
                                    onClick={() => openExpandedModal(request)}
                                    className="flex items-center gap-1 text-[8px] font-black uppercase text-red-600 hover:text-white transition-colors"
                                    title="Agrandir la conversation"
                                  >
                                    <Maximize2 className="w-3 h-3" />
                                    Agrandir
                                  </button>
                                )}
                              </div>
                            </div>
                            
                            <div className="bg-black/30 rounded-xl border border-zinc-800 p-3 max-h-[300px] overflow-y-auto space-y-3">
                              {loadingMessages ? (
                                <div className="text-center py-4">
                                  <RefreshCcw className="w-4 h-4 text-red-600 animate-spin mx-auto" />
                                </div>
                              ) : messages.length === 0 ? (
                                <p className="text-[8px] text-zinc-500 text-center py-4">
                                  Aucun échange pour l&apos;instant. Soyez le premier à répondre.
                                </p>
                              ) : (
                                messages.map((msg) => (
                                  <div
                                    key={msg.id}
                                    className={`p-2 rounded-lg ${
                                      msg.is_staff
                                        ? "bg-red-600/10 border-l-2 border-red-600"
                                        : "bg-zinc-800/30 border-l-2 border-zinc-600"
                                    }`}
                                  >
                                    <div className="flex justify-between items-center mb-1">
                                      <span className="text-[7px] font-black uppercase text-zinc-500">
                                        {msg.sender_name} {msg.is_staff ? "(Staff)" : ""}
                                      </span>
                                      <span className="text-[6px] text-zinc-600">
                                        {new Date(msg.created_at).toLocaleString()}
                                      </span>
                                    </div>
                                    <p className="text-[9px] text-zinc-300 whitespace-pre-wrap wrap-break-word">
                                      {msg.content}
                                    </p>
                                    {msg.file_url && (
                                      <a
                                        href={msg.file_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-block mt-1 text-[7px] text-red-600 hover:text-red-500"
                                      >
                                        📎 Voir le fichier joint
                                      </a>
                                    )}
                                  </div>
                                ))
                              )}
                            </div>
                            
                            <div className="bg-black/50 rounded-xl border border-zinc-800 p-3 space-y-3">
                              <textarea
                                value={replyContent}
                                onChange={(e) => setReplyContent(e.target.value)}
                                placeholder="Saisissez votre réponse..."
                                rows={3}
                                className="w-full bg-black border border-zinc-800 rounded-lg p-2 text-[10px] text-white focus:border-red-600 outline-none resize-none"
                              />
                              <div className="flex gap-2 justify-end">
                                <button
                                  onClick={handleSendReply}
                                  disabled={sendingReply || !replyContent.trim() || !request.dossier_ref}
                                  className="px-3 py-1 rounded-lg text-[8px] font-black uppercase bg-red-600 hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center gap-1"
                                >
                                  {sendingReply ? (
                                    <RefreshCcw className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <Send className="w-3 h-3" />
                                  )}
                                  Envoyer
                                </button>
                              </div>
                            </div>
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
                              Cette demande a déjà été traitée le {request.reviewed_at ? new Date(request.reviewed_at).toLocaleDateString('fr-FR') : "date inconnue"}.
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

      {/* MODAL D'EXPANSION POUR LE FIL DE DISCUSSION */}
      {isModalOpen && selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/95 backdrop-blur-xl" onClick={closeExpandedModal} />
          <div className="relative w-full max-w-4xl max-h-[90vh] bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-zinc-800">
              <div>
                <h2 className="text-lg font-black uppercase tracking-tighter">
                  Conversation avec <span className="text-red-600">{selectedRequest.full_name}</span>
                </h2>
                <p className="text-[8px] text-zinc-500 uppercase tracking-widest mt-1">
                  {selectedRequest.email} • {selectedRequest.company || "Particulier"} • N° Dossier: <span className="text-red-600 font-mono">{selectedRequest.dossier_ref || "N/A"}</span>
                  <span className="ml-2 text-blue-500">• {selectedRequest.type === "player" ? "Joueur" : "Partenaire"}</span>
                </p>
              </div>
              <button
                onClick={closeExpandedModal}
                className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
                title="Fermer"
              >
                <Minimize2 className="w-5 h-5 text-zinc-500" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-5 space-y-4 max-h-[60vh]">
              {modalMessages.length === 0 ? (
                <div className="text-center py-8">
                  <MessageSquare className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest">
                    Aucun échange pour l&apos;instant.
                  </p>
                  <p className="text-[8px] text-zinc-600 mt-1">
                    Soyez le premier à envoyer un message.
                  </p>
                </div>
              ) : (
                modalMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`p-3 rounded-xl ${
                      msg.is_staff
                        ? "bg-red-600/10 border-l-4 border-red-600 ml-4"
                        : "bg-zinc-800/30 border-l-4 border-zinc-600 mr-4"
                    }`}
                  >
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[8px] font-black uppercase text-zinc-500">
                        {msg.sender_name} {msg.is_staff ? "(Staff VAGONDYS)" : "(Demandeur)"}
                      </span>
                      <span className="text-[7px] text-zinc-600">
                        {new Date(msg.created_at).toLocaleString('fr-FR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-300 leading-relaxed whitespace-pre-wrap wrap-break-word">
                      {msg.content}
                    </p>
                    {msg.file_url && (
                      <a
                        href={msg.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block mt-2 text-[8px] text-red-600 hover:text-red-500"
                      >
                        📎 Voir le fichier joint
                      </a>
                    )}
                  </div>
                ))
              )}
            </div>
            
            <div className="p-5 border-t border-zinc-800 space-y-3">
              <textarea
                value={modalReplyContent}
                onChange={(e) => setModalReplyContent(e.target.value)}
                placeholder="Saisissez votre réponse..."
                rows={3}
                className="w-full bg-black border border-zinc-800 rounded-xl p-3 text-[11px] text-white focus:border-red-600 outline-none resize-none"
              />
              <div className="flex gap-3 justify-end">
                <button
                  onClick={closeExpandedModal}
                  className="px-4 py-2 rounded-lg text-[9px] font-black uppercase bg-zinc-800 hover:bg-zinc-700 transition-colors"
                >
                  Fermer
                </button>
                <button
                  onClick={handleModalSendReply}
                  disabled={modalSendingReply || !modalReplyContent.trim()}
                  className="px-4 py-2 rounded-lg text-[9px] font-black uppercase bg-red-600 hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                  {modalSendingReply ? (
                    <RefreshCcw className="w-3 h-3 animate-spin" />
                  ) : (
                    <Send className="w-3 h-3" />
                  )}
                  Envoyer la réponse
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
