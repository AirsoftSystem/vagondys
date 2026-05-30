
"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { fetchGitHubArchive } from "@/lib/supabase/client";
import { getStaffCity } from "@/actions/staff-actions";
import { 
  Mail, Phone, Clock,
  MessageSquare, Send, X, 
  Link as LinkIcon, ChevronLeft, Archive, History, ChevronDown, ChevronUp,
  RefreshCcw, ShieldCheck, CheckCircle2, Files, DatabaseBackup, Search,
  AlertTriangle,
  User,
} from "lucide-react";
import Link from "next/link";

interface SignalMessage {
  id: string;
  created_at: string;
  confirmed: boolean;
  is_read: boolean;
  dossier_ref: string | null;
  payload: {
    name: string;
    firstname?: string;
    lastname?: string;
    pseudo?: string;
    email: string;
    phone?: string;
    subject: string;
    message: string;
    client_identity?: unknown;
  };
}

interface HistoryMessage {
  id: string;
  created_at: string;
  agent_email: string;
  content: string;
  document_url?: string | null;
  dossier_ref: string;
}

interface ExtendedHistoryMessage extends HistoryMessage {
  is_initial?: boolean;
}

interface GitHubArchiveData {
  dossier: SignalMessage;
  echanges_staff: HistoryMessage[];
  fil_de_discussion?: Array<{
    role?: string;
    sender?: string;
    content?: string;
    created_at?: string;
    is_initial?: boolean;
    id?: string;
    agent_email?: string;
    document_url?: string | null;
    dossier_ref?: string;
  }>;
  date_archivage: string;
  archive_by: string;
}

interface ApiHistoryItem {
  id: string;
  created_at: string;
  agent_email: string;
  content: string;
  dossier_ref: string;
  document_url: string | null;
}

interface ApiHistoryResponse {
  history: ApiHistoryItem[];
  linkedDossiers: string[];
  clientEmail: string | null;
}

export const dynamic = 'force-dynamic';

export default function StaffMessagesPage() {
  // États principaux
  const [messages, setMessages] = useState<SignalMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userCity, setUserCity] = useState<string | null>(null);
  const [userCountry, setUserCountry] = useState<string | null>(null);
  const [view, setView] = useState<"pending" | "archived">("pending");
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());
  
  // États pour l'historique et les réponses
  const [replyingTo, setReplyingTo] = useState<SignalMessage | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [documentLink, setDocumentLink] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isArchiving, setIsArchiving] = useState<string | null>(null);
  const [isMarkingRead, setIsMarkingRead] = useState<string | null>(null);
  const [historyMessages, setHistoryMessages] = useState<ExtendedHistoryMessage[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [linkedDossiers, setLinkedDossiers] = useState<string[]>([]);
  const [clientEmail, setClientEmail] = useState<string | null>(null);
  const [searchRef, setSearchRef] = useState("");
  const [isSearchingExternal, setIsSearchingExternal] = useState(false);
  const [githubArchive, setGithubArchive] = useState<GitHubArchiveData | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  const restoreArchivedDossier = async (dossierRef: string) => {
    if (!userCity) return false;
    
    try {
      const response = await fetch('/api/archive-external/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dossier_ref: dossierRef,
          city_code: userCity,
          country_code: userCountry || 'FR'
        }),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        console.error("❌ Erreur restauration:", result.error);
        return false;
      }
      
      console.log(`✅ Dossier ${dossierRef} restauré avec succès`);
      return true;
      
    } catch (err) {
      console.error("❌ Exception restauration:", err);
      return false;
    }
  };

  // Chargement unique au montage
  useEffect(() => {
    let isMounted = true;
    let isLoading = false;
    
    const loadMessages = async () => {
      if (isLoading) return;
      isLoading = true;
      setLoading(true);
      setError(null);
      
      try {
        const { city, country, email } = await getStaffCity();
        
        if (!isMounted) return;
        
        setUserEmail(email);
        if (city) {
          setUserCity(city);
          setUserCountry(country || "FR");
        }
        
        const response = await fetch(`/api/staff/pending-signals?view=${view}`);
        const result = await response.json();
        
        if (!response.ok) {
          throw new Error(result.error || "Erreur chargement des messages");
        }
        
        if (isMounted) {
          setMessages(result.messages || []);
        }
      } catch (err) {
        console.error("❌ Erreur chargement:", err);
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Erreur inconnue");
        }
      } finally {
        if (isMounted) setLoading(false);
        isLoading = false;
      }
    };
    
    loadMessages();
    
    return () => { isMounted = false; };
  }, [view]);

  // Regroupement des messages
  const groupedMessages = useMemo(() => {
    const groups: Record<string, SignalMessage> = {};
    
    messages.forEach(msg => {
      const key = msg.dossier_ref || msg.payload.email;
      if (!groups[key] || new Date(msg.created_at) > new Date(groups[key].created_at)) {
        groups[key] = msg;
      }
    });

    return Object.values(groups).sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [messages]);

  const formatDisplaySubject = (subject: string) => {
    if (!subject) return "SANS OBJET";
    return subject.split('_')[0].toUpperCase();
  };

  // ✅ Fonction utilitaire pour normaliser une date (supprime les millisecondes pour la comparaison)
  const normalizeDate = (dateStr: string): string => {
    try {
      const date = new Date(dateStr);
      // Normaliser au format ISO sans millisecondes ni fuseau
      return date.toISOString().split('.')[0]; // "2026-05-30T22:50:12"
    } catch {
      return dateStr;
    }
  };

  // ✅ CORRECTION : Dédoublonnage des messages par contenu + date normalisée (évite les collisions de dates)
  // ✅ AJOUT : Extraction des messages client depuis fil_de_discussion de l'archive GitHub
  const fetchHistoryAndLinks = useCallback(async (ref: string) => {
    if (!ref) return;
    setLoadingHistory(true);
    setGithubArchive(null);
    setLinkedDossiers([]);
    setClientEmail(null);
    
    try {
      const response = await fetch(`/api/staff/history?ref=${encodeURIComponent(ref)}`);
      const result: ApiHistoryResponse = await response.json();
      
      if (!response.ok) {
        throw new Error("Erreur chargement historique");
      }
      
      const formattedHistory: ExtendedHistoryMessage[] = (result.history || []).map((item: ApiHistoryItem) => ({
        id: item.id,
        created_at: item.created_at,
        agent_email: item.agent_email,
        content: item.content,
        dossier_ref: item.dossier_ref,
        document_url: item.document_url || null,
        is_initial: false
      }));
      
      const archivedData = await fetchGitHubArchive(ref, userCity || undefined, userCountry || undefined);
      
      // ✅ CORRECTION : Dédoublonnage par clé unique basée sur la date normalisée + contenu complet
      // Cela évite les problèmes de millisecondes ou de formats différents
      const getMessageKey = (msg: { created_at: string; content: string }) => {
        const normalizedDate = normalizeDate(msg.created_at);
        return `${normalizedDate}_${msg.content}`;
      };
      
      const messageMap = new Map<string, ExtendedHistoryMessage>();
      
      // Ajouter les messages de la base STAFF (prioritaires)
      formattedHistory.forEach(msg => {
        const key = getMessageKey(msg);
        if (!messageMap.has(key)) {
          messageMap.set(key, msg);
        }
      });
      
      // ✅ AJOUT : Ajouter les messages client depuis l'archive GitHub (fil_de_discussion)
      if (archivedData && archivedData.fil_de_discussion && archivedData.fil_de_discussion.length > 0) {
        archivedData.fil_de_discussion.forEach(msg => {
          // Ne prendre que les messages client (role === "public")
          if (msg.role === "public" && msg.content && msg.created_at) {
            const key = getMessageKey({ created_at: msg.created_at, content: msg.content });
            if (!messageMap.has(key)) {
              messageMap.set(key, {
                id: `github_client_${normalizeDate(msg.created_at)}`,
                created_at: msg.created_at,
                agent_email: "CLIENT",
                content: msg.content,
                dossier_ref: ref,
                document_url: null,
                is_initial: msg.is_initial === true
              });
            }
          }
        });
        console.log(`📦 GitHub: ${archivedData.fil_de_discussion.filter(m => m.role === "public").length} messages client ajoutés depuis fil_de_discussion`);
      }
      
      // Ajouter les messages staff depuis GitHub (echanges_staff)
      if (archivedData && archivedData.echanges_staff && archivedData.echanges_staff.length > 0) {
        archivedData.echanges_staff.forEach(h => {
          const key = getMessageKey(h);
          if (!messageMap.has(key)) {
            messageMap.set(key, {
              id: h.id,
              created_at: h.created_at,
              agent_email: h.agent_email,
              content: h.content,
              dossier_ref: h.dossier_ref,
              document_url: h.document_url || null,
              is_initial: false
            });
          }
        });
        setGithubArchive(archivedData);
      }
      
      // Convertir la Map en tableau et trier par date (du plus récent au plus ancien)
      const mergedHistory = Array.from(messageMap.values());
      mergedHistory.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      setHistoryMessages(mergedHistory);
      
      if (result.linkedDossiers) {
        setLinkedDossiers(result.linkedDossiers);
      }
      if (result.clientEmail) {
        setClientEmail(result.clientEmail);
      }
      
    } catch (err) {
      console.error("Erreur historique:", err);
      setHistoryMessages([]);
      setLinkedDossiers([]);
      setClientEmail(null);
    } finally {
      setLoadingHistory(false);
    }
  }, [userCity, userCountry]);

  const handleExternalSearch = async () => {
    if (!searchRef.trim()) return;
    setIsSearchingExternal(true);
    setGithubArchive(null);
    
    console.log(`🔍 Recherche externe: ${searchRef} pour ${userCity}/${userCountry}`);
    
    try {
      const archivedData = await fetchGitHubArchive(
        searchRef.trim().toUpperCase(),
        userCity || undefined,
        userCountry || undefined
      );
      
      if (archivedData) {
        console.log(`✅ Archive trouvée pour ${searchRef}`);
        
        setIsRestoring(true);
        const restored = await restoreArchivedDossier(searchRef.trim().toUpperCase());
        if (restored) {
          console.log(`📦 Dossier restauré, rafraîchissement de la vue...`);
          if (view === "archived") {
            const response = await fetch(`/api/staff/pending-signals?view=archived`);
            const result = await response.json();
            if (response.ok) {
              setMessages(result.messages || []);
            }
          }
        }
        setIsRestoring(false);
        
        const mockMsg: SignalMessage = {
          ...archivedData.dossier,
          id: `archived-${archivedData.dossier.dossier_ref}`
        };
        
        // ✅ Extraire également les messages client depuis fil_de_discussion pour l'affichage immédiat
        const allMessages: ExtendedHistoryMessage[] = [];
        
        // Ajouter les messages staff
        if (archivedData.echanges_staff && archivedData.echanges_staff.length > 0) {
          archivedData.echanges_staff.forEach(h => {
            allMessages.push({
              ...h,
              document_url: h.document_url || null,
              is_initial: false
            });
          });
        }
        
        // Ajouter les messages client depuis fil_de_discussion
        if (archivedData.fil_de_discussion && archivedData.fil_de_discussion.length > 0) {
          archivedData.fil_de_discussion.forEach(msg => {
            if (msg.role === "public" && msg.content && msg.created_at) {
              allMessages.push({
                id: `github_client_${normalizeDate(msg.created_at)}`,
                created_at: msg.created_at,
                agent_email: "CLIENT",
                content: msg.content,
                dossier_ref: archivedData.dossier.dossier_ref || "",
                document_url: null,
                is_initial: msg.is_initial === true
              });
            }
          });
        }
        
        // Trier par date (du plus récent au plus ancien)
        allMessages.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        
        setHistoryMessages(allMessages);
        setGithubArchive(archivedData);
        setReplyingTo(mockMsg);
        setLinkedDossiers([]);
        setClientEmail(mockMsg.payload.email);
        
        alert(`Dossier ${searchRef} restauré dans les archives.`);
      } else {
        console.warn(`❌ Aucune archive trouvée pour ${searchRef}`);
        alert("Aucune archive trouvée pour cette référence dans le coffre-fort.");
      }
    } catch (err) {
      console.error("Erreur recherche externe:", err);
      alert("Erreur lors de la recherche d'archive.");
    } finally {
      setIsSearchingExternal(false);
    }
  };

  const handleMarkAsReadSilent = async (msg: SignalMessage) => {
    if (isMarkingRead || !userEmail) return;
    
    const secureRef = msg.dossier_ref ? String(msg.dossier_ref).trim().toUpperCase() : null;
    const secureEmail = msg.payload.email;

    if (!secureRef) {
      alert("Erreur : Référence du dossier manquante.");
      return;
    }

    setIsMarkingRead(msg.id);
    
    try {
      const response = await fetch('/api/notify-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          dossierRef: secureRef,
          email: secureEmail,
          cityCode: userCity,
          countryCode: userCountry || 'FR'
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Erreur mise à jour statut");
      }

      setMessages(prev => prev.filter(m => 
        (m.dossier_ref && m.dossier_ref !== secureRef) && 
        (m.payload.email !== secureEmail)
      ));
      
    } catch (err: unknown) {
      console.error("Erreur lors du marquage comme lu:", err);
      alert(err instanceof Error ? `Erreur : ${err.message}` : "Une erreur inconnue est survenue.");
    } finally {
      setIsMarkingRead(null);
    }
  };

  const toggleExpand = (msg: SignalMessage) => {
    const newExpanded = new Set(expandedMessages);
    if (newExpanded.has(msg.id)) {
      newExpanded.delete(msg.id);
    } else {
      newExpanded.add(msg.id);
    }
    setExpandedMessages(newExpanded);
  };

  // ✅ CORRECTION : Suppression de "history: historyMessages" pour que l'API aille chercher l'historique complet en base
  const handleDeepArchive = async (msg: SignalMessage) => {
    if (!confirm(`ATTENTION : Le dossier ${msg.dossier_ref} va être sauvegardé sur GitHub puis SUPPRIMÉ définitivement des bases actives. Confirmer ?`)) return;
    
    setIsArchiving(msg.id);
    
    try {
      const response = await fetch('/api/archive-external', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: msg, 
          purgeActive: true,
          city_code: userCity,
          country_code: userCountry || 'FR'
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setMessages(prev => prev.filter(m => 
          (m.dossier_ref && m.dossier_ref !== msg.dossier_ref) || 
          (!m.dossier_ref && m.payload.email !== msg.payload.email)
        ));
        setReplyingTo(null);
        alert(result.message || "Sécurisation et purge réussies.");
      } else {
        throw new Error(result.error || "Erreur lors de l'archivage");
      }
    } catch (err) {
      const error = err as Error;
      console.error("Erreur archivage:", error);
      alert(`Échec de la sécurisation : ${error.message}`);
    } finally {
      setIsArchiving(null);
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyingTo || !replyContent || !userEmail) return;
    setIsSending(true);
    
    const sharedId = self.crypto.randomUUID();
    // Suppression du footer - le contenu est identique pour l'email et la base
    const cleanContent = replyContent;

    try {
      const response = await fetch('/api/send-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: sharedId,
          messageId: replyingTo.id,
          to: replyingTo.payload.email,
          subject: replyingTo.payload.subject,
          message: cleanContent,
          agentEmail: userEmail,
          docLink: documentLink,
          dossierRef: replyingTo.dossier_ref,
          cityCode: userCity,
          silent: false
        }),
      });

      if (!response.ok) {
        throw new Error("Erreur lors de l'envoi");
      }

      if (replyingTo.dossier_ref) {
        await fetch('/api/notify-read', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            dossierRef: replyingTo.dossier_ref,
            email: replyingTo.payload.email,
            cityCode: userCity,
            countryCode: userCountry || 'FR'
          }),
        });
      }

      if (view === "pending") {
        setMessages(prev => prev.filter(m => 
          (m.dossier_ref !== replyingTo.dossier_ref) && 
          (m.payload.email !== replyingTo.payload.email)
        ));
      }
      
      window.dispatchEvent(new CustomEvent('staff-message-updated'));
      
      setReplyContent("");
      setDocumentLink("");
      
      if (replyingTo.dossier_ref) {
        await fetchHistoryAndLinks(replyingTo.dossier_ref);
      }
      
      setReplyingTo(null);
      alert("Réponse transmise avec succès.");
      
    } catch (err) {
      console.error(err);
      alert("Échec de la connexion.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20 p-4 font-sans">      
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-900 pb-8">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link href="/staff" className="text-zinc-500 hover:text-white transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </Link>
            <h1 className="text-2xl font-black uppercase tracking-[0.2em] italic text-white">
              Unité <span className="text-red-600">Communication</span>
            </h1>
          </div>
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">
            Agent : {userEmail || "Identification..."} {userCity && `(Station ${userCity}${userCountry ? `, ${userCountry}` : ""})`}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden lg:flex items-center bg-black border border-white/5 rounded-lg px-3 py-1 gap-2 focus-within:border-red-600/50 transition-all">
             <Search className="w-3 h-3 text-zinc-600" />
             <input 
               type="text" 
               placeholder="RECHERCHE COFFRE-FORT..." 
               value={searchRef}
               onChange={(e) => setSearchRef(e.target.value)}
               className="bg-transparent text-[9px] font-black uppercase tracking-widest outline-none text-white w-40 placeholder:text-zinc-800"/>
             <button 
               onClick={handleExternalSearch}
               disabled={isSearchingExternal || isRestoring}
               className="text-[9px] font-black text-red-600 hover:text-white transition-colors">
               {isSearchingExternal || isRestoring ? "..." : "OK"}
             </button>
          </div>
          <div className="flex bg-neutral-900/50 p-1 rounded-lg border border-white/5">
            <button 
              onClick={() => setView("pending")}
              className={`px-6 py-2 rounded-md text-[10px] font-black uppercase tracking-widest transition-all ${view === "pending" ? "bg-red-600 text-white shadow-lg shadow-red-900/20" : "text-zinc-500 hover:text-white"}`}>
              En attente
            </button>
            <button 
              onClick={() => setView("archived")}
              className={`px-6 py-2 rounded-md text-[10px] font-black uppercase tracking-widest transition-all ${view === "archived" ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-white"}`}>
              Archives
            </button>
          </div>
        </div>
      </header>

      <div className="space-y-4">
        {loading ? (
          <div className="py-20 text-center">
            <RefreshCcw className="w-8 h-8 text-red-600 animate-spin mx-auto mb-4" />
            <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 font-bold">Synchronisation du flux...</p>
          </div>
        ) : error ? (
          <div className="py-20 text-center border border-red-600/30 rounded-2xl bg-red-600/5">
            <AlertTriangle className="w-12 h-12 text-red-600 mx-auto mb-4" />
            <p className="text-[10px] uppercase tracking-[0.3em] text-red-500 font-bold">Erreur : {error}</p>
            <button 
              onClick={() => window.location.reload()}
              className="mt-4 text-[9px] text-white border border-white/20 px-4 py-2 rounded-lg hover:bg-white/10"
            >
              Réessayer
            </button>
          </div>
        ) : groupedMessages.length === 0 ? (
          <div className="py-20 text-center border border-dashed border-neutral-900 rounded-2xl">
            <ShieldCheck className="w-12 h-12 text-zinc-800 mx-auto mb-4" />
            <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-600 font-bold font-mono">Aucun signal détecté</p>
          </div>
        ) : (
          groupedMessages.map((msg) => (
            <div 
              key={msg.id} 
              className={`group border transition-all duration-500 overflow-hidden ${expandedMessages.has(msg.id) ? "border-red-600/50 bg-neutral-900/40 rounded-2xl" : "border-neutral-900 bg-neutral-950/50 hover:border-zinc-700 rounded-xl"}`}>
              <div 
                onClick={() => toggleExpand(msg)}
                className="p-5 flex items-center justify-between cursor-pointer"
              >
                <div className="flex items-center gap-6">
                  <div className={`w-2 h-2 rounded-full ${msg.is_read ? "bg-zinc-800" : "bg-red-600 animate-pulse"}`} />
                  <div className="flex flex-col">
                    <h3 className="text-xs font-black uppercase tracking-widest text-white group-hover:text-red-500 transition-colors">
                      {msg.payload.name}
                    </h3>
                    <p className="text-[9px] text-zinc-500 uppercase tracking-tighter mt-1 font-mono">
                      REF: {msg.dossier_ref || "---"} • {formatDisplaySubject(msg.payload.subject)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="hidden md:block text-[9px] text-zinc-600 font-mono italic">
                    {new Date(msg.created_at).toLocaleString()}
                  </span>
                  {expandedMessages.has(msg.id) ? <ChevronUp className="w-4 h-4 text-red-600" /> : <ChevronDown className="w-4 h-4 text-zinc-700" />}
                </div>
              </div>
              {expandedMessages.has(msg.id) && (
                <div className="px-5 pb-5 pt-2 border-t border-neutral-900 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="grid md:grid-cols-3 gap-6 mb-8">
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 text-zinc-400">
                        <Mail className="w-3.5 h-3.5 text-red-600" />
                        <span className="text-[10px] font-bold tracking-widest uppercase">{msg.payload.email}</span>
                      </div>
                      <div className="flex items-center gap-3 text-zinc-400">
                        <Phone className="w-3.5 h-3.5 text-red-600" />
                        <span className="text-[10px] font-bold tracking-widest uppercase">{msg.payload.phone || "Non renseigné"}</span>
                      </div>
                    </div>
                    <div className="md:col-span-2 bg-black/40 p-6 rounded-xl border border-white/5 relative">
                      <MessageSquare className="absolute top-4 right-4 w-4 h-4 text-zinc-800" />
                      <p className="text-xs leading-relaxed text-zinc-300 whitespace-pre-wrap font-medium">
                        {msg.payload.message}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <button 
                      onClick={() => {
                        setReplyingTo(msg);
                        if(msg.dossier_ref) fetchHistoryAndLinks(msg.dossier_ref);
                      }}
                      className="bg-white text-black text-[9px] font-black uppercase tracking-widest px-6 py-3 rounded-md hover:bg-red-600 hover:text-white transition-all flex items-center gap-2">
                      <Send className="w-3 h-3" /> RÉPONDRE / HISTORIQUE
                    </button>                    
                    {!msg.is_read && (
                      <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            handleMarkAsReadSilent(msg);
                        }}
                        disabled={isMarkingRead === msg.id}
                        className="bg-neutral-900 text-zinc-400 text-[9px] font-black uppercase tracking-widest px-6 py-3 rounded-md hover:bg-zinc-800 hover:text-white transition-all flex items-center gap-2 border border-white/5">
                        {isMarkingRead === msg.id ? <RefreshCcw className="w-3 h-3 animate-spin" /> : <Archive className="w-3 h-3" />} MARQUER COMME LU
                      </button>
                    )}
                    {msg.is_read && (
                      <button 
                        disabled={isArchiving === msg.id}
                        onClick={() => handleDeepArchive(msg)}
                        className="bg-red-600/10 text-red-500 text-[9px] font-black uppercase tracking-widest px-6 py-3 rounded-md hover:bg-red-600 hover:text-white transition-all flex items-center gap-2 border border-red-500/20 shadow-lg shadow-red-900/10">
                        {isArchiving === msg.id ? <RefreshCcw className="w-3 h-3 animate-spin" /> : <DatabaseBackup className="w-3 h-3" />}
                        SÉCURISER (ARCHIVE EXTERNE + PURGE)
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {replyingTo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={() => setReplyingTo(null)} />          
          <div className="relative w-full max-w-4xl max-h-[90vh] bg-neutral-950 border border-neutral-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden">
            <div className="p-6 border-b border-neutral-900 flex items-center justify-between bg-neutral-900/20">
              <div className="flex items-center gap-4">
                <div className="flex flex-col">
                  <h2 className="text-sm font-black uppercase tracking-[0.2em] italic flex items-center gap-2 text-white">
                    <History className="w-4 h-4 text-red-600" /> 
                    Fil de discussion <span className="text-zinc-500 font-mono not-italic ml-2">#{replyingTo.dossier_ref}</span>
                  </h2>

                  {clientEmail && (
                    <p className="text-[9px] text-zinc-500 font-mono mt-1">
                      Email client : {clientEmail}
                    </p>
                  )}

                  <div className="mt-2 flex items-center gap-4">
                    <div className="flex flex-col">
                      <div className="text-sm font-black uppercase tracking-tight text-white">
                        {replyingTo.payload.firstname || replyingTo.payload.lastname
                          ? `${replyingTo.payload.firstname ?? ""} ${replyingTo.payload.lastname ?? ""}`.trim()
                          : replyingTo.payload.name}
                      </div>
                      {replyingTo.payload.pseudo && (
                        <div className="text-[10px] text-zinc-400 uppercase tracking-widest font-mono mt-1">
                          Pseudo: {replyingTo.payload.pseudo}
                        </div>
                      )}
                    </div>

                    <div className="ml-4 flex flex-col text-[10px] text-zinc-400">
                      <div className="flex items-center gap-2">
                        <Mail className="w-3 h-3 text-red-600" />
                        <a href={`mailto:${replyingTo.payload.email}`} className="text-zinc-200 hover:text-red-500">{replyingTo.payload.email}</a>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Phone className="w-3 h-3 text-red-600" />
                        <a href={`tel:${replyingTo.payload.phone ?? ""}`} className="text-zinc-200 hover:text-red-500">{replyingTo.payload.phone ?? "N/A"}</a>
                      </div>
                    </div>
                  </div>
                </div>
                {linkedDossiers.length > 0 && (
                  <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-lg border border-white/10 ml-4">
                    <Files className="w-3.5 h-3.5 text-zinc-400" />
                    <span className="text-[9px] font-black text-zinc-400 uppercase">{linkedDossiers.length} Autre(s) dossier(s)</span>
                  </div>
                )}
              </div>
              <button onClick={() => setReplyingTo(null)} className="p-2 hover:bg-white/5 rounded-full transition-colors" title="Fermer la fenêtre">
                <X className="w-5 h-5 text-zinc-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              {githubArchive && (
                <div className="bg-red-600/10 border-2 border-red-600/30 p-5 rounded-2xl flex items-start gap-4 animate-pulse">
                  <AlertTriangle className="w-6 h-6 text-red-600 shrink-0" />
                  <div>
                    <h3 className="text-[11px] font-black uppercase text-red-600 tracking-widest mb-1">Archive Coffre-Fort Détectée</h3>
                    <p className="text-[10px] text-zinc-400 font-medium leading-relaxed">Données sécurisées sur GitHub.</p>
                  </div>
                </div>
              )}

              {linkedDossiers.length > 0 && (
                <div className="space-y-2">
                   <h3 className="text-[9px] font-black uppercase tracking-widest text-zinc-600">Dossiers associés à cet email :</h3>
                   <div className="flex flex-wrap gap-2">
                     {linkedDossiers.map(ref => (
                       <span key={ref} className="text-[9px] font-mono bg-zinc-900 text-zinc-500 px-2 py-1 rounded border border-white/5">#{ref}</span>
                     ))}
                   </div>
                </div>
              )}

              <div className="space-y-4">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-600 flex items-center gap-2">
                  <Clock className="w-3 h-3" /> Chronologie des échanges
                </h3>

                {loadingHistory ? (
                  <div className="text-center py-6">
                    <RefreshCcw className="w-5 h-5 text-red-600 animate-spin mx-auto" />
                  </div>
                ) : historyMessages.length > 0 ? (
                  <div className="space-y-4 ml-4 md:ml-8 border-l-2 border-red-600/10 pl-4 md:pl-8">
                    {historyMessages.map((h, idx) => {
                      const isClient = h.agent_email === "CLIENT";
                      const isInitial = h.is_initial === true;
                      return (
                        <div key={h.id || idx} className={`${isClient ? "bg-zinc-900/50 border-zinc-800" : "bg-red-600/5 border-red-600/20"} border p-4 rounded-2xl relative`}>
                          <div className={`absolute left-[-18px] md:left-[-34px] top-5 w-4 h-4 rounded-full bg-black border-2 ${isClient ? "border-zinc-500" : "border-red-600"} flex items-center justify-center`}>
                            {isClient ? <User className="w-2 h-2 text-zinc-500" /> : <CheckCircle2 className="w-2 h-2 text-red-600" />}
                          </div>
                          <div className="flex justify-between items-center mb-2">
                            <span className={`text-[9px] font-black uppercase tracking-widest flex items-center gap-2 ${isClient ? "text-zinc-400" : "text-white"}`}>
                              {isClient ? (isInitial ? "Message initial" : "Message Client") : `Agent: ${h.agent_email}`}
                            </span>
                            <span className="text-[8px] font-mono text-zinc-500">{new Date(h.created_at).toLocaleString()}</span>
                          </div>
                          <p className={`text-xs leading-relaxed font-medium ${isClient ? "text-zinc-400 italic" : "text-zinc-200"}`}>
                            {h.content}
                          </p>
                          {h.document_url && (
                            <a href={h.document_url} target="_blank" className="inline-flex items-center gap-2 mt-3 text-[9px] font-bold text-red-500 bg-red-500/10 px-3 py-1.5 rounded-lg border border-red-500/20 uppercase hover:bg-red-500 transition-all">
                              <LinkIcon className="w-3 h-3" /> Pièce jointe
                            </a>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 border border-dashed border-white/5 rounded-2xl">
                    <p className="text-[9px] text-zinc-700 uppercase font-bold tracking-[0.3em]">Aucun échange archivé</p>
                  </div>
                )}
              </div>

              <form onSubmit={handleSendReply} className="space-y-6 pt-8 border-t border-neutral-900 mt-12">
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                    <Send className="w-3 h-3 text-red-600" /> Nouvelle Transmission
                  </label>
                  <textarea 
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    required
                    rows={5}
                    className="w-full bg-black border border-neutral-800 rounded-2xl p-5 text-xs text-white focus:border-red-600 outline-none transition-all resize-none placeholder:text-zinc-800 font-medium"
                    placeholder="Saisissez votre réponse..."
                  />
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                      <LinkIcon className="w-3 h-3" /> Pièce jointe (URL)
                    </label>
                    <input 
                      type="url" 
                      value={documentLink}
                      onChange={(e) => setDocumentLink(e.target.value)}
                      className="w-full bg-black border border-neutral-800 rounded-xl p-4 text-[11px] text-white focus:border-red-600 outline-none font-mono"
                      placeholder="https://..."
                    />
                  </div>                  
                  <div className="bg-red-600/5 p-4 rounded-xl border border-red-600/10 flex items-center gap-3 self-end">
                    <ShieldCheck className="w-5 h-5 text-red-600 shrink-0" />
                    <p className="text-[9px] text-zinc-500 uppercase leading-relaxed font-bold tracking-tight"> La réponse sera archivée et synchronisée.
                    </p>
                  </div>
                </div>
                <button 
                  type="submit"
                  disabled={isSending || !replyContent.trim()}
                  className={`w-full bg-red-600 hover:bg-red-700 text-white font-black py-5 rounded-2xl uppercase tracking-[0.3em] text-xs transition-all flex items-center justify-center gap-3 ${isSending ? "opacity-50 cursor-not-allowed" : "active:scale-95 shadow-xl shadow-red-900/40"}`}>
                  {isSending ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {isSending ? "TRANSMISSION EN COURS..." : "ACTIVER L'ENVOI DU SIGNAL"}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
